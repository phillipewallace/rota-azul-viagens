
import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

export const useGeolocation = () => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentPosition = async (): Promise<GeolocationPosition | null> => {
    try {
      setLoading(true);
      setError(null);
      
      // Verificar se temos permissão
      const permissions = await Geolocation.checkPermissions();
      console.log('📍 Permissões de geolocalização:', permissions);
      
      if (permissions.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          throw new Error('Permissão de localização negada');
        }
      }

      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });

      const newPosition: GeolocationPosition = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy,
        timestamp: coordinates.timestamp
      };

      setPosition(newPosition);
      console.log('📍 Localização obtida:', newPosition);
      return newPosition;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao obter localização';
      setError(errorMessage);
      console.error('❌ Erro de geolocalização:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const watchPosition = (callback: (position: GeolocationPosition) => void) => {
    const watchId = Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 10000
    }, (position, err) => {
      if (err) {
        console.error('❌ Erro no watch position:', err);
        setError(err.message);
        return;
      }
      
      if (position) {
        const newPosition: GeolocationPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        
        setPosition(newPosition);
        callback(newPosition);
      }
    });

    return watchId;
  };

  useEffect(() => {
    // Obter posição inicial
    getCurrentPosition();
  }, []);

  return {
    position,
    error,
    loading,
    getCurrentPosition,
    watchPosition,
    clearWatch: Geolocation.clearWatch
  };
};
