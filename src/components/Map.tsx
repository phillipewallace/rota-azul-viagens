
import React, { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [trucks] = useState([
    { id: 1, name: 'Caminhão 001', lat: -23.5505, lng: -46.6333, status: 'moving', speed: 45, route: 'SP → RJ', eta: '14:30' },
    { id: 2, name: 'Caminhão 002', lat: -23.5605, lng: -46.6433, status: 'stopped', speed: 0, route: 'SP → MG', eta: '16:45' },
    { id: 3, name: 'Caminhão 003', lat: -23.5405, lng: -46.6233, status: 'moving', speed: 52, route: 'SP → PR', eta: '12:15' }
  ]);

  const initializeMap = async (apiKey: string) => {
    if (!mapContainer.current) return;

    try {
      // Carrega Google Maps API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        const map = new window.google.maps.Map(mapContainer.current!, {
          center: { lat: -23.5505, lng: -46.6333 },
          zoom: 10,
          styles: [
            {
              "elementType": "geometry",
              "stylers": [{"color": "#212121"}]
            },
            {
              "elementType": "labels.icon",
              "stylers": [{"visibility": "off"}]
            },
            {
              "elementType": "labels.text.fill",
              "stylers": [{"color": "#757575"}]
            },
            {
              "elementType": "labels.text.stroke",
              "stylers": [{"color": "#212121"}]
            },
            {
              "featureType": "administrative",
              "elementType": "geometry",
              "stylers": [{"color": "#757575"}]
            },
            {
              "featureType": "road",
              "elementType": "geometry.fill",
              "stylers": [{"color": "#2c2c2c"}]
            },
            {
              "featureType": "road",
              "elementType": "labels.text.fill",
              "stylers": [{"color": "#8a8a8a"}]
            },
            {
              "featureType": "water",
              "elementType": "geometry",
              "stylers": [{"color": "#000000"}]
            }
          ]
        });

        // Adiciona marcadores dos caminhões
        trucks.forEach(truck => {
          const marker = new window.google.maps.Marker({
            position: { lat: truck.lat, lng: truck.lng },
            map: map,
            title: truck.name,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: truck.status === 'moving' ? '#22c55e' : '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            }
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div class="p-2">
                <h3 class="font-semibold">${truck.name}</h3>
                <p class="text-sm">Status: ${truck.status === 'moving' ? 'Em movimento' : 'Parado'}</p>
                <p class="text-sm">Velocidade: ${truck.speed} km/h</p>
                <p class="text-sm">Rota: ${truck.route}</p>
                <p class="text-sm">ETA: ${truck.eta}</p>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });
        });
      };

      document.head.appendChild(script);
      setShowTokenInput(false);
    } catch (error) {
      console.error('Erro ao carregar o Google Maps:', error);
    }
  };

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (googleMapsKey.trim()) {
      initializeMap(googleMapsKey);
    }
  };

  if (showTokenInput) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold mb-4">Configure o Google Maps</h2>
          <p className="text-sm text-gray-600 mb-4">
            Para usar o mapa, você precisa inserir sua chave da API do Google Maps.
            Obtenha sua chave em: <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Google Cloud Console</a>
          </p>
          <form onSubmit={handleTokenSubmit}>
            <Input
              type="text"
              placeholder="Cole sua chave da API do Google Maps aqui"
              value={googleMapsKey}
              onChange={(e) => setGoogleMapsKey(e.target.value)}
              className="mb-4"
            />
            <Button type="submit" className="w-full">
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
    </div>
  );
};

// Adiciona tipos para Google Maps
declare global {
  interface Window {
    google: any;
  }
}

export default Map;
