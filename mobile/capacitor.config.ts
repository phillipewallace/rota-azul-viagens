
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alchemyrouter.mobile',  
  appName: 'AlchemyRouter',
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
