
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Truck, Clock, RefreshCw, ExternalLink, User, Route } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { useMobile, TruckMobileData } from '@/hooks/useMobile';
import { toast } from 'sonner';
import MobileRouteMap from '@/components/MobileRouteMap';

const MobileDriver = () => {
  const [plate, setPlate] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getTruckByPlate, updateTruckLocation, updateRoutePoint, isUpdatingLocation } = useMobile();

  const handlePlateSubmit = async () => {
    if (!plate.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTruckByPlate(plate);
      setTruckData(data);
      toast.success('Caminhão encontrado!');
      console.log('Truck data loaded:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados do caminhão');
      toast.error('Erro ao buscar caminhão');
      console.error('Error loading truck data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      setCurrentLocation(newLocation);
      
      if (truckData) {
        await updateTruckLocation({
          truckId: truckData.id,
          lat: newLocation.lat,
          lng: newLocation.lng
        });
        toast.success('Localização atualizada');
      }
      
      console.log('Location updated:', newLocation);
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      setError('Erro ao obter localização GPS');
      toast.error('Erro ao obter localização GPS');
    }
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
      console.error('Error updating route point:', error);
    }
  };

  useEffect(() => {
    getCurrentLocation();
    const interval = setInterval(getCurrentLocation, 30000);
    return () => clearInterval(interval);
  }, [truckData]);

  if (!truckData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Truck className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800 mb-2">
              Rota Azul Viagens
            </CardTitle>
            <p className="text-gray-600 font-medium">App do Motorista</p>
            <div className="w-16 h-1 bg-blue-600 rounded-full mx-auto mt-2"></div>
          </CardHeader>
          <CardContent className="space-y-6 px-6 pb-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0"></div>
                  {error}
                </div>
              </div>
            )}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4" />
                Placa do Caminhão
              </label>
              <Input
                placeholder="ABC-1234"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="h-12 text-center text-lg font-mono border-2 border-gray-200 focus:border-blue-500 rounded-xl shadow-sm"
                disabled={loading}
                maxLength={8}
              />
            </div>
            <Button 
              onClick={handlePlateSubmit} 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105"
              disabled={loading || !plate.trim()}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Route className="h-5 w-5 mr-2" />
                  Acessar Rota
                </>
              )}
            </Button>
            <div className="text-center pt-4">
              <p className="text-xs text-gray-500">
                Digite a placa do seu caminhão para acessar as rotas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPoint = truckData.currentRoute?.points.find(p => !p.completed);
  const completedCount = truckData.currentRoute?.points.filter(p => p.completed).length || 0;
  const totalPoints = truckData.currentRoute?.points.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-lg text-gray-800">{truckData.name}</h1>
                  <p className="text-sm text-gray-600 font-mono">{truckData.plate}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-green-600 hover:bg-green-700 shadow-sm">Em Rota</Badge>
                <Button size="sm" variant="ghost" onClick={() => setTruckData(null)} className="text-gray-600">
                  Sair
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Preview Map */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                Preview da Rota
              </h3>
              {truckData.currentRoute && (
                <p className="text-sm text-gray-600 mt-1">{truckData.currentRoute.name}</p>
              )}
            </div>
            {truckData.currentRoute ? (
              <MobileRouteMap route={truckData.currentRoute} />
            ) : (
              <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Nenhuma rota ativa</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Route Info */}
        {truckData.currentRoute ? (
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="h-5 w-5 text-blue-600" />
                {truckData.currentRoute.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <div className="text-2xl font-bold text-blue-600">{totalPoints}</div>
                  <div className="text-sm text-blue-700 font-medium">Paradas</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">{completedCount + 1}</div>
                  <div className="text-sm text-green-700 font-medium">Atual</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Route className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Nenhuma rota ativa encontrada</p>
            </CardContent>
          </Card>
        )}

        {/* Next Destination */}
        {currentPoint && (
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-orange-500" />
                Próximo Destino ({completedCount + 1}/{totalPoints})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                  <p className="font-medium text-gray-800">{currentPoint.address}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex items-center gap-2 flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => window.open(`https://maps.google.com/?q=${currentPoint.lat},${currentPoint.lng}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Google Maps
                  </Button>
                  <Button 
                    size="sm"
                    className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 flex-1 shadow-sm"
                    onClick={() => markPointAsCompleted(currentPoint.id)}
                  >
                    ✓ Concluído
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route Sequence */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Sequência de Paradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {truckData.currentRoute?.points.map((point, index) => (
                <div 
                  key={point.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    point.completed 
                      ? 'bg-green-50 border-2 border-green-200 shadow-sm' 
                      : index === completedCount
                      ? 'bg-blue-50 border-2 border-blue-200 shadow-sm ring-2 ring-blue-100'
                      : 'bg-gray-50 border-2 border-gray-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                    point.completed 
                      ? 'bg-green-500 text-white' 
                      : index === completedCount
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {point.completed ? '✓' : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-800">{point.address}</p>
                    <p className="text-xs text-gray-600 capitalize font-medium mt-1">
                      {point.type === 'origin' ? '🏁 Origem' : 
                       point.type === 'destination' ? '🏆 Destino' : '📍 Parada'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileDriver;
