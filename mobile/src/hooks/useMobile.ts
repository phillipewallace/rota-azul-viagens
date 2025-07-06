
import { useState } from 'react';
import { API_BASE_URL, APP_CONFIG } from '../services/config';

export interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed: boolean;
}

export interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: string;
  driver?: string;
  currentRoute?: {
    id: string;
    name: string;
    description?: string;
    points: RoutePoint[];
  };
}

console.log('📡 [MOBILE CONFIG] API URL configurada:', API_BASE_URL);

export const useMobile = () => {
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    try {
      console.log(`🔍 [MOBILE] Buscando caminhão com placa: ${plate}`);
      console.log(`🔍 [MOBILE] URL da API: ${API_BASE_URL}/mobile/truck/${plate}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': `${APP_CONFIG.name}/${APP_CONFIG.version}`,
        },
        credentials: 'omit',
        signal: AbortSignal.timeout(APP_CONFIG.apiTimeout),
      });
      
      console.log(`📡 [MOBILE] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [MOBILE] Erro na resposta:', errorText);
        
        if (response.status === 404) {
          throw new Error('Caminhão não encontrado com esta placa');
        } else if (response.status >= 500) {
          throw new Error('Erro no servidor. Tente novamente em alguns momentos.');
        } else {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log('✅ [MOBILE] Dados do caminhão recebidos:', {
        id: data.id,
        name: data.name,
        plate: data.plate,
        status: data.status,
        hasRoute: !!data.currentRoute,
        pointsCount: data.currentRoute?.points?.length || 0
      });
      
      if (!data.id || !data.name || !data.plate) {
        throw new Error('Dados do caminhão incompletos recebidos do servidor');
      }
      
      if (data.currentRoute?.points) {
        console.log('📍 [MOBILE] Status dos pontos recebidos:', 
          data.currentRoute.points.map((point: RoutePoint) => ({
            id: point.id,
            order: point.order,
            address: point.address.substring(0, 50) + '...',
            completed: point.completed,
            type: typeof point.completed
          }))
        );
      }
      
      return data;
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao buscar caminhão:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão com o servidor. Verifique sua conexão com a internet.');
      }
      
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Timeout na conexão com o servidor. Tente novamente.');
      }
      
      throw error;
    }
  };

  const updateTruckLocation = async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    try {
      setIsUpdatingLocation(true);
      
      console.log(`📍 [MOBILE] Atualizando localização do caminhão ${truckId}:`, { lat, lng });
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': `${APP_CONFIG.name}/${APP_CONFIG.version}`,
        },
        credentials: 'omit',
        body: JSON.stringify({ lat, lng }),
        signal: AbortSignal.timeout(8000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [MOBILE] Erro ao atualizar localização:', errorText);
        throw new Error('Erro ao atualizar localização no servidor');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Localização atualizada com sucesso');
      return result;
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao atualizar localização:', error);
      throw error;
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const updateRoutePoint = async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
    try {
      console.log(`🎯 [MOBILE] Marcando ponto ${pointId} como completed: ${completed}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': `${APP_CONFIG.name}/${APP_CONFIG.version}`,
        },
        credentials: 'omit',
        body: JSON.stringify({ completed }),
        signal: AbortSignal.timeout(8000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [MOBILE] Erro ao atualizar ponto:', errorText);
        throw new Error('Erro ao atualizar ponto da rota no servidor');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Ponto da rota atualizado com sucesso:', result);
      return result;
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao atualizar ponto da rota:', error);
      throw error;
    }
  };

  const finishRoute = async (truckId: string) => {
    try {
      console.log(`🏁 [MOBILE] Finalizando rota do caminhão: ${truckId}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': `${APP_CONFIG.name}/${APP_CONFIG.version}`,
        },
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [MOBILE] Erro ao finalizar rota:', errorText);
        throw new Error('Erro ao finalizar rota no servidor');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Rota finalizada com sucesso:', result);
      return result;
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao finalizar rota:', error);
      throw error;
    }
  };

  return {
    getTruckByPlate,
    updateTruckLocation,
    updateRoutePoint,
    finishRoute,
    isUpdatingLocation
  };
};
