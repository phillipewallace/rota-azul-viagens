
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e145d80f177c4eb9987fd67c392fc5de',
  appName: 'AlchemyRotas Mobile',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'admmicban.com.br',
      'https://admmicban.com.br',
      'maps.googleapis.com',
      'https://maps.googleapis.com',
      'maps.google.com',
      'https://maps.google.com',
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
      showSpinner: true,
      spinnerColor: "#ffffff"
    },
    CapacitorHttp: {
      enabled: true
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#1e40af",
      sound: "beep.wav"
    },
    App: {
      enabled: true
    },
    Device: {
      enabled: true
    },
    BackgroundMode: {
      enabled: true,
      title: "AlchemyRotas",
      text: "Sistema de rastreamento ativo",
      silent: false
    }
  }
};

export default config;
