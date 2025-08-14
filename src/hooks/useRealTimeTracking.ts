
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
  const [watchId, setWatchId] = useState<number | null>(null);

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    if (!truckId) {
      console.warn('No truck ID provided for location update');
      return;
    }

    const newLocation: TruckLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: new Date(),
      speed: position.coords.speed || undefined,
      heading: position.coords.heading || undefined
    };

    console.log('📍 Updating truck location:', newLocation);

    try {
      // Atualizar localização no backend
      const response = await fetch(`http://localhost:3001/api/trucks/${truckId}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lat: newLocation.lat, 
          lng: newLocation.lng 
        })
      });

      if (!response.ok) {
        console.error('Failed to update truck location:', response.status);
      }

      // Calcular próximo destino se houver rota
      let nextDestination = null;
      let routeInfo = null;

      if (routePoints && routePoints.length > 0) {
        const sortedPoints = routePoints.sort((a, b) => (a.order || 0) - (b.order || 0));
        const nextPoint = sortedPoints.find(p => !p.completed);
        
        if (nextPoint && nextPoint.lat && nextPoint.lng) {
          console.log('🎯 Calculating traffic to next destination:', nextPoint.address);
          
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
            console.log('✅ Next destination calculated:', nextDestination);
          } else {
            console.warn('Failed to get traffic info for next destination');
          }
        }

        // Calcular informações da rota completa
        const remainingPoints = sortedPoints.filter(p => !p.completed);
        if (remainingPoints.length > 0 && remainingPoints.every(p => p.lat && p.lng)) {
          console.log('🗺️ Calculating full route traffic info');
          
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
            console.log('✅ Route info calculated:', routeInfo);
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
      console.log('📍 Tracking data updated successfully');
    } catch (err) {
      console.error('Erro ao atualizar rastreamento:', err);
      setError('Erro ao atualizar localização');
    }
  }, [truckId, routePoints]);

  const startTracking = useCallback(() => {
    console.log('🚀 Starting real-time tracking for truck:', truckId);
    
    if (isTracking || !truckId) {
      console.warn('Tracking already active or no truck ID');
      return;
    }

    setLoading(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      setLoading(false);
      console.error('Geolocation not supported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        console.log('📍 GPS position received:', position.coords);
        updateLocation(position);
        setLoading(false);
        setIsTracking(true);
      },
      (error) => {
        console.error('Erro GPS:', error);
        setError(`Erro ao obter localização GPS: ${error.message}`);
        setLoading(false);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    setWatchId(id);
    console.log('📍 GPS watch started with ID:', id);
    
    return () => {
      if (id) {
        navigator.geolocation.clearWatch(id);
        console.log('📍 GPS watch cleared:', id);
      }
      setIsTracking(false);
      setWatchId(null);
    };
  }, [truckId, updateLocation, isTracking]);

  const stopTracking = useCallback(() => {
    console.log('⏹️ Stopping real-time tracking');
    
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    setIsTracking(false);
    setTrackingData(null);
    setLoading(false);
    setError(null);
  }, [watchId]);

  // Auto-start tracking quando truck ID é definido
  useEffect(() => {
    if (truckId && !isTracking && !loading) {
      console.log('🔄 Auto-starting tracking for new truck ID:', truckId);
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
    stopTracking
  };
};
