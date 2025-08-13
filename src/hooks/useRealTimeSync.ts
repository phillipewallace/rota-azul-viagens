
import { useState, useEffect, useCallback } from 'react';
import { locationSyncService, TruckLocation } from '@/services/locationSync';
import { useTrucks } from './useTrucks';

export interface RealTimePosition {
  truckId: string;
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export const useRealTimeSync = () => {
  const [positions, setPositions] = useState<Map<string, RealTimePosition>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { loadTrucks } = useTrucks();

  // Handler para processar localizações recebidas
  const handleLocationsUpdate = useCallback((locations: TruckLocation[]) => {
    console.log('📍 [REAL-TIME SYNC] Processando localizações:', locations.length);
    
    const newPositions = new Map<string, RealTimePosition>();
    
    locations.forEach(location => {
      const position: RealTimePosition = {
        truckId: location.truckId,
        lat: location.lat,
        lng: location.lng,
        timestamp: new Date(location.lastGpsTimestamp || location.lastUpdate).getTime()
      };
      
      newPositions.set(location.truckId, position);
    });

    setPositions(newPositions);
    setLastUpdate(new Date());
    setIsConnected(true);

    // Também recarregar dados dos caminhões para manter sincronizado
    loadTrucks();
    
    console.log(`✅ [REAL-TIME SYNC] Atualizadas ${newPositions.size} posições`);
  }, [loadTrucks]);

  // Iniciar sincronização quando o hook é montado
  useEffect(() => {
    console.log('🔄 [REAL-TIME SYNC] Iniciando sincronização em tempo real');
    
    // Subscrever para atualizações
    const unsubscribe = locationSyncService.subscribe(handleLocationsUpdate);
    
    // Iniciar polling se ainda não estiver ativo
    const status = locationSyncService.getPollingStatus();
    if (!status.isPolling) {
      locationSyncService.startPolling(15000); // A cada 15 segundos
    }

    setIsConnected(true);

    return () => {
      console.log('🛑 [REAL-TIME SYNC] Limpando subscrição');
      unsubscribe();
      
      // Se não há mais callbacks, parar o polling
      const finalStatus = locationSyncService.getPollingStatus();
      if (finalStatus.callbackCount === 0) {
        locationSyncService.stopPolling();
      }
      
      setIsConnected(false);
    };
  }, [handleLocationsUpdate]);

  const updateTruckPosition = useCallback((truckId: string, position: RealTimePosition) => {
    setPositions(prev => {
      const newPositions = new Map(prev);
      newPositions.set(truckId, position);
      return newPositions;
    });
    
    console.log(`📍 [REAL-TIME SYNC] Posição manual atualizada para ${truckId}:`, position);
  }, []);

  const getTruckPosition = useCallback((truckId: string): RealTimePosition | null => {
    return positions.get(truckId) || null;
  }, [positions]);

  const getAllPositions = useCallback(() => {
    return Array.from(positions.values());
  }, [positions]);

  const getConnectionStatus = useCallback(() => ({
    isConnected,
    lastUpdate,
    trackedTrucks: positions.size
  }), [isConnected, lastUpdate, positions.size]);

  const forceRefresh = useCallback(async () => {
    try {
      console.log('🔄 [REAL-TIME SYNC] Forçando atualização...');
      const locations = await locationSyncService.getCurrentLocations();
      handleLocationsUpdate(locations);
    } catch (error) {
      console.error('❌ [REAL-TIME SYNC] Erro na atualização forçada:', error);
      setIsConnected(false);
    }
  }, [handleLocationsUpdate]);

  return {
    positions: getAllPositions(),
    getTruckPosition,
    updateTruckPosition,
    connectionStatus: getConnectionStatus(),
    forceRefresh
  };
};
