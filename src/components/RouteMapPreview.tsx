
import React, { useEffect, useRef } from 'react';
import { googleMapsService } from '@/services/googleMaps';

interface RouteMapPreviewProps {
  route: any;
}

const RouteMapPreview: React.FC<RouteMapPreviewProps> = ({ route }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);

  useEffect(() => {
    initializeMap();
    return () => cleanup();
  }, [route]);

  const cleanup = () => {
    if (directionsRenderer.current) {
      directionsRenderer.current.setMap(null);
      directionsRenderer.current = null;
    }
    if (mapInstance.current) {
      mapInstance.current = null;
    }
  };

  const initializeMap = async () => {
    if (!mapContainer.current || !route?.points?.length) return;

    try {
      await googleMapsService.initialize();

      if (!window.google?.maps) {
        console.error('Google Maps não carregado');
        return;
      }

      // Calculate center from route points
      const validPoints = route.points.filter((p: any) => p.lat && p.lng);
      if (validPoints.length === 0) return;

      const center = {
        lat: validPoints.reduce((sum: number, p: any) => sum + p.lat, 0) / validPoints.length,
        lng: validPoints.reduce((sum: number, p: any) => sum + p.lng, 0) / validPoints.length
      };

      mapInstance.current = new window.google.maps.Map(mapContainer.current, {
        center,
        zoom: 12,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });

      await drawRoute();
    } catch (error) {
      console.error('Erro ao inicializar mapa de preview:', error);
    }
  };

  const drawRoute = async () => {
    if (!mapInstance.current || !route?.points?.length || route.points.length < 2) return;

    try {
      const sortedPoints = route.points
        .filter((p: any) => p.lat && p.lng && typeof p.lat === 'number' && typeof p.lng === 'number')
        .sort((a: any, b: any) => a.order - b.order);

      if (sortedPoints.length < 2) return;

      const directionsService = new window.google.maps.DirectionsService();
      directionsRenderer.current = new window.google.maps.DirectionsRenderer({
        map: mapInstance.current,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      });

      const origin = sortedPoints[0];
      const destination = sortedPoints[sortedPoints.length - 1];
      const waypoints = sortedPoints.slice(1, -1).map((point: any) => ({
        location: new window.google.maps.LatLng(point.lat, point.lng),
        stopover: true
      }));

      directionsService.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
      }, (result: any, status: string) => {
        if (status === 'OK' && directionsRenderer.current) {
          directionsRenderer.current.setDirections(result);
        } else {
          console.error('Erro ao desenhar rota:', status);
        }
      });

    } catch (error) {
      console.error('Erro ao desenhar rota:', error);
    }
  };

  return (
    <div className="w-full h-80 bg-gray-100 rounded-lg border overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default RouteMapPreview;
