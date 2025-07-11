
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

interface CacheEntry {
  data: any;
  timestamp: number;
  expiry: number;
}

export const useMobile = () => {
  // Cache persistente com expiração inteligente
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const requestTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());
  
  const CACHE_DURATION = 30000; // 30 segundos
  const DEBOUNCE_TIME = 2000; // 2 segundos - aumentado
  const MAX_CACHE_SIZE = 20;

  // Cleanup automático
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCache(prev => {
        const newCache = new Map(prev);
        for (const [key, entry] of newCache) {
          if (now > entry.expiry) {
            newCache.delete(key);
          }
        }
        return newCache;
      });
    }, 60000); // Cleanup a cada minuto

    return () => {
      clearInterval(cleanupInterval);
      requestTimers.current.forEach(timer => clearTimeout(timer));
      requestTimers.current.clear();
      pendingRequests.current.clear();
    };
  }, []);

  // Cache inteligente com debounce real
  const smartRequest = useCallback((key: string, fetchFn: () => Promise<any>, forceRefresh = false) => {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      
      // Verificar cache válido primeiro
      if (!forceRefresh) {
        const cached = cache.get(key);
        if (cached && now < cached.expiry) {
          resolve(cached.data);
          return;
        }
      }

      // Verificar se já existe requisição pendente
      const pendingRequest = pendingRequests.current.get(key);
      if (pendingRequest) {
        pendingRequest.then(resolve).catch(reject);
        return;
      }

      // Cancelar timer anterior
      const existingTimer = requestTimers.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Criar nova requisição debounced
      const timer = setTimeout(async () => {
        try {
          const fetchPromise = fetchFn();
          pendingRequests.current.set(key, fetchPromise);
          
          const data = await fetchPromise;
          
          // Atualizar cache
          setCache(prev => {
            const newCache = new Map(prev);
            
            // Limitar tamanho do cache
            if (newCache.size >= MAX_CACHE_SIZE) {
              const firstKey = newCache.keys().next().value;
              newCache.delete(firstKey);
            }
            
            newCache.set(key, {
              data,
              timestamp: now,
              expiry: now + CACHE_DURATION
            });
            
            return newCache;
          });
          
          requestTimers.current.delete(key);
          pendingRequests.current.delete(key);
          resolve(data);
          
        } catch (error) {
          requestTimers.current.delete(key);
          pendingRequests.current.delete(key);
          reject(error);
        }
      }, DEBOUNCE_TIME);

      requestTimers.current.set(key, timer);
    });
  }, [cache]);

  const getTruckByPlate = useCallback(async (plate: string, forceRefresh = false): Promise<TruckMobileData> => {
    return smartRequest(`truck-${plate}`, async () => {
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
      return data;
    }, forceRefresh);
  }, [smartRequest]);

  const updateTruckLocation = useCallback(async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    // Updates não devem ser cached - sempre executar
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
    
    // Invalidar cache relacionado
    setCache(prev => {
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
      console.error('❌ [MOBILE] Erro ao atualizar ponto:', errorData);
      throw new Error('Erro ao atualizar ponto da rota');
    }
    
    const result = await response.json();
    
    // Invalidar cache relacionado
    setCache(prev => {
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
      console.error('❌ [MOBILE] Erro ao finalizar rota:', errorData);
      throw new Error('Erro ao finalizar rota');
    }
    
    const result = await response.json();
    
    // Limpar todo o cache
    setCache(new Map());
    requestTimers.current.forEach(timer => clearTimeout(timer));
    requestTimers.current.clear();
    pendingRequests.current.clear();
    
    return result;
  }, []);

  const clearCache = useCallback(() => {
    setCache(new Map());
    requestTimers.current.forEach(timer => clearTimeout(timer));
    requestTimers.current.clear();
    pendingRequests.current.clear();
  }, []);

  return {
    getTruckByPlate,
    updateTruckLocation,
    updateRoutePoint,
    finishRoute,
    clearCache,
    cacheSize: cache.size
  };
};
