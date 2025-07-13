
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
      
      console.log(`🔄 [ROUTE SYNC] Verificando atualizações para caminhão ${truckData.plate}`);
      
      // Buscar dados atualizados do caminhão
      const updatedTruckData = await getTruckByPlate(truckData.plate);
      
      if (updatedTruckData.currentRoute?.lastUpdated) {
        const currentLastUpdate = truckData.currentRoute.lastUpdated;
        const newLastUpdate = updatedTruckData.currentRoute.lastUpdated;
        
        console.log(`📅 [ROUTE SYNC] Comparando timestamps:`);
        console.log(`📅 [ROUTE SYNC] Atual: ${currentLastUpdate}`);
        console.log(`📅 [ROUTE SYNC] Novo: ${newLastUpdate}`);
        
        // Verificar se a rota foi atualizada
        if (currentLastUpdate && newLastUpdate && newLastUpdate > currentLastUpdate) {
          console.log('🔄 [ROUTE SYNC] ✅ Rota atualizada detectada!');
          
          // ✅ VERIFICAR SE REALMENTE HÁ MUDANÇAS NOS PONTOS
          const hasRealChanges = hasSignificantRouteChanges(truckData.currentRoute, updatedTruckData.currentRoute);
          
          if (hasRealChanges) {
            console.log('🔄 [ROUTE SYNC] ✅ Mudanças significativas detectadas');
            
            setSyncState(prev => ({
              ...prev,
              lastRouteUpdate: newLastUpdate,
              hasRouteChanged: true,
              newRouteData: updatedTruckData
            }));
          } else {
            console.log('🔄 [ROUTE SYNC] ℹ️ Apenas timestamp atualizado, sem mudanças nos pontos');
          }
        } else {
          console.log('🔄 [ROUTE SYNC] ℹ️ Nenhuma atualização detectada');
        }
      }
      
    } catch (error) {
      console.error('❌ [ROUTE SYNC] Erro ao verificar atualizações:', error);
    } finally {
      setSyncState(prev => ({ ...prev, isChecking: false }));
    }
  }, [truckData?.plate, truckData?.currentRoute?.lastUpdated, getTruckByPlate]);

  // ✅ FUNÇÃO PARA DETECTAR MUDANÇAS SIGNIFICATIVAS
  const hasSignificantRouteChanges = (oldRoute: any, newRoute: any) => {
    if (!oldRoute || !newRoute) return true;
    
    // Verificar se número de pontos mudou
    if (oldRoute.points?.length !== newRoute.points?.length) {
      console.log(`🔍 [ROUTE SYNC] Mudança no número de pontos: ${oldRoute.points?.length} → ${newRoute.points?.length}`);
      return true;
    }
    
    // Verificar se algum ponto novo foi adicionado ou removido
    const oldPointIds = new Set(oldRoute.points?.map((p: any) => p.id) || []);
    const newPointIds = new Set(newRoute.points?.map((p: any) => p.id) || []);
    
    const hasNewPoints = newRoute.points?.some((p: any) => !oldPointIds.has(p.id));
    const hasRemovedPoints = oldRoute.points?.some((p: any) => !newPointIds.has(p.id));
    
    if (hasNewPoints || hasRemovedPoints) {
      console.log(`🔍 [ROUTE SYNC] Mudança nos pontos: novos=${hasNewPoints}, removidos=${hasRemovedPoints}`);
      return true;
    }
    
    // Verificar se ordem dos pontos mudou
    const oldOrder = oldRoute.points?.map((p: any) => p.id).join(',') || '';
    const newOrder = newRoute.points?.map((p: any) => p.id).join(',') || '';
    
    if (oldOrder !== newOrder) {
      console.log(`🔍 [ROUTE SYNC] Mudança na ordem dos pontos`);
      return true;
    }
    
    return false;
  };

  // Otimizado: Verificação apenas manual
  useEffect(() => {
    // Não fazer polling automático para reduzir requisições
    return () => {
      // Cleanup se necessário
    };
  }, []);

  const acceptRouteUpdate = useCallback((newData: TruckMobileData) => {
    console.log(`✅ [ROUTE SYNC] Aceitando atualização da rota`);
    
    setSyncState(prev => ({ 
      ...prev, 
      hasRouteChanged: false,
      newRouteData: null
    }));
    return newData;
  }, []);

  const dismissRouteUpdate = useCallback(() => {
    console.log(`❌ [ROUTE SYNC] Dispensando atualização da rota`);
    
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
