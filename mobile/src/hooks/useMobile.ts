
import { useState, useCallback } from 'react';
import { API_BASE_URL } from '@/services/config';

export interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  status: string;
  driver?: string;
  currentRoute?: {
    id: string;
    name: string;
    description?: string;
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      completed: boolean;
      completedAt?: string;
    }>;
    lastUpdated?: string;
  };
  location?: {
    lat: number;
    lng: number;
  };
  lastUpdated?: string;
}

export const useMobile = () => {
  // Cache otimizado para evitar requisições desnecessárias
  const [requestCache, setRequestCache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_DURATION = 30000; // 30 segundos de cache

  const getCachedOrFetch = useCallback(async (key: string, fetchFn: () => Promise<any>) => {
    const cached = requestCache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }
    
    const data = await fetchFn();
    
    setRequestCache(prev => {
      const newCache = new Map(prev);
      newCache.set(key, { data, timestamp: now });
      return newCache;
    });
    
    return data;
  }, [requestCache]);

  const getTruckByPlate = useCallback(async (plate: string): Promise<TruckMobileData> => {
    return getCachedOrFetch(`truck-${plate}`, async () => {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error('Caminhão não encontrado');
      }
      
      const data = await response.json();
      return data;
    });
  }, [getCachedOrFetch]);

  const updateTruckLocation = useCallback(async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
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
      throw new Error('Erro ao atualizar localização');
    }
    
    const result = await response.json();
    
    // Limpar cache relacionado de forma eficiente
    setRequestCache(prev => {
      const newCache = new Map(prev);
      for (const key of newCache.keys()) {
        if (key.includes(truckId)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
    
    return result;
  }, []);

  const updateRoutePoint = useCallback(async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
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
      const errorData = await response.text();
      throw new Error('Erro ao atualizar ponto da rota');
    }
    
    const result = await response.json();
    
    // Limpar cache relacionado
    setRequestCache(prev => {
      const newCache = new Map(prev);
      for (const key of newCache.keys()) {
        if (key.includes(truckId)) {
          newCache.delete(key);
        }
      }
      return newCache;
    });
    
    return result;
  }, []);

  const finishRoute = useCallback(async (truckId: string) => {
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'omit',
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error('Erro ao finalizar rota');
    }
    
    const result = await response.json();
    
    // Limpar todo o cache após finalizar rota
    setRequestCache(new Map());
    
    return result;
  }, []);

  return {
    getTruckByPlate,
    updateTruckLocation,
    updateRoutePoint,
    finishRoute,
    clearCache: () => setRequestCache(new Map())
  };
};
