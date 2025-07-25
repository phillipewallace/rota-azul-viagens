
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TruckData {
  id: string;
  name: string;
  plate: string;
  model: string;
  currentRoute?: {
    id: string;
    name: string;
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      completed?: boolean;
    }>;
    polyline?: string;
  };
}

interface MobileRouteMapProps {
  truckData: TruckData;
}

const MobileRouteMap: React.FC<MobileRouteMapProps> = ({ truckData }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!truckData.currentRoute?.points || truckData.currentRoute.points.length === 0) {
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        // Verificar se o Google Maps já está carregado
        if (window.google && window.google.maps) {
          initializeMap();
          return;
        }

        // Carregar Google Maps
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w&libraries=geometry`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          initializeMap();
        };
        
        script.onerror = () => {
          setError('Erro ao carregar Google Maps');
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('Erro ao carregar mapa:', error);
        setError('Erro ao inicializar mapa');
      }
    };

    const initializeMap = () => {
      if (!mapRef.current || !truckData.currentRoute?.points) return;

      const points = truckData.currentRoute.points;
      const bounds = new window.google.maps.LatLngBounds();

      // Criar mapa
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 10,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });

      // Adicionar marcadores
      points.forEach((point, index) => {
        const position = new window.google.maps.LatLng(point.lat, point.lng);
        bounds.extend(position);

        const marker = new window.google.maps.Marker({
          position,
          map,
          title: point.address,
          icon: {
            url: point.completed 
              ? 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#22c55e"/>
                  <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              `)
              : 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#ef4444"/>
                  <text x="12" y="17" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="white">${index + 1}</text>
                </svg>
              `),
            scaledSize: new window.google.maps.Size(24, 24),
            anchor: new window.google.maps.Point(12, 12),
          },
        });

        // InfoWindow para cada ponto
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 200px;">
              <strong>Ponto ${index + 1}</strong><br>
              ${point.address}<br>
              <span style="color: ${point.completed ? '#22c55e' : '#ef4444'};">
                ${point.completed ? '✅ Concluído' : '⏳ Pendente'}
              </span>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      });

      // Desenhar rota se houver polyline
      if (truckData.currentRoute.polyline) {
        const decodedPath = window.google.maps.geometry.encoding.decodePath(truckData.currentRoute.polyline);
        
        const routePath = new window.google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 1.0,
          strokeWeight: 3,
        });

        routePath.setMap(map);
      }

      // Ajustar zoom para mostrar todos os pontos
      map.fitBounds(bounds);
      setMapLoaded(true);
    };

    loadGoogleMaps();
  }, [truckData.currentRoute]);

  if (!truckData.currentRoute) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Nenhuma rota atribuída a este caminhão</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const completedPoints = truckData.currentRoute.points.filter(p => p.completed).length;
  const totalPoints = truckData.currentRoute.points.length;

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{truckData.currentRoute.name}</h3>
            <Badge variant="outline">
              {completedPoints}/{totalPoints} pontos
            </Badge>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full" 
              style={{ width: `${(completedPoints / totalPoints) * 100}%` }}
            />
          </div>
        </div>
        
        <div 
          ref={mapRef}
          className="w-full h-96 bg-gray-100 flex items-center justify-center"
        >
          {!mapLoaded && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-gray-500">Carregando mapa...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MobileRouteMap;
