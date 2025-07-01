
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
  const [loadingLocation, setLoadingLocation] = useState(true);
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  const getUserLocation = () => {
    setLoadingLocation(true);
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não é suportada pelo navegador');
      setUserLocation({ lat: -23.5505, lng: -46.6333 }); // São Paulo fallback
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(location);
        setLocationError(null);
        setLoadingLocation(false);
        console.log('📍 Localização obtida:', location);
      },
      (error) => {
        console.error('❌ Erro ao obter localização:', error);
        setLocationError('Não foi possível obter sua localização');
        setUserLocation({ lat: -23.5505, lng: -46.6333 }); // São Paulo fallback
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000 // 5 minutos
      }
    );
  };

  const initializeMap = async () => {
    if (!mapContainer.current || !userLocation) return;

    try {
      // Remove script existente se houver
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (!mapContainer.current || !userLocation) return;

        map.current = new window.google.maps.Map(mapContainer.current, {
          center: userLocation,
          zoom: 15,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
          styles: [
            {
              "featureType": "poi",
              "elementType": "labels",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "transit",
              "elementType": "labels",
              "stylers": [{"visibility": "off"}]
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
            scale: 15,
            fillColor: '#4285f4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 4
          }
        });

        // Círculo de precisão
        new window.google.maps.Circle({
          center: userLocation,
          radius: 50,
          map: map.current,
          fillColor: '#4285f4',
          fillOpacity: 0.15,
          strokeColor: '#4285f4',
          strokeOpacity: 0.4,
          strokeWeight: 2
        });

        // Info window para localização do usuário
        const userInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div class="p-3">
              <h3 class="font-semibold text-blue-600 mb-2">📍 Sua Localização</h3>
              <p class="text-sm text-gray-600">
                Lat: ${userLocation.lat.toFixed(6)}<br>
                Lng: ${userLocation.lng.toFixed(6)}
              </p>
            </div>
          `
        });

        userMarker.addListener('click', () => {
          userInfoWindow.open(map.current, userMarker);
        });

        // Controles de tipo de mapa
        createMapTypeControls();
        
        setMapLoaded(true);
        console.log('🗺️ Mapa inicializado com sucesso');
      };

      script.onerror = () => {
        console.error('❌ Erro ao carregar Google Maps API');
        setLocationError('Erro ao carregar o mapa');
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error('❌ Erro ao inicializar mapa:', error);
      setLocationError('Erro ao inicializar o mapa');
    }
  };

  const createMapTypeControls = () => {
    if (!mapContainer.current) return;

    const controlDiv = document.createElement('div');
    controlDiv.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      overflow: hidden;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const buttons = [
      { id: 'roadmap', text: '🗺️ Mapa', type: 'roadmap' },
      { id: 'satellite', text: '🛰️ Satélite', type: 'satellite' },
      { id: 'hybrid', text: '🔀 Híbrido', type: 'hybrid' }
    ];

    buttons.forEach((btn, index) => {
      const button = document.createElement('button');
      button.innerHTML = btn.text;
      button.style.cssText = `
        display: block;
        width: 100%;
        padding: 10px 15px;
        border: none;
        background: white;
        cursor: pointer;
        font-size: 13px;
        text-align: left;
        transition: background-color 0.2s;
        ${index < buttons.length - 1 ? 'border-bottom: 1px solid #eee;' : ''}
      `;

      button.onmouseover = () => button.style.background = '#f5f5f5';
      button.onmouseout = () => {
        button.style.background = map.current?.getMapTypeId() === btn.type ? '#e3f2fd' : 'white';
      };

      button.onclick = () => {
        if (map.current) {
          map.current.setMapTypeId(btn.type);
          buttons.forEach(b => {
            const btnEl = controlDiv.querySelector(`#btn-${b.id}`) as HTMLElement;
            if (btnEl) {
              btnEl.style.background = b.type === btn.type ? '#e3f2fd' : 'white';
            }
          });
        }
      };

      button.id = `btn-${btn.id}`;
      if (btn.type === 'roadmap') button.style.background = '#e3f2fd';
      
      controlDiv.appendChild(button);
    });

    mapContainer.current.appendChild(controlDiv);
  };

  const updateMapMarkers = () => {
    if (!map.current || !window.google || !mapLoaded) return;

    console.log('🎯 Atualizando marcadores do mapa');

    // Marcadores dos caminhões
    trucks.forEach(truck => {
      if (!truck.location) return;

      const marker = new window.google.maps.Marker({
        position: { lat: truck.location.lat, lng: truck.location.lng },
        map: map.current,
        title: truck.name,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: truck.status === 'in-route' ? '#22c55e' : 
                   truck.status === 'maintenance' ? '#ef4444' : '#6b7280',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          rotation: 0
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="p-4 min-w-[250px]">
            <h3 class="font-bold text-lg mb-3 text-blue-600">🚛 ${truck.name}</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="font-medium">Placa:</span>
                <span>${truck.plate}</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Modelo:</span>
                <span>${truck.model} (${truck.year})</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Status:</span>
                <span class="px-2 py-1 rounded text-xs font-medium ${
                  truck.status === 'in-route' ? 'bg-green-100 text-green-800' : 
                  truck.status === 'maintenance' ? 'bg-red-100 text-red-800' : 
                  'bg-gray-100 text-gray-800'
                }">
                  ${truck.status === 'in-route' ? '🚀 Em movimento' : 
                    truck.status === 'maintenance' ? '🔧 Manutenção' : '⏸️ Disponível'}
                </span>
              </div>
              ${truck.driver ? `
                <div class="flex justify-between">
                  <span class="font-medium">Motorista:</span>
                  <span>${truck.driver}</span>
                </div>
              ` : ''}
              ${truck.currentRoute ? `
                <div class="flex justify-between">
                  <span class="font-medium">Rota:</span>
                  <span>${truck.currentRoute}</span>
                </div>
              ` : ''}
              <div class="flex justify-between">
                <span class="font-medium">Quilometragem:</span>
                <span>${truck.mileage.toLocaleString()} km</span>
              </div>
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
      if (route.points.length < 2) return;

      const path = route.points
        .sort((a, b) => a.order - b.order)
        .map(point => ({ lat: point.lat, lng: point.lng }));

      const routeLine = new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 1.0,
        strokeWeight: 4,
        icons: [{
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_OPEN_ARROW,
            scale: 3,
            strokeColor: '#2563eb'
          },
          offset: '100%',
          repeat: '50px'
        }]
      });

      routeLine.setMap(map.current);

      // Marcadores dos pontos da rota
      route.points.forEach((point, index) => {
        const marker = new window.google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: map.current,
          title: point.address,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: point.type === 'origin' ? '#10b981' : 
                     point.type === 'destination' ? '#ef4444' : '#f59e0b',
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
            <div class="p-3">
              <h4 class="font-semibold text-blue-600 mb-2">
                📍 Ponto ${index + 1} - ${route.name}
              </h4>
              <div class="text-sm space-y-1">
                <p><strong>Endereço:</strong> ${point.address}</p>
                <p><strong>Tipo:</strong> ${
                  point.type === 'origin' ? '🟢 Origem' : 
                  point.type === 'destination' ? '🔴 Destino' : '🟡 Parada'
                }</p>
                <p><strong>CEP:</strong> ${point.cep}</p>
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

  useEffect(() => {
    getUserLocation();
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
      
      {/* Loading States */}
      {(loadingLocation || !mapLoaded) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border">
          <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            {loadingLocation ? '📍 Obtendo sua localização...' : '🗺️ Carregando mapa...'}
          </div>
        </div>
      )}

      {/* Error States */}
      {locationError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm text-center">
          <div className="font-medium mb-1">⚠️ Aviso</div>
          <div>{locationError}</div>
          <div className="text-xs mt-1 text-yellow-600">Usando São Paulo como localização padrão</div>
        </div>
      )}

      {/* Map Info */}
      {userLocation && mapLoaded && (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg text-xs font-mono border">
          <div className="text-gray-600 mb-1">📍 Sua Localização:</div>
          <div className="font-medium">
            {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
          </div>
          <div className="text-gray-500 mt-1">
            🚛 {trucks.length} caminhões • 🛣️ {routes.length} rotas
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
