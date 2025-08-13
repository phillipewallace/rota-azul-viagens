
import { useState, useEffect, useCallback } from 'react';
import { trafficService } from '@/services/traffic';

interface TruckLocation {
  lat: number;
  lng: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

interface TrackingData {
  truckId: string;
  currentLocation: TruckLocation | null;
  nextDestination: {
    address: string;
    lat: number;
    lng: number;
    eta: string;
    distance: string;
    duration: string;
    durationInTraffic: string;
  } | null;
  route: {
    totalDistance: string;
    totalDuration: string;
    totalDurationInTraffic: string;
    completedPoints: number;
    remainingPoints: number;
  } | null;
}

// Sistema de logs configurável
const LOG_LEVEL = 'INFO';
const logLevels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

const log = (level: string, message: string, ...args: any[]) => {
  if (logLevels[level] <= logLevels[LOG_LEVEL]) {
    const timestamp = new Date().toISOString();
    const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'INFO' ? '✅' : '🔍';
    console.log(`${timestamp}: ${prefix} [TRACKING] ${message}`, ...args);
  }
};

export const useRealTimeTracking = (truckId: string | null, routePoints: any[] = []) => {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    if (!truckId) {
      log('DEBUG', 'No truck ID provided for location update');
      return;
    }

    const newLocation: TruckLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: new Date(),
      speed: position.coords.speed || undefined,
      heading: position.coords.heading || undefined
    };

    // Log reduzido - apenas a cada 10 atualizações
    setUpdateCount(prev => {
      const newCount = prev + 1;
      if (newCount % 10 === 0) {
        log('DEBUG', `Localização atualizada (#${newCount}):`, {
          lat: newLocation.lat.toFixed(6),
          lng: newLocation.lng.toFixed(6)
        });
      }
      return newCount;
    });

    try {
      // Atualizar localização no backend com debounce
      const response = await fetch(`https://admmicban.com.br/api/trucks/${truckId}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lat: newLocation.lat, 
          lng: newLocation.lng 
        })
      });

      if (!response.ok && response.status !== 404) {
        log('WARN', `Failed to update truck location: ${response.status}`);
      }

      // Calcular próximo destino apenas quando necessário
      let nextDestination = null;
      let routeInfo = null;

      if (routePoints && routePoints.length > 0 && updateCount % 5 === 0) { // Atualizar rota a cada 5 posições
        const sortedPoints = routePoints.sort((a, b) => (a.order || 0) - (b.order || 0));
        const nextPoint = sortedPoints.find(p => !p.completed);
        
        if (nextPoint && nextPoint.lat && nextPoint.lng) {
          log('DEBUG', 'Calculando tráfego para próximo destino:', nextPoint.address);
          
          const trafficInfo = await trafficService.getTrafficInfo(
            { lat: newLocation.lat, lng: newLocation.lng, address: 'Localização atual' },
            { lat: nextPoint.lat, lng: nextPoint.lng, address: nextPoint.address }
          );

          if (trafficInfo && trafficInfo.status === 'OK') {
            nextDestination = {
              address: nextPoint.address,
              lat: nextPoint.lat,
              lng: nextPoint.lng,
              eta: trafficInfo.durationInTraffic,
              distance: trafficInfo.distance,
              duration: trafficInfo.duration,
              durationInTraffic: trafficInfo.durationInTraffic
            };
          }
        }

        // Calcular informações da rota completa apenas ocasionalmente
        const remainingPoints = sortedPoints.filter(p => !p.completed);
        if (remainingPoints.length > 0 && remainingPoints.every(p => p.lat && p.lng) && updateCount % 20 === 0) {
          const routeTrafficInfo = await trafficService.getRouteTrafficInfo(
            [{ lat: newLocation.lat, lng: newLocation.lng, address: 'Atual' }, ...remainingPoints]
          );

          if (routeTrafficInfo) {
            routeInfo = {
              totalDistance: routeTrafficInfo.totalDistance,
              totalDuration: routeTrafficInfo.totalDuration,
              totalDurationInTraffic: routeTrafficInfo.totalDurationInTraffic,
              completedPoints: sortedPoints.length - remainingPoints.length,
              remainingPoints: remainingPoints.length
            };
          }
        }
      }

      setTrackingData({
        truckId,
        currentLocation: newLocation,
        nextDestination,
        route: routeInfo
      });

      setError(null);
    } catch (err) {
      log('ERROR', 'Erro ao atualizar rastreamento:', err);
      setError('Erro ao atualizar localização');
    }
  }, [truckId, routePoints, updateCount]);

  const startTracking = useCallback(() => {
    log('INFO', `Iniciando rastreamento para caminhão: ${truckId}`);
    
    if (isTracking || !truckId) {
      log('WARN', 'Tracking já ativo ou sem truck ID');
      return;
    }

    setLoading(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      setLoading(false);
      log('ERROR', 'Geolocation não suportado');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position);
        setLoading(false);
        setIsTracking(true);
      },
      (error) => {
        log('ERROR', 'Erro GPS:', error.message);
        setError(`Erro ao obter localização GPS: ${error.message}`);
        setLoading(false);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000
      }
    );

    setWatchId(id);
    log('DEBUG', `GPS watch iniciado com ID: ${id}`);
    
    return () => {
      if (id) {
        navigator.geolocation.clearWatch(id);
        log('DEBUG', `GPS watch limpo: ${id}`);
      }
      setIsTracking(false);
      setWatchId(null);
    };
  }, [truckId, updateLocation, isTracking]);

  const stopTracking = useCallback(() => {
    log('INFO', 'Parando rastreamento');
    
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    setIsTracking(false);
    setTrackingData(null);
    setLoading(false);
    setError(null);
    setUpdateCount(0);
  }, [watchId]);

  // Auto-start tracking quando truck ID é definido
  useEffect(() => {
    if (truckId && !isTracking && !loading) {
      log('INFO', `Auto-iniciando tracking para truck: ${truckId}`);
      const cleanup = startTracking();
      return cleanup;
    }
  }, [truckId, startTracking, isTracking, loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    trackingData,
    isTracking,
    loading,
    error,
    startTracking,
    stopTracking,
    updateCount
  };
};
