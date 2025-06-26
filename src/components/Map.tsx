import React, { useEffect, useRef, useState } from 'react';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  const initializeMap = async () => {
    if (!mapContainer.current) return;

    try {
      // Remove script anterior se existir
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Carrega Google Maps API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (!mapContainer.current) return;

        map.current = new window.google.maps.Map(mapContainer.current, {
          center: { lat: -23.5505, lng: -46.6333 },
          zoom: 10,
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

    // Adiciona rotas no mapa
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

      // Adiciona marcadores para pontos da rota
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
    initializeMap();
  }, []);

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
            Carregando mapa...
          </div>
        </div>
      )}
    </div>
  );
};

// Declara tipos para Google Maps
declare global {
  interface Window {
    google: any;
  }
}

export default Map;
