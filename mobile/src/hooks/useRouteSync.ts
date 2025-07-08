
import { useState, useEffect, useCallback } from 'react';
import { useMobile } from './useMobile';
import type { TruckMobileData } from './useMobile';

interface RouteSync {
  lastRouteUpdate: string | null;
  hasRouteChanged: boolean;
  isChecking: boolean;
}

export const useRouteSync = (truckData: TruckMobileData | null, onRouteUpdate?: (newData: TruckMobileData) => void) => {
  const [syncState, setSyncState] = useState<RouteSync>({
    lastRouteUpdate: null,
    hasRouteChanged: false,
    isChecking: false
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
          console.log('🔄 [ROUTE SYNC] Rota foi atualizada! Sincronizando...');
          
          // Verificar se pontos concluídos ainda estão preservados
          const completedPoints = truckData.currentRoute.points?.filter(p => p.completed) || [];
          const newPoints = updatedTruckData.currentRoute.points || [];
          
          // Manter status dos pontos já concluídos
          const syncedPoints = newPoints.map(newPoint => {
            const existingPoint = completedPoints.find(cp => 
              cp.id === newPoint.id || 
              (cp.address === newPoint.address && cp.lat === newPoint.lat && cp.lng === newPoint.lng)
            );
            
            if (existingPoint && existingPoint.completed) {
              return { ...newPoint, completed: true, completedAt: existingPoint.completedAt };
            }
            
            return newPoint;
          });
          
          // Criar dados sincronizados
          const syncedTruckData = {
            ...updatedTruckData,
            currentRoute: {
              ...updatedTruckData.currentRoute,
              points: syncedPoints
            }
          };
          
          setSyncState(prev => ({
            ...prev,
            lastRouteUpdate: newLastUpdate,
            hasRouteChanged: true
          }));
          
          // Notificar sobre a mudança
          if (onRouteUpdate) {
            onRouteUpdate(syncedTruckData);
          }
          
          console.log(`✅ [ROUTE SYNC] Rota sincronizada! Preservados ${completedPoints.length} pontos concluídos`);
        } else {
          console.log('ℹ️ [ROUTE SYNC] Nenhuma atualização de rota detectada');
        }
      }
      
    } catch (error) {
      console.error('❌ [ROUTE SYNC] Erro ao verificar atualizações:', error);
    } finally {
      setSyncState(prev => ({ ...prev, isChecking: false }));
    }
  }, [truckData, getTruckByPlate, onRouteUpdate]);

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

  const markRouteChangeAsRead = useCallback(() => {
    setSyncState(prev => ({ ...prev, hasRouteChanged: false }));
  }, []);

  return {
    ...syncState,
    checkForRouteUpdates,
    markRouteChangeAsRead
  };
};
