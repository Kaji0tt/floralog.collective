package de.floralog.app;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Capacitor plugin that exposes OTA update operations to JavaScript.
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
@CapacitorPlugin(name = "OtaUpdate")
public class OtaUpdatePlugin extends Plugin {

    private static final String TAG = "OtaUpdatePlugin";
    private OtaManager otaManager;

    @Override
    public void load() {
        otaManager = new OtaManager(getContext());
    }

    // ── getStoredVersion ──────────────────────────────────────────────────────

    @PluginMethod
    public void getStoredVersion(PluginCall call) {
        String version = otaManager.getStoredVersion();
        JSObject result = new JSObject();
        result.put("version", version != null ? version : "");
        call.resolve(result);
    }

    // ── downloadAndApply ──────────────────────────────────────────────────────

    /**
     * Downloads a bundle ZIP, verifies its SHA-256, extracts it, and sets it as the active bundle.
     * The WebView reloads automatically via setServerBasePath.
     *
     * Options:
     *   bundleUrl  – HTTPS URL of the bundle ZIP
     *   version    – version identifier string
     *   sha256     – (optional) expected hex SHA-256 digest for integrity check
     */
    @PluginMethod
    public void downloadAndApply(PluginCall call) {
        final String bundleUrl = call.getString("bundleUrl");
        final String version   = call.getString("version");
        final String sha256    = call.getString("sha256", "");

        if (bundleUrl == null || bundleUrl.isEmpty()) {
            call.reject("bundleUrl is required");
            return;
        }
        if (version == null || version.isEmpty()) {
            call.reject("version is required");
            return;
        }

        new Thread(() -> {
            try {
                Log.d(TAG, "OTA download started: v" + version + " from " + bundleUrl);

                // 1. Download
                File zipFile = otaManager.downloadBundle(bundleUrl,
                        percent -> notifyProgress(percent));

                // 2. Optional integrity check
                if (sha256 != null && !sha256.isEmpty()) {
                    boolean valid = otaManager.verifySha256(zipFile, sha256);
                    if (!valid) {
                        //noinspection ResultOfMethodCallIgnored
                        zipFile.delete();
                        getBridge().getActivity().runOnUiThread(
                                () -> call.reject("SHA-256 verification failed"));
                        return;
                    }
                }

                // 3. Extract
                String extractedPath = otaManager.extractBundle(zipFile, version);
                //noinspection ResultOfMethodCallIgnored
                zipFile.delete();

                // 4. Resolve root and sanity check
                String bundleRootPath = otaManager.resolveBundleRoot(extractedPath);
                if (bundleRootPath == null || bundleRootPath.isEmpty()) {
                    getBridge().getActivity().runOnUiThread(
                            () -> call.reject("Invalid bundle: index.html missing"));
                    return;
                }

                // 5. Persist state
                otaManager.saveActiveBundle(version, bundleRootPath);
                otaManager.cleanupOldBundles(version);

                Log.d(TAG, "OTA bundle staged: " + bundleRootPath);

                // 6. Apply – must run on UI thread
                getBridge().getActivity().runOnUiThread(() -> {
                    try {
                        getBridge().setServerBasePath(bundleRootPath);
                        JSObject result = new JSObject();
                        result.put("success", true);
                        result.put("version", version);
                        result.put("path", bundleRootPath);
                        call.resolve(result);
                    } catch (Exception e) {
                        Log.e(TAG, "setServerBasePath failed", e);
                        call.reject("Failed to apply bundle: " + e.getMessage());
                    }
                });

            } catch (SecurityException e) {
                Log.e(TAG, "OTA security error", e);
                getBridge().getActivity().runOnUiThread(
                        () -> call.reject("Security error: " + e.getMessage()));
            } catch (Exception e) {
                Log.e(TAG, "OTA failed", e);
                getBridge().getActivity().runOnUiThread(
                        () -> call.reject("OTA failed: " + e.getMessage()));
            }
        }).start();
    }

    // ── applyStoredUpdate ─────────────────────────────────────────────────────

    /**
     * Applies an already-downloaded OTA bundle without re-downloading.
     * Useful to call on app restart if the last download completed but reload didn't happen.
     */
    @PluginMethod
    public void applyStoredUpdate(PluginCall call) {
        String activePath = otaManager.getActivePath();
        if (activePath == null || activePath.isEmpty()) {
            call.reject("No stored update available");
            return;
        }
        File indexFile = new File(activePath, "index.html");
        if (!indexFile.exists()) {
            otaManager.clearActiveBundle();
            call.reject("Stored bundle is invalid");
            return;
        }
        try {
            getBridge().setServerBasePath(activePath);
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("path", activePath);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "applyStoredUpdate failed", e);
            call.reject("Apply failed: " + e.getMessage());
        }
    }

    // ── reset ─────────────────────────────────────────────────────────────────

    /**
     * Resets to the app's built-in assets (removes OTA override).
     * The WebView will serve the bundled assets again after the next restart.
     */
    @PluginMethod
    public void reset(PluginCall call) {
        otaManager.clearActiveBundle();
        try {
            // Pass empty string to reset to built-in assets
            getBridge().setServerBasePath("");
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "reset failed", e);
            call.reject("Reset failed: " + e.getMessage());
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void notifyProgress(int percent) {
        JSObject data = new JSObject();
        data.put("progress", percent);
        notifyListeners("downloadProgress", data);
    }
}
