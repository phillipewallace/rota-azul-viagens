
import { API_BASE_URL } from './config';

export interface TruckLocation {
  truckId: string;
  name: string;
  plate: string;
  status: string;
  lat: number;
  lng: number;
  driver: string | null;
  route: string | null;
  lastUpdate: string;
  lastGpsTimestamp: string | null;
}

export interface LocationSyncResponse {
  success: boolean;
  count: number;
  locations: TruckLocation[];
  timestamp: string;
}

class LocationSyncService {
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private callbacks: ((locations: TruckLocation[]) => void)[] = [];

  async getCurrentLocations(): Promise<TruckLocation[]> {
    try {
      console.log('📍 [LOCATION SYNC] Buscando localizações atuais...');
      
      const response = await fetch(`${API_BASE_URL}/mobile/locations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: LocationSyncResponse = await response.json();
      
      console.log(`✅ [LOCATION SYNC] Recebidas ${data.count} localizações`);
      
      return data.locations;
    } catch (error) {
      console.error('❌ [LOCATION SYNC] Erro ao buscar localizações:', error);
      return [];
    }
  }

  startPolling(intervalMs: number = 15000) {
    if (this.isPolling) {
      console.log('⚠️ [LOCATION SYNC] Polling já está ativo');
      return;
    }

    console.log(`🔄 [LOCATION SYNC] Iniciando polling a cada ${intervalMs}ms`);
    this.isPolling = true;

    const poll = async () => {
      try {
        const locations = await this.getCurrentLocations();
        this.notifyCallbacks(locations);
      } catch (error) {
        console.error('❌ [LOCATION SYNC] Erro no polling:', error);
      }
    };

    // Executar imediatamente e depois a cada intervalo
    poll();
    this.pollInterval = setInterval(poll, intervalMs);
  }

  stopPolling() {
    if (!this.isPolling) {
      return;
    }

    console.log('🛑 [LOCATION SYNC] Parando polling');
    this.isPolling = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  subscribe(callback: (locations: TruckLocation[]) => void) {
    console.log('📡 [LOCATION SYNC] Nova subscrição adicionada');
    this.callbacks.push(callback);

    // Retornar função para cancelar subscrição
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
        console.log('📡 [LOCATION SYNC] Subscrição removida');
      }
    };
  }

  private notifyCallbacks(locations: TruckLocation[]) {
    console.log(`📢 [LOCATION SYNC] Notificando ${this.callbacks.length} callbacks`);
    this.callbacks.forEach(callback => {
      try {
        callback(locations);
      } catch (error) {
        console.error('❌ [LOCATION SYNC] Erro no callback:', error);
      }
    });
  }

  getPollingStatus() {
    return {
      isPolling: this.isPolling,
      callbackCount: this.callbacks.length
    };
  }
}

export const locationSyncService = new LocationSyncService();
