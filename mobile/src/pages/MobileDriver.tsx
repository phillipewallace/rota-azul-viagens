
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { MapPin, Navigation, Truck, Clock, Play, CheckCircle, ExternalLink, AlertCircle, Locate } from 'lucide-react';
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
  const userMarker = useRef<any>(null);
  
  const { getTruckByPlate, updateTruckLocation, updateRoutePoint, finishRoute } = useMobile();

  const handlePlateSubmit = async () => {
    if (!plate.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTruckByPlate(plate);
      setTruckData(data);
      
      if (data.currentRoute) {
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
      
      setCurrentLocation(newLocation);
      
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
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ],
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
          scale: 12,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 4
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
          strokeColor: '#3b82f6',
          strokeWeight: 5,
          strokeOpacity: 0.9
        },
        markerOptions: {
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3
          }
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
        toast.success('Todos os pontos concluídos! Finalize a rota.');
      }
      
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
      
      // Reset state
      setTruckData(null);
      setRouteStarted(false);
      setCurrentPointIndex(0);
      setPlate('');
      
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
      
      toast.success('Rota finalizada com sucesso!');
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
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-40 h-40 bg-blue-400 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-purple-400 rounded-full blur-2xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-cyan-400 rounded-full blur-xl animate-pulse delay-500"></div>
          <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-indigo-400 rounded-full blur-lg animate-pulse delay-700"></div>
        </div>

        <Card className="w-full max-w-md shadow-2xl backdrop-blur-lg bg-white/10 border border-white/20 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-6 pt-10 px-8">
            <div className="relative mx-auto mb-8">
              <div className="w-28 h-28 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-3xl flex items-center justify-center shadow-2xl transform rotate-6 hover:rotate-0 transition-transform duration-500">
                <Truck className="w-14 h-14 text-white" />
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-400 rounded-full border-4 border-white animate-pulse shadow-lg"></div>
            </div>
            <CardTitle className="text-4xl font-bold text-white mb-3 tracking-tight">
              AlchemyRouter
            </CardTitle>
            <p className="text-blue-200 font-medium text-lg">App do Motorista</p>
          </CardHeader>
          
          <CardContent className="space-y-8 px-8 pb-10">
            <div className="space-y-4">
              <label className="block text-lg font-bold text-white mb-4">
                Placa do Caminhão
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="ABC-1234"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className="text-center text-2xl font-mono tracking-widest bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-2xl h-16 text-white placeholder-white/60 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/30 transition-all duration-300"
                  maxLength={8}
                />
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <div className="w-10 h-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">BR</span>
                  </div>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="flex items-center gap-4 p-5 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-2xl text-red-200">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="font-medium">{error}</div>
              </div>
            )}
            
            <Button 
              onClick={handlePlateSubmit}
              disabled={loading || !plate.trim()}
              className="w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 text-white text-xl font-bold py-6 rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl disabled:opacity-50 disabled:transform-none border-0"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  Carregando...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6" />
                  Acessar Caminhão
                </div>
              )}
            </Button>

            <div className="text-center pt-6">
              <p className="text-sm text-white/60">
                Versão 2.5 • Powered by Alchemy
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
  const isLastPoint = currentPointIndex === points.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Modern header with enhanced gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 shadow-xl">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{truckData.name}</h1>
                <p className="text-blue-100 font-mono text-base tracking-wider">{truckData.plate}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge 
                variant={routeStarted ? "default" : "secondary"}
                className={`px-4 py-2 rounded-full font-bold text-sm ${
                  routeStarted 
                    ? 'bg-green-500 text-white shadow-xl border-2 border-green-400' 
                    : 'bg-white/25 text-white backdrop-blur-sm border-2 border-white/30'
                }`}
              >
                {routeStarted ? '🚛 Em Rota' : '⏸️ Parado'}
              </Badge>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setTruckData(null);
                  setRouteStarted(false);
                  setCurrentPointIndex(0);
                  setPlate('');
                }}
                className="text-white hover:bg-white/20 rounded-xl font-semibold"
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Enhanced map with modern styling */}
        {route && (
          <Card className="overflow-hidden rounded-3xl shadow-2xl border-0 relative bg-white/80 backdrop-blur-sm">
            <CardContent className="p-0">
              <div ref={mapRef} className="w-full h-80 bg-gradient-to-br from-slate-200 to-slate-300 rounded-3xl" />
              {/* Enhanced location button */}
              <Button
                onClick={centerOnUserLocation}
                className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-white/95 hover:bg-white text-blue-600 shadow-2xl border-2 border-blue-200 p-0 hover:scale-110 transition-all duration-300"
                size="sm"
              >
                <Locate className="w-6 h-6" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Enhanced route info with modern card design */}
        {route ? (
          <Card className="rounded-3xl shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-4 text-2xl">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                  <Navigation className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">{route.name}</div>
                  <div className="text-sm text-slate-500 font-normal">Rota Ativa</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl shadow-lg">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {points.length}
                  </div>
                  <div className="text-sm text-slate-600 font-semibold">Total de Paradas</div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-3xl shadow-lg">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {currentPointIndex + 1}
                  </div>
                  <div className="text-sm text-slate-600 font-semibold">Parada Atual</div>
                </div>
              </div>

              {!routeStarted ? (
                <Button 
                  onClick={startRoute}
                  className="w-full bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600 hover:from-green-600 hover:via-emerald-700 hover:to-teal-700 text-white text-xl font-bold py-6 rounded-3xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl"
                >
                  <Play className="w-7 h-7 mr-4" />
                  Iniciar Rota
                </Button>
              ) : (
                <div className="space-y-6">
                  {currentPoint && (
                    <div className="p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-3xl shadow-lg">
                      <div className="flex items-start gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                          <MapPin className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-xl mb-3">
                            Próximo Destino
                          </h4>
                          <div className="flex items-center gap-3 mb-4">
                            <Badge className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
                              {currentPointIndex + 1} de {points.length}
                            </Badge>
                          </div>
                          <p className="text-slate-700 font-medium text-lg">
                            {currentPoint.address}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    <Button
                      onClick={openInGoogleMaps}
                      variant="outline"
                      className="flex items-center justify-center gap-4 py-6 rounded-3xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-300 text-lg font-semibold hover:shadow-lg"
                    >
                      <ExternalLink className="w-6 h-6" />
                      <span>Abrir no Google Maps</span>
                    </Button>
                    
                    {!isLastPoint ? (
                      <Button
                        onClick={markPointCompleted}
                        className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white py-6 rounded-3xl shadow-2xl font-bold text-lg flex items-center justify-center gap-4 transform transition-all duration-300 hover:scale-105 hover:shadow-3xl"
                      >
                        <CheckCircle className="w-6 h-6" />
                        Marcar como Concluído
                      </Button>
                    ) : (
                      <Button
                        onClick={handleFinishRoute}
                        disabled={loading}
                        className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 hover:from-red-600 hover:via-rose-600 hover:to-pink-600 text-white py-6 rounded-3xl shadow-2xl font-bold text-lg flex items-center justify-center gap-4 transform transition-all duration-300 hover:scale-105 hover:shadow-3xl disabled:opacity-50"
                      >
                        <CheckCircle className="w-6 h-6" />
                        {loading ? 'Finalizando...' : 'Finalizar Rota'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-16 rounded-3xl shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
            <CardContent>
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Nenhuma rota atribuída</h3>
              <p className="text-slate-600 text-lg">Este caminhão não possui uma rota ativa no momento.</p>
            </CardContent>
          </Card>
        )}

        {/* Enhanced route points list */}
        {route && routeStarted && (
          <Card className="rounded-3xl shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-800">Sequência de Paradas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {points.map((point, index) => (
                  <div 
                    key={point.id} 
                    className={`flex items-center gap-5 p-5 rounded-3xl border-2 transition-all duration-300 shadow-lg ${
                      index === currentPointIndex 
                        ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-300 shadow-xl transform scale-105' 
                        : index < currentPointIndex 
                        ? 'bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-green-300' 
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg ${
                      index === currentPointIndex
                        ? 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 text-white'
                        : index < currentPointIndex
                        ? 'bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700 text-white'
                        : 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 text-white'
                    }`}>
                      {index < currentPointIndex ? '✓' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate text-lg">{point.address}</p>
                      <p className="text-base text-slate-600 capitalize mt-2">
                        {point.type === 'origin' ? '🚀 Origem' : 
                         point.type === 'destination' ? '🏁 Destino' : '📍 Parada'}
                      </p>
                    </div>
                    {index < currentPointIndex && (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileDriver;
