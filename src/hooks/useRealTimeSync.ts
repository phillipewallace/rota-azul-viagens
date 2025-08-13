
import { useState, useEffect, useCallback } from 'react';
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

  // Simular WebSocket/SSE para atualizações em tempo real
  const startRealTimeUpdates = useCallback(() => {
    console.log('🔄 [REAL-TIME] Iniciando atualizações em tempo real');
    
    const updateInterval = setInterval(async () => {
      try {
        // Recarregar dados dos caminhões a cada 15 segundos
        await loadTrucks();
        setLastUpdate(new Date());
        setIsConnected(true);
      } catch (error) {
        console.error('❌ [REAL-TIME] Erro na atualização:', error);
        setIsConnected(false);
      }
    }, 15000); // 15 segundos

    return () => {
      clearInterval(updateInterval);
      setIsConnected(false);
    };
  }, [loadTrucks]);

  // Iniciar atualizações quando o hook é montado
  useEffect(() => {
    const cleanup = startRealTimeUpdates();
    return cleanup;
  }, [startRealTimeUpdates]);

  const updateTruckPosition = useCallback((truckId: string, position: RealTimePosition) => {
    setPositions(prev => {
      const newPositions = new Map(prev);
      newPositions.set(truckId, position);
      return newPositions;
    });
    
    console.log(`📍 [REAL-TIME] Posição atualizada para caminhão ${truckId}:`, position);
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

  return {
    positions: getAllPositions(),
    getTruckPosition,
    updateTruckPosition,
    connectionStatus: getConnectionStatus(),
    startRealTimeUpdates
  };
};
