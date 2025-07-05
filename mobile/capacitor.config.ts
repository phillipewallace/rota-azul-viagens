
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'Rotas.Alchemy.com',
  appName: 'AlchemyRotas',
  webDir: 'dist',
  plugins: {
    Geolocation: {
      permissions: {
        location: "always"
      }
    }
  }
};

export default config;
