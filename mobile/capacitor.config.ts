
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e145d80f177c4eb9987fd67c392fc5de',
  appName: 'AlchemyRotas Mobile',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Remover URL fixa para permitir build APK independente
    // url: 'https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Geolocation: {
      permissions: {
        location: "always"
      }
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e40af"
    }
  }
};

export default config;
