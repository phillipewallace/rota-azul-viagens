
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Truck, Clock, RefreshCw } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';

interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
}

interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: string;
  driver?: string;
  currentRoute?: {
    id: string;
    name: string;
    points: RoutePoint[];
  };
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

const MobileDriver = () => {
  const [plate, setPlate] = useState('');
  const [truckData, setTruckData] = useState<TruckMobileData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const getTruckByPlate = async (plate: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar caminhão');
      }
      
      const data = await response.json();
      setTruckData(data);
      return true;
    } catch (error) {
      console.error('Error fetching truck by plate:', error);
      setError(error instanceof Error ? error.message : 'Erro ao buscar caminhão');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async (truckId: string, lat: number, lng: number) => {
    try {
      setIsUpdatingLocation(true);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lat, lng }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar localização');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const updateRoutePoint = async (truckId: string, pointId: string, completed: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar ponto da rota');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating route point:', error);
      throw error;
    }
  };

  const finishRoute = async (truckId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao finalizar rota');
      }
      
      return true;
    } catch (error) {
      console.error('Error finishing route:', error);
      return false;
    }
  };

  const handlePlateSubmit = async () => {
    if (!plate.trim()) return;
    
    const success = await getTruckByPlate(plate);
    if (success) {
      toast.success('Caminhão encontrado!');
      console.log('Truck data loaded:', truckData);
    } else {
      toast.error('Erro ao buscar caminhão');
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
      
      // Atualiza a localização do caminhão no servidor
      if (truckData) {
        await updateLocation(truckData.id, newLocation.lat, newLocation.lng);
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
      await updateRoutePoint(truckData.id, pointId, true);
      
      // Atualiza o estado local
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
    
    // Atualizar localização a cada 30 segundos
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
                <Badge variant="outline" className="bg-green-50 text-green-700">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                {truckData.currentRoute.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {truckData.currentRoute.points.map((point, index) => (
                <div 
                  key={point.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    point.completed 
                      ? 'bg-green-50 border-green-200' 
                      : point === currentPoint
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    point.completed 
                      ? 'bg-green-500 text-white' 
                      : point === currentPoint
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {point.order}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{point.address}</p>
                    <p className="text-xs text-gray-600 capitalize">{point.type}</p>
                  </div>
                  {point.completed && (
                    <div className="text-green-500">✓</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-gray-600">Nenhuma rota ativa encontrada</p>
            </CardContent>
          </Card>
        )}

        {/* Próximo Destino */}
        {currentPoint && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                Próximo Destino
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="font-medium">{currentPoint.address}</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open(`https://maps.google.com/?q=${currentPoint.lat},${currentPoint.lng}`, '_blank')}
                  >
                    Abrir no Maps
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => markPointAsCompleted(currentPoint.id)}
                  >
                    Marcar como Concluído
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Localização Atual */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {currentLocation 
                    ? `GPS: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
                    : 'Obtendo localização...'
                  }
                </span>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={getCurrentLocation}
                disabled={isUpdatingLocation}
              >
                <RefreshCw className={`h-4 w-4 ${isUpdatingLocation ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileDriver;
