package de.floralog.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.util.Log;
import androidx.core.view.WindowCompat;
import java.io.File;
import com.base44.floralog.ota.OtaUpdateChecker;

public class MainActivity extends BridgeActivity {

	private static final String TAG = "MainActivity";

	@Override
	public void onCreate(Bundle savedInstanceState) {
		// Register the OTA plugin before the bridge initialises
		registerPlugin(OtaUpdatePlugin.class);

		super.onCreate(savedInstanceState);

		// Edge-to-Edge: WebView rendert hinter Status- und Navigationsleiste.
		// CSS env(safe-area-inset-*) (siehe #root in index.css) übernimmt das Padding.
		// setStatusBarColor/setNavigationBarColor sind seit API 35 deprecated und
		// werden bei targetSdk 35+ zu No-Ops (Play Console meldet sie als nicht mehr
		// unterstützte EdgeToEdge-APIs) – das System liefert die transparenten Bars
		// bei erzwungenem Edge-to-Edge bereits selbst.
		WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

		// Apply a previously staged OTA bundle so the WebView loads from it
		OtaManager otaManager = new OtaManager(this);
		String activePath = otaManager.getActivePath();
		if (activePath != null && !activePath.isEmpty()) {
			File indexFile = new File(activePath, "index.html");
			if (indexFile.exists()) {
				Log.i(TAG, "Applying OTA bundle: " + activePath);
				getBridge().setServerBasePath(activePath);
			} else {
				Log.w(TAG, "OTA bundle missing index.html – reverting to built-in assets");
				otaManager.clearActiveBundle();
			}
		}

		// OTA-Update-Check und Anwendung beim Start
		OtaUpdateChecker.checkForUpdateAndApply(this, new OtaUpdateChecker.OtaUpdateListener() {
			@Override
			public void onUpdateAvailable(String version, String url) {
				Log.i(TAG, "OTA Update verfügbar: Version " + version + ", URL: " + url);
			}

			@Override
			public void onNoUpdate() {
				Log.i(TAG, "Kein OTA-Update verfügbar.");
			}

			@Override
			public void onError(Exception e) {
				Log.e(TAG, "OTA-Update-Check Fehler", e);
			}

			@Override
			public void onProgress(String message, int percent) {
				Log.d(TAG, "OTA Fortschritt: " + message + " (" + percent + "%)");
			}

			@Override
			public void onBundleActivated(String version, String path) {
				Log.i(TAG, "OTA-Bundle aktiviert: " + version + ", Pfad: " + path);
				// Optional: Neustart oder Hinweis an UI
			}
		});
	}
}
