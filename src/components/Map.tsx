import React, { useEffect, useRef, useState } from 'react';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { googleMapsService } from '@/services/googleMaps';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

const MapComponent = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isMapTypeVisible, setIsMapTypeVisible] = useState(false);
  const directionsRenderers = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  // Cores fixas para cada caminhão
  const truckColors = [
    '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#10b981', '#f97316',
    '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'
  ];

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
      
      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps API não carregada');
      }
      
      map.current = new window.google.maps.Map(mapContainer.current, {
        center: userLocation,
        zoom: 12,
        mapTypeControl: false,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: false,
        mapTypeControlOptions: {
          position: window.google.maps.ControlPosition.BOTTOM_RIGHT,
          style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU
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
      try {
        renderer.setMap(null);
      } catch (error) {
        console.error('Error clearing directions renderer:', error);
      }
    });
    directionsRenderers.current = [];
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => {
      try {
        marker.setMap(null);
      } catch (error) {
        console.error('Error clearing marker:', error);
      }
    });
    markersRef.current = [];
  };

  const createTruckIcon = (color: string) => {
    return {
      path: 'M23.5 7c.276 0 .5.224.5.5v9c0 .276-.224.5-.5.5h-2.5v2c0 .828-.672 1.5-1.5 1.5h-1c-.828 0-1.5-.672-1.5-1.5v-2h-8v2c0 .828-.672 1.5-1.5 1.5h-1c-.828 0-1.5-.672-1.5-1.5v-2H3.5c-.276 0-.5-.224-.5-.5v-9c0-.276.224-.5.5-.5h1v-2c0-.552.448-1 1-1h14c.552 0 1 .448 1 1v2h1zm-2-2H5.5v1.5h16V5zM5 8.5v6h14v-6H5zm2.5 7.5c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1zm9 0c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 1.2,
      anchor: new window.google.maps.Point(12, 20)
    };
  };

  const updateMapMarkers = async () => {
    if (!map.current || !window.google || !mapLoaded) return;

    console.log('🎯 Atualizando marcadores:', { trucks: trucks?.length || 0, routes: routes?.length || 0 });

    clearDirectionsRenderers();
    clearMarkers();
    
    if (!Array.isArray(trucks)) return;
    
    // Criar mapa de cores por caminhão para consistência
    const truckColorMap = new Map();
    trucks.forEach((truck, index) => {
      truckColorMap.set(truck.id, truckColors[index % truckColors.length]);
    });
    
    trucks.forEach((truck) => {
      if (!truck.location || typeof truck.location.lat !== 'number' || typeof truck.location.lng !== 'number') return;

      const truckColor = truckColorMap.get(truck.id);
      
      try {
        const marker = new window.google.maps.Marker({
          position: { lat: truck.location.lat, lng: truck.location.lng },
          map: map.current,
          title: truck.name,
          icon: createTruckIcon(truckColor),
        });

        markersRef.current.push(marker);

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: ${truckColor};">🚛 ${truck.name}</h3>
              <div style="font-size: 13px; line-height: 1.4;">
                <div><strong>Placa:</strong> ${truck.plate}</div>
                <div><strong>Status:</strong> ${truck.status === 'available' ? 'Disponível' : truck.status === 'in-route' ? 'Em Rota' : 'Manutenção'}</div>
                ${truck.currentRouteName ? `<div><strong>Rota:</strong> ${truck.currentRouteName}</div>` : ''}
                ${truck.driverName ? `<div><strong>Motorista:</strong> ${truck.driverName}</div>` : ''}
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map.current, marker);
        });

        // Só desenhar a rota se o caminhão tem uma rota atribuída E está em rota
        if (truck.currentRoute && truck.status === 'in-route' && Array.isArray(routes)) {
          const route = routes.find(r => r.id === truck.currentRoute);
          if (route && route.points && route.points.length >= 2) {
            drawTruckRoute(route, truckColor);
          }
        }
      } catch (error) {
        console.error('Error creating truck marker:', error);
      }
    });
  };

  const drawTruckRoute = async (route: any, color: string) => {
    if (!route.points || route.points.length < 2 || !window.google) return;

    try {
      const validPoints = route.points
        .filter((point: any) => point.lat && point.lng && typeof point.lat === 'number' && typeof point.lng === 'number')
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
        optimizeWaypoints: false,
        avoidHighways: false,
        avoidTolls: false
      }, (result: any, status: string) => {
        if (status === 'OK' && result) {
          try {
            const directionsRenderer = new window.google.maps.DirectionsRenderer({
              directions: result,
              map: map.current,
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: color,
                strokeWeight: 5,
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
          } catch (error) {
            console.error('Error creating directions renderer:', error);
          }
        } else {
          console.error('Directions service failed:', status);
        }
      });

    } catch (error) {
      console.error('Erro ao desenhar rota:', error);
    }
  };

  const toggleMapType = () => {
    if (!map.current) return;
    
    const currentType = map.current.getMapTypeId();
    const newType = currentType === 'roadmap' ? 'satellite' : 'roadmap';
    map.current.setMapTypeId(newType);
    setIsMapTypeVisible(!isMapTypeVisible);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDirectionsRenderers();
      clearMarkers();
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-gray-100">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Botão de Tipo de Mapa movido para canto inferior esquerdo */}
      {mapLoaded && (
        <Button
          onClick={toggleMapType}
          className="absolute bottom-4 left-4 z-10 bg-white hover:bg-gray-50 text-gray-700 border shadow-lg"
          size="sm"
        >
          <MapPin className="h-4 w-4 mr-2" />
          {isMapTypeVisible ? 'Mapa' : 'Satélite'}
        </Button>
      )}
      
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

export default MapComponent;
