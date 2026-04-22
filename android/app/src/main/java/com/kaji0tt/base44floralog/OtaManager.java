package com.kaji0tt.base44floralog;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * OtaManager handles downloading, extracting, and bookkeeping of OTA web bundles.
 * Bundles are stored under getFilesDir()/ota_bundles/<version>/.
 * The active version path is persisted in SharedPreferences.
 */
public class OtaManager {

    private static final String TAG = "OtaManager";
    private static final String PREFS_NAME = "OtaPrefs";
    private static final String KEY_CURRENT_VERSION = "currentVersion";
    private static final String KEY_ACTIVE_PATH = "activePath";
    private static final String OTA_DIR_NAME = "ota_bundles";

    private final Context context;

    public OtaManager(Context context) {
        this.context = context.getApplicationContext();
    }

    // ── Preferences ──────────────────────────────────────────────────────────

    private SharedPreferences getPrefs() {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public String getStoredVersion() {
        return getPrefs().getString(KEY_CURRENT_VERSION, null);
    }

    public String getActivePath() {
        return getPrefs().getString(KEY_ACTIVE_PATH, null);
    }

    public void saveActiveBundle(String version, String path) {
        getPrefs().edit()
                .putString(KEY_CURRENT_VERSION, version)
                .putString(KEY_ACTIVE_PATH, path)
                .apply();
    }

    public void clearActiveBundle() {
        getPrefs().edit()
                .remove(KEY_CURRENT_VERSION)
                .remove(KEY_ACTIVE_PATH)
                .apply();
    }

    // ── Directories ───────────────────────────────────────────────────────────

    public File getOtaDir() {
        File dir = new File(context.getFilesDir(), OTA_DIR_NAME);
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return dir;
    }

    /** Sanitized versioned bundle directory, e.g. ota_bundles/v_20260422120000 */
    public File getBundleDir(String version) {
        String safeName = "v_" + version.replaceAll("[^a-zA-Z0-9_\\-]", "_");
        return new File(getOtaDir(), safeName);
    }

    // ── Download ──────────────────────────────────────────────────────────────

    /**
     * Downloads a bundle ZIP from the given HTTPS URL to a temporary cache file.
     * Reports integer progress (0–100) via the supplied listener.
     */
    public File downloadBundle(String bundleUrl, ProgressListener listener) throws IOException {
        File tempFile = File.createTempFile("ota_bundle_", ".zip", context.getCacheDir());
        URL url = new URL(bundleUrl);

        if (!url.getProtocol().equals("https")) {
            throw new SecurityException("OTA bundle URL must use HTTPS");
        }

        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(90_000);
        conn.connect();

        int fileLength = conn.getContentLength();
        try (InputStream input = new BufferedInputStream(conn.getInputStream());
             FileOutputStream output = new FileOutputStream(tempFile)) {

            byte[] buf = new byte[8192];
            long total = 0;
            int count;
            while ((count = input.read(buf)) != -1) {
                total += count;
                output.write(buf, 0, count);
                if (listener != null && fileLength > 0) {
                    listener.onProgress((int) (total * 100 / fileLength));
                }
            }
        } finally {
            conn.disconnect();
        }
        return tempFile;
    }

    // ── Verification ──────────────────────────────────────────────────────────

    /** Returns true if the file's SHA-256 hex digest matches expectedHex (case-insensitive). */
    public boolean verifySha256(File file, String expectedHex) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buf = new byte[8192];
            int count;
            while ((count = fis.read(buf)) != -1) {
                digest.update(buf, 0, count);
            }
        }
        byte[] hashBytes = digest.digest();
        StringBuilder sb = new StringBuilder(64);
        for (byte b : hashBytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString().equalsIgnoreCase(expectedHex);
    }

    // ── Extract ───────────────────────────────────────────────────────────────

    /**
     * Extracts a ZIP bundle into the versioned directory.
     * Performs a zip-slip check on every entry.
     *
     * @return absolute path of the extracted directory (contains index.html at root)
     */
    public String extractBundle(File zipFile, String version) throws IOException {
        File destDir = getBundleDir(version);
        if (destDir.exists()) {
            deleteRecursive(destDir);
        }
        //noinspection ResultOfMethodCallIgnored
        destDir.mkdirs();

        String canonicalDest = destDir.getCanonicalPath() + File.separator;

        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
            ZipEntry entry;
            byte[] buf = new byte[8192];

            while ((entry = zis.getNextEntry()) != null) {
                File outFile = new File(destDir, entry.getName());

                // Zip-slip guard
                if (!outFile.getCanonicalPath().startsWith(canonicalDest)) {
                    throw new IOException("Zip-slip attempt blocked: " + entry.getName());
                }

                if (entry.isDirectory()) {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.mkdirs();
                } else {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.getParentFile().mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        int len;
                        while ((len = zis.read(buf)) > 0) {
                            fos.write(buf, 0, len);
                        }
                    }
                }
                zis.closeEntry();
            }
        }
        return destDir.getAbsolutePath();
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    /** Removes all bundle directories except the one matching activeVersion. */
    public void cleanupOldBundles(String activeVersion) {
        File otaDir = getOtaDir();
        File[] dirs = otaDir.listFiles();
        if (dirs == null) return;

        String keepName = "v_" + activeVersion.replaceAll("[^a-zA-Z0-9_\\-]", "_");
        for (File dir : dirs) {
            if (dir.isDirectory() && !dir.getName().equals(keepName)) {
                deleteRecursive(dir);
                Log.d(TAG, "Removed old bundle: " + dir.getName());
            }
        }
    }

    private void deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursive(child);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    // ── Listener ──────────────────────────────────────────────────────────────

    public interface ProgressListener {
        void onProgress(int percent);
    }
}
