
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
  const [isTracking, setIsTracking] = useState(true);
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  // Função para obter localização atual
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada');
      setUserLocation({ lat: -23.5505, lng: -46.6333 }); // São Paulo fallback
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
        setUserLocation({ lat: -23.5505, lng: -46.6333 }); // Fallback para São Paulo
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Cache por 1 minuto
      }
    );
  };

  // Inicializar o mapa
  const initializeMap = () => {
    if (!mapContainer.current || !userLocation || mapLoaded) return;

    // Limpar scripts existentes
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/js/v3/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      if (!mapContainer.current || !userLocation || !window.google) return;

      try {
        map.current = new window.google.maps.Map(mapContainer.current, {
          center: userLocation,
          zoom: 15,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
          styles: [
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }]
            },
            {
              featureType: "transit",
              elementType: "labels.icon",
              stylers: [{ visibility: "off" }]
            }
          ]
        });

        // Marcador da localização do usuário
        const userMarker = new window.google.maps.Marker({
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
          animation: window.google.maps.Animation.DROP
        });

        // Círculo de precisão
        new window.google.maps.Circle({
          center: userLocation,
          radius: 100,
          map: map.current,
          fillColor: '#4285f4',
          fillOpacity: 0.1,
          strokeColor: '#4285f4',
          strokeOpacity: 0.3,
          strokeWeight: 1
        });

        // Info window para localização do usuário
        const userInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h3 style="margin: 0 0 8px 0; color: #1976d2; font-size: 16px;">📍 Sua Localização</h3>
              <p style="margin: 0; font-size: 13px; color: #666;">
                Lat: ${userLocation.lat.toFixed(6)}<br>
                Lng: ${userLocation.lng.toFixed(6)}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
                Atualização automática ativa
              </p>
            </div>
          `
        });

        userMarker.addListener('click', () => {
          userInfoWindow.open(map.current, userMarker);
        });

        setMapLoaded(true);
        console.log('🗺️ Mapa inicializado com sucesso');

        // Atualizar marcadores após o mapa carregar
        updateMapMarkers();
      } catch (error) {
        console.error('❌ Erro ao criar mapa:', error);
        setLocationError('Erro ao inicializar o mapa');
      }
    };

    script.onerror = () => {
      console.error('❌ Erro ao carregar Google Maps API');
      setLocationError('Erro ao carregar o mapa');
    };

    document.head.appendChild(script);
  };

  // Atualizar marcadores no mapa
  const updateMapMarkers = () => {
    if (!map.current || !window.google || !mapLoaded) return;

    console.log('🎯 Atualizando marcadores:', { trucks: trucks.length, routes: routes.length });

    // Limpar marcadores existentes (exceto o do usuário)
    // Adicionar marcadores dos caminhões
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
          rotation: 0
        },
        animation: window.google.maps.Animation.DROP
      });

      const statusLabels = {
        'in-route': '🚀 Em rota',
        'maintenance': '🔧 Manutenção',
        'available': '⏸️ Disponível'
      };

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 280px;">
            <h3 style="margin: 0 0 12px 0; color: #1976d2; font-size: 18px;">🚛 ${truck.name}</h3>
            <div style="display: grid; gap: 8px; font-size: 14px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: 500;">Placa:</span>
                <span>${truck.plate}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: 500;">Modelo:</span>
                <span>${truck.model} (${truck.year})</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 500;">Status:</span>
                <span style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; background: ${statusColors[truck.status as keyof typeof statusColors] || '#6b7280'}20; color: ${statusColors[truck.status as keyof typeof statusColors] || '#6b7280'};">
                  ${statusLabels[truck.status as keyof typeof statusLabels] || 'Status desconhecido'}
                </span>
              </div>
              ${truck.driver ? `
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-weight: 500;">Motorista:</span>
                  <span>${truck.driver}</span>
                </div>
              ` : ''}
              ${truck.currentRoute ? `
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-weight: 500;">Rota:</span>
                  <span>${truck.currentRoute}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: 500;">Quilometragem:</span>
                <span>${truck.mileage?.toLocaleString() || 0} km</span>
              </div>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map.current, marker);
      });
    });

    // Adicionar rotas
    routes.forEach(route => {
      if (!route.points || route.points.length < 2) return;

      const validPoints = route.points
        .filter(point => point.lat && point.lng)
        .sort((a, b) => a.order - b.order);

      if (validPoints.length < 2) return;

      const path = validPoints.map(point => ({ lat: point.lat, lng: point.lng }));

      const routeLine = new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        icons: [{
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_OPEN_ARROW,
            scale: 3,
            strokeColor: '#2563eb'
          },
          offset: '100%',
          repeat: '80px'
        }]
      });

      routeLine.setMap(map.current);

      // Marcadores dos pontos da rota
      validPoints.forEach((point, index) => {
        const pointColors = {
          origin: '#10b981',
          destination: '#ef4444',
          waypoint: '#f59e0b'
        };

        const pointLabels = {
          origin: '🟢 Origem',
          destination: '🔴 Destino',
          waypoint: '🟡 Parada'
        };

        const marker = new window.google.maps.Marker({
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
          label: {
            text: (index + 1).toString(),
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold'
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h4 style="margin: 0 0 8px 0; color: #1976d2; font-size: 16px;">
                📍 Ponto ${index + 1} - ${route.name}
              </h4>
              <div style="font-size: 14px; line-height: 1.4;">
                <p style="margin: 4px 0;"><strong>Endereço:</strong> ${point.address}</p>
                <p style="margin: 4px 0;"><strong>Tipo:</strong> ${pointLabels[point.type] || '🟡 Parada'}</p>
                ${point.cep ? `<p style="margin: 4px 0;"><strong>CEP:</strong> ${point.cep}</p>` : ''}
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map.current, marker);
        });
      });
    });
  };

  // Efeito para obter localização inicial
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Efeito para inicializar o mapa
  useEffect(() => {
    if (userLocation && !mapLoaded) {
      initializeMap();
    }
  }, [userLocation, mapLoaded]);

  // Efeito para atualizar marcadores
  useEffect(() => {
    if (mapLoaded && !trucksLoading && !routesLoading) {
      updateMapMarkers();
    }
  }, [trucks, routes, trucksLoading, routesLoading, mapLoaded]);

  // Rastreamento em tempo real da localização
  useEffect(() => {
    if (!isTracking) return;

    const watchId = navigator.geolocation?.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(newLocation);
        
        // Recentrar o mapa na nova localização (opcional)
        if (map.current && mapLoaded) {
          map.current.panTo(newLocation);
        }
      },
      (error) => {
        console.error('❌ Erro no rastreamento:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000 // Cache por 30 segundos
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isTracking, mapLoaded]);

  return (
    <div className="relative w-full h-full bg-gray-100">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Controles do mapa */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={getCurrentLocation}
          className="bg-white hover:bg-gray-50 text-gray-700 p-3 rounded-lg shadow-lg border transition-colors"
          title="Atualizar localização"
        >
          📍
        </button>
        <button
          onClick={() => setIsTracking(!isTracking)}
          className={`p-3 rounded-lg shadow-lg border transition-colors ${
            isTracking 
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : 'bg-white hover:bg-gray-50 text-gray-700'
          }`}
          title={isTracking ? 'Parar rastreamento' : 'Iniciar rastreamento'}
        >
          {isTracking ? '⏸️' : '▶️'}
        </button>
      </div>

      {/* Status de carregamento */}
      {!mapLoaded && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border z-10">
          <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            {!userLocation ? '📍 Obtendo localização...' : '🗺️ Carregando mapa...'}
          </div>
        </div>
      )}

      {/* Erros */}
      {locationError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm text-center z-10">
          <div className="font-medium mb-1">⚠️ Aviso</div>
          <div>{locationError}</div>
        </div>
      )}

      {/* Informações do mapa */}
      {userLocation && mapLoaded && (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg text-xs border z-10">
          <div className="text-gray-600 mb-1">📍 Localização:</div>
          <div className="font-mono text-gray-800 mb-2">
            {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
          </div>
          <div className="text-gray-500 flex items-center gap-4">
            <span>🚛 {trucks.length} caminhões</span>
            <span>🛣️ {routes.length} rotas</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {isTracking ? '🔴 Rastreamento ativo' : '⏸️ Rastreamento pausado'}
          </div>
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
