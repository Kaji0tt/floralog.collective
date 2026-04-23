package com.base44.floralog.ota;

import android.content.Context;
import android.os.AsyncTask;
import java.io.BufferedInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;

public class OtaUpdateChecker {
    public interface OtaUpdateListener {
        void onUpdateAvailable(String version, String url);
        void onNoUpdate();
        void onError(Exception e);
        void onProgress(String message, int percent); // Optional: Fortschritt
        void onBundleActivated(String version, String path);
    }

    private static final String META_URL = "https://<DEIN_R2_ENDPOINT>/latest.json";
    private static final String LOCAL_META = "ota_latest.json";

    public static void checkForUpdateAndApply(Context context, OtaUpdateListener listener) {
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
                    URL url = new URL(META_URL);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    InputStream in = new BufferedInputStream(conn.getInputStream());
                    StringBuilder sb = new StringBuilder();
                    int b;
                    while ((b = in.read()) != -1) sb.append((char) b);
                    JSONObject remoteMeta = new JSONObject(sb.toString());
                    remoteVersion = remoteMeta.getString("version");
                    remoteUrl = remoteMeta.getString("url");
                    remoteHash = remoteMeta.optString("hash", null);

                    // 2. Lese lokale Version
                    File localMetaFile = new File(context.getFilesDir(), LOCAL_META);
                    String localVersion = null;
                    if (localMetaFile.exists()) {
                        FileReader fr = new FileReader(localMetaFile);
                        char[] buf = new char[256];
                        int len = fr.read(buf);
                        JSONObject localMeta = new JSONObject(new String(buf, 0, len));
                        localVersion = localMeta.getString("version");
                        fr.close();
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
                    bundlePath = otaManager.extractBundle(zipFile, remoteVersion);

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
