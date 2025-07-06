import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { MapPin, Navigation, Truck, Play, CheckCircle, ExternalLink, AlertCircle, Locate, ArrowLeft } from 'lucide-react';
import { useMobile, TruckMobileData, RoutePoint } from '../hooks/useMobile';
import { toast } from 'sonner';

const MobileDriver = () => {
  const [plate, setPlate] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeStarted, setRouteStarted] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  const userMarker = useRef<any>(null);
  
  const { getTruckByPlate, updateTruckLocation, updateRoutePoint, finishRoute } = useMobile();

  const handlePlateSubmit = async () => {
    if (!plate.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTruckByPlate(plate);
      setTruckData(data);
      
      // Reset route state when loading new truck data
      setRouteStarted(false);
      setCurrentPointIndex(0);
      
      if (data.currentRoute) {
        // Find first non-completed point
        const sortedPoints = data.currentRoute.points.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order);
        const firstIncompleteIndex = sortedPoints.findIndex(point => !point.completed);
        setCurrentPointIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
        
        await initializeRouteMap(data.currentRoute);
      }
      
      toast.success('Caminhão encontrado!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar dados do caminhão';
      setError(errorMessage);
      toast.error('Erro ao buscar caminhão');
      console.error('Error loading truck data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPlateEntry = () => {
    // Reset all states
    setTruckData(null);
    setRouteStarted(false);
    setCurrentPointIndex(0);
    setPlate('');
    setError(null);
    
    // Cleanup map
    if (directionsRenderer.current) {
      directionsRenderer.current.setMap(null);
      directionsRenderer.current = null;
    }
    if (userMarker.current) {
      userMarker.current.setMap(null);
      userMarker.current = null;
    }
    if (mapInstance.current) {
      mapInstance.current = null;
    }
  };

  const getCurrentLocation = async (): Promise<{ lat: number; lng: number } | null> => {
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
      
      // Update user marker position
      if (userMarker.current && mapInstance.current) {
        userMarker.current.setPosition(newLocation);
      }
      
      if (truckData && routeStarted) {
        try {
          await updateTruckLocation({
            truckId: truckData.id,
            lat: newLocation.lat,
            lng: newLocation.lng
          });
        } catch (error) {
          console.error('Error updating truck location:', error);
        }
      }
      
      return newLocation;
    } catch (error) {
      console.error('Erro ao obter localização GPS:', error);
      toast.error('Erro ao obter localização GPS');
      return null;
    }
  };

  const centerOnUserLocation = async () => {
    const location = await getCurrentLocation();
    if (location && mapInstance.current) {
      mapInstance.current.panTo(location);
      mapInstance.current.setZoom(16);
      toast.success('Centralizado na sua localização');
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
      userMarker.current = new window.google.maps.Marker({
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
      await drawRoute(route);
      
    } catch (error) {
      console.error('Erro ao inicializar mapa:', error);
      toast.error('Erro ao carregar mapa');
    }
  };

  const drawRoute = async (route: any) => {
    if (!mapInstance.current || !route.points || !window.google) return;

    try {
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

  const startRoute = async () => {
    if (!truckData?.currentRoute) return;
    
    // Find first non-completed point
    const sortedPoints = truckData.currentRoute.points.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order);
    const firstIncompleteIndex = sortedPoints.findIndex(point => !point.completed);
    
    setRouteStarted(true);
    setCurrentPointIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
    
    await getCurrentLocation();
    toast.success('Rota iniciada! Navegue para o próximo destino.');
  };

  const openInGoogleMaps = () => {
    if (!truckData?.currentRoute || !truckData.currentRoute.points) return;
    
    const points = truckData.currentRoute.points.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order);
    const nextPoint = points[currentPointIndex];
    
    if (nextPoint) {
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nextPoint.lat},${nextPoint.lng}&travelmode=driving`;
      window.open(googleMapsUrl, '_blank');
      toast.success('Abrindo Google Maps...');
      console.log('🗺️ Opening Google Maps for point:', nextPoint.address);
    } else {
      toast.error('Nenhum destino disponível');
      console.error('❌ No next point available for navigation');
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
      
      // Find next incomplete point
      const nextIncompleteIndex = points.findIndex((point, index) => 
        index > currentPointIndex && !point.completed
      );
      
      if (nextIncompleteIndex >= 0) {
        setCurrentPointIndex(nextIncompleteIndex);
        toast.success('Ponto concluído! Próximo destino carregado.');
      } else {
        // All points completed
        toast.success('Todos os pontos concluídos! Finalize a rota.');
        setCurrentPointIndex(points.length); // Set to beyond last point
      }
      
      // Update truck data to reflect the completed point
      setTruckData(prev => {
        if (!prev?.currentRoute) return prev;
        
        const updatedPoints = prev.currentRoute.points.map(point => 
          point.id === currentPoint.id ? { ...point, completed: true } : point
        );
        
        return {
          ...prev,
          currentRoute: {
            ...prev.currentRoute,
            points: updatedPoints
          }
        };
      });
      
    } catch (error) {
      console.error('Error marking point as completed:', error);
      toast.error('Erro ao marcar ponto como concluído');
    }
  };

  const handleFinishRoute = async () => {
    if (!truckData) return;
    
    try {
      setLoading(true);
      await finishRoute(truckData.id);
      
      toast.success('Rota finalizada com sucesso!');
      
      // Voltar para entrada de placa após finalizar
      setTimeout(() => {
        handleBackToPlateEntry();
      }, 1500);
      
    } catch (error) {
      console.error('Error finishing route:', error);
      toast.error('Erro ao finalizar rota');
    } finally {
      setLoading(false);
    }
  };

  // Auto-update location every 30 seconds when route is active
  useEffect(() => {
    if (routeStarted && truckData) {
      const interval = setInterval(() => {
        getCurrentLocation().catch(console.error);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [routeStarted, truckData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (directionsRenderer.current) {
        directionsRenderer.current.setMap(null);
      }
      if (userMarker.current) {
        userMarker.current.setMap(null);
      }
    };
  }, []);

  if (!truckData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-400 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-24 h-24 bg-indigo-400 rounded-full blur-2xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-cyan-400 rounded-full blur-xl animate-pulse delay-500"></div>
        </div>

        <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-white/95 border-0 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2 pt-8 px-8">
            <div className="relative mx-auto mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                <Truck className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse"></div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
              AlchemyRotas
            </CardTitle>
            <p className="text-slate-600 font-medium">App do Motorista</p>
          </CardHeader>
          
          <CardContent className="space-y-6 px-8 pb-8">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Placa do Caminhão
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="ABC-1234"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className="text-center text-xl font-mono tracking-widest bg-slate-50 border-2 border-slate-200 rounded-2xl h-14 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                  maxLength={8}
                />
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <div className="w-8 h-5 bg-blue-600 rounded-sm flex items-center justify-center">
                    <span className="text-white text-xs font-bold">BR</span>
                  </div>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-2xl text-red-700">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="text-sm font-medium">{error}</div>
              </div>
            )}
            
            <Button 
              onClick={handlePlateSubmit}
              disabled={loading || !plate.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg font-semibold py-4 rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Carregando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Acessar Caminhão
                </div>
              )}
            </Button>

            <div className="text-center pt-4">
              <p className="text-xs text-slate-500">
                Versão 2.0 • Powered by Alchemy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const route = truckData.currentRoute;
  const points = route?.points?.sort((a: RoutePoint, b: RoutePoint) => a.order - b.order) || [];
  const currentPoint = points[currentPointIndex];
  const allPointsCompleted = currentPointIndex >= points.length;
  
  // Check if all points are completed
  const completedPointsCount = points.filter(point => point.completed).length;
  const isRouteFullyCompleted = completedPointsCount === points.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-lg">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{truckData.name}</h1>
                <p className="text-blue-100 font-mono text-sm">{truckData.plate}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={routeStarted ? "default" : "secondary"}
                className={`px-3 py-1 rounded-full font-semibold ${
                  routeStarted 
                    ? 'bg-green-500 text-white shadow-lg' 
                    : 'bg-white/20 text-white backdrop-blur-sm'
                }`}
              >
                {routeStarted ? '🚛 Em Rota' : '⏸️ Parado'}
              </Badge>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleBackToPlateEntry}
                className="text-white hover:bg-white/20 rounded-xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Map with modern styling */}
        {route && (
          <Card className="overflow-hidden rounded-2xl shadow-lg border-0 relative">
            <CardContent className="p-0">
              <div ref={mapRef} className="w-full h-64 bg-gradient-to-br from-slate-200 to-slate-300" />
              <Button
                onClick={centerOnUserLocation}
                className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white/90 hover:bg-white text-blue-600 shadow-lg border-2 border-blue-200 p-0"
                size="sm"
              >
                <Locate className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Route Info */}
        {route ? (
          <Card className="rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">{route.name}</div>
                  <div className="text-sm text-slate-500 font-normal">Rota Ativa</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {points.length}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">Total de Paradas</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {completedPointsCount}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">Concluídas</div>
                </div>
              </div>

              {!routeStarted ? (
                <Button 
                  onClick={startRoute}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-lg font-semibold py-4 rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-105"
                >
                  <Play className="w-6 h-6 mr-3" />
                  Iniciar Rota
                </Button>
              ) : isRouteFullyCompleted || allPointsCompleted ? (
                <Button
                  onClick={handleFinishRoute}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white text-lg font-semibold py-4 rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-105 disabled:opacity-50"
                >
                  <CheckCircle className="w-6 h-6 mr-3" />
                  {loading ? 'Finalizando...' : 'Finalizar Rota'}
                </Button>
              ) : (
                <div className="space-y-4">
                  {currentPoint && (
                    <div className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-2xl">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-lg mb-2">
                            Próximo Destino
                          </h4>
                          <div className="flex items-center gap-2 mb-3">
                            <Badge className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                              {currentPointIndex + 1} de {points.length}
                            </Badge>
                          </div>
                          <p className="text-slate-700 font-medium">
                            {currentPoint.address}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      onClick={openInGoogleMaps}
                      variant="outline"
                      className="flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300"
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span className="font-semibold">Abrir no Google Maps</span>
                    </Button>
                    
                    <Button
                      onClick={markPointCompleted}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-4 rounded-2xl shadow-lg font-semibold flex items-center justify-center gap-3 transform transition-all duration-300 hover:scale-105"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Marcar como Concluído
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-12 rounded-2xl shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Nenhuma rota atribuída</h3>
              <p className="text-slate-600">Este caminhão não possui uma rota ativa no momento.</p>
              <Button
                onClick={handleBackToPlateEntry}
                className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileDriver;
