import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.floralog.app',
  appName: 'base44-app',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'DARK',
      // Edge-to-Edge: WebView rendert hinter den System-Bars.
      // Safe-Areas werden app-weit via CSS env(safe-area-inset-*) in #root kompensiert.
      // Kein backgroundColor im Overlay-Modus (wäre wirkungslos/irreführend).
      overlaysWebView: true
    }
  }
};

export default config;
