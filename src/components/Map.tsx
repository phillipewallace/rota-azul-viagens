
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
  const markersRef = useRef<any[]>([]);
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  // Cores para diferentes caminhões/rotas
  const truckColors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#f97316'];

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
      path: 'M29.395,0H17.636c-3.117,0-5.643,3.467-5.643,6.584v34.804c0,3.116,2.526,5.644,5.643,5.644h11.759 c3.116,0,5.644-2.527,5.644-5.644V6.584C35.037,3.467,32.511,0,29.395,0z M34.05,14.188v11.665l-2.729,0.351v-4.806L34.05,14.188z M32.618,10.773c-1.016,3.9-2.219,8.51-2.219,8.51H16.631c0,0-1.203-4.61-2.219-8.51 C14.412,10.773,23.293,7.755,32.618,10.773z M15.741,21.284v4.806l-2.73-0.351V14.188L15.741,21.284z M13.011,37.94 c-0.685-2.225-1.216-4.75-1.216-4.75v-27.47c0-2.794,1.965-5.064,4.397-5.735v34.863C15.598,35.477,14.131,36.659,13.011,37.94z M18.72,39.968c-2.048-1.322-3.329-3.635-3.329-6.176v-0.83c0-0.185,0.148-0.334,0.334-0.334h2.995V39.968z M18.72,30.389h-2.995 c-0.185,0-0.334-0.148-0.334-0.334v-8.704c0-0.185,0.148-0.334,0.334-0.334h2.995V30.389z M25.207,33.82c0,0.934-0.757,1.691-1.691,1.691 c-0.934,0-1.691-0.757-1.691-1.691c0-0.934,0.757-1.691,1.691-1.691C24.45,32.129,25.207,32.886,25.207,33.82z M28.691,3.056 c3.814,0,6.904,3.09,6.904,6.904s-3.09,6.904-6.904,6.904s-6.904-3.09-6.904-6.904S24.877,3.056,28.691,3.056z M28.691,39.968 V32.628h2.995c0.185,0,0.334,0.148,0.334,0.334v0.83c0,2.541-1.281,4.854-3.329,6.176V39.968z M28.691,30.389V21.017h2.995 c0.185,0,0.334,0.148,0.334,0.334v8.704c0,0.185-0.148,0.334-0.334,0.334H28.691z M32.618,37.94 c-1.12-1.281-2.587-2.463-3.181-3.032V0.843c2.432,0.671,4.397,2.941,4.397,5.735v27.47C33.834,33.19,33.303,35.715,32.618,37.94z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 0.8,
      anchor: new window.google.maps.Point(23, 46)
    };
  };

  const updateMapMarkers = async () => {
    if (!map.current || !window.google || !mapLoaded) return;

    console.log('🎯 Atualizando marcadores:', { trucks: trucks?.length || 0, routes: routes?.length || 0 });

    clearDirectionsRenderers();
    clearMarkers();
    
    if (!Array.isArray(trucks)) return;
    
    trucks.forEach((truck, index) => {
      if (!truck.location || typeof truck.location.lat !== 'number' || typeof truck.location.lng !== 'number') return;

      const truckColor = truckColors[index % truckColors.length];
      
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

        // Se o caminhão tem uma rota ativa, desenhar a rota
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

    // Rotas sem caminhões atribuídos (rotas ativas mas não em uso)
    if (Array.isArray(routes)) {
      routes.forEach((route, index) => {
        if (route.status !== 'active') return;
        
        const routeInUse = trucks.some(truck => truck.currentRoute === route.id);
        if (routeInUse) return;
        
        if (route.points && route.points.length >= 2) {
          drawTruckRoute(route, '#6b7280');
        }
      });
    }
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
                  scale: 8,
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
