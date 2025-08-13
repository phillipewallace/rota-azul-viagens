
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MapPin, Navigation, Clock, AlertCircle, Truck } from 'lucide-react';
import { backgroundTracker } from '../services/backgroundTracking';
import { useMobile } from '../hooks/useMobile';

interface Driver {
  id: string;
  name: string;
  truck_plate?: string;
  current_route?: {
    id: string;
    name: string;
    status: string;
  };
}

const MobileDriver = () => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trackingStatus, setTrackingStatus] = useState({
    isTracking: false,
    lastPosition: null,
    lastUpdate: null
  });
  
  const { checkConnection } = useMobile();

  useEffect(() => {
    loadDriverData();
    // Verificar status de rastreamento a cada 30 segundos
    const statusInterval = setInterval(updateTrackingStatus, 30000);
    return () => clearInterval(statusInterval);
  }, []);

  const loadDriverData = async () => {
    try {
      setIsLoading(true);
      const driverId = localStorage.getItem('mobile_driver_id');
      
      if (!driverId) {
        console.error('Driver ID não encontrado');
        return;
      }

      // Simular dados do motorista - em produção viria da API
      const mockDriver: Driver = {
        id: driverId,
        name: 'Motorista Teste',
        truck_plate: 'ABC-1234',
        current_route: {
          id: '1',
          name: 'Rota Centro',
          status: 'active'
        }
      };

      setDriver(mockDriver);

      // Iniciar rastreamento obrigatório automaticamente
      await startMandatoryTracking(driverId, mockDriver.current_route?.id);
      
    } catch (error) {
      console.error('Erro ao carregar dados do motorista:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startMandatoryTracking = async (driverId: string, routeId?: string) => {
    try {
      console.log('🚛 Iniciando rastreamento obrigatório da empresa');
      await backgroundTracker.enforceTracking(driverId, routeId);
      updateTrackingStatus();
      
      console.log('✅ Rastreamento obrigatório ativado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao iniciar rastreamento obrigatório:', error);
      // Mostrar alerta que o rastreamento é obrigatório
      alert('ATENÇÃO: O rastreamento de localização é obrigatório para o trabalho. Verifique as permissões do aplicativo.');
    }
  };

  const updateTrackingStatus = () => {
    const status = backgroundTracker.getTrackingStatus();
    setTrackingStatus(status);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados do motorista...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erro</h2>
            <p className="text-gray-600 mb-4">Não foi possível carregar os dados do motorista.</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Tentar Novamente
            </Button>
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
            <p className="text-blue-100">Bem-vindo, {driver.name}</p>
          </div>
          <Truck className="h-8 w-8" />
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
                <span className="text-gray-600">Placa:</span>
                <span className="font-semibold">{driver.truck_plate || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Motorista:</span>
                <span className="font-semibold">{driver.name}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Status Card */}
        {driver.current_route && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Rota Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Rota:</span>
                  <span className="font-semibold">{driver.current_route.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={driver.current_route.status === 'active' ? 'default' : 'secondary'}>
                    {driver.current_route.status === 'active' ? 'Ativa' : 'Inativa'}
                  </Badge>
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
                  <div className={`w-3 h-3 rounded-full ${trackingStatus.isTracking ? 'bg-green-500' : 'bg-red-500'}`}></div>
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

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Status da Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={checkConnection} 
              variant="outline" 
              className="w-full"
            >
              Verificar Conexão com Servidor
            </Button>
          </CardContent>
        </Card>

        {/* Refresh Status Button */}
        <Card>
          <CardContent className="p-4">
            <Button 
              onClick={updateTrackingStatus} 
              className="w-full"
              variant="secondary"
            >
              Atualizar Status
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobileDriver;
