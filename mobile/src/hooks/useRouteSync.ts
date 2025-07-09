
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
      
      console.log('🔄 [ROUTE SYNC] Verificando atualizações da rota...');
      
      // Buscar dados atualizados do caminhão
      const updatedTruckData = await getTruckByPlate(truckData.plate);
      
      if (updatedTruckData.currentRoute?.lastUpdated) {
        const currentLastUpdate = truckData.currentRoute.lastUpdated;
        const newLastUpdate = updatedTruckData.currentRoute.lastUpdated;
        
        // Verificar se a rota foi atualizada
        if (currentLastUpdate && newLastUpdate && newLastUpdate > currentLastUpdate) {
          console.log('🔄 [ROUTE SYNC] Rota foi atualizada! Dados disponíveis para sincronização...');
          
          setSyncState(prev => ({
            ...prev,
            lastRouteUpdate: newLastUpdate,
            hasRouteChanged: true,
            newRouteData: updatedTruckData
          }));
          
          console.log('✅ [ROUTE SYNC] Notificação de mudança preparada');
        } else {
          console.log('ℹ️ [ROUTE SYNC] Nenhuma atualização de rota detectada');
        }
      }
      
    } catch (error) {
      console.error('❌ [ROUTE SYNC] Erro ao verificar atualizações:', error);
    } finally {
      setSyncState(prev => ({ ...prev, isChecking: false }));
    }
  }, [truckData, getTruckByPlate]);

  // Polling a cada 30 segundos para verificar mudanças
  useEffect(() => {
    if (!truckData?.currentRoute) {
      return;
    }

    // Primeira verificação
    checkForRouteUpdates();
    
    // Configurar polling
    const interval = setInterval(checkForRouteUpdates, 30000); // 30 segundos
    
    console.log('🔄 [ROUTE SYNC] Polling iniciado para detectar mudanças na rota');
    
    return () => {
      clearInterval(interval);
      console.log('⏹️ [ROUTE SYNC] Polling interrompido');
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
