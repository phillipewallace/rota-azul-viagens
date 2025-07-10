
import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Cache inteligente com debounce real
  const [requestCache, setRequestCache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());
  const requestTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const CACHE_DURATION = 30000; // 30 segundos
  const DEBOUNCE_TIME = 1000; // 1 segundo

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      requestTimers.current.forEach(timer => clearTimeout(timer));
      requestTimers.current.clear();
    };
  }, []);

  const debouncedRequest = useCallback((key: string, fetchFn: () => Promise<any>) => {
    return new Promise((resolve, reject) => {
      // Cancelar timer anterior se existir
      const existingTimer = requestTimers.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Verificar cache primeiro
      const cached = requestCache.get(key);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log(`🔄 [MOBILE CACHE] Cache hit para: ${key}`);
        resolve(cached.data);
        return;
      }

      // Criar novo timer debounced
      const timer = setTimeout(async () => {
        try {
          console.log(`🔍 [MOBILE] Fazendo requisição debounced para: ${key}`);
          const data = await fetchFn();
          
          setRequestCache(prev => {
            const newCache = new Map(prev);
            newCache.set(key, { data, timestamp: now });
            // Limitar tamanho do cache (máximo 10 itens)
            if (newCache.size > 10) {
              const firstKey = newCache.keys().next().value;
              newCache.delete(firstKey);
            }
            return newCache;
          });
          
          requestTimers.current.delete(key);
          resolve(data);
        } catch (error) {
          requestTimers.current.delete(key);
          reject(error);
        }
      }, DEBOUNCE_TIME);

      requestTimers.current.set(key, timer);
    });
  }, [requestCache]);

  const getTruckByPlate = useCallback(async (plate: string): Promise<TruckMobileData> => {
    return debouncedRequest(`truck-${plate}`, async () => {
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
  }, [debouncedRequest]);

  const updateTruckLocation = useCallback(async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    // Não fazer cache de updates, sempre executar
    console.log('📍 [MOBILE] Atualizando localização:', { truckId, lat, lng });
    
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
    console.log('✅ [MOBILE] Localização atualizada');
    
    // Invalidar cache relacionado
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
    console.log('🎯 [MOBILE] Atualizando ponto:', { truckId, pointId, completed });
    
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
    console.log('✅ [MOBILE] Ponto atualizado');
    
    // Invalidar cache relacionado
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
    console.log('🏁 [MOBILE] Finalizando rota:', truckId);
    
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
    console.log('✅ [MOBILE] Rota finalizada');
    
    // Limpar todo o cache
    setRequestCache(new Map());
    
    return result;
  }, []);

  const clearCache = useCallback(() => {
    setRequestCache(new Map());
    requestTimers.current.forEach(timer => clearTimeout(timer));
    requestTimers.current.clear();
  }, []);

  return {
    getTruckByPlate,
    updateTruckLocation,
    updateRoutePoint,
    finishRoute,
    clearCache
  };
};
