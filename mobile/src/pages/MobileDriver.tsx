
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { MapPin, Navigation, Truck, Clock, RefreshCw, Route, Play, CheckCircle, ExternalLink } from 'lucide-react';
import { useMobile, TruckMobileData } from '../hooks/useMobile';
import { toast } from 'sonner';

const MobileDriver = () => {
  const [plate, setPlate] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [routeStarted, setRouteStarted] = useState(false);
  
  const { getTruckByPlate, updateTruckLocation, updateRoutePoint, isUpdatingLocation } = useMobile();

  const handlePlateSubmit = async () => {
    if (!plate.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTruckByPlate(plate);
      setTruckData(data);
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
          timeout: 10000
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
    } catch (error) {
      setError('Erro ao obter localização GPS');
      toast.error('Erro ao obter localização GPS');
    }
  };

  const startRoute = () => {
    if (!truckData?.currentRoute) return;
    setSelectedRoute(truckData.currentRoute);
    setRouteStarted(true);
    toast.success('Rota iniciada! Siga para o próximo destino.');
  };

  const markPointAsCompleted = async (pointId: string) => {
    if (!truckData?.currentRoute) return;
    
    try {
      await updateRoutePoint({
        truckId: truckData.id,
        pointId,
        completed: true
      });
      
      setTruckData(prev => {
        if (!prev?.currentRoute) return prev;
        
        const updatedPoints = prev.currentRoute.points.map(point =>
          point.id === pointId ? { ...point, completed: true } : point
        );
        
        return {
          ...prev,
          currentRoute: {
            ...prev.currentRoute,
            points: updatedPoints
          }
        };
      });

      toast.success('Ponto marcado como concluído!');
      await getCurrentLocation();
    } catch (error) {
      toast.error('Erro ao marcar ponto como concluído');
    }
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const finishRoute = () => {
    setRouteStarted(false);
    setSelectedRoute(null);
    toast.success('Rota finalizada com sucesso!');
  };

  useEffect(() => {
    getCurrentLocation();
    const interval = setInterval(getCurrentLocation, 30000);
    return () => clearInterval(interval);
  }, [truckData, routeStarted]);

  if (!truckData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mb-4">
              <Truck className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              AlchemyRotas
            </CardTitle>
            <p className="text-sm text-gray-600">App do Motorista</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700">Placa do Caminhão</label>
              <Input
                placeholder="ABC-1234"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="mt-1 h-12 text-center text-lg font-mono"
                disabled={loading}
              />
            </div>
            <Button 
              onClick={handlePlateSubmit} 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium"
              disabled={loading || !plate.trim()}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4 mr-2" />
                  Acessar Rota
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPoint = truckData.currentRoute?.points.find(p => !p.completed);
  const completedPoints = truckData.currentRoute?.points.filter(p => p.completed).length || 0;
  const totalPoints = truckData.currentRoute?.points.length || 0;
  const progress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header do Caminhão */}
        <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-800">{truckData.name}</h1>
                  <p className="text-sm text-gray-600">{truckData.plate}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Ativo
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => setTruckData(null)}>
                  Sair
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rota Atual */}
        {truckData.currentRoute ? (
          <>
            <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Route className="h-5 w-5 text-blue-600" />
                  {truckData.currentRoute.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">{completedPoints}/{totalPoints}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {!routeStarted ? (
                  <Button 
                    onClick={startRoute}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Rota
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {truckData.currentRoute.points.map((point, index) => (
                      <div 
                        key={point.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          point.completed 
                            ? 'bg-green-50 border-green-200' 
                            : point === currentPoint
                            ? 'bg-blue-50 border-blue-200 shadow-md'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          point.completed 
                            ? 'bg-green-500 text-white' 
                            : point === currentPoint
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-300 text-gray-600'
                        }`}>
                          {point.completed ? <CheckCircle className="h-4 w-4" /> : point.order}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{point.address}</p>
                          <p className="text-xs text-gray-600 capitalize">{point.type}</p>
                        </div>
                        {point === currentPoint && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInGoogleMaps(point.lat, point.lng)}
                              className="p-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => markPointAsCompleted(point.id)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {progress === 100 && (
                      <Button 
                        onClick={finishRoute}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium mt-4"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Finalizar Rota
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Route className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600">Nenhuma rota ativa encontrada</p>
              <p className="text-sm text-gray-500 mt-1">Entre em contato com a central</p>
            </CardContent>
          </Card>
        )}

        {/* Localização */}
        <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Localização GPS</p>
                  <p className="text-xs font-mono">
                    {currentLocation 
                      ? `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
                      : 'Obtendo localização...'
                    }
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={getCurrentLocation}
                disabled={isUpdatingLocation}
                className="p-2"
              >
                <RefreshCw className={`h-4 w-4 ${isUpdatingLocation ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pt-4">
          AlchemyRotas © 2024 - Sistema de Roteirização
        </div>
      </div>
    </div>
  );
};

export default MobileDriver;
