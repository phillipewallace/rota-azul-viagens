
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { MapPin, Navigation, Clock, AlertCircle, Truck, LogOut } from 'lucide-react';
import { backgroundTracker } from '../services/backgroundTracking';

interface TruckData {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: string;
  driver: string | null;
  location: {
    lat: number;
    lng: number;
  } | null;
  currentRoute: {
    id: string;
    name: string;
    description: string | null;
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: string;
      completed: boolean;
      completedAt: string | null;
    }>;
    pointsCount: number;
    completedPoints: number;
    lastUpdated: string;
  } | null;
  lastUpdated: string;
}

const MobileDriver = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [truckData, setTruckData] = useState<TruckData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingStatus, setTrackingStatus] = useState({
    isTracking: false,
    lastPosition: null,
    lastUpdate: null
  });

  useEffect(() => {
    // Verificar se há sessão ativa no localStorage
    const savedPlate = localStorage.getItem('mobile_truck_plate');
    const savedTruckData = localStorage.getItem('mobile_truck_data');
    
    if (savedPlate && savedTruckData) {
      try {
        const truck = JSON.parse(savedTruckData);
        setPlateNumber(savedPlate);
        setTruckData(truck);
        setIsLoggedIn(true);
        
        // Iniciar rastreamento obrigatório
        startMandatoryTracking(truck.id);
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
        localStorage.removeItem('mobile_truck_plate');
        localStorage.removeItem('mobile_truck_data');
      }
    }

    // Verificar status de rastreamento periodicamente
    const statusInterval = setInterval(updateTrackingStatus, 30000);
    return () => clearInterval(statusInterval);
  }, []);

  const handleLogin = async () => {
    if (!plateNumber.trim()) {
      setError('Por favor, insira o número da placa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 [MOBILE] Fazendo login com placa:', plateNumber);
      
      const response = await fetch(`https://admmicban.com.br/api/mobile/truck/${plateNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      console.log('📡 [MOBILE] Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [MOBILE] Erro:', errorData);
        throw new Error('Caminhão não encontrado ou placa inválida');
      }

      const data: TruckData = await response.json();
      console.log('✅ [MOBILE] Dados do caminhão recebidos:', data);
      
      setTruckData(data);
      setIsLoggedIn(true);
      
      // Salvar sessão no localStorage
      localStorage.setItem('mobile_truck_plate', plateNumber);
      localStorage.setItem('mobile_truck_data', JSON.stringify(data));
      
      // Iniciar rastreamento obrigatório automaticamente
      await startMandatoryTracking(data.id);
      
      console.log('🚛 Login realizado com sucesso:', data.name);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('❌ Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const startMandatoryTracking = async (truckId: string) => {
    try {
      console.log('🚛 Iniciando rastreamento obrigatório para caminhão:', truckId);
      await backgroundTracker.enforceTracking(truckId, truckData?.currentRoute?.id);
      updateTrackingStatus();
      
      console.log('✅ Rastreamento obrigatório ativado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao iniciar rastreamento obrigatório:', error);
      setError('ATENÇÃO: O rastreamento de localização é obrigatório para o trabalho. Verifique as permissões do aplicativo.');
    }
  };

  const updateTrackingStatus = () => {
    const status = backgroundTracker.getTrackingStatus();
    setTrackingStatus(status);
  };

  const handleLogout = async () => {
    try {
      // Parar rastreamento
      await backgroundTracker.stopTracking();
      
      // Limpar dados do localStorage
      localStorage.removeItem('mobile_truck_plate');
      localStorage.removeItem('mobile_truck_data');
      
      // Resetar estado
      setIsLoggedIn(false);
      setTruckData(null);
      setPlateNumber('');
      setError(null);
      setTrackingStatus({
        isTracking: false,
        lastPosition: null,
        lastUpdate: null
      });
      
      console.log('👋 Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro no logout:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados do caminhão...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Truck className="h-6 w-6 text-blue-600" />
              AlchemyRotas Mobile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Placa do Caminhão</label>
              <Input
                type="text"
                placeholder="Ex: ABC-1234"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                disabled={loading}
                className="text-center font-mono"
              />
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleLogin} 
              disabled={loading || !plateNumber.trim()}
            >
              {loading ? 'Verificando...' : 'Acessar Caminhão'}
            </Button>
            
            <div className="text-xs text-gray-500 text-center">
              Digite a placa do caminhão para iniciar o rastreamento
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">AlchemyRotas Mobile</h1>
            <p className="text-blue-100">
              {truckData?.driver ? `Motorista: ${truckData.driver}` : 'Sistema de Rastreamento'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="text-blue-600 border-white hover:bg-white hover:text-blue-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="p-4 space-y-4">
        
        {/* Truck Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Informações do Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Nome:</span>
                <span className="font-semibold">{truckData?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Placa:</span>
                <span className="font-semibold font-mono">{truckData?.plate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Modelo:</span>
                <span className="font-semibold">{truckData?.model} ({truckData?.year})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <Badge variant={
                  truckData?.status === 'in-route' ? 'default' : 
                  truckData?.status === 'maintenance' ? 'destructive' : 'secondary'
                }>
                  {truckData?.status === 'in-route' ? 'Em Rota' : 
                   truckData?.status === 'maintenance' ? 'Manutenção' : 'Disponível'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Status Card */}
        {truckData?.currentRoute && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Rota Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Nome:</span>
                  <span className="font-semibold">{truckData.currentRoute.name}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Progresso:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {truckData.currentRoute.completedPoints}/{truckData.currentRoute.pointsCount}
                    </span>
                    <Badge variant={
                      truckData.currentRoute.completedPoints === truckData.currentRoute.pointsCount 
                        ? 'default' : 'secondary'
                    }>
                      {truckData.currentRoute.completedPoints === truckData.currentRoute.pointsCount 
                        ? 'Completa' : 'Em Andamento'}
                    </Badge>
                  </div>
                </div>

                {truckData.currentRoute.description && (
                  <div>
                    <span className="text-gray-600 text-sm">Descrição:</span>
                    <p className="text-sm mt-1">{truckData.currentRoute.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location Card */}
        {truckData?.location && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-500" />
                Localização Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Latitude:</span>
                  <span className="font-mono text-sm">{truckData.location.lat.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Longitude:</span>
                  <span className="font-mono text-sm">{truckData.location.lng.toFixed(6)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mandatory Tracking Status Card */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <MapPin className="h-5 w-5" />
              Rastreamento da Empresa
              <Badge variant="destructive" className="ml-auto">OBRIGATÓRIO</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${trackingStatus.isTracking ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="font-semibold">
                    {trackingStatus.isTracking ? 'Rastreando' : 'Desconectado'}
                  </span>
                </div>
              </div>
              
              {trackingStatus.lastUpdate && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Última atualização:</span>
                  <span className="text-sm font-medium">{trackingStatus.lastUpdate}</span>
                </div>
              )}
              
              <div className="bg-orange-100 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Rastreamento Obrigatório</p>
                    <p>Este dispositivo pertence à empresa e deve manter a localização ativa durante o horário de trabalho.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button 
            onClick={updateTrackingStatus} 
            className="w-full"
            variant="secondary"
          >
            <Clock className="h-4 w-4 mr-2" />
            Atualizar Status
          </Button>
          
          {!trackingStatus.isTracking && truckData && (
            <Button 
              onClick={() => startMandatoryTracking(truckData.id)} 
              className="w-full"
              variant="default"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Reativar Rastreamento
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileDriver;
