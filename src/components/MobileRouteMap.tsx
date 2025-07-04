
import React, { useEffect, useRef, useState } from 'react';
import { googleMapsService } from '@/services/googleMaps';

interface MobileRouteMapProps {
  route: {
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      completed?: boolean;
    }>;
  };
}

const MobileRouteMap: React.FC<MobileRouteMapProps> = ({ route }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    const initializeMap = async () => {
      if (!mapContainer.current || !route.points?.length) {
        console.log('❌ Map container or points not available');
        return;
      }

      try {
        console.log('🗺️ Initializing mobile route map...');
        await googleMapsService.initialize();
        
        if (!window.google || !window.google.maps) {
          console.log('❌ Google Maps API not loaded');
          return;
        }

        const validPoints = route.points
          .filter(point => point.lat && point.lng && typeof point.lat === 'number' && typeof point.lng === 'number')
          .sort((a, b) => a.order - b.order);

        console.log('📍 Valid points:', validPoints.length);

        if (validPoints.length === 0) {
          console.log('❌ No valid points found');
          return;
        }

        // Calculate center point
        const centerLat = validPoints.reduce((sum, point) => sum + point.lat, 0) / validPoints.length;
        const centerLng = validPoints.reduce((sum, point) => sum + point.lng, 0) / validPoints.length;

        console.log('🎯 Map center:', { lat: centerLat, lng: centerLng });

        map.current = new window.google.maps.Map(mapContainer.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 12,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControl: true,
          mapTypeId: 'roadmap',
        });

        // Add markers for each point
        validPoints.forEach((point, index) => {
          const marker = new window.google.maps.Marker({
            position: { lat: point.lat, lng: point.lng },
            map: map.current,
            title: point.address,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: point.completed ? 8 : 10,
              fillColor: point.completed ? '#22c55e' : point.type === 'origin' ? '#3b82f6' : '#f59e0b',
              fillOpacity: point.completed ? 0.7 : 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            },
            label: {
              text: (index + 1).toString(),
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }
          });
        });

        // Draw route if more than one point
        if (validPoints.length > 1) {
          const origin = validPoints[0];
          const destination = validPoints[validPoints.length - 1];
          const waypoints = validPoints.slice(1, -1).map(point => ({
            location: new window.google.maps.LatLng(point.lat, point.lng),
            stopover: true
          }));

          const directionsService = new window.google.maps.DirectionsService();
          const directionsRenderer = new window.google.maps.DirectionsRenderer({
            map: map.current,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#3b82f6',
              strokeWeight: 4,
              strokeOpacity: 0.8
            }
          });

          directionsService.route({
            origin: new window.google.maps.LatLng(origin.lat, origin.lng),
            destination: new window.google.maps.LatLng(destination.lat, destination.lng),
            waypoints: waypoints,
            travelMode: window.google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
          }, (result: any, status: string) => {
            if (status === 'OK') {
              directionsRenderer.setDirections(result);
              console.log('✅ Route drawn successfully');
            } else {
              console.error('❌ Directions service failed:', status);
            }
          });
        }

        setMapLoaded(true);
        console.log('✅ Mobile route map initialized successfully');
      } catch (error) {
        console.error('❌ Error initializing mobile route map:', error);
      }
    };

    initializeMap();
  }, [route]);

  if (!route.points?.length) {
    return (
      <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Nenhuma rota disponível</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-64 bg-gray-200 rounded-lg overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm">Carregando mapa...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileRouteMap;
