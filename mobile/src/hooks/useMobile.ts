
import { useState } from 'react';

export interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
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

// Configuração da URL da API forçada para produção
const API_BASE_URL = 'https://admmicban.com.br/api';

console.log('🔍 [MOBILE] API_BASE_URL configurada como:', API_BASE_URL);

export const useMobile = () => {
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    try {
      console.log(`🔍 [MOBILE] Buscando caminhão com placa: ${plate}`);
      console.log(`🔍 [MOBILE] URL da requisição: ${API_BASE_URL}/mobile/truck/${plate}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      console.log(`📡 [MOBILE] Response status: ${response.status}`);
      console.log(`📡 [MOBILE] Response ok: ${response.ok}`);
      
      if (!response.ok) {
        const errorData = await response.text().catch(() => 'Erro desconhecido');
        console.error('❌ [MOBILE] Erro na resposta:', errorData);
        throw new Error(`Erro ${response.status}: ${response.statusText} - ${errorData}`);
      }
      
      const data = await response.json();
      console.log('✅ [MOBILE] Dados do caminhão recebidos:', data);
      
      return data;
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao buscar caminhão:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão. Verifique se o servidor está acessível.');
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
        },
        credentials: 'omit',
        body: JSON.stringify({ lat, lng }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [MOBILE] Erro ao atualizar localização:', errorData);
        throw new Error('Erro ao atualizar localização');
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
      console.log(`🎯 [MOBILE] Atualizando ponto da rota ${pointId} para caminhão ${truckId}:`, { completed });
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar ponto da rota');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Ponto da rota atualizado com sucesso');
      return result;
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao atualizar ponto da rota:', error);
      throw error;
    }
  };

  const finishRoute = async (truckId: string) => {
    try {
      console.log(`🏁 [MOBILE] Finalizando rota para caminhão ${truckId}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao finalizar rota');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Rota finalizada com sucesso');
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
