
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
  status: string;
  currentRoute?: {
    name: string;
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      pointType?: 'limpeza' | 'entrega' | 'recolhimento';
      completed: boolean;
    }>;
  };
  location?: {
    lat: number;
    lng: number;
  };
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useMobile = () => {
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    try {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar caminhão');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching truck by plate:', error);
      throw error;
    }
  };

  const updateTruckLocation = async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    try {
      setIsUpdatingLocation(true);
      
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
      
      return await response.json();
    } catch (error) {
      console.error('Error updating truck location:', error);
      throw error;
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const updateRoutePoint = async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
    try {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error updating route point:', error);
      throw error;
    }
  };

  const finishRoute = async (truckId: string) => {
    try {
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
      
      return await response.json();
    } catch (error) {
      console.error('Error finishing route:', error);
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
