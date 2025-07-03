
import React, { useEffect, useRef, useState } from 'react';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada');
      setUserLocation({ lat: -23.5505, lng: -46.6333 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(newLocation);
        setLocationError(null);
        console.log('📍 Localização atualizada:', newLocation);
      },
      (error) => {
        console.error('❌ Erro GPS:', error);
        setLocationError('Erro ao obter localização GPS');
        // Fallback para São Paulo se não conseguir obter localização
        setUserLocation({ lat: -23.5505, lng: -46.6333 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const loadGoogleMapsScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Erro ao carregar Google Maps'));

      document.head.appendChild(script);
    });
  };

  const initializeMap = async () => {
    if (!mapContainer.current || !userLocation || mapLoaded) return;

    try {
      await loadGoogleMapsScript();
      
      map.current = new window.google.maps.Map(mapContainer.current, {
        center: userLocation,
        zoom: 15,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
      });

      // Marcador da localização do usuário
      new window.google.maps.Marker({
        position: userLocation,
        map: map.current,
        title: 'Sua localização atual',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#4285f4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        },
      });

      setMapLoaded(true);
      console.log('🗺️ Mapa inicializado com sucesso');
      updateMapMarkers();
    } catch (error) {
      console.error('❌ Erro ao inicializar mapa:', error);
      setLocationError('Erro ao carregar o mapa');
    }
  };

  const updateMapMarkers = () => {
    if (!map.current || !window.google || !mapLoaded) return;

    console.log('🎯 Atualizando marcadores:', { trucks: trucks.length, routes: routes.length });

    // Marcadores dos caminhões
    trucks.forEach(truck => {
      if (!truck.location) return;

      const statusColors = {
        'in-route': '#22c55e',
        'maintenance': '#ef4444',
        'available': '#6b7280'
      };

      const marker = new window.google.maps.Marker({
        position: { lat: truck.location.lat, lng: truck.location.lng },
        map: map.current,
        title: truck.name,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 10,
          fillColor: statusColors[truck.status as keyof typeof statusColors] || '#6b7280',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 16px; min-width: 280px;">
            <h3 style="margin: 0 0 12px 0; color: #1976d2;">🚛 ${truck.name}</h3>
            <div style="display: grid; gap: 8px;">
              <div><strong>Placa:</strong> ${truck.plate}</div>
              <div><strong>Modelo:</strong> ${truck.model} (${truck.year})</div>
              <div><strong>Status:</strong> ${truck.status}</div>
              ${truck.driver ? `<div><strong>Motorista:</strong> ${truck.driver}</div>` : ''}
              <div><strong>Quilometragem:</strong> ${truck.mileage?.toLocaleString() || 0} km</div>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map.current, marker);
      });
    });

    // Rotas
    routes.forEach(route => {
      if (!route.points || route.points.length < 2) return;

      const validPoints = route.points
        .filter(point => point.lat && point.lng)
        .sort((a, b) => a.order - b.order);

      if (validPoints.length < 2) return;

      const path = validPoints.map(point => ({ lat: point.lat, lng: point.lng }));

      new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map.current
      });

      validPoints.forEach((point) => {
        const pointColors = {
          origin: '#10b981',
          destination: '#ef4444',
          waypoint: '#f59e0b'
        };

        new window.google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: map.current,
          title: point.address,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: pointColors[point.type] || '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
        });
      });
    });
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (userLocation && !mapLoaded) {
      initializeMap();
    }
  }, [userLocation, mapLoaded]);

  useEffect(() => {
    if (mapLoaded && !trucksLoading && !routesLoading) {
      updateMapMarkers();
    }
  }, [trucks, routes, trucksLoading, routesLoading, mapLoaded]);

  return (
    <div className="relative w-full h-full bg-gray-100">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {!mapLoaded && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border z-10">
          <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            {!userLocation ? '📍 Obtendo localização...' : '🗺️ Carregando mapa...'}
          </div>
        </div>
      )}

      {locationError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm text-center z-10">
          <div className="font-medium mb-1">⚠️ Aviso</div>
          <div>{locationError}</div>
        </div>
      )}
    </div>
  );
};

declare global {
  interface Window {
    google: any;
  }
}

export default Map;
