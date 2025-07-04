
import React, { useEffect, useRef, useState } from 'react';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { googleMapsService } from '@/services/googleMaps';

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const directionsRenderers = useRef<any[]>([]);
  
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
        setUserLocation({ lat: -23.5505, lng: -46.6333 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const initializeMap = async () => {
    if (!mapContainer.current || !userLocation || mapLoaded) return;

    try {
      await googleMapsService.initialize();
      
      map.current = new window.google.maps.Map(mapContainer.current, {
        center: userLocation,
        zoom: 12,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true,
        mapTypeControlOptions: {
          position: window.google.maps.ControlPosition.BOTTOM_RIGHT,
          style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU
        },
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.BOTTOM_RIGHT
        },
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Marcador da base
      new window.google.maps.Marker({
        position: userLocation,
        map: map.current,
        title: 'Base/Galpão - AlchemyRotas',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#1e40af',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        },
      });

      setMapLoaded(true);
      console.log('🗺️ Mapa inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar mapa:', error);
      setLocationError('Erro ao carregar o mapa');
    }
  };

  const clearDirectionsRenderers = () => {
    directionsRenderers.current.forEach(renderer => {
      renderer.setMap(null);
    });
    directionsRenderers.current = [];
  };

  const updateMapMarkers = async () => {
    if (!map.current || !window.google || !mapLoaded) return;

    console.log('🎯 Atualizando marcadores:', { trucks: trucks.length, routes: routes.length });

    // Limpar renderers anteriores
    clearDirectionsRenderers();

    // Cores para diferentes caminhões/rotas
    const truckColors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];
    
    // Marcadores dos caminhões
    trucks.forEach((truck, index) => {
      if (!truck.location) return;

      const truckColor = truckColors[index % truckColors.length];
      
      // Ícone customizado de caminhão
      const truckIcon = {
        path: 'M2,18 L2,11 L0,11 L0,6 L17,6 L17,8 L20,8 L20,18 L18,18 L18,20 L16,20 L16,18 L6,18 L6,20 L4,20 L4,18 L2,18 Z M2,8 L2,16 L16,16 L16,8 L2,8 Z M18,10 L18,16 L20,16 L20,10 L18,10 Z M3,13 L3,15 L5,15 L5,13 L3,13 Z M17,13 L17,15 L19,15 L19,13 L17,13 Z',
        fillColor: truckColor,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 1.2,
        anchor: new window.google.maps.Point(10, 10)
      };

      const marker = new window.google.maps.Marker({
        position: { lat: truck.location.lat, lng: truck.location.lng },
        map: map.current,
        title: truck.name,
        icon: truckIcon,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: ${truckColor};">🚛 ${truck.name}</h3>
            <div style="font-size: 13px; line-height: 1.4;">
              <div><strong>Placa:</strong> ${truck.plate}</div>
              <div><strong>Status:</strong> ${truck.status}</div>
              ${truck.currentRoute ? `<div><strong>Rota:</strong> ${truck.currentRoute}</div>` : ''}
              ${truck.driver ? `<div><strong>Motorista:</strong> ${truck.driver}</div>` : ''}
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map.current, marker);
      });

      // Se o caminhão tem uma rota ativa, desenhar a rota
      if (truck.currentRoute && truck.status === 'in-route') {
        const route = routes.find(r => r.name === truck.currentRoute);
        if (route && route.points && route.points.length >= 2) {
          drawTruckRoute(route, truckColor);
        }
      }
    });

    // Rotas sem caminhões atribuídos (rotas ativas mas não em uso)
    routes.forEach((route, index) => {
      if (route.status !== 'active') return;
      
      const routeInUse = trucks.some(truck => truck.currentRoute === route.name);
      if (routeInUse) return; // Já foi desenhada acima
      
      if (route.points && route.points.length >= 2) {
        drawTruckRoute(route, '#6b7280'); // Cor cinza para rotas não ativas
      }
    });
  };

  const drawTruckRoute = async (route: any, color: string) => {
    if (!route.points || route.points.length < 2) return;

    try {
      const validPoints = route.points
        .filter((point: any) => point.lat && point.lng)
        .sort((a: any, b: any) => a.order - b.order);

      if (validPoints.length < 2) return;

      const origin = validPoints[0];
      const destination = validPoints[validPoints.length - 1];
      const waypoints = validPoints.slice(1, -1).map((point: any) => ({
        location: new window.google.maps.LatLng(point.lat, point.lng),
        stopover: true
      }));

      const directionsService = new window.google.maps.DirectionsService();
      
      directionsService.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
      }, (result: any, status: string) => {
        if (status === 'OK') {
          const directionsRenderer = new window.google.maps.DirectionsRenderer({
            directions: result,
            map: map.current,
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: color,
              strokeWeight: 4,
              strokeOpacity: 0.8
            },
            markerOptions: {
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            }
          });

          directionsRenderers.current.push(directionsRenderer);
        }
      });

    } catch (error) {
      console.error('Erro ao desenhar rota:', error);
    }
  };

  useEffect(() => {
    getCurrentLocation();
    const locationInterval = setInterval(getCurrentLocation, 30000);
    return () => clearInterval(locationInterval);
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

export default Map;
