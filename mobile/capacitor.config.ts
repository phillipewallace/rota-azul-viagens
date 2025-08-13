
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e145d80f177c4eb9987fd67c392fc5de',
  appName: 'AlchemyRotas',
  webDir: 'dist',
  server: {
    url: 'https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com?forceHideBadge=true',
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com',
      'https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com'
    ]
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#1e40af'
  },
  plugins: {
    Geolocation: {
      permissions: {
        location: "always"
      }
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e40af",
      showSpinner: false
    },
    CapacitorHttp: {
      enabled: true
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#1e40af"
    },
    App: {
      enabled: true
    },
    Device: {
      enabled: true
    }
  }
};

export default config;
