
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.e145d80f177c4eb9987fd67c392fc5de',
  appName: 'AlchemyRotas',
  webDir: 'dist',
  server: {
    url: 'http://admmicban.com.br',
    cleartext: true
  },
  plugins: {
    Geolocation: {
      permissions: {
        location: "always"
      }
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF"
    }
  }
};

export default config;
