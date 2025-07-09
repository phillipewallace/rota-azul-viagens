
import { useState, useEffect, useCallback } from 'react';
import { useMobile } from './useMobile';
import type { TruckMobileData } from './useMobile';

interface RouteSync {
  lastRouteUpdate: string | null;
  hasRouteChanged: boolean;
  isChecking: boolean;
  newRouteData: TruckMobileData | null;
}

export const useRouteSync = (truckData: TruckMobileData | null) => {
  const [syncState, setSyncState] = useState<RouteSync>({
    lastRouteUpdate: null,
    hasRouteChanged: false,
    isChecking: false,
    newRouteData: null
  });
  
  const { getTruckByPlate } = useMobile();

  const checkForRouteUpdates = useCallback(async () => {
    if (!truckData?.plate || !truckData.currentRoute) {
      return;
    }

    try {
      setSyncState(prev => ({ ...prev, isChecking: true }));
      
      // Buscar dados atualizados do caminhão
      const updatedTruckData = await getTruckByPlate(truckData.plate);
      
      if (updatedTruckData.currentRoute?.lastUpdated) {
        const currentLastUpdate = truckData.currentRoute.lastUpdated;
        const newLastUpdate = updatedTruckData.currentRoute.lastUpdated;
        
        // Verificar se a rota foi atualizada
        if (currentLastUpdate && newLastUpdate && newLastUpdate > currentLastUpdate) {
          console.log('🔄 [ROUTE SYNC] Rota atualizada detectada');
          
          setSyncState(prev => ({
            ...prev,
            lastRouteUpdate: newLastUpdate,
            hasRouteChanged: true,
            newRouteData: updatedTruckData
          }));
        }
      }
      
    } catch (error) {
      console.error('❌ [ROUTE SYNC] Erro ao verificar atualizações:', error);
    } finally {
      setSyncState(prev => ({ ...prev, isChecking: false }));
    }
  }, [truckData, getTruckByPlate]);

  // OTIMIZADO: Polling reduzido - só verifica mudanças quando necessário
  useEffect(() => {
    if (!truckData?.currentRoute) {
      return;
    }

    // Verificação inicial
    const initialCheck = setTimeout(checkForRouteUpdates, 5000);
    
    // Polling reduzido para 2 minutos (apenas para mudanças críticas)
    const interval = setInterval(checkForRouteUpdates, 120000);
    
    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [truckData?.currentRoute?.id, checkForRouteUpdates]);

  const acceptRouteUpdate = useCallback((newData: TruckMobileData) => {
    setSyncState(prev => ({ 
      ...prev, 
      hasRouteChanged: false,
      newRouteData: null
    }));
    return newData;
  }, []);

  const dismissRouteUpdate = useCallback(() => {
    setSyncState(prev => ({ 
      ...prev, 
      hasRouteChanged: false,
      newRouteData: null
    }));
  }, []);

  return {
    ...syncState,
    checkForRouteUpdates,
    acceptRouteUpdate,
    dismissRouteUpdate
  };
};
