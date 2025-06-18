
import React, { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [trucks] = useState([
    { id: 1, name: 'Caminhão 001', lat: -23.5505, lng: -46.6333, status: 'moving', speed: 45, route: 'SP → RJ', eta: '14:30' },
    { id: 2, name: 'Caminhão 002', lat: -23.5605, lng: -46.6433, status: 'stopped', speed: 0, route: 'SP → MG', eta: '16:45' },
    { id: 3, name: 'Caminhão 003', lat: -23.5405, lng: -46.6233, status: 'moving', speed: 52, route: 'SP → PR', eta: '12:15' }
  ]);

  const initializeMap = async (token: string) => {
    if (!mapContainer.current) return;

    try {
      const mapboxgl = await import('mapbox-gl');
      await import('mapbox-gl/dist/mapbox-gl.css');

      mapboxgl.default.accessToken = token;
      
      const map = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-46.6333, -23.5505],
        zoom: 10,
        pitch: 0,
        bearing: 0
      });

      map.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

      map.on('load', () => {
        // Add truck markers
        trucks.forEach(truck => {
          const el = document.createElement('div');
          el.className = `w-4 h-4 rounded-full border-2 border-white ${
            truck.status === 'moving' ? 'bg-truck-green' : 'bg-truck-red'
          } shadow-lg`;
          
          const popup = new mapboxgl.default.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${truck.name}</h3>
              <p class="text-sm">Status: ${truck.status === 'moving' ? 'Em movimento' : 'Parado'}</p>
              <p class="text-sm">Velocidade: ${truck.speed} km/h</p>
              <p class="text-sm">Rota: ${truck.route}</p>
              <p class="text-sm">ETA: ${truck.eta}</p>
            </div>
          `);
          
          new mapboxgl.default.Marker(el)
            .setLngLat([truck.lng, truck.lat])
            .setPopup(popup)
            .addTo(map);
        });
      });

      setShowTokenInput(false);
    } catch (error) {
      console.error('Erro ao carregar o mapa:', error);
    }
  };

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mapboxToken.trim()) {
      initializeMap(mapboxToken);
    }
  };

  if (showTokenInput) {
    return (
      <div className="flex items-center justify-center h-full bg-map-dark">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <h2 className="text-xl font-semibold mb-4">Configure o Mapbox</h2>
          <p className="text-sm text-gray-600 mb-4">
            Para usar o mapa, você precisa inserir seu token público do Mapbox.
            Obtenha seu token em: <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">mapbox.com</a>
          </p>
          <form onSubmit={handleTokenSubmit}>
            <Input
              type="text"
              placeholder="Cole seu token público do Mapbox aqui"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
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

export default Map;
