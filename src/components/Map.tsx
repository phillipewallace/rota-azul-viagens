
import React, { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(true);
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  const initializeMap = async (apiKey: string) => {
    if (!mapContainer.current) return;

    try {
      // Remove script anterior se existir
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Carrega Google Maps API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
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

        updateMapMarkers();
      };

      script.onerror = () => {
        console.error('Erro ao carregar Google Maps API');
        alert('Erro ao carregar Google Maps. Verifique sua chave da API.');
      };

      document.head.appendChild(script);
      setShowTokenInput(false);
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
    if (map.current && !trucksLoading && !routesLoading) {
      updateMapMarkers();
    }
  }, [trucks, routes, trucksLoading, routesLoading]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (googleMapsKey.trim()) {
      localStorage.setItem('googleMapsApiKey', googleMapsKey);
      initializeMap(googleMapsKey);
    }
  };

  // Verifica se já existe uma chave salva
  useEffect(() => {
    const savedKey = localStorage.getItem('googleMapsApiKey');
    if (savedKey) {
      setGoogleMapsKey(savedKey);
      initializeMap(savedKey);
    }
  }, []);

  if (showTokenInput) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold mb-4">Configure o Google Maps</h2>
          <p className="text-sm text-gray-600 mb-4">
            Para usar o mapa, você precisa inserir sua chave da API do Google Maps.
            Obtenha sua chave em: <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Google Cloud Console</a>
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Cole sua chave da API do Google Maps aqui"
              value={googleMapsKey}
              onChange={(e) => setGoogleMapsKey(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={!googleMapsKey.trim()}>
              Carregar Mapa
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      {(trucksLoading || routesLoading) && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Carregando dados...
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
