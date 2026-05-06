package de.floralog.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.util.Log;
import java.io.File;
import com.base44.floralog.ota.OtaUpdateChecker;
import androidx.core.view.WindowCompat;
import android.view.WindowManager;

public class MainActivity extends BridgeActivity {

	private static final String TAG = "MainActivity";

	@Override
	public void onCreate(Bundle savedInstanceState) {
		// Register the OTA plugin before the bridge initialises
		registerPlugin(OtaUpdatePlugin.class);

		super.onCreate(savedInstanceState);

		// Enable edge-to-edge display to handle system bars properly
		WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
		
		// Set status bar and navigation bar to transparent
		getWindow().setStatusBarColor(0x0A0A14); // #141a12 or similar dark color
		getWindow().setNavigationBarColor(0x0A0A14);

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
