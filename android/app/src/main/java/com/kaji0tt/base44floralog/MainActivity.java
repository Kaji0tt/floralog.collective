package com.kaji0tt.base44floralog;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.util.Log;
import java.io.File;

public class MainActivity extends BridgeActivity {

	private static final String TAG = "MainActivity";

	@Override
	public void onCreate(Bundle savedInstanceState) {
		// Register the OTA plugin before the bridge initialises
		registerPlugin(OtaUpdatePlugin.class);

		super.onCreate(savedInstanceState);

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
	}
}
