
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

export const useRealTimeTracking = (truckId: string | null, routePoints: any[] = []) => {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    if (!truckId) return;

    const newLocation: TruckLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: new Date(),
      speed: position.coords.speed || undefined,
      heading: position.coords.heading || undefined
    };

    try {
      // Atualizar localização no backend
      await fetch(`http://localhost:3001/api/trucks/${truckId}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lat: newLocation.lat, 
          lng: newLocation.lng 
        })
      });

      // Calcular próximo destino se houver rota
      let nextDestination = null;
      let routeInfo = null;

      if (routePoints.length > 0) {
        const sortedPoints = routePoints.sort((a, b) => a.order - b.order);
        const nextPoint = sortedPoints.find(p => !p.completed);
        
        if (nextPoint) {
          const trafficInfo = await trafficService.getTrafficInfo(
            { lat: newLocation.lat, lng: newLocation.lng, address: 'Localização atual' },
            { lat: nextPoint.lat, lng: nextPoint.lng, address: nextPoint.address }
          );

          if (trafficInfo) {
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

        // Calcular informações da rota completa
        const remainingPoints = sortedPoints.filter(p => !p.completed);
        if (remainingPoints.length > 0) {
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

      console.log('📍 Localização atualizada:', newLocation);
    } catch (err) {
      console.error('Erro ao atualizar rastreamento:', err);
      setError('Erro ao atualizar localização');
    }
  }, [truckId, routePoints]);

  const startTracking = useCallback(() => {
    if (isTracking || !truckId) return;

    setLoading(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        updateLocation(position);
        setLoading(false);
        setIsTracking(true);
      },
      (error) => {
        console.error('Erro GPS:', error);
        setError('Erro ao obter localização GPS');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    setIsTracking(true);
    
    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsTracking(false);
    };
  }, [truckId, updateLocation, isTracking]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setTrackingData(null);
  }, []);

  // Auto-start tracking quando truck ID é definido
  useEffect(() => {
    if (truckId && !isTracking) {
      const cleanup = startTracking();
      return cleanup;
    }
  }, [truckId, startTracking, isTracking]);

  return {
    trackingData,
    isTracking,
    loading,
    error,
    startTracking,
    stopTracking
  };
};
