
import { Geolocation, Position } from '@capacitor/geolocation';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';

class BackgroundTrackingService {
  private watchId: string | null = null;
  private isTracking = false;
  private trackingInterval: NodeJS.Timeout | null = null;
  private lastPosition: Position | null = null;
  private apiUrl = 'https://admmicban.com.br/api';

  async startTracking(driverId: string, routeId?: string) {
    console.log('🚛 Iniciando rastreamento obrigatório para motorista:', driverId);
    
    if (this.isTracking) {
      console.log('⚠️ Rastreamento já ativo');
      return;
    }

    try {
      // Verificar permissões
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          throw new Error('Permissões de localização são obrigatórias para o trabalho');
        }
      }

      // Configurar notificação persistente
      await this.setupPersistentNotification();

      // Iniciar rastreamento contínuo
      this.isTracking = true;
      await this.startContinuousTracking(driverId, routeId);

      // Monitorar estado do app
      this.setupAppStateHandlers(driverId, routeId);

      console.log('✅ Rastreamento obrigatório iniciado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao iniciar rastreamento:', error);
      throw error;
    }
  }

  private async startContinuousTracking(driverId: string, routeId?: string) {
    // Rastreamento de alta precisão a cada 15 segundos
    this.trackingInterval = setInterval(async () => {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        });

        this.lastPosition = position;
        await this.sendLocationUpdate(driverId, position, routeId);
        
        console.log('📍 Localização enviada:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });

      } catch (error) {
        console.error('❌ Erro ao obter localização:', error);
        // Tentar novamente em caso de erro
        this.retryLocationUpdate(driverId, routeId);
      }
    }, 15000); // A cada 15 segundos
  }

  private async sendLocationUpdate(driverId: string, position: Position, routeId?: string) {
    try {
      const deviceInfo = await Device.getInfo();
      
      const locationData = {
        driverId,
        routeId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        altitude: position.coords.altitude,
        timestamp: new Date(position.timestamp).toISOString(),
        deviceInfo: {
          platform: deviceInfo.platform,
          model: deviceInfo.model,
          operatingSystem: deviceInfo.operatingSystem,
          osVersion: deviceInfo.osVersion
        }
      };

      const response = await fetch(`${this.apiUrl}/mobile/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(locationData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Localização sincronizada com servidor');
    } catch (error) {
      console.error('❌ Erro ao enviar localização:', error);
      // Armazenar offline para sincronização posterior
      this.storeOfflineLocation(driverId, position, routeId);
    }
  }

  private async retryLocationUpdate(driverId: string, routeId?: string) {
    // Tentar obter localização novamente após 5 segundos
    setTimeout(async () => {
      if (this.isTracking) {
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false, // Usar precisão menor na tentativa
            timeout: 15000,
            maximumAge: 10000
          });
          
          await this.sendLocationUpdate(driverId, position, routeId);
        } catch (error) {
          console.error('❌ Falha na nova tentativa:', error);
        }
      }
    }, 5000);
  }

  private storeOfflineLocation(driverId: string, position: Position, routeId?: string) {
    const offlineData = {
      driverId,
      routeId,
      position,
      timestamp: Date.now()
    };
    
    // Armazenar no localStorage para sincronização posterior
    const stored = localStorage.getItem('offline_locations') || '[]';
    const locations = JSON.parse(stored);
    locations.push(offlineData);
    localStorage.setItem('offline_locations', JSON.stringify(locations));
    
    console.log('💾 Localização armazenada offline');
  }

  private async setupPersistentNotification() {
    try {
      await LocalNotifications.requestPermissions();
      
      const notification: LocalNotificationSchema = {
        id: 1,
        title: 'AlchemyRotas - Rastreamento Ativo',
        body: 'Localização sendo monitorada continuamente',
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#1e40af'
      };

      await LocalNotifications.schedule({
        notifications: [notification]
      });

      console.log('🔔 Notificação persistente configurada');
    } catch (error) {
      console.error('❌ Erro ao configurar notificação:', error);
    }
  }

  private setupAppStateHandlers(driverId: string, routeId?: string) {
    // Monitorar quando app vai para background
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('📱 Estado do app mudou:', isActive ? 'ativo' : 'background');
      
      if (!isActive && this.isTracking) {
        console.log('⏰ App em background - mantendo rastreamento');
        // Continuar rastreamento em background
        this.maintainBackgroundTracking(driverId, routeId);
      }
    });

    // Monitorar quando app é resumido
    App.addListener('resume', () => {
      console.log('🔄 App resumido - verificando rastreamento');
      if (this.isTracking) {
        this.syncOfflineLocations();
      }
    });
  }

  private async maintainBackgroundTracking(driverId: string, routeId?: string) {
    // Manter um intervalo de tracking mesmo em background
    // No Android, isso funciona por alguns minutos
    console.log('🔄 Mantendo rastreamento em background');
  }

  private async syncOfflineLocations() {
    try {
      const stored = localStorage.getItem('offline_locations');
      if (!stored) return;

      const locations = JSON.parse(stored);
      if (locations.length === 0) return;

      console.log(`🔄 Sincronizando ${locations.length} localizações offline`);

      for (const location of locations) {
        await this.sendLocationUpdate(location.driverId, location.position, location.routeId);
      }

      // Limpar localizações sincronizadas
      localStorage.removeItem('offline_locations');
      console.log('✅ Sincronização offline concluída');

    } catch (error) {
      console.error('❌ Erro na sincronização offline:', error);
    }
  }

  async stopTracking() {
    console.log('🛑 Interrompendo rastreamento');
    
    this.isTracking = false;
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    if (this.watchId) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }

    // Remover notificação
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    
    console.log('✅ Rastreamento interrompido');
  }

  getTrackingStatus() {
    return {
      isTracking: this.isTracking,
      lastPosition: this.lastPosition,
      lastUpdate: this.lastPosition ? new Date(this.lastPosition.timestamp).toLocaleString() : null
    };
  }

  // Método para forçar rastreamento (sem possibilidade de desativação pelo usuário)
  async enforceTracking(driverId: string, routeId?: string) {
    if (!this.isTracking) {
      await this.startTracking(driverId, routeId);
    }
  }
}

export const backgroundTracker = new BackgroundTrackingService();
