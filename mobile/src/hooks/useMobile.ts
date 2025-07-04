
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
    points: RoutePoint[];
  };
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useMobile = () => {
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const getTruckByPlate = async (plate: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar caminhão');
      }
      
      const data = await response.json();
      setTruckData(data);
      return true;
    } catch (error) {
      console.error('Error fetching truck by plate:', error);
      setError(error instanceof Error ? error.message : 'Erro ao buscar caminhão');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async (truckId: string, lat: number, lng: number) => {
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
      console.error('Error updating location:', error);
      throw error;
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const updateRoutePoint = async (truckId: string, pointId: string, completed: boolean) => {
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

  const finishRoute = async (truckId: string): Promise<boolean> => {
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
      
      return true;
    } catch (error) {
      console.error('Error finishing route:', error);
      return false;
    }
  };

  return {
    truckData,
    loading,
    error,
    isUpdatingLocation,
    getTruckByPlate,
    updateLocation,
    updateRoutePoint,
    finishRoute
  };
};
