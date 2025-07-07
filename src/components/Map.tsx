import React, { useEffect, useRef, useState } from 'react';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { googleMapsService } from '@/services/googleMaps';
import { trafficService } from '@/services/traffic';
import { Locate } from 'lucide-react';

const MapComponent = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentMapType, setCurrentMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const directionsRenderers = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const userLocationMarker = useRef<any>(null);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [realTimeTraffic, setRealTimeTraffic] = useState<any[]>([]);
  const [activeTrucks, setActiveTrucks] = useState<Set<string>>(new Set());
  
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  const truckColors = [
    '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#10b981', '#f97316',
    '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'
  ];

  const mapTypes = [
    { id: 'roadmap', label: 'Mapa' },
    { id: 'satellite', label: 'Satélite' },
    { id: 'hybrid', label: 'Híbrido' },
    { id: 'terrain', label: 'Terreno' }
  ] as const;

  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError('Geolocalização não suportada');
        resolve(null);
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
          console.log('📍 Localização obtida:', newLocation);
          resolve(newLocation);
        },
        (error) => {
          console.error('❌ Erro GPS:', error);
          setLocationError('Erro ao obter localização GPS');
          const defaultLocation = { lat: -19.9167, lng: -44.0833 };
          setUserLocation(defaultLocation);
          resolve(defaultLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
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
        mapTypeId: currentMapType,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      setMapLoaded(true);
      console.log('🗺️ Mapa inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar mapa:', error);
      setLocationError('Erro ao carregar o mapa');
    }
  };

  const toggleTrafficLayer = () => {
    if (!map.current) return;

    if (trafficEnabled) {
      trafficService.disableTrafficLayer();
      setTrafficEnabled(false);
    } else {
      trafficService.enableTrafficLayer(map.current);
      setTrafficEnabled(true);
    }
  };

  const updateRealTimeTraffic = async () => {
    if (!map.current) return;

    try {
      const bounds = map.current.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        const trafficData = await trafficService.getRealTimeTrafficData({
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng()
        });
        
        setRealTimeTraffic(trafficData);
      }
    } catch (error) {
      console.error('Error updating real-time traffic:', error);
    }
  };

  const changeMapType = () => {
    const currentIndex = mapTypes.findIndex(type => type.id === currentMapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    const nextMapType = mapTypes[nextIndex].id;
    
    setCurrentMapType(nextMapType);
    
    if (map.current) {
      map.current.setMapTypeId(nextMapType);
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

  const updateUserLocationMarker = () => {
    if (!map.current || !userLocation || !window.google) return;

    if (userLocationMarker.current) {
      userLocationMarker.current.setMap(null);
    }

    userLocationMarker.current = new window.google.maps.Marker({
      position: userLocation,
      map: map.current,
      title: 'Sua localização atual',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      },
      zIndex: 1000
    });

    console.log('📍 Marcador de localização atualizado');
  };

  const createTruckIcon = (color: string, isTracked: boolean = false) => {
    const size = isTracked ? 44 : 36;
    const strokeWidth = isTracked ? 3 : 2;
    const shadowSize = isTracked ? 6 : 4;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="${shadowSize/2}" stdDeviation="${shadowSize/2}" flood-color="rgba(0,0,0,0.3)"/>
            </filter>
            <linearGradient id="truckGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${adjustBrightness(color, -20)};stop-opacity:1" />
            </linearGradient>
          </defs>
          
          <!-- Truck body -->
          <rect x="2" y="8" width="12" height="8" rx="1" 
                fill="url(#truckGradient)" 
                stroke="${isTracked ? '#22c55e' : '#ffffff'}" 
                stroke-width="${strokeWidth}" 
                filter="url(#shadow)"/>
          
          <!-- Truck cab -->
          <rect x="14" y="10" width="6" height="6" rx="1" 
                fill="url(#truckGradient)" 
                stroke="${isTracked ? '#22c55e' : '#ffffff'}" 
                stroke-width="${strokeWidth}" 
                filter="url(#shadow)"/>
          
          <!-- Wheels -->
          <circle cx="6" cy="17" r="2" 
                  fill="#2d3748" 
                  stroke="#ffffff" 
                  stroke-width="1"/>
          <circle cx="17" cy="17" r="2" 
                  fill="#2d3748" 
                  stroke="#ffffff" 
                  stroke-width="1"/>
          
          <!-- Details -->
          <rect x="15" y="11" width="2" height="1.5" rx="0.2" fill="#87ceeb" opacity="0.8"/>
          <rect x="15" y="13" width="2" height="1.5" rx="0.2" fill="#87ceeb" opacity="0.8"/>
          
          ${isTracked ? `
          <!-- Tracking indicator -->
          <circle cx="20" cy="6" r="3" fill="#22c55e" stroke="#ffffff" stroke-width="2">
            <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
          </circle>
          <text x="20" y="8" text-anchor="middle" font-size="8" fill="white" font-weight="bold">●</text>
          ` : ''}
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size/2, size),
      labelOrigin: new window.google.maps.Point(size/2, -8)
    };
  };

  const adjustBrightness = (hex: string, percent: number) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const B = (num >> 8 & 0x00FF) + amt;
    const G = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
  };

  const updateMapMarkers = async () => {
    if (!map.current || !window.google || !mapLoaded) return;

    console.log('🎯 Atualizando marcadores:', { trucks: trucks?.length || 0, routes: routes?.length || 0 });

    clearDirectionsRenderers();
    clearMarkers();
    
    updateUserLocationMarker();
    
    if (!Array.isArray(trucks)) return;
    
    const truckColorMap = new Map();
    trucks.forEach((truck, index) => {
      truckColorMap.set(truck.id, truckColors[index % truckColors.length]);
    });
    
    const activeTracking = Array.from(activeTrucks);
    
    trucks.forEach((truck) => {
      if (!truck.location || typeof truck.location.lat !== 'number' || typeof truck.location.lng !== 'number') return;

      const truckColor = truckColorMap.get(truck.id);
      const isActivelyTracked = activeTracking.includes(truck.id);
      
      try {
        const marker = new window.google.maps.Marker({
          position: { lat: truck.location.lat, lng: truck.location.lng },
          map: map.current,
          title: truck.name,
          icon: createTruckIcon(truckColor, isActivelyTracked),
          zIndex: isActivelyTracked ? 1000 : 100
        });

        markersRef.current.push(marker);

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: ${truckColor};">${isActivelyTracked ? '📍' : '🚛'} ${truck.name}</h3>
              <div style="font-size: 13px; line-height: 1.4;">
                <div><strong>Placa:</strong> ${truck.plate}</div>
                <div><strong>Status:</strong> ${truck.status === 'available' ? 'Disponível' : truck.status === 'in-route' ? 'Em Rota' : 'Manutenção'}</div>
                ${isActivelyTracked ? '<div style="color: #22c55e;"><strong>📍 Rastreamento Ativo</strong></div>' : ''}
                ${truck.currentRouteName ? `<div><strong>Rota:</strong> ${truck.currentRouteName}</div>` : ''}
                ${truck.driverName ? `<div><strong>Motorista:</strong> ${truck.driverName}</div>` : ''}
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map.current, marker);
        });

        if (truck.currentRoute && truck.status === 'in-route' && Array.isArray(routes)) {
          const route = routes.find(r => r.id === truck.currentRoute);
          if (route && route.points && route.points.length >= 2) {
            drawTruckRoute(route, truckColor, isActivelyTracked);
          }
        }
      } catch (error) {
        console.error('Error creating truck marker:', error);
      }
    });
  };

  const drawTruckRoute = async (route: any, color: string, isTracked: boolean = false) => {
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
                strokeWeight: isTracked ? 6 : 5,
                strokeOpacity: isTracked ? 1 : 0.8,
                icons: isTracked ? [
                  {
                    icon: {
                      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                      scale: 3,
                      strokeColor: color
                    },
                    offset: '100%',
                    repeat: '50px'
                  }
                ] : undefined
              },
              markerOptions: {
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: isTracked ? 8 : 6,
                  fillColor: color,
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2
                }
              }
            });

            directionsRenderers.current.push(directionsRenderer);
            console.log('✅ Rota desenhada com sucesso para:', route.name, isTracked ? '(Rastreada)' : '');
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

  const centerOnUserLocation = async () => {
    if (!map.current) return;
    
    try {
      const location = await getCurrentLocation();
      if (location) {
        map.current.panTo(location);
        map.current.setZoom(16);
        console.log('📍 Mapa centralizado na localização do usuário');
      }
    } catch (error) {
      console.error('Erro ao centralizar na localização:', error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'active-truck-tracking') {
        try {
          const activeTruckIds = JSON.parse(e.newValue || '[]');
          setActiveTrucks(new Set(activeTruckIds));
          console.log('📍 Active truck tracking updated:', activeTruckIds);
        } catch (error) {
          console.error('Error parsing active truck tracking:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    try {
      const stored = localStorage.getItem('active-truck-tracking');
      if (stored) {
        const activeTruckIds = JSON.parse(stored);
        setActiveTrucks(new Set(activeTruckIds));
      }
    } catch (error) {
      console.error('Error loading initial tracking state:', error);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

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

  useEffect(() => {
    if (mapLoaded && userLocation) {
      updateUserLocationMarker();
    }
  }, [userLocation, mapLoaded]);

  useEffect(() => {
    if (mapLoaded && trafficEnabled) {
      updateRealTimeTraffic();
      const trafficInterval = setInterval(updateRealTimeTraffic, 60000);
      return () => clearInterval(trafficInterval);
    }
  }, [mapLoaded, trafficEnabled]);

  useEffect(() => {
    if (mapLoaded && map.current && trafficEnabled) {
      trafficService.enableTrafficLayer(map.current);
    }
  }, [mapLoaded]);

  useEffect(() => {
    return () => {
      clearDirectionsRenderers();
      clearMarkers();
      if (userLocationMarker.current) {
        userLocationMarker.current.setMap(null);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full bg-gray-100">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      {/* Controles do mapa */}
      {mapLoaded && (
        <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
          <button
            onClick={changeMapType}
            className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors"
          >
            {mapTypes.find(type => type.id === currentMapType)?.label}
          </button>
          
          <button
            onClick={toggleTrafficLayer}
            className={`border border-gray-300 rounded-lg shadow-lg px-4 py-2 text-sm font-medium transition-colors ${
              trafficEnabled 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            🚦 Trânsito
          </button>

          <button
            onClick={centerOnUserLocation}
            className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-lg p-2 text-gray-700 transition-colors flex items-center justify-center"
            title="Centralizar na minha localização"
          >
            <Locate className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Indicador de trânsito em tempo real */}
      {mapLoaded && trafficEnabled && realTimeTraffic.length > 0 && (
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-sm z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">Trânsito em Tempo Real</span>
          </div>
          <div className="text-xs text-gray-600">
            Última atualização: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {!mapLoaded && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border z-10">
          <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            {!userLocation ? '📍 Obtendo localização...' : '🗺️ Carregando mapa...'}
          </div>
        </div>
      )}

      {/* Error indicator */}
      {locationError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm text-center z-10">
          <div className="font-medium mb-1">⚠️ Aviso</div>
          <div>{locationError}</div>
        </div>
      )}

      {/* Contador de caminhões ativos */}
      {activeTrucks.size > 0 && (
        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium z-10">
          📍 {activeTrucks.size} caminhão{activeTrucks.size > 1 ? 'ões' : ''} rastreado{activeTrucks.size > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default MapComponent;
