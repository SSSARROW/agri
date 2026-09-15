import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agri.field',
  appName: 'Agri Field',
  webDir: 'dist',
  server: {
    // Dev-only: avoids WebView "Mixed Content" blocking when the app calls the
    // plain-HTTP FastAPI dev server at 10.0.2.2. Switch back to https before shipping.
    androidScheme: 'http',
  },
};

export default config;
