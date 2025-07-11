
import { useState, useEffect, useCallback } from 'react';
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
  // Cache para evitar requisições desnecessárias
  const [requestCache, setRequestCache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_DURATION = 10000; // 10 segundos de cache

  const getCachedOrFetch = useCallback(async (key: string, fetchFn: () => Promise<any>) => {
    const cached = requestCache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`🔄 [MOBILE CACHE] Usando cache para: ${key}`);
      return cached.data;
    }
    
    console.log(`🔍 [MOBILE] Fazendo requisição para: ${key}`);
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
        console.error('❌ [MOBILE] Erro:', errorData);
        throw new Error('Caminhão não encontrado');
      }
      
      const data = await response.json();
      console.log('✅ [MOBILE] Dados do caminhão recebidos');
      return data;
    });
  }, [getCachedOrFetch]);

  const updateTruckLocation = useCallback(async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    console.log('📍 [MOBILE] Atualizando localização do caminhão:', { truckId, lat, lng });
    
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

  const updateRoutePoint = useCallback(async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
    console.log('🎯 [MOBILE] Atualizando ponto da rota:', { truckId, pointId, completed });
    
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
      console.error('❌ [MOBILE] Erro ao atualizar ponto:', errorData);
      throw new Error('Erro ao atualizar ponto da rota');
    }
    
    const result = await response.json();
    console.log('✅ [MOBILE] Ponto da rota atualizado com sucesso');
    
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
    console.log('🏁 [MOBILE] Finalizando rota do caminhão:', truckId);
    
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
      console.error('❌ [MOBILE] Erro ao finalizar rota:', errorData);
      throw new Error('Erro ao finalizar rota');
    }
    
    const result = await response.json();
    console.log('✅ [MOBILE] Rota finalizada com sucesso');
    
    // Limpar todo o cache
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
