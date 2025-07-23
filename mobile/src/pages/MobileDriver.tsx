
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMobile } from "@/hooks/useMobile";
import { MapPin, CheckCircle, Circle, Navigation, LogOut } from 'lucide-react';

const MobileDriver = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    truckData, 
    getTruckByPlate, 
    markPointAsCompleted, 
    updateLocation, 
    clearTruckData,
    syncWithServer
  } = useMobile();

  const isLoggedIn = !!truckData;

  // ✅ GEOLOCALIZAÇÃO AUTOMÁTICA
  useEffect(() => {
    if (!isLoggedIn) return;

    const updateCurrentLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateLocation(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            console.error('❌ [MOBILE] Erro ao obter localização:', error);
          }
        );
      }
    };

    // Atualizar localização imediatamente
    updateCurrentLocation();

    // Atualizar localização a cada 1 minuto
    const interval = setInterval(updateCurrentLocation, 60000);
    
    return () => clearInterval(interval);
  }, [isLoggedIn, updateLocation]);

  // ✅ SINCRONIZAÇÃO AUTOMÁTICA AO ABRIR/FOCAR NA PÁGINA
  useEffect(() => {
    if (!isLoggedIn) return;

    const handleFocus = () => {
      console.log('📱 [MOBILE] Página focada, sincronizando dados...');
      syncWithServer();
    };

    window.addEventListener('focus', handleFocus);
    
    // Sincronizar imediatamente ao carregar
    syncWithServer();

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoggedIn, syncWithServer]);

  const handleLogin = async () => {
    if (!plateNumber.trim()) {
      setError('Por favor, insira o número da placa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 [MOBILE] Fazendo login com placa:', plateNumber);
      
      await getTruckByPlate(plateNumber);
      
      console.log('✅ [MOBILE] Login realizado com sucesso');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('❌ [MOBILE] Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearTruckData();
    setPlateNumber('');
    setError(null);
    console.log('👋 [MOBILE] Logout realizado');
  };

  const handleMarkComplete = async (pointId: string) => {
    try {
      console.log(`✅ [MOBILE] Marcando ponto ${pointId} como concluído`);
      await markPointAsCompleted(pointId);
      console.log(`✅ [MOBILE] Ponto ${pointId} marcado como concluído`);
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao marcar ponto:', error);
      setError('Erro ao marcar ponto como concluído');
    }
  };

  const getNextIncompletePoint = () => {
    if (!truckData?.currentRoute?.points) return null;
    
    return truckData.currentRoute.points
      .filter(point => !point.completed)
      .sort((a, b) => a.order - b.order)[0];
  };

  const getCompletedCount = () => {
    if (!truckData?.currentRoute?.points) return 0;
    return truckData.currentRoute.points.filter(point => point.completed).length;
  };

  const getTotalPoints = () => {
    return truckData?.currentRoute?.points?.length || 0;
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Acessar Caminhão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>Erro:</strong> {error}
              </div>
            )}
            
            <Input
              type="text"
              placeholder="Número da placa"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              disabled={loading}
              className="text-center"
            />
            
            <Button 
              className="w-full" 
              onClick={handleLogin} 
              disabled={loading}
            >
              {loading ? 'Carregando...' : 'Entrar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextPoint = getNextIncompletePoint();
  const completedCount = getCompletedCount();
  const totalPoints = getTotalPoints();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg">{truckData.name}</CardTitle>
                <p className="text-sm text-gray-600">Placa: {truckData.plate}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Progress */}
        {truckData.currentRoute && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                {truckData.currentRoute.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Progresso:</span>
                  <Badge variant="secondary">
                    {completedCount}/{totalPoints} pontos
                  </Badge>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${totalPoints > 0 ? (completedCount / totalPoints) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Próximo Ponto */}
        {nextPoint && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-600">Próximo Destino</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">{nextPoint.address}</p>
                    <p className="text-sm text-gray-600 capitalize">{nextPoint.type}</p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handleMarkComplete(nextPoint.id)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcar como Concluído
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Pontos */}
        {truckData.currentRoute && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Todos os Pontos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {truckData.currentRoute.points
                  .sort((a, b) => a.order - b.order)
                  .map((point, index) => (
                  <div 
                    key={point.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      point.completed 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="mt-0.5">
                      {point.completed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {index + 1}. {point.address}
                        </span>
                        {point.completed && (
                          <Badge variant="secondary" className="text-xs">
                            Concluído
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 capitalize">{point.type}</p>
                      {point.completedAt && (
                        <p className="text-xs text-green-600">
                          Concluído: {new Date(point.completedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    {!point.completed && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleMarkComplete(point.id)}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sem Rota */}
        {!truckData.currentRoute && (
          <Card>
            <CardContent className="text-center py-8">
              <Navigation className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma rota ativa no momento</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileDriver;
