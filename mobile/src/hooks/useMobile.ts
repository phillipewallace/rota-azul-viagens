
import { useState, useEffect, usecallback, useRef } from 'react';
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
  // CORREÇÃO: Cache persistente otimizado com localStorage
  const [cache, setCache] = useState<Map<string, CacheEntry>>(() => {
    try {
      const stored = localStorage.getItem('mobile-cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        const validEntries = Object.entries(parsed).filter(
          ([, entry]: [string, any]) => now < entry.expiry
        );
        return new Map(validEntries);
      }
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    }
    return new Map();
  });

  const requestTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());
  
  // OTIMIZAÇÃO: Configurações de cache mais agressivas
  const CACHE_DURATION = 120000; // 2 minutos - aumentado
  const DEBOUNCE_TIME = 5000; // 5 segundos - aumentado significativamente
  const MAX_CACHE_SIZE = 10; // Reduzido para otimizar memória

  // CORREÇÃO: Persistir cache no localStorage automaticamente
  useEffect(() => {
    try {
      const cacheObj = Object.fromEntries(cache);
      localStorage.setItem('mobile-cache', JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  }, [cache]);

  // OTIMIZAÇÃO: Cleanup automático melhorado
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setCache(prev => {
        const newCache = new Map();
        let hasChanges = false;
        
        for (const [key, entry] of prev) {
          if (now < entry.expiry) {
            newCache.set(key, entry);
          } else {
            hasChanges = true;
          }
        }
        
        return hasChanges ? newCache : prev;
      });
    }, 60000);

    return () => {
      clearInterval(cleanupInterval);
      requestTimers.current.forEach(timer => clearTimeout(timer));
      requestTimers.current.clear();
      pendingRequests.current.clear();
    };
  }, []);

  // CORREÇÃO: Smart request com debounce real e cache inteligente
  const smartRequest = useCallback((key: string, fetchFn: () => Promise<any>, forceRefresh = false) => {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      
      // OTIMIZAÇÃO: Verificar cache válido primeiro (mais agressivo)
      if (!forceRefresh) {
        const cached = cache.get(key);
        if (cached && now < cached.expiry) {
          resolve(cached.data);
          return;
        }
      }

      // CORREÇÃO: Verificar se já existe requisição pendente (evita duplicatas)
      const pendingRequest = pendingRequests.current.get(key);
      if (pendingRequest) {
        pendingRequest.then(resolve).catch(reject);
        return;
      }

      // CORREÇÃO: Cancelar timer anterior se existir
      const existingTimer = requestTimers.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // OTIMIZAÇÃO: Debounce mais agressivo
      const timer = setTimeout(async () => {
        try {
          const fetchPromise = fetchFn();
          pendingRequests.current.set(key, fetchPromise);
          
          const data = await fetchPromise;
          
          // CORREÇÃO: Atualizar cache com controle de tamanho
          setCache(prev => {
            const newCache = new Map(prev);
            
            // Limpar cache antigo se necessário
            if (newCache.size >= MAX_CACHE_SIZE) {
              const oldestKey = Array.from(newCache.entries())
                .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0];
              newCache.delete(oldestKey);
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
  }, [cache, CACHE_DURATION, DEBOUNCE_TIME, MAX_CACHE_SIZE]);

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
        throw new Error('Caminhão não encontrado');
      }
      
      const data = await response.json();
      return data;
    }, forceRefresh);
  }, [smartRequest]);

  const updateTruckLocation = useCallback(async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
    // CORREÇÃO: Updates não devem ser cached - sempre executar imediatamente
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
    
    // OTIMIZAÇÃO: Invalidar cache relacionado de forma inteligente
    setCache(prev => {
      const newCache = new Map(prev);
      for (const key of newCache.keys()) {
        if (key.includes(truckId) || key.includes('truck-')) {
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
    
    // OTIMIZAÇÃO: Invalidação específica de cache
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
      throw new Error('Erro ao finalizar rota');
    }
    
    const result = await response.json();
    
    // CORREÇÃO: Limpar cache completamente após finalizar rota
    setCache(new Map());
    localStorage.removeItem('mobile-cache');
    requestTimers.current.forEach(timer => clearTimeout(timer));
    requestTimers.current.clear();
    pendingRequests.current.clear();
    
    return result;
  }, []);

  const clearCache = useCallback(() => {
    setCache(new Map());
    localStorage.removeItem('mobile-cache');
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
