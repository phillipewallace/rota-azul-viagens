
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e145d80f177c4eb9987fd67c392fc5de',
  appName: 'AlchemyRotas Mobile',
  webDir: 'dist',
  server: {
    url: 'https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com?forceHideBadge=true',
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'admmicban.com.br',
      'https://admmicban.com.br',
      'maps.googleapis.com',
      'https://maps.googleapis.com',
      'maps.google.com',
      'https://maps.google.com'
    ]
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    Geolocation: {
      permissions: {
        location: "always"
      }
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav"
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e40af"
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
