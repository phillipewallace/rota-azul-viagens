
import { LocalNotifications } from '@capacitor/local-notifications';

export class BackgroundNotificationManager {
  private static NOTIFICATION_ID = 'alchemyrotas-tracking';
  
  static async requestPermissions() {
    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  static async showTrackingNotification(truckName: string) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('⚠️ Notification permissions not granted');
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'AlchemyRotas-Ativo',
            body: `Rastreamento ativo - ${truckName}`,
            id: 1,
            ongoing: true,
            autoCancel: false,
            extra: {
              type: 'tracking',
              truckName
            }
          }
        ]
      });

      console.log('✅ [NOTIFICATION] Tracking notification scheduled');
    } catch (error) {
      console.error('❌ Error showing tracking notification:', error);
    }
  }

  static async hideTrackingNotification() {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: 1 }]
      });
      console.log('✅ [NOTIFICATION] Tracking notification cancelled');
    } catch (error) {
      console.error('❌ Error hiding tracking notification:', error);
    }
  }

  static async updateTrackingNotification(truckName: string, status: string) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'AlchemyRotas-Ativo',
            body: `${status} - ${truckName}`,
            id: 1,
            ongoing: true,
            autoCancel: false,
            extra: {
              type: 'tracking',
              truckName,
              status
            }
          }
        ]
      });
      console.log('✅ [NOTIFICATION] Tracking notification updated');
    } catch (error) {
      console.error('❌ Error updating tracking notification:', error);
    }
  }
}
