
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Truck, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { useMobile, TruckMobileData } from '@/hooks/useMobile';
import { toast } from 'sonner';

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
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <Truck className="h-6 w-6 text-blue-600" />
              Rota Azul Viagens
            </CardTitle>
            <p className="text-sm text-gray-600">App do Motorista</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Placa do Caminhão</label>
              <Input
                placeholder="ABC-1234"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="mt-1"
                disabled={loading}
              />
            </div>
            <Button 
              onClick={handlePlateSubmit} 
              className="w-full"
              disabled={loading || !plate.trim()}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Acessar Rota'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPoint = truckData.currentRoute?.points.find(p => !p.completed);
  const completedCount = truckData.currentRoute?.points.filter(p => p.completed).length || 0;
  const totalPoints = truckData.currentRoute?.points.length || 0;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-semibold">{truckData.name}</h1>
                <p className="text-sm text-gray-600">{truckData.plate}</p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-blue-600 hover:bg-blue-700">Em Rota</Badge>
                <Button size="sm" variant="ghost" onClick={() => setTruckData(null)}>
                  Sair
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Preview Map */}
        <Card>
          <CardContent className="p-0">
            <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MapPin className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Preview da Rota</p>
                {truckData.currentRoute && (
                  <p className="text-xs mt-1">{truckData.currentRoute.name}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Info */}
        {truckData.currentRoute ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="h-5 w-5 text-blue-600" />
                {truckData.currentRoute.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalPoints}</div>
                  <div className="text-sm text-gray-600">Paradas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedCount + 1}</div>
                  <div className="text-sm text-gray-600">Atual</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-gray-600">Nenhuma rota ativa encontrada</p>
            </CardContent>
          </Card>
        )}

        {/* Next Destination */}
        {currentPoint && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                Próximo Destino ({completedCount + 1}/{totalPoints})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="font-medium">{currentPoint.address}</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => window.open(`https://maps.google.com/?q=${currentPoint.lat},${currentPoint.lng}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Google Maps
                  </Button>
                  <Button 
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => markPointAsCompleted(currentPoint.id)}
                  >
                    Ponto Concluído
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route Sequence */}
        <Card>
          <CardHeader>
            <CardTitle>Sequência de Paradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {truckData.currentRoute?.points.map((point, index) => (
                <div 
                  key={point.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    point.completed 
                      ? 'bg-green-50 border border-green-200' 
                      : index === completedCount
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    point.completed 
                      ? 'bg-green-500 text-white' 
                      : index === completedCount
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {point.completed ? '✓' : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{point.address}</p>
                    <p className="text-xs text-gray-600 capitalize">
                      {point.type === 'origin' ? 'Origem' : 
                       point.type === 'destination' ? 'Destino' : 'Parada'}
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
