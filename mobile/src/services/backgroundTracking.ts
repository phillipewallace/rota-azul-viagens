
import { CapacitorConfig } from '@capacitor/cli';
import { BackgroundMode } from '@capacitor/background-mode';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Device } from '@capacitor/device';

class BackgroundTracker {
  private isTracking = false;
  private trackingInterval: number | null = null;
  private currentTruckId: string | null = null;
  private currentRouteId: string | null = null;
  private lastPosition: { lat: number; lng: number; timestamp: number } | null = null;
  private trackingData: Array<{ lat: number; lng: number; timestamp: number }> = [];

  async enforceTracking(truckId: string, routeId?: string): Promise<void> {
    try {
      console.log('🎯 [TRACKER] Iniciando rastreamento obrigatório para caminhão:', truckId);
      
      this.currentTruckId = truckId;
      this.currentRouteId = routeId || null;
      
      // Solicitar permissões necessárias
      await this.requestPermissions();
      
      // Configurar modo background
      await this.setupBackgroundMode();
      
      // Configurar notificação persistente
      await this.setupPersistentNotification();
      
      // Iniciar rastreamento
      await this.startLocationTracking();
      
      this.isTracking = true;
      console.log('✅ [TRACKER] Rastreamento obrigatório ativado com sucesso');
      
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao ativar rastreamento obrigatório:', error);
      throw new Error('Não foi possível ativar o rastreamento obrigatório. Verifique as permissões do aplicativo.');
    }
  }

  private async requestPermissions(): Promise<void> {
    try {
      // Permissão de localização
      const locationPermission = await Geolocation.requestPermissions();
      if (locationPermission.location !== 'granted') {
        throw new Error('Permissão de localização é obrigatória para o funcionamento do aplicativo');
      }

      // Permissão de notificação
      const notificationPermission = await LocalNotifications.requestPermissions();
      if (notificationPermission.display !== 'granted') {
        console.warn('⚠️ Permissão de notificação não concedida');
      }

      console.log('✅ [TRACKER] Permissões concedidas');
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao solicitar permissões:', error);
      throw error;
    }
  }

  private async setupBackgroundMode(): Promise<void> {
    try {
      // Ativar modo background
      await BackgroundMode.enable();
      
      // Configurar para não ser otimizado pelo sistema
      await BackgroundMode.disableWebViewOptimizations();
      
      console.log('✅ [TRACKER] Modo background configurado');
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao configurar modo background:', error);
      // Não interromper o fluxo se o background mode falhar
    }
  }

  private async setupPersistentNotification(): Promise<void> {
    try {
      // Cancelar notificações existentes
      await LocalNotifications.cancel({ notifications: [{ id: 'tracking' }] });
      
      // Criar notificação persistente
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 'tracking',
            title: 'AlchemyRotas - Conectado',
            body: 'Sistema conectado',
            ongoing: true,
            autoCancel: false,
            sound: undefined,
            smallIcon: 'icon',
            iconColor: '#017C85',
            extra: {
              persistent: true,
              priority: 'high'
            }
          }
        ]
      });
      
      console.log('✅ [TRACKER] Notificação persistente configurada');
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao configurar notificação:', error);
      // Não interromper o fluxo se a notificação falhar
    }
  }

  private async startLocationTracking(): Promise<void> {
    try {
      // Configurar tracking de alta precisão
      const trackingOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      };

      // Primeiro tracking imediato
      await this.performLocationUpdate(trackingOptions);
      
      // Configurar interval para tracking contínuo (a cada 30 segundos)
      this.trackingInterval = window.setInterval(async () => {
        try {
          await this.performLocationUpdate(trackingOptions);
        } catch (error) {
          console.error('❌ [TRACKER] Erro no tracking interval:', error);
        }
      }, 30000);
      
      console.log('✅ [TRACKER] Rastreamento de localização iniciado');
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao iniciar rastreamento:', error);
      throw error;
    }
  }

  private async performLocationUpdate(options: any): Promise<void> {
    try {
      const position = await Geolocation.getCurrentPosition(options);
      
      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: Date.now(),
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading
      };

      this.lastPosition = {
        lat: locationData.lat,
        lng: locationData.lng,
        timestamp: locationData.timestamp
      };
      
      // Adicionar ao buffer local
      this.trackingData.push(this.lastPosition);
      
      // Manter apenas os últimos 100 pontos para evitar uso excessivo de memória
      if (this.trackingData.length > 100) {
        this.trackingData = this.trackingData.slice(-100);
      }
      
      // Enviar para o servidor
      await this.sendLocationToServer(locationData);
      
      console.log('📍 [TRACKER] Localização atualizada:', {
        lat: locationData.lat.toFixed(6),
        lng: locationData.lng.toFixed(6),
        accuracy: locationData.accuracy
      });
      
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao obter localização:', error);
      // Em caso de erro, tentar novamente em 10 segundos
      setTimeout(() => this.performLocationUpdate(options), 10000);
    }
  }

  private async sendLocationToServer(locationData: any): Promise<void> {
    try {
      if (!this.currentTruckId) {
        console.warn('⚠️ [TRACKER] Truck ID não definido, pulando envio');
        return;
      }

      const payload = {
        truckId: this.currentTruckId,
        routeId: this.currentRouteId,
        location: {
          lat: locationData.lat,
          lng: locationData.lng
        },
        timestamp: new Date().toISOString(),
        accuracy: locationData.accuracy,
        speed: locationData.speed,
        heading: locationData.heading,
        deviceInfo: await this.getDeviceInfo()
      };

      const response = await fetch('https://admmicban.com.br/api/mobile/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      console.log('📡 [TRACKER] Localização enviada para servidor com sucesso');
      
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao enviar localização:', error);
      // Armazenar localmente para reenvio posterior
      this.storeFailedLocation(locationData);
    }
  }

  private async getDeviceInfo(): Promise<any> {
    try {
      const deviceInfo = await Device.getInfo();
      return {
        platform: deviceInfo.platform,
        model: deviceInfo.model,
        osVersion: deviceInfo.osVersion,
        appVersion: '1.0.0'
      };
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao obter info do device:', error);
      return {};
    }
  }

  private storeFailedLocation(locationData: any): void {
    try {
      const failedLocations = JSON.parse(localStorage.getItem('failed-locations') || '[]');
      failedLocations.push({
        ...locationData,
        truckId: this.currentTruckId,
        routeId: this.currentRouteId,
        failedAt: Date.now()
      });
      
      // Manter apenas os últimos 50 pontos falhos
      if (failedLocations.length > 50) {
        failedLocations.splice(0, failedLocations.length - 50);
      }
      
      localStorage.setItem('failed-locations', JSON.stringify(failedLocations));
      console.log('💾 [TRACKER] Localização armazenada localmente para reenvio');
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao armazenar localização localmente:', error);
    }
  }

  async stopTracking(): Promise<void> {
    try {
      console.log('🛑 [TRACKER] Parando rastreamento');
      
      this.isTracking = false;
      
      // Parar interval de tracking
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = null;
      }
      
      // Cancelar notificação persistente
      await LocalNotifications.cancel({ notifications: [{ id: 'tracking' }] });
      
      // Desativar modo background
      await BackgroundMode.disable();
      
      // Limpar dados
      this.currentTruckId = null;
      this.currentRouteId = null;
      this.lastPosition = null;
      this.trackingData = [];
      
      console.log('✅ [TRACKER] Rastreamento parado com sucesso');
      
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao parar rastreamento:', error);
    }
  }

  getTrackingStatus(): any {
    return {
      isTracking: this.isTracking,
      lastPosition: this.lastPosition,
      lastUpdate: this.lastPosition 
        ? new Date(this.lastPosition.timestamp).toLocaleString('pt-BR')
        : null,
      dataPoints: this.trackingData.length,
      currentTruckId: this.currentTruckId,
      currentRouteId: this.currentRouteId
    };
  }

  async retryFailedLocations(): Promise<void> {
    try {
      const failedLocations = JSON.parse(localStorage.getItem('failed-locations') || '[]');
      
      if (failedLocations.length === 0) {
        console.log('📡 [TRACKER] Nenhuma localização pendente para reenvio');
        return;
      }
      
      console.log(`📡 [TRACKER] Tentando reenviar ${failedLocations.length} localizações`);
      
      const successful = [];
      
      for (const location of failedLocations) {
        try {
          await this.sendLocationToServer(location);
          successful.push(location);
        } catch (error) {
          console.error('❌ [TRACKER] Falha ao reenviar localização:', error);
        }
      }
      
      // Remover localizações enviadas com sucesso
      if (successful.length > 0) {
        const remaining = failedLocations.filter(loc => !successful.includes(loc));
        localStorage.setItem('failed-locations', JSON.stringify(remaining));
        console.log(`✅ [TRACKER] ${successful.length} localizações reenviadas com sucesso`);
      }
      
    } catch (error) {
      console.error('❌ [TRACKER] Erro ao reenviar localizações:', error);
    }
  }
}

export const backgroundTracker = new BackgroundTracker();
