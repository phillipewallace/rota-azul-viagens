
import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/services/config';

export interface RoutePointMobile {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string | null;
}

export interface RouteMobile {
  id: string;
  name: string;
  description?: string;
  points: RoutePointMobile[];
  totalDistance: number;
  estimatedTime: string;
  optimizedOrder: string[];
  status: 'active' | 'inactive' | 'completed';
  createdAt: string;
  lastUpdated?: string;
}

export interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  model: string;
  currentRoute?: RouteMobile | null;
  currentLocation?: {
    lat: number;
    lng: number;
  } | null;
}

export const useMobile = () => {
  const [truckData, setTruckData] = useState<TruckMobileData | null>(() => {
    // ✅ RECUPERAR DADOS DO STORAGE AO INICIALIZAR
    try {
      const savedData = localStorage.getItem('mobile-truck-data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        console.log('📱 [MOBILE STORAGE] Dados recuperados do storage:', parsed.name || 'Unknown');
        return parsed;
      }
    } catch (error) {
      console.error('❌ [MOBILE STORAGE] Erro ao recuperar dados:', error);
    }
    return null;
  });

  // ✅ SALVAR DADOS NO STORAGE SEMPRE QUE ATUALIZAR
  const saveTruckDataToStorage = useCallback((data: TruckMobileData | null) => {
    try {
      if (data) {
        localStorage.setItem('mobile-truck-data', JSON.stringify(data));
        console.log('💾 [MOBILE STORAGE] Dados salvos:', data.name);
      } else {
        localStorage.removeItem('mobile-truck-data');
        console.log('🗑️ [MOBILE STORAGE] Dados removidos do storage');
      }
    } catch (error) {
      console.error('❌ [MOBILE STORAGE] Erro ao salvar dados:', error);
    }
  }, []);

  // ✅ ATUALIZAR setTruckData PARA SEMPRE SALVAR
  const updateTruckData = useCallback((data: TruckMobileData | null) => {
    setTruckData(data);
    saveTruckDataToStorage(data);
  }, [saveTruckDataToStorage]);

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    try {
      console.log(`🔍 [MOBILE API] Buscando caminhão por placa: ${plate}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Caminhão não encontrado');
      }

      const data = await response.json();
      console.log(`✅ [MOBILE API] Caminhão encontrado: ${data.name}`);
      
      // ✅ SALVAR AUTOMATICAMENTE DADOS ATUALIZADOS
      updateTruckData(data);
      
      return data;
    } catch (error) {
      console.error('❌ [MOBILE API] Erro ao buscar caminhão:', error);
      throw error;
    }
  };

  // ✅ FUNÇÃO CRÍTICA: MARCAR PONTO COMO CONCLUÍDO
  const markPointAsCompleted = async (pointId: string): Promise<void> => {
    if (!truckData?.id) {
      throw new Error('Caminhão não identificado');
    }

    try {
      console.log(`✅ [MOBILE API] Marcando ponto ${pointId} como concluído`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/trucks/${truckData.id}/points/${pointId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao marcar ponto como concluído');
      }

      const result = await response.json();
      console.log(`✅ [MOBILE API] Ponto concluído no servidor:`, result);

      // ✅ ATUALIZAR DADOS LOCAIS MANTENDO STATUS CONCLUÍDO
      if (truckData.currentRoute) {
        const updatedRoute = {
          ...truckData.currentRoute,
          points: truckData.currentRoute.points.map(point =>
            point.id === pointId
              ? { 
                  ...point, 
                  completed: true, 
                  completedAt: new Date().toISOString() 
                }
              : point
          )
        };

        const updatedTruckData = {
          ...truckData,
          currentRoute: updatedRoute
        };

        console.log(`💾 [MOBILE] Salvando ponto ${pointId} como concluído no storage`);
        updateTruckData(updatedTruckData);
      }

    } catch (error) {
      console.error('❌ [MOBILE API] Erro ao marcar ponto:', error);
      throw error;
    }
  };

  const updateLocation = async (lat: number, lng: number): Promise<void> => {
    if (!truckData?.id) {
      console.log('⚠️ [MOBILE API] Truck data não disponível para atualização de localização');
      return;
    }

    try {
      console.log(`📍 [MOBILE API] Atualizando localização do ${truckData.name}: ${lat}, ${lng}`);
      
      const response = await fetch(`${API_BASE_URL}/mobile/trucks/${truckData.id}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lat, lng }),
      });

      if (!response.ok) {
        console.error('❌ [MOBILE API] Erro ao atualizar localização:', response.status);
        return;
      }

      const result = await response.json();
      console.log(`✅ [MOBILE API] Localização atualizada:`, result);

      // ✅ ATUALIZAR DADOS LOCAIS COM NOVA LOCALIZAÇÃO
      const updatedTruckData = {
        ...truckData,
        currentLocation: { lat, lng }
      };

      updateTruckData(updatedTruckData);

    } catch (error) {
      console.error('❌ [MOBILE API] Erro ao atualizar localização:', error);
    }
  };

  // ✅ FUNÇÃO PARA SINCRONIZAR DADOS COM SERVIDOR
  const syncWithServer = async (): Promise<void> => {
    if (!truckData?.plate) {
      console.log('⚠️ [MOBILE SYNC] Sem dados para sincronizar');
      return;
    }

    try {
      console.log(`🔄 [MOBILE SYNC] Sincronizando dados do caminhão ${truckData.name}`);
      
      const freshData = await getTruckByPlate(truckData.plate);
      
      // ✅ MANTER PONTOS CONCLUÍDOS DO STORAGE SE MAIS RECENTES
      if (truckData.currentRoute && freshData.currentRoute) {
        const mergedPoints = freshData.currentRoute.points.map(serverPoint => {
          const localPoint = truckData.currentRoute!.points.find(p => p.id === serverPoint.id);
          
          // Se o ponto local está concluído mas o servidor não, manter o local
          if (localPoint?.completed && !serverPoint.completed) {
            console.log(`📱 [MOBILE SYNC] Mantendo ponto ${serverPoint.id} como concluído (local mais recente)`);
            return localPoint;
          }
          
          return serverPoint;
        });

        freshData.currentRoute.points = mergedPoints;
      }

      updateTruckData(freshData);
      console.log(`✅ [MOBILE SYNC] Dados sincronizados com sucesso`);

    } catch (error) {
      console.error('❌ [MOBILE SYNC] Erro na sincronização:', error);
    }
  };

  // ✅ FUNÇÃO PARA LIMPAR DADOS (LOGOUT)
  const clearTruckData = useCallback(() => {
    console.log('🚪 [MOBILE] Realizando logout e limpando dados');
    updateTruckData(null);
  }, [updateTruckData]);

  // ✅ LISTENER PARA MUDANÇAS NO STORAGE (SINCRONIZAÇÃO ENTRE ABAS)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'mobile-truck-data') {
        try {
          const newData = event.newValue ? JSON.parse(event.newValue) : null;
          console.log('🔄 [MOBILE STORAGE] Sincronizando dados entre abas');
          setTruckData(newData);
        } catch (error) {
          console.error('❌ [MOBILE STORAGE] Erro na sincronização:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // ✅ SINCRONIZAÇÃO AUTOMÁTICA A CADA 30 SEGUNDOS
  useEffect(() => {
    if (!truckData?.plate) return;

    const interval = setInterval(() => {
      syncWithServer();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [truckData?.plate]);

  return {
    truckData,
    getTruckByPlate,
    markPointAsCompleted,
    updateLocation,
    clearTruckData,
    updateTruckData,
    syncWithServer
  };
};
