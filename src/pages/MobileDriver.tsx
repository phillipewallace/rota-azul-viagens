
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Truck, Clock } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';

interface TruckRoute {
  id: string;
  name: string;
  plate: string;
  currentRoute: {
    id: string;
    name: string;
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      completed: boolean;
    }>;
    currentPointIndex: number;
  };
}

const MobileDriver = () => {
  const [plate, setPlate] = useState('');
  const [truckData, setTruckData] = useState<TruckRoute | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePlateSubmit = async () => {
    if (!plate.trim()) return;
    
    setLoading(true);
    // Simular busca da rota do caminhão
    setTimeout(() => {
      const mockTruckData: TruckRoute = {
        id: '1',
        name: 'Caminhão 001',
        plate: plate.toUpperCase(),
        currentRoute: {
          id: '1',
          name: 'Rota SP-RJ Multi-pontos',
          currentPointIndex: 1,
          points: [
            {
              id: '1',
              address: 'São Paulo, SP',
              lat: -23.5505,
              lng: -46.6333,
              order: 1,
              type: 'origin',
              completed: true
            },
            {
              id: '2',
              address: 'Santos, SP',
              lat: -23.9608,
              lng: -46.3331,
              order: 2,
              type: 'waypoint',
              completed: false
            },
            {
              id: '3',
              address: 'Rio de Janeiro, RJ',
              lat: -22.9068,
              lng: -43.1729,
              order: 3,
              type: 'destination',
              completed: false
            }
          ]
        }
      };
      setTruckData(mockTruckData);
      setLoading(false);
    }, 1000);
  };

  const getCurrentLocation = async () => {
    try {
      const position = await Geolocation.getCurrentPosition();
      setCurrentLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      // Localização mockada para desenvolvimento
      setCurrentLocation({ lat: -23.5505, lng: -46.6333 });
    }
  };

  const markPointAsCompleted = (pointId: string) => {
    if (!truckData) return;
    
    setTruckData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        currentRoute: {
          ...prev.currentRoute,
          points: prev.currentRoute.points.map(point =>
            point.id === pointId ? { ...point, completed: true } : point
          ),
          currentPointIndex: prev.currentRoute.currentPointIndex + 1
        }
      };
    });
  };

  useEffect(() => {
    getCurrentLocation();
    // Atualizar localização a cada 30 segundos
    const interval = setInterval(getCurrentLocation, 30000);
    return () => clearInterval(interval);
  }, []);

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
            <div>
              <label className="text-sm font-medium">Placa do Caminhão</label>
              <Input
                placeholder="ABC-1234"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handlePlateSubmit} 
              className="w-full"
              disabled={loading || !plate.trim()}
            >
              {loading ? 'Buscando...' : 'Acessar Rota'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPoint = truckData.currentRoute.points[truckData.currentRoute.currentPointIndex];
  const nextPoint = truckData.currentRoute.points[truckData.currentRoute.currentPointIndex + 1];

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
              <Badge variant="outline" className="bg-green-50 text-green-700">
                Em Rota
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Rota Atual */}
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
                    : index === truckData.currentRoute.currentPointIndex
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  point.completed 
                    ? 'bg-green-500 text-white' 
                    : index === truckData.currentRoute.currentPointIndex
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
        {currentLocation && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  Localização: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileDriver;
