
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

// Sistema de logs configurável
const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'INFO';
const logLevels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

const log = (level: string, message: string, ...args: any[]) => {
  if (logLevels[level] <= logLevels[LOG_LEVEL]) {
    const timestamp = new Date().toISOString();
    const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'INFO' ? '✅' : '🔍';
    console.log(`${timestamp}: ${prefix} [LOCATION SYNC] ${message}`, ...args);
  }
};

class LocationSyncService {
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private callbacks: ((locations: TruckLocation[]) => void)[] = [];
  private lastRequestTime = 0;
  private debounceDelay = 5000; // 5 segundos de debounce
  private retryCount = 0;
  private maxRetries = 3;

  async getCurrentLocations(): Promise<TruckLocation[]> {
    try {
      // Debounce para evitar requests excessivos
      const now = Date.now();
      if (now - this.lastRequestTime < this.debounceDelay) {
        log('DEBUG', 'Request ignorado - debounce ativo');
        return [];
      }
      this.lastRequestTime = now;

      log('DEBUG', 'Buscando localizações atuais...');
      
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
      
      // Só logar quando houver mudança significativa
      if (data.count > 0) {
        log('INFO', `Recebidas ${data.count} localizações`);
      }
      
      this.retryCount = 0; // Reset retry count em sucesso
      return data.locations;
    } catch (error) {
      this.retryCount++;
      
      if (this.retryCount <= this.maxRetries) {
        log('WARN', `Erro ao buscar localizações (tentativa ${this.retryCount}/${this.maxRetries}):`, error.message);
      } else {
        log('ERROR', 'Erro crítico ao buscar localizações após múltiplas tentativas:', error.message);
        this.retryCount = 0; // Reset para próxima sequência
      }
      
      return [];
    }
  }

  startPolling(intervalMs: number = 60000) { // Aumentado de 15s para 60s
    if (this.isPolling) {
      log('WARN', 'Polling já está ativo');
      return;
    }

    log('INFO', `Iniciando polling a cada ${intervalMs/1000}s`);
    this.isPolling = true;

    const poll = async () => {
      try {
        const locations = await this.getCurrentLocations();
        if (locations.length > 0) {
          this.notifyCallbacks(locations);
        }
      } catch (error) {
        log('ERROR', 'Erro no polling:', error.message);
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

    log('INFO', 'Parando polling');
    this.isPolling = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  subscribe(callback: (locations: TruckLocation[]) => void) {
    log('DEBUG', 'Nova subscrição adicionada');
    this.callbacks.push(callback);

    // Retornar função para cancelar subscrição
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
        log('DEBUG', 'Subscrição removida');
      }
    };
  }

  private notifyCallbacks(locations: TruckLocation[]) {
    log('DEBUG', `Notificando ${this.callbacks.length} callbacks com ${locations.length} localizações`);
    this.callbacks.forEach(callback => {
      try {
        callback(locations);
      } catch (error) {
        log('ERROR', 'Erro no callback:', error.message);
      }
    });
  }

  getPollingStatus() {
    return {
      isPolling: this.isPolling,
      callbackCount: this.callbacks.length,
      retryCount: this.retryCount
    };
  }
}

export const locationSyncService = new LocationSyncService();
