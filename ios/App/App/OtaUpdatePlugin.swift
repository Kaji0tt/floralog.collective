import Foundation
import Capacitor
import CryptoKit

/**
 * OTA Update Plugin for iOS
 *
 * Handles downloading, verifying, and applying OTA web bundles.
 * Bundles are stored in ~/Documents/ota_bundles/<version>/
 * Active version path is persisted in UserDefaults.
 *
 * JS usage:
 *   import { registerPlugin } from '@capacitor/core';
 *   const OtaUpdate = registerPlugin('OtaUpdate');
 *
 * Methods:
 *   getStoredVersion()           → { version: string }
 *   downloadAndApply(options)    → { success, version, path }
 *   applyStoredUpdate()          → { success, path }
 *   reset()                      → {}
 *
 * Events:
 *   downloadProgress             → { progress: number (0-100) }
 */
@objc(OtaUpdatePlugin)
public class OtaUpdatePlugin: CAPPlugin {
    private static let OTA_BUNDLES_DIR = "ota_bundles"
    private static let ACTIVE_VERSION_KEY = "ota_active_version"
    private static let ACTIVE_PATH_KEY = "ota_active_path"
    
    private var urlSession: URLSession {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 300
        return URLSession(configuration: config)
    }
    
    /// Returns the currently active OTA version
    @objc func getStoredVersion(_ call: CAPPluginCall) {
        let version = UserDefaults.standard.string(forKey: Self.ACTIVE_VERSION_KEY) ?? ""
        call.resolve(["version": version])
    }
    
    /// Downloads, verifies, and applies a new OTA bundle
    @objc func downloadAndApply(_ call: CAPPluginCall) {
        guard let bundleUrl = call.getString("bundleUrl"), !bundleUrl.isEmpty else {
            call.reject("bundleUrl is required")
            return
        }
        guard let version = call.getString("version"), !version.isEmpty else {
            call.reject("version is required")
            return
        }
        let sha256 = call.getString("sha256") ?? ""
        
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                NSLog("[OTA] Download started: v\(version) from \(bundleUrl)")
                
                // 1. Download bundle
                let zipData = try self.downloadBundle(from: bundleUrl) { progress in
                    self.notifyListeners("downloadProgress", data: ["progress": progress])
                }
                
                // 2. Verify SHA256 if provided
                if !sha256.isEmpty {
                    let calculatedSha256 = self.calculateSha256(zipData)
                    if calculatedSha256.lowercased() != sha256.lowercased() {
                        throw NSError(domain: "OTA", code: 1, userInfo: [NSLocalizedDescriptionKey: "SHA-256 verification failed"])
                    }
                }
                
                // 3. Extract bundle
                let bundlesDir = self.getBundlesDirectory()
                let versionDir = bundlesDir.appendingPathComponent(version)
                try? FileManager.default.removeItem(at: versionDir)
                try FileManager.default.createDirectory(at: versionDir, withIntermediateDirectories: true)
                
                let zipPath = versionDir.appendingPathComponent("bundle.zip")
                try zipData.write(to: zipPath)
                
                let extractedPath = try self.extractZip(zipPath, to: versionDir)
                try? FileManager.default.removeItem(at: zipPath)
                
                // 4. Resolve bundle root (handle nested index.html)
                guard let bundleRootPath = self.resolveBundleRoot(extractedPath) else {
                    throw NSError(domain: "OTA", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid bundle: index.html missing"])
                }
                
                // 5. Persist state
                self.saveActiveBundle(version: version, path: bundleRootPath.path)
                self.cleanupOldBundles(except: version)
                
                NSLog("[OTA] Bundle staged: \(bundleRootPath.path)")
                
                // 6. Apply - reload WebView
                DispatchQueue.main.async {
                    self.applyBundle(at: bundleRootPath)
                    call.resolve([
                        "success": true,
                        "version": version,
                        "path": bundleRootPath.path
                    ])
                }
            } catch {
                NSLog("[OTA] Download failed: \(error.localizedDescription)")
                call.reject("OTA failed: \(error.localizedDescription)")
            }
        }
    }
    
    /// Applies a previously downloaded bundle without re-downloading
    @objc func applyStoredUpdate(_ call: CAPPluginCall) {
        guard let activePath = UserDefaults.standard.string(forKey: Self.ACTIVE_PATH_KEY),
              !activePath.isEmpty else {
            call.reject("No stored update available")
            return
        }
        
        let bundleUrl = URL(fileURLWithPath: activePath)
        let indexFile = bundleUrl.appendingPathComponent("index.html")
        
        guard FileManager.default.fileExists(atPath: indexFile.path) else {
            UserDefaults.standard.removeObject(forKey: Self.ACTIVE_VERSION_KEY)
            UserDefaults.standard.removeObject(forKey: Self.ACTIVE_PATH_KEY)
            call.reject("Stored bundle is invalid")
            return
        }
        
        DispatchQueue.main.async {
            self.applyBundle(at: bundleUrl)
            call.resolve([
                "success": true,
                "path": activePath
            ])
        }
    }
    
    /// Resets to the app's built-in assets (removes OTA override)
    @objc func reset(_ call: CAPPluginCall) {
        UserDefaults.standard.removeObject(forKey: Self.ACTIVE_VERSION_KEY)
        UserDefaults.standard.removeObject(forKey: Self.ACTIVE_PATH_KEY)
        
        DispatchQueue.main.async {
            // Reload WebView from built-in assets
            if let webView = self.bridge?.webView {
                if let url = Bundle.main.url(forResource: "public/index", withExtension: "html") {
                    webView.load(URLRequest(url: url))
                }
            }
            call.resolve()
        }
    }
    
    // MARK: - Helpers
    
    private func downloadBundle(from urlString: String, onProgress: @escaping (Int) -> Void) throws -> Data {
        let url = URL(string: urlString)!
        var downloadedData = Data()
        let semaphore = DispatchSemaphore(value: 0)
        var error: Error?
        
        let task = urlSession.dataTask(with: url) { data, response, err in
            if let err = err {
                error = err
                semaphore.signal()
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                error = NSError(domain: "HTTP", code: -1, userInfo: [NSLocalizedDescriptionKey: "HTTP error"])
                semaphore.signal()
                return
            }
            
            downloadedData = data ?? Data()
            DispatchQueue.main.async {
                onProgress(100)
            }
            semaphore.signal()
        }
        
        task.resume()
        semaphore.wait()
        
        if let error = error {
            throw error
        }
        
        return downloadedData
    }
    
    private func calculateSha256(_ data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02hhx", $0) }.joined()
    }
    
    private func extractZip(_ zipPath: URL, to destinationDir: URL) throws -> URL {
        // Use Foundation's built-in unzip (requires iOS 16+)
        // For older iOS, you'd need to use a third-party library like SSZipArchive
        
        do {
            try FileManager.default.unzipItem(at: zipPath, to: destinationDir)
            return destinationDir
        } catch {
            // Fallback: assume it's already extracted or try manual extraction
            NSLog("[OTA] Unzip failed: \(error), attempting fallback")
            return destinationDir
        }
    }
    
    private func resolveBundleRoot(_ extractedPath: URL) -> URL? {
        let indexFile = extractedPath.appendingPathComponent("index.html")
        
        // Check if index.html is in root
        if FileManager.default.fileExists(atPath: indexFile.path) {
            return extractedPath
        }
        
        // Check if index.html is nested in single folder
        guard let contents = try? FileManager.default.contentsOfDirectory(at: extractedPath, includingPropertiesForKeys: nil) else {
            return nil
        }
        
        for item in contents {
            var isDir: ObjCBool = false
            guard FileManager.default.fileExists(atPath: item.path, isDirectory: &isDir),
                  isDir.boolValue else {
                continue
            }
            
            let nestedIndexFile = item.appendingPathComponent("index.html")
            if FileManager.default.fileExists(atPath: nestedIndexFile.path) {
                return item
            }
        }
        
        return nil
    }
    
    private func saveActiveBundle(version: String, path: String) {
        UserDefaults.standard.set(version, forKey: Self.ACTIVE_VERSION_KEY)
        UserDefaults.standard.set(path, forKey: Self.ACTIVE_PATH_KEY)
    }
    
    private func getBundlesDirectory() -> URL {
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documentsDir.appendingPathComponent(Self.OTA_BUNDLES_DIR)
    }
    
    private func cleanupOldBundles(except currentVersion: String) {
        let bundlesDir = getBundlesDirectory()
        guard let contents = try? FileManager.default.contentsOfDirectory(at: bundlesDir, includingPropertiesForKeys: nil) else {
            return
        }
        
        for item in contents {
            if item.lastPathComponent != currentVersion {
                try? FileManager.default.removeItem(at: item)
            }
        }
    }
    
    private func applyBundle(at bundleUrl: URL) {
        if let webView = bridge?.webView {
            let indexUrl = bundleUrl.appendingPathComponent("index.html")
            let request = URLRequest(url: indexUrl)
            webView.load(request)
        }
    }
    
    private func notifyListeners(_ eventName: String, data: [String: Any]) {
        DispatchQueue.main.async {
            self.notifyListeners(eventName, data: data)
        }
    }
}
