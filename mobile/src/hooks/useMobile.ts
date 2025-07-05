
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

const API_BASE_URL = 'https://admmicban.com.br/api';

export const useMobile = () => {
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    try {
      console.log(`🔍 Buscando caminhão com placa: ${plate}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`📡 Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('❌ Erro na resposta:', errorData);
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Dados do caminhão recebidos:', data);
      
      // Garantir que os pontos tenham completed como boolean
      if (data.currentRoute && data.currentRoute.points) {
        data.currentRoute.points = data.currentRoute.points.map((point: any) => ({
          ...point,
          completed: Boolean(point.completed)
        }));
        console.log('📍 Pontos processados:', data.currentRoute.points.map((p: any) => ({
          id: p.id,
          address: p.address,
          order: p.order,
          completed: p.completed
        })));
      }
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar caminhão:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão. Verifique se o servidor está rodando.');
      }
      
      throw error;
    }
  };

  const updateTruckLocation = async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    try {
      setIsUpdatingLocation(true);
      console.log(`📍 Atualizando localização do caminhão ${truckId}: ${lat}, ${lng}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lat, lng }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar localização');
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
      console.log(`🎯 Atualizando ponto da rota: ${pointId} para completed: ${completed}`);
      
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
      console.log('✅ Ponto atualizado com sucesso');
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
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao finalizar rota');
      }
      
      const result = await response.json();
      console.log('✅ Rota finalizada com sucesso');
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
