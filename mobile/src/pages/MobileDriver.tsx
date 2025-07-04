
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { MapPin, Navigation, Truck, Clock, Play, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { useMobile, TruckMobileData, RoutePoint } from '../hooks/useMobile';
import { toast } from 'sonner';

const MobileDriver = () => {
  const [plate, setPlate] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeStarted, setRouteStarted] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  
  const { getTruckByPlate, updateTruckLocation, updateRoutePoint, finishRoute } = useMobile();

  const handlePlateSubmit = async () => {
    if (!plate.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTruckByPlate(plate);
      setTruckData(data);
      
      if (data.currentRoute) {
        initializeRouteMap(data.currentRoute);
      }
      
      toast.success('Caminhão encontrado!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados do caminhão');
      toast.error('Erro ao buscar caminhão');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        });
      });
      
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      setCurrentLocation(newLocation);
      
      if (truckData && routeStarted) {
        await updateTruckLocation({
          truckId: truckData.id,
          lat: newLocation.lat,
          lng: newLocation.lng
        });
      }
      
      return newLocation;
    } catch (error) {
      console.error('Erro ao obter localização GPS:', error);
      toast.error('Erro ao obter localização GPS');
      return null;
    }
  };

  const initializeRouteMap = async (route: any) => {
    if (!mapRef.current || !route.points || route.points.length < 2) return;

    try {
      const location = await getCurrentLocation();
      if (!location) return;

      // Load Google Maps
      if (!window.google) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w&libraries=geometry`;
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Initialize map
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: location,
        zoom: 13,
        mapTypeControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControlOptions: {
          position: window.google.maps.ControlPosition.BOTTOM_RIGHT,
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR
        }
      });

      // Add user location marker
      new window.google.maps.Marker({
        position: location,
        map: mapInstance.current,
        title: 'Sua localização',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285f4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        }
      });

      // Draw route
      drawRoute(route);
      
    } catch (error) {
      console.error('Erro ao inicializar mapa:', error);
      toast.error('Erro ao carregar mapa');
    }
  };

  const drawRoute = (route: any) => {
    if (!mapInstance.current || !route.points) return;

    const directionsService = new window.google.maps.DirectionsService();
    directionsRenderer.current = new window.google.maps.DirectionsRenderer({
      map: mapInstance.current,
      polylineOptions: {
        strokeColor: '#22c55e',
        strokeWeight: 4,
        strokeOpacity: 0.8
      }
    });

    const points = route.points.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order);
    const origin = points[0];
    const destination = points[points.length - 1];
    const waypoints = points.slice(1, -1).map((point: RoutePoint) => ({
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
      if (status === 'OK') {
        directionsRenderer.current.setDirections(result);
      }
    });
  };

  const startRoute = async () => {
    if (!truckData?.currentRoute) return;
    
    setRouteStarted(true);
    setCurrentPointIndex(0);
    
    await getCurrentLocation();
    toast.success('Rota iniciada! Navegue para o primeiro destino.');
  };

  const openInGoogleMaps = () => {
    if (!truckData?.currentRoute || !truckData.currentRoute.points) return;
    
    const points = truckData.currentRoute.points.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order);
    const nextPoint = points[currentPointIndex];
    
    if (nextPoint) {
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nextPoint.lat},${nextPoint.lng}&travelmode=driving`;
      window.open(googleMapsUrl, '_blank');
    }
  };

  const markPointCompleted = async () => {
    if (!truckData?.currentRoute || !truckData.currentRoute.points) return;
    
    const points = truckData.currentRoute.points.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order);
    const currentPoint = points[currentPointIndex];
    
    if (!currentPoint) return;
    
    try {
      await updateRoutePoint({
        truckId: truckData.id,
        pointId: currentPoint.id,
        completed: true
      });
      
      await getCurrentLocation();
      
      if (currentPointIndex < points.length - 1) {
        setCurrentPointIndex(prev => prev + 1);
        toast.success('Ponto concluído! Próximo destino carregado.');
      } else {
        // Última parada - mostrar botão finalizar
        toast.success('Todos os pontos concluídos! Finalize a rota.');
      }
      
    } catch (error) {
      toast.error('Erro ao marcar ponto como concluído');
    }
  };

  const handleFinishRoute = async () => {
    if (!truckData) return;
    
    try {
      setLoading(true);
      await finishRoute(truckData.id);
      
      // Reset state
      setTruckData(null);
      setRouteStarted(false);
      setCurrentPointIndex(0);
      setPlate('');
      
      toast.success('Rota finalizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao finalizar rota');
    } finally {
      setLoading(false);
    }
  };

  // Auto-update location every 30 seconds when route is active
  useEffect(() => {
    if (routeStarted) {
      const interval = setInterval(getCurrentLocation, 30000);
      return () => clearInterval(interval);
    }
  }, [routeStarted, truckData]);

  if (!truckData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">AlchemyRotas</CardTitle>
            <p className="text-gray-600">App do Motorista</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Placa do Caminhão
              </label>
              <Input
                type="text"
                placeholder="ABC-1234"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="text-center text-lg font-mono"
                maxLength={8}
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <Button 
              onClick={handlePlateSubmit}
              disabled={loading || !plate.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3"
            >
              {loading ? 'Buscando...' : 'Acessar Caminhão'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const route = truckData.currentRoute;
  const points = route?.points?.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order) || [];
  const currentPoint = points[currentPointIndex];
  const isLastPoint = currentPointIndex === points.length - 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{truckData.name}</h1>
              <p className="text-sm text-gray-600">{truckData.plate}</p>
            </div>
            <Badge variant={routeStarted ? "default" : "secondary"}>
              {routeStarted ? 'Em Rota' : 'Parado'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Map */}
        {route && (
          <Card>
            <CardContent className="p-0">
              <div ref={mapRef} className="w-full h-64 rounded-lg bg-gray-200" />
            </CardContent>
          </Card>
        )}

        {/* Route Info */}
        {route && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600" />
                {route.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {points.length}
                  </div>
                  <div className="text-sm text-gray-600">Paradas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {currentPointIndex + 1}
                  </div>
                  <div className="text-sm text-gray-600">Atual</div>
                </div>
              </div>

              {!routeStarted ? (
                <Button 
                  onClick={startRoute}
                  className="w-full bg-green-600 hover:bg-green-700 text-lg py-3"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Iniciar Rota
                </Button>
              ) : (
                <div className="space-y-3">
                  {currentPoint && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-900">
                            Próximo Destino ({currentPointIndex + 1}/{points.length})
                          </h4>
                          <p className="text-sm text-blue-700 mt-1">
                            {currentPoint.address}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={openInGoogleMaps}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Google Maps
                    </Button>
                    
                    {!isLastPoint ? (
                      <Button
                        onClick={markPointCompleted}
                        className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Ponto Concluído
                      </Button>
                    ) : (
                      <Button
                        onClick={handleFinishRoute}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {loading ? 'Finalizando...' : 'Finalizar Rota'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Route Points List */}
        {route && routeStarted && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sequência de Paradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {points.map((point, index) => (
                  <div 
                    key={point.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      index === currentPointIndex 
                        ? 'bg-blue-50 border-blue-200' 
                        : index < currentPointIndex 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === currentPointIndex
                        ? 'bg-blue-600 text-white'
                        : index < currentPointIndex
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-400 text-white'
                    }`}>
                      {index < currentPointIndex ? '✓' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{point.address}</p>
                      <p className="text-xs text-gray-600 capitalize">
                        {point.type === 'origin' ? 'Origem' : 
                         point.type === 'destination' ? 'Destino' : 'Parada'}
                      </p>
                    </div>
                    {index < currentPointIndex && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!route && (
          <Card className="text-center py-8">
            <CardContent>
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma rota atribuída</h3>
              <p className="text-gray-600">Este caminhão não possui uma rota ativa no momento.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileDriver;
