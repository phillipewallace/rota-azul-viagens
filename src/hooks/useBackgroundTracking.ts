import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { trafficService } from '@/services/traffic';
import { BackgroundNotificationManager } from '@/utils/backgroundNotification';

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

export const useBackgroundTracking = (truckId: string | null, routePoints: any[] = []) => {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);

  const updateLocation = useCallback(async (position: any) => {
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

    console.log('📍 [BACKGROUND] Updating truck location:', newLocation);

    try {
      // Atualizar localização no backend
      const response = await fetch(`https://admmicban.com.br/api/trucks/${truckId}/location`, {
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
          console.log('🎯 [BACKGROUND] Calculating traffic to next destination:', nextPoint.address);
          
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
            console.log('✅ [BACKGROUND] Next destination calculated:', nextDestination);
          }
        }

        // Calcular informações da rota completa
        const remainingPoints = sortedPoints.filter(p => !p.completed);
        if (remainingPoints.length > 0 && remainingPoints.every(p => p.lat && p.lng)) {
          console.log('🗺️ [BACKGROUND] Calculating full route traffic info');
          
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
            console.log('✅ [BACKGROUND] Route info calculated:', routeInfo);
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
      console.log('📍 [BACKGROUND] Tracking data updated successfully');
    } catch (err) {
      console.error('Erro ao atualizar rastreamento:', err);
      setError('Erro ao atualizar localização');
    }
  }, [truckId, routePoints]);

  const startTracking = useCallback(async () => {
    console.log('🚀 [BACKGROUND] Starting background tracking for truck:', truckId);
    
    if (isTracking || !truckId) {
      console.warn('Tracking already active or no truck ID');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Solicitar permissões de localização
      const permissions = await Geolocation.requestPermissions();
      
      if (permissions.location !== 'granted') {
        throw new Error('Permissão de localização negada');
      }

      console.log('✅ [BACKGROUND] Location permissions granted');

      // Mostrar notificação persistente
      await BackgroundNotificationManager.showTrackingNotification(`Caminhão ${truckId}`);

      // Iniciar rastreamento com Capacitor Geolocation
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        },
        (position) => {
          console.log('📍 [BACKGROUND] GPS position received:', position?.coords);
          if (position) {
            updateLocation(position);
            setLoading(false);
            setIsTracking(true);
          }
        },
        (error) => {
          console.error('❌ [BACKGROUND] GPS error:', error);
          setError(`Erro ao obter localização GPS: ${error.message}`);
          setLoading(false);
          setIsTracking(false);
          BackgroundNotificationManager.hideTrackingNotification();
        }
      );

      setWatchId(id);
      console.log('📍 [BACKGROUND] GPS watch started with ID:', id);
      
    } catch (error: any) {
      console.error('❌ [BACKGROUND] Error starting tracking:', error);
      setError(error.message || 'Erro ao iniciar rastreamento');
      setLoading(false);
      setIsTracking(false);
      BackgroundNotificationManager.hideTrackingNotification();
    }
  }, [truckId, updateLocation, isTracking]);

  const stopTracking = useCallback(async () => {
    console.log('⏹️ [BACKGROUND] Stopping background tracking');
    
    if (watchId) {
      await Geolocation.clearWatch({ id: watchId });
      setWatchId(null);
    }
    
    // Esconder notificação
    await BackgroundNotificationManager.hideTrackingNotification();
    
    setIsTracking(false);
    setTrackingData(null);
    setLoading(false);
    setError(null);
  }, [watchId]);

  // Auto-start tracking quando truck ID é definido
  useEffect(() => {
    if (truckId && !isTracking && !loading) {
      console.log('🔄 [BACKGROUND] Auto-starting tracking for new truck ID:', truckId);
      startTracking();
    }
  }, [truckId, startTracking, isTracking, loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
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
