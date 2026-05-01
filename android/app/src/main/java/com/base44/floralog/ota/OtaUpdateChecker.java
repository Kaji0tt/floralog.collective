package com.base44.floralog.ota;

import android.content.Context;
import android.os.AsyncTask;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;

import de.floralog.app.R;

public class OtaUpdateChecker {
    public interface OtaUpdateListener {
        void onUpdateAvailable(String version, String url);
        void onNoUpdate();
        void onError(Exception e);
        void onProgress(String message, int percent); // Optional: Fortschritt
        void onBundleActivated(String version, String path);
    }

    private static final String DEFAULT_META_URL = "https://floralog-ota.green-term-27d0.workers.dev/version.json?platform=android";
    private static final String LOCAL_META = "ota_latest.json";

    private static String resolveManifestUrl(Context context) {
        try {
            String fromResources = context.getString(R.string.ota_manifest_url);
            if (fromResources != null) {
                String trimmed = fromResources.trim();
                if (!trimmed.isEmpty() && !trimmed.contains("PLACEHOLDER")) {
                    return trimmed;
                }
            }
        } catch (Exception ignored) {
            // Fallback below
        }
        return DEFAULT_META_URL;
    }

    public static void checkForUpdateAndApply(Context context, OtaUpdateListener listener) {
        final String manifestUrl = resolveManifestUrl(context);
        new AsyncTask<Void, String, Boolean>() {
            Exception error;
            String remoteVersion = null;
            String remoteUrl = null;
            String remoteHash = null;
            String bundlePath = null;

            @Override
            protected Boolean doInBackground(Void... voids) {
                try {
                    // 1. Lade remote Metadatei
                    publishProgress("Lade Metadatei", 0+"");
                    URL url = new URL(manifestUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    InputStream in = new BufferedInputStream(conn.getInputStream());
                    StringBuilder sb = new StringBuilder();
                    int b;
                    while ((b = in.read()) != -1) sb.append((char) b);
                    JSONObject remoteMeta = new JSONObject(sb.toString());
                    remoteVersion = remoteMeta.getString("version");
                    remoteUrl = remoteMeta.optString("bundleUrl", remoteMeta.optString("url", null));
                    remoteHash = remoteMeta.optString("sha256", remoteMeta.optString("hash", null));

                    if (remoteUrl == null || remoteUrl.isEmpty()) {
                        throw new Exception("Manifest missing bundle URL (bundleUrl/url)");
                    }

                    // 2. Lese lokale Version
                    File localMetaFile = new File(context.getFilesDir(), LOCAL_META);
                    String localVersion = null;
                    if (localMetaFile.exists()) {
                        StringBuilder localRaw = new StringBuilder();
                        try (BufferedReader fr = new BufferedReader(new FileReader(localMetaFile))) {
                            String line;
                            while ((line = fr.readLine()) != null) {
                                localRaw.append(line);
                            }
                        }
                        if (localRaw.length() > 0) {
                            JSONObject localMeta = new JSONObject(localRaw.toString());
                            localVersion = localMeta.optString("version", null);
                        }
                    }

                    // 3. Vergleiche Versionen
                    if (localVersion != null && localVersion.equals(remoteVersion)) {
                        return false; // Kein Update
                    }

                    // 4. Download Bundle
                    publishProgress("Lade Bundle", 10+"");
                    de.floralog.app.OtaManager otaManager = new de.floralog.app.OtaManager(context);
                    File zipFile = otaManager.downloadBundle(remoteUrl, percent -> publishProgress("Download", 10 + percent/2 + ""));

                    // 5. Verifikation
                    if (remoteHash != null && !remoteHash.isEmpty()) {
                        publishProgress("Prüfe Integrität", 60+"");
                        boolean ok = otaManager.verifySha256(zipFile, remoteHash);
                        if (!ok) throw new Exception("Hash mismatch beim OTA-Bundle");
                    }

                    // 6. Entpacken
                    publishProgress("Entpacke Bundle", 80+"");
                    String extractedPath = otaManager.extractBundle(zipFile, remoteVersion);
                    String resolvedRoot = otaManager.resolveBundleRoot(extractedPath);
                    if (resolvedRoot == null || resolvedRoot.isEmpty()) {
                        throw new Exception("Invalid bundle: index.html missing");
                    }
                    bundlePath = resolvedRoot;

                    // 7. Aktivieren
                    otaManager.saveActiveBundle(remoteVersion, bundlePath);
                    otaManager.cleanupOldBundles(remoteVersion);

                    // 8. Schreibe neue Metadatei
                    FileWriter fw = new FileWriter(localMetaFile);
                    fw.write(remoteMeta.toString());
                    fw.close();

                    return true;
                } catch (Exception e) {
                    error = e;
                    return false;
                }
            }

            @Override
            protected void onProgressUpdate(String... values) {
                if (listener != null && values.length >= 2) {
                    try {
                        int percent = Integer.parseInt(values[1]);
                        listener.onProgress(values[0], percent);
                    } catch (Exception ignore) {}
                }
            }

            @Override
            protected void onPostExecute(Boolean updated) {
                if (error != null) {
                    listener.onError(error);
                } else if (updated) {
                    listener.onUpdateAvailable(remoteVersion, remoteUrl);
                    listener.onBundleActivated(remoteVersion, bundlePath);
                } else {
                    listener.onNoUpdate();
                }
            }
        }.execute();
    }
}
