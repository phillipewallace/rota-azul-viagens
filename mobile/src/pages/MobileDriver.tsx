
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useMobile } from '@/hooks/useMobile';
import { MapPin, Navigation, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const MobileDriver = () => {
  const [truckPlate, setTruckPlate] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const { 
    truckData, 
    loading, 
    error, 
    getTruckByPlate, 
    updateLocation, 
    updateRoutePoint, 
    finishRoute 
  } = useMobile();

  useEffect(() => {
    if (navigator.geolocation && truckData) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          updateLocation(truckData.id, position.coords.latitude, position.coords.longitude);
        },
        (error) => console.error('Erro GPS:', error),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [truckData, updateLocation]);

  const handleLogin = async () => {
    if (!truckPlate.trim()) {
      alert('Digite a placa do caminhão');
      return;
    }

    const success = await getTruckByPlate(truckPlate.trim());
    if (success) {
      setIsLoggedIn(true);
    }
  };

  const handleCompletePoint = async (pointId: string) => {
    if (!truckData) return;
    
    try {
      await updateRoutePoint(truckData.id, pointId, true);
      // Refresh truck data
      await getTruckByPlate(truckPlate);
    } catch (error) {
      console.error('Erro ao marcar ponto:', error);
      alert('Erro ao marcar ponto como concluído');
    }
  };

  const handleFinishRoute = async () => {
    if (!truckData) return;
    
    if (window.confirm('Tem certeza que deseja finalizar a rota?')) {
      try {
        const success = await finishRoute(truckData.id);
        if (success) {
          alert('Rota finalizada com sucesso!');
          setIsLoggedIn(false);
          setTruckPlate('');
        }
      } catch (error) {
        console.error('Erro ao finalizar rota:', error);
        alert('Erro ao finalizar rota');
      }
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-blue-600">
              🚛 AlchemyRotas Mobile
            </CardTitle>
            <p className="text-gray-600">Acesso do Motorista</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Placa do Caminhão
              </label>
              <Input
                type="text"
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                className="text-center text-lg"
                maxLength={8}
              />
            </div>
            
            <Button 
              onClick={handleLogin}
              disabled={loading || !truckPlate.trim()}
              className="w-full"
            >
              {loading ? 'Verificando...' : 'Acessar'}
            </Button>

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!truckData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🚛 {truckData.name}</span>
              <Badge variant={truckData.status === 'in-route' ? 'default' : 'secondary'}>
                {truckData.status === 'in-route' ? 'Em Rota' : 'Disponível'}
              </Badge>
            </CardTitle>
            <div className="text-sm text-gray-600">
              <div>Placa: {truckData.plate}</div>
              {truckData.driver && <div>Motorista: {truckData.driver}</div>}
            </div>
          </CardHeader>
        </Card>

        {/* Rota Atual */}
        {truckData.currentRoute ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                {truckData.currentRoute.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600 mb-4">
                Pontos da rota ({truckData.currentRoute.points?.length || 0} total)
              </div>

              {truckData.currentRoute.points?.map((point: any, index: number) => (
                <div key={point.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                    point.completed ? 'bg-green-500' : 
                    point.type === 'origin' ? 'bg-blue-500' :
                    point.type === 'destination' ? 'bg-red-500' : 'bg-gray-400'
                  }`}>
                    {point.completed ? <CheckCircle className="h-4 w-4" /> : index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-medium text-sm">{point.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {point.type === 'origin' ? 'Origem' :
                         point.type === 'destination' ? 'Destino' : 'Parada'}
                      </Badge>
                      {point.completed && (
                        <Badge variant="default" className="text-xs bg-green-500">
                          Concluído
                        </Badge>
                      )}
                    </div>
                  </div>

                  {!point.completed && (
                    <Button
                      size="sm"
                      onClick={() => handleCompletePoint(point.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                onClick={handleFinishRoute}
                className="w-full mt-4 bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                🏁 Finalizar Rota Completa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma rota ativa</h3>
              <p className="text-gray-600">
                Aguarde a atribuição de uma nova rota
              </p>
            </CardContent>
          </Card>
        )}

        {/* Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-green-500" />
                <span>GPS Ativo</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>{new Date().toLocaleTimeString('pt-BR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          onClick={() => {
            setIsLoggedIn(false);
            setTruckPlate('');
          }}
          className="w-full"
        >
          Sair
        </Button>
      </div>
    </div>
  );
};

export default MobileDriver;
