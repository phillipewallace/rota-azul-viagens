
import { useState } from 'react';

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

// Configuração dinâmica da API baseada no ambiente
const getApiUrl = () => {
  // Se estiver em produção, usar a URL de produção
  if (import.meta.env.PROD) {
    return 'https://admmicban.com.br/api';
  }
  
  // Se existir variável de ambiente, usar ela
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Fallback para desenvolvimento local
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiUrl();

export const useMobile = () => {
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    try {
      console.log(`🔍 Buscando caminhão com placa: ${plate}`);
      console.log(`🔍 URL da API: ${API_BASE_URL}/mobile/truck/${plate}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      console.log(`📡 Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('❌ Erro na resposta:', errorData);
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Dados do caminhão recebidos:', data);
      
      // Log específico dos pontos da rota para debug
      if (data.currentRoute?.points) {
        console.log('📍 Status dos pontos recebidos:', 
          data.currentRoute.points.map((point: RoutePoint) => ({
            order: point.order,
            address: point.address,
            completed: point.completed,
            type: typeof point.completed
          }))
        );
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar caminhão:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão. Verifique se o servidor está rodando e a URL está correta.');
      }
      
      throw error;
    }
  };

  const updateTruckLocation = async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    try {
      setIsUpdatingLocation(true);
      
      console.log(`📍 Atualizando localização do caminhão ${truckId}:`, { lat, lng });
      
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
        const errorData = await response.json().catch(() => ({ error: 'Erro ao atualizar localização' }));
        throw new Error(errorData.error || 'Erro ao atualizar localização');
      }
      
      const result = await response.json();
      console.log('✅ Localização atualizada com sucesso');
      return result;
    } catch (error) {
      console.error('❌ Erro ao atualizar localização:', error);
      throw error;
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const updateRoutePoint = async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
    try {
      console.log(`🎯 Marcando ponto ${pointId} como completed: ${completed}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({ completed }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro ao atualizar ponto da rota' }));
        throw new Error(errorData.error || 'Erro ao atualizar ponto da rota');
      }
      
      const result = await response.json();
      console.log('✅ Ponto da rota atualizado com sucesso:', result);
      return result;
    } catch (error) {
      console.error('❌ Erro ao atualizar ponto da rota:', error);
      throw error;
    }
  };

  const finishRoute = async (truckId: string) => {
    try {
      console.log(`🏁 Finalizando rota do caminhão: ${truckId}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro ao finalizar rota' }));
        throw new Error(errorData.error || 'Erro ao finalizar rota');
      }
      
      const result = await response.json();
      console.log('✅ Rota finalizada com sucesso:', result);
      return result;
    } catch (error) {
      console.error('❌ Erro ao finalizar rota:', error);
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
