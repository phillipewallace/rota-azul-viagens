
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

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não é suportada pelo navegador');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(location);
        console.log('Localização do usuário obtida:', location);
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        setLocationError('Erro ao obter localização GPS');
        // Fallback para São Paulo se não conseguir obter localização
        setUserLocation({ lat: -23.5505, lng: -46.6333 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
      }
    );
  };

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (!mapContainer.current) return;

        // Usa a localização do usuário ou fallback para São Paulo
        const center = userLocation || { lat: -23.5505, lng: -46.6333 };

        map.current = new window.google.maps.Map(mapContainer.current, {
          center: center,
          zoom: userLocation ? 15 : 10, // Zoom maior se tiver localização do usuário
          mapTypeControl: false,
          styles: [
            {
              "elementType": "geometry",
              "stylers": [{"color": "#f5f5f5"}]
            },
            {
              "elementType": "labels.icon",
              "stylers": [{"visibility": "off"}]
            },
            {
              "elementType": "labels.text.fill",
              "stylers": [{"color": "#616161"}]
            },
            {
              "elementType": "labels.text.stroke",
              "stylers": [{"color": "#f5f5f5"}]
            },
            {
              "featureType": "road",
              "elementType": "geometry",
              "stylers": [{"color": "#ffffff"}]
            },
            {
              "featureType": "road",
              "elementType": "labels.text.fill",
              "stylers": [{"color": "#9e9e9e"}]
            },
            {
              "featureType": "water",
              "elementType": "geometry",
              "stylers": [{"color": "#c9c9c9"}]
            }
          ]
        });

        // Adiciona marcador da localização do usuário se disponível
        if (userLocation) {
          new window.google.maps.Marker({
            position: userLocation,
            map: map.current,
            title: 'Sua localização',
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#4285f4',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3
            }
          });

          // Adiciona círculo de precisão
          new window.google.maps.Circle({
            center: userLocation,
            radius: 100, // 100 metros
            map: map.current,
            fillColor: '#4285f4',
            fillOpacity: 0.1,
            strokeColor: '#4285f4',
            strokeOpacity: 0.3,
            strokeWeight: 1
          });
        }

        // Cria controle personalizado para tipo de mapa
        const mapTypeControl = document.createElement('div');
        mapTypeControl.style.cssText = `
          position: absolute;
          bottom: 20px;
          left: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          overflow: hidden;
          z-index: 1000;
          display: flex;
          flex-direction: column;
        `;

        const roadmapBtn = document.createElement('button');
        roadmapBtn.innerHTML = 'Mapa';
        roadmapBtn.style.cssText = `
          padding: 10px 15px;
          border: none;
          background: white;
          cursor: pointer;
          font-size: 13px;
          border-bottom: 1px solid #eee;
        `;

        const satelliteBtn = document.createElement('button');
        satelliteBtn.innerHTML = 'Satélite';
        satelliteBtn.style.cssText = `
          padding: 10px 15px;
          border: none;
          background: white;
          cursor: pointer;
          font-size: 13px;
        `;

        roadmapBtn.onclick = () => {
          map.current.setMapTypeId('roadmap');
          roadmapBtn.style.background = '#e3f2fd';
          satelliteBtn.style.background = 'white';
        };

        satelliteBtn.onclick = () => {
          map.current.setMapTypeId('satellite');
          satelliteBtn.style.background = '#e3f2fd';
          roadmapBtn.style.background = 'white';
        };

        mapTypeControl.appendChild(roadmapBtn);
        mapTypeControl.appendChild(satelliteBtn);
        mapContainer.current.appendChild(mapTypeControl);

        setMapLoaded(true);
        updateMapMarkers();
      };

      script.onerror = () => {
        console.error('Erro ao carregar Google Maps API');
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error('Erro ao carregar o Google Maps:', error);
    }
  };

  const updateMapMarkers = () => {
    if (!map.current || !window.google) return;

    // Limpa marcadores existentes
    // (Note: em uma implementação real, você manteria referências aos marcadores)

    // Adiciona marcadores dos caminhões
    trucks.forEach(truck => {
      if (!truck.location) return;

      const marker = new window.google.maps.Marker({
        position: { lat: truck.location.lat, lng: truck.location.lng },
        map: map.current,
        title: truck.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: truck.status === 'in-route' ? '#22c55e' : 
                   truck.status === 'maintenance' ? '#ef4444' : '#6b7280',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="p-3 min-w-[200px]">
            <h3 class="font-semibold text-base mb-2">${truck.name}</h3>
            <div class="space-y-1 text-sm">
              <p><strong>Placa:</strong> ${truck.plate}</p>
              <p><strong>Modelo:</strong> ${truck.model} (${truck.year})</p>
              <p><strong>Status:</strong> ${
                truck.status === 'in-route' ? 'Em movimento' : 
                truck.status === 'maintenance' ? 'Manutenção' : 'Disponível'
              }</p>
              ${truck.driver ? `<p><strong>Motorista:</strong> ${truck.driver}</p>` : ''}
              ${truck.currentRoute ? `<p><strong>Rota:</strong> ${truck.currentRoute}</p>` : ''}
              <p><strong>Km:</strong> ${truck.mileage.toLocaleString()}</p>
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map.current, marker);
      });
    });

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
        strokeWeight: 3
      });

      routeLine.setMap(map.current);

      route.points.forEach((point, index) => {
        const marker = new window.google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: map.current,
          title: point.address,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: point.type === 'origin' ? '#10b981' : 
                     point.type === 'destination' ? '#ef4444' : '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1
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
            <div class="p-2">
              <h4 class="font-medium">${point.address}</h4>
              <p class="text-sm text-gray-600">Tipo: ${point.type}</p>
              <p class="text-xs text-gray-500">CEP: ${point.cep}</p>
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
    if (userLocation) {
      initializeMap();
    }
  }, [userLocation]);

  useEffect(() => {
    if (map.current && mapLoaded && !trucksLoading && !routesLoading) {
      updateMapMarkers();
    }
  }, [trucks, routes, trucksLoading, routesLoading, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      {(trucksLoading || routesLoading || !mapLoaded) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            {!userLocation ? 'Obtendo localização...' : 'Carregando mapa...'}
          </div>
        </div>
      )}
      {locationError && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-lg shadow-lg text-sm">
          {locationError}
        </div>
      )}
      {userLocation && (
        <div className="absolute bottom-4 right-4 bg-white px-3 py-2 rounded-lg shadow-lg text-xs">
          📍 Sua localização: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
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
