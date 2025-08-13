
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundMode } from '@capacitor/background-mode';
import { BackgroundTask } from '@capacitor/background-task';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from './config';

export interface TrackingConfig {
  truckId: string;
  truckName: string;
  plate: string;
  updateInterval: number; // em milissegundos
}

class BackgroundTrackingService {
  private isTracking = false;
  private watchId: string | null = null;
  private config: TrackingConfig | null = null;
  private backgroundTaskId: string | null = null;
  private lastPosition: { lat: number; lng: number; timestamp: number } | null = null;
  private positionQueue: Array<{ lat: number; lng: number; timestamp: number }> = [];
  private syncInterval: NodeJS.Timeout | null = null;

  async initialize() {
    console.log('📱 [BG TRACKING] Inicializando serviço de rastreamento background');
    
    if (Capacitor.isNativePlatform()) {
      // Configurar background mode
      await BackgroundMode.enable();
      
      // Solicitar permissões de notificação
      await LocalNotifications.requestPermissions();
      
      // Verificar informações do dispositivo
      const deviceInfo = await Device.getInfo();
      console.log('📱 [BG TRACKING] Info do dispositivo:', deviceInfo);
    }
  }

  async startTracking(config: TrackingConfig): Promise<boolean> {
    try {
      console.log('🟢 [BG TRACKING] Iniciando rastreamento obrigatório para:', config.truckName);
      
      this.config = config;
      
      // Verificar permissões de localização
      const permissions = await Geolocation.checkPermissions();
      console.log('📍 [BG TRACKING] Permissões atuais:', permissions);
      
      if (permissions.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          throw new Error('Permissões de localização são obrigatórias para o rastreamento');
        }
      }

      // Configurar background mode (sempre ativo)
      if (Capacitor.isNativePlatform()) {
        await BackgroundMode.enable();
        
        // Criar notificação persistente
        await this.createPersistentNotification();
        
        // Iniciar background task
        this.backgroundTaskId = await BackgroundTask.beforeExit(async () => {
          console.log('🔄 [BG TRACKING] App entrando em background - mantendo rastreamento');
          await this.maintainBackgroundTracking();
        });
      }

      // Iniciar watchPosition com alta precisão
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        },
        (position, err) => {
          if (err) {
            console.error('❌ [BG TRACKING] Erro ao obter localização:', err);
            return;
          }

          if (position) {
            this.handleNewPosition(position.coords.latitude, position.coords.longitude);
          }
        }
      );

      // Iniciar sincronização em batch
      this.startBatchSync();
      
      this.isTracking = true;
      console.log('✅ [BG TRACKING] Rastreamento iniciado com sucesso');
      
      return true;
    } catch (error) {
      console.error('❌ [BG TRACKING] Erro ao iniciar rastreamento:', error);
      throw error;
    }
  }

  private async handleNewPosition(lat: number, lng: number) {
    const timestamp = Date.now();
    const newPosition = { lat, lng, timestamp };
    
    console.log(`📍 [BG TRACKING] Nova posição: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    // Verificar se a posição mudou significativamente (> 10 metros)
    if (this.lastPosition) {
      const distance = this.calculateDistance(
        this.lastPosition.lat, this.lastPosition.lng,
        lat, lng
      );
      
      if (distance < 10) { // Menos de 10 metros, ignorar
        console.log(`📍 [BG TRACKING] Movimento insignificante (${distance.toFixed(1)}m), ignorando`);
        return;
      }
    }
    
    this.lastPosition = newPosition;
    this.positionQueue.push(newPosition);
    
    // Tentar envio imediato se possível
    await this.attemptImmediateSync();
    
    // Atualizar notificação
    await this.updateNotification(lat, lng);
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private async attemptImmediateSync() {
    if (!this.config || this.positionQueue.length === 0) return;
    
    try {
      const position = this.positionQueue[this.positionQueue.length - 1]; // Última posição
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${this.config.truckId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({ 
          lat: position.lat, 
          lng: position.lng,
          timestamp: position.timestamp
        }),
      });

      if (response.ok) {
        console.log('✅ [BG TRACKING] Posição sincronizada imediatamente');
        // Manter apenas as últimas 5 posições como backup
        this.positionQueue = this.positionQueue.slice(-5);
      }
    } catch (error) {
      console.log('⚠️ [BG TRACKING] Sync imediato falhou, usando batch sync:', error);
    }
  }

  private startBatchSync() {
    // Sincronização em batch a cada 30 segundos
    this.syncInterval = setInterval(async () => {
      await this.syncPositionQueue();
    }, 30000);
  }

  private async syncPositionQueue() {
    if (!this.config || this.positionQueue.length === 0) return;
    
    console.log(`🔄 [BG TRACKING] Sincronizando ${this.positionQueue.length} posições em batch`);
    
    try {
      // Enviar a posição mais recente
      const latestPosition = this.positionQueue[this.positionQueue.length - 1];
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${this.config.truckId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({ 
          lat: latestPosition.lat, 
          lng: latestPosition.lng,
          timestamp: latestPosition.timestamp
        }),
      });

      if (response.ok) {
        console.log('✅ [BG TRACKING] Batch sync realizado com sucesso');
        this.positionQueue = []; // Limpar queue após sucesso
      }
    } catch (error) {
      console.error('❌ [BG TRACKING] Erro no batch sync:', error);
      
      // Limitar queue para não consumir muita memória (máximo 100 posições)
      if (this.positionQueue.length > 100) {
        this.positionQueue = this.positionQueue.slice(-50);
      }
    }
  }

  private async createPersistentNotification() {
    if (!Capacitor.isNativePlatform()) return;
    
    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'AlchemyRotas - Rastreamento Ativo',
          body: `${this.config?.truckName} (${this.config?.plate}) - GPS monitorado`,
          id: 1,
          ongoing: true,
          autoCancel: false,
          iconColor: '#1e40af',
          actionTypeId: 'TRACKING_ACTIONS',
          extra: { persistent: true }
        }
      ]
    });
  }

  private async updateNotification(lat: number, lng: number) {
    if (!Capacitor.isNativePlatform() || !this.config) return;
    
    const coords = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const time = new Date().toLocaleTimeString('pt-BR');
    
    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'AlchemyRotas - Localização Atualizada',
          body: `${this.config.truckName} • ${coords} • ${time}`,
          id: 1,
          ongoing: true,
          autoCancel: false,
          iconColor: '#10b981'
        }
      ]
    });
  }

  private async maintainBackgroundTracking() {
    console.log('🔄 [BG TRACKING] Mantendo rastreamento em background');
    
    // Continuar sincronização mesmo em background
    if (this.positionQueue.length > 0) {
      await this.syncPositionQueue();
    }
    
    // Manter watchPosition ativo
    if (!this.watchId && this.config) {
      console.log('🔄 [BG TRACKING] Reiniciando watchPosition em background');
      await this.startTracking(this.config);
    }
  }

  async stopTracking(): Promise<void> {
    console.log('🔴 [BG TRACKING] AVISO: Tentativa de parar rastreamento obrigatório');
    
    // ⚠️ IMPORTANTE: Em um cenário real de empresa, você NÃO permitiria parar o rastreamento
    // Este método existe apenas para desenvolvimento/teste
    
    if (this.watchId) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.backgroundTaskId) {
      BackgroundTask.finish({ taskId: this.backgroundTaskId });
      this.backgroundTaskId = null;
    }
    
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
      await BackgroundMode.disable();
    }
    
    // Sync final da queue
    await this.syncPositionQueue();
    
    this.isTracking = false;
    this.config = null;
    this.lastPosition = null;
    this.positionQueue = [];
    
    console.log('🔴 [BG TRACKING] Rastreamento interrompido');
  }

  getTrackingStatus(): { isTracking: boolean; config: TrackingConfig | null; queueSize: number } {
    return {
      isTracking: this.isTracking,
      config: this.config,
      queueSize: this.positionQueue.length
    };
  }

  // Método para forçar sincronização manual
  async forcSync(): Promise<boolean> {
    console.log('🔄 [BG TRACKING] Sincronização forçada solicitada');
    await this.syncPositionQueue();
    return this.positionQueue.length === 0;
  }
}

// Singleton instance
export const backgroundTrackingService = new BackgroundTrackingService();
