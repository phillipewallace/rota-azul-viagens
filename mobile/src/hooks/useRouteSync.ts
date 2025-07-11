
import { useState, useCallback } from 'react';
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

  // OTIMIZADO: Verificação manual com cache inteligente
  const checkForRouteUpdates = useCallback(async (forceCheck = false) => {
    if (!truckData?.plate || !truckData.currentRoute) {
      return;
    }

    try {
      setSyncState(prev => ({ ...prev, isChecking: true }));
      
      // Usar cache do useMobile, mas permitir forceRefresh se necessário
      const updatedTruckData = await getTruckByPlate(truckData.plate, forceCheck);
      
      if (updatedTruckData.currentRoute?.lastUpdated) {
        const currentLastUpdate = truckData.currentRoute.lastUpdated;
        const newLastUpdate = updatedTruckData.currentRoute.lastUpdated;
        
        // Verificar se a rota foi realmente atualizada
        if (currentLastUpdate && newLastUpdate && newLastUpdate > currentLastUpdate) {
          console.log('🔄 [ROUTE SYNC] Nova atualização detectada');
          
          setSyncState(prev => ({
            ...prev,
            lastRouteUpdate: newLastUpdate,
            hasRouteChanged: true,
            newRouteData: updatedTruckData
          }));
        }
      }
      
    } catch (error) {
      console.error('❌ [ROUTE SYNC] Erro na verificação:', error);
    } finally {
      setSyncState(prev => ({ ...prev, isChecking: false }));
    }
  }, [truckData?.plate, truckData?.currentRoute?.lastUpdated, getTruckByPlate]);

  const acceptRouteUpdate = useCallback((newData: TruckMobileData) => {
    setSyncState(prev => ({ 
      ...prev, 
      hasRouteChanged: false,
      newRouteData: null,
      lastRouteUpdate: newData.currentRoute?.lastUpdated || null
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
