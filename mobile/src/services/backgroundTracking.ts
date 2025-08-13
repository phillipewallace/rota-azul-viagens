
import { BackgroundMode } from '@capacitor/background-mode';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Device } from '@capacitor/device';

// Sistema de logs configurável
const LOG_LEVEL = 'INFO'; // ERROR, WARN, INFO, DEBUG
const logLevels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

const log = (level: string, message: string, ...args: any[]) => {
  if (logLevels[level] <= logLevels[LOG_LEVEL]) {
    const timestamp = new Date().toISOString();
    const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'INFO' ? '✅' : '🔍';
    console.log(`${timestamp}: ${prefix} [TRACKER] ${message}`, ...args);
  }
};

class BackgroundTracker {
  private isTracking = false;
  private trackingInterval: number | null = null;
  private currentTruckId: string | null = null;
  private currentRouteId: string | null = null;
  private lastPosition: { lat: number; lng: number; timestamp: number } | null = null;
  private trackingData: Array<{ lat: number; lng: number; timestamp: number }> = [];
  private sendQueue: Array<any> = [];
  private isProcessingQueue = false;

  async enforceTracking(truckId: string, routeId?: string): Promise<void> {
    try {
      log('INFO', `Iniciando rastreamento obrigatório para caminhão: ${truckId}`);
      
      this.currentTruckId = truckId;
      this.currentRouteId = routeId || null;
      
      await this.requestPermissions();
      await this.setupBackgroundMode();
      await this.setupPersistentNotification();
      await this.startLocationTracking();
      
      this.isTracking = true;
      log('INFO', 'Rastreamento obrigatório ativado com sucesso');
      
    } catch (error) {
      log('ERROR', 'Erro ao ativar rastreamento obrigatório:', error);
      throw new Error('Não foi possível ativar o rastreamento obrigatório. Verifique as permissões do aplicativo.');
    }
  }

  private async requestPermissions(): Promise<void> {
    try {
      const locationPermission = await Geolocation.requestPermissions();
      if (locationPermission.location !== 'granted') {
        throw new Error('Permissão de localização é obrigatória para o funcionamento do aplicativo');
      }

      const notificationPermission = await LocalNotifications.requestPermissions();
      if (notificationPermission.display !== 'granted') {
        log('WARN', 'Permissão de notificação não concedida');
      }

      log('INFO', 'Permissões concedidas');
    } catch (error) {
      log('ERROR', 'Erro ao solicitar permissões:', error);
      throw error;
    }
  }

  private async setupBackgroundMode(): Promise<void> {
    try {
      await BackgroundMode.enable();
      await BackgroundMode.disableWebViewOptimizations();
      log('INFO', 'Modo background configurado');
    } catch (error) {
      log('WARN', 'Erro ao configurar modo background:', error);
    }
  }

  private async setupPersistentNotification(): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: 'tracking' }] });
      
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
      
      log('INFO', 'Notificação persistente configurada');
    } catch (error) {
      log('WARN', 'Erro ao configurar notificação:', error);
    }
  }

  private async startLocationTracking(): Promise<void> {
    try {
      const trackingOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      };

      await this.performLocationUpdate(trackingOptions);
      
      // Tracking a cada 60 segundos (otimizado)
      this.trackingInterval = window.setInterval(async () => {
        try {
          await this.performLocationUpdate(trackingOptions);
        } catch (error) {
          log('ERROR', 'Erro no tracking interval:', error);
        }
      }, 60000); // Aumentado de 30s para 60s
      
      log('INFO', 'Rastreamento de localização iniciado');
    } catch (error) {
      log('ERROR', 'Erro ao iniciar rastreamento:', error);
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
      
      this.trackingData.push(this.lastPosition);
      
      if (this.trackingData.length > 50) { // Reduzido de 100 para 50
        this.trackingData = this.trackingData.slice(-50);
      }
      
      await this.sendLocationToServer(locationData);
      
      // Log reduzido - só a cada 5 atualizações
      if (this.trackingData.length % 5 === 0) {
        log('DEBUG', `Localização atualizada: ${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`);
      }
      
    } catch (error) {
      log('WARN', 'Erro ao obter localização:', error);
      setTimeout(() => this.performLocationUpdate(options), 30000);
    }
  }

  private async sendLocationToServer(locationData: any): Promise<void> {
    try {
      if (!this.currentTruckId) {
        log('DEBUG', 'Truck ID não definido, pulando envio');
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

      log('DEBUG', 'Localização enviada para servidor com sucesso');
      
    } catch (error) {
      log('WARN', 'Erro ao enviar localização:', error);
      this.addToSendQueue(locationData);
    }
  }

  private addToSendQueue(locationData: any): void {
    this.sendQueue.push({
      ...locationData,
      truckId: this.currentTruckId,
      routeId: this.currentRouteId,
      failedAt: Date.now()
    });
    
    if (this.sendQueue.length > 20) { // Limitar queue
      this.sendQueue = this.sendQueue.slice(-20);
    }
    
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.sendQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      const batch = this.sendQueue.splice(0, 5); // Processar em lotes de 5
      
      for (const item of batch) {
        try {
          await this.sendLocationToServer(item);
        } catch (error) {
          // Re-adicionar ao queue se falhar novamente
          this.sendQueue.push(item);
        }
      }
    } finally {
      this.isProcessingQueue = false;
      
      // Continuar processando se ainda houver items
      if (this.sendQueue.length > 0) {
        setTimeout(() => this.processQueue(), 30000); // Tentar novamente em 30s
      }
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
      log('ERROR', 'Erro ao obter info do device:', error);
      return {};
    }
  }

  async stopTracking(): Promise<void> {
    try {
      log('INFO', 'Parando rastreamento');
      
      this.isTracking = false;
      
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = null;
      }
      
      await LocalNotifications.cancel({ notifications: [{ id: 'tracking' }] });
      await BackgroundMode.disable();
      
      this.currentTruckId = null;
      this.currentRouteId = null;
      this.lastPosition = null;
      this.trackingData = [];
      this.sendQueue = [];
      
      log('INFO', 'Rastreamento parado com sucesso');
      
    } catch (error) {
      log('ERROR', 'Erro ao parar rastreamento:', error);
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
      queueSize: this.sendQueue.length,
      currentTruckId: this.currentTruckId,
      currentRouteId: this.currentRouteId
    };
  }
}

export const backgroundTracker = new BackgroundTracker();
