import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.floralog.app',
  appName: 'base44-app',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#141a12',
      overlaysWebView: true
    }
  }
};

export default config;
