
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  AlertCircle, 
  Truck, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Battery, 
  Signal,
  CheckCircle,
  XCircle,
  MapIcon,
  TrendingUp,
  Activity
} from 'lucide-react';
import { backgroundTracker } from '../services/backgroundTracking';
import { ThemeToggle } from '../components/ThemeToggle';
import { SplashScreen } from '../components/SplashScreen';

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [recentPlates, setRecentPlates] = useState<string[]>([]);
  const [trackingStatus, setTrackingStatus] = useState({
    isTracking: false,
    lastPosition: null,
    lastUpdate: null,
    dataPoints: 0
  });

  // Simular splash screen na primeira carga
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Monitor de conexão
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Carregar placas recentes do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent_plates');
    if (saved) {
      setRecentPlates(JSON.parse(saved));
    }
  }, []);

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

  const saveRecentPlate = (plate: string) => {
    const updated = [plate, ...recentPlates.filter(p => p !== plate)].slice(0, 5);
    setRecentPlates(updated);
    localStorage.setItem('recent_plates', JSON.stringify(updated));
  };

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
      
      // Salvar na lista de placas recentes
      saveRecentPlate(plateNumber.toUpperCase());
      
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
        lastUpdate: null,
        dataPoints: 0
      });
      
      console.log('👋 Logout realizado com sucesso');
    } catch (error) {
      console.error('❌ Erro no logout:', error);
    }
  };

  // Calcular progresso da rota
  const getRouteProgress = () => {
    if (!truckData?.currentRoute) return 0;
    const { completedPoints, pointsCount } = truckData.currentRoute;
    return pointsCount > 0 ? (completedPoints / pointsCount) * 100 : 0;
  };

  // Mostrar splash screen
  if (initialLoading) {
    return <SplashScreen isLoading={initialLoading} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center animate-pulse">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium">Verificando dados do caminhão...</p>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full gradient-primary animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card animate-fade-in">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
                <svg 
                  viewBox="0 0 2000 2000" 
                  className="w-10 h-10 text-white" 
                  fill="currentColor"
                >
                  <path d="m1108 636h27l22 1 11 3 11 6 9 9 8 16 2 13-2 12-5 12-8 10-8 6-9 4-16 3h-17v299l8 16 19 37 10 19 12 23 10 19 17 33 24 46 10 18 8 16 15 29 12 22 12 24 11 20 8 16 12 23 10 19 15 29 10 19 14 27 12 22 19 37 12 22 10 19 9 20 3 11v19l-5 16-7 12-12 13-12 9-14 6-15 4-14 1h-715l-17-2-15-5-11-6-10-8-8-8-9-14-4-10-2-12v-11l2-12 6-15 24-46 8-16 12-23 17-33 10-19 18-35 10-19 17-33 10-19 15-29 9-17 8-16 22-43 10-19 15-29 35-68 10-19 15-29 20-39 9-17 1-294h-18l-13-2-10-4-9-7-8-10-5-12-1-4v-16l4-13 7-11 8-7 12-6 8-2z"/>
                </svg>
              </div>
            </div>
            <CardTitle className="responsive-text-2xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              AlchemyRotas Mobile
            </CardTitle>
            <p className="text-muted-foreground">Sistema de Rastreamento</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status de conexão */}
            <div className="flex items-center justify-center space-x-2 text-sm">
              {isOnline ? (
                <><Wifi className="h-4 w-4 text-green-500" /><span className="text-green-500">Online</span></>
              ) : (
                <><WifiOff className="h-4 w-4 text-red-500" /><span className="text-red-500">Offline</span></>
              )}
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg animate-slide-up">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Placa do Caminhão</label>
                <Input
                  type="text"
                  placeholder="Ex: ABC-1234"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="text-center font-mono text-lg h-12"
                  maxLength={8}
                />
              </div>

              {/* Placas recentes */}
              {recentPlates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Placas Recentes</label>
                  <div className="flex flex-wrap gap-2">
                    {recentPlates.map((plate, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => setPlateNumber(plate)}
                        className="h-8 text-xs font-mono"
                      >
                        {plate}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              <Button 
                className="w-full h-12 gradient-primary text-white font-medium" 
                onClick={handleLogin} 
                disabled={loading || !plateNumber.trim() || !isOnline}
              >
                {loading ? (
                  <><Activity className="h-4 w-4 mr-2 animate-spin" />Verificando...</>
                ) : (
                  <><Truck className="h-4 w-4 mr-2" />Acessar Caminhão</>
                )}
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>Digite a placa do caminhão para iniciar o rastreamento</p>
              {!isOnline && <p className="text-warning">⚠️ Conexão necessária para login</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const routeProgress = getRouteProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <div className="gradient-primary text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <svg 
                viewBox="0 0 2000 2000" 
                className="w-6 h-6 text-white" 
                fill="currentColor"
              >
                <path d="m1108 636h27l22 1 11 3 11 6 9 9 8 16 2 13-2 12-5 12-8 10-8 6-9 4-16 3h-17v299l8 16 19 37 10 19 12 23 10 19 17 33 24 46 10 18 8 16 15 29 12 22 12 24 11 20 8 16 12 23 10 19 15 29 10 19 14 27 12 22 19 37 12 22 10 19 9 20 3 11v19l-5 16-7 12-12 13-12 9-14 6-15 4-14 1h-715l-17-2-15-5-11-6-10-8-8-8-9-14-4-10-2-12v-11l2-12 6-15 24-46 8-16 12-23 17-33 10-19 18-35 10-19 17-33 10-19 15-29 9-17 8-16 22-43 10-19 15-29 35-68 10-19 15-29 20-39 9-17 1-294h-18l-13-2-10-4-9-7-8-10-5-12-1-4v-16l4-13 7-11 8-7 12-6 8-2z"/>
              </svg>
            </div>
            <div>
              <h1 className="responsive-text-xl font-bold">AlchemyRotas Mobile</h1>
              <p className="text-white/80 text-sm">
                {truckData?.driver ? `Motorista: ${truckData.driver}` : 'Sistema de Rastreamento'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Status indicators */}
            <div className="flex items-center space-x-1">
              {isOnline ? (
                <Signal className="h-4 w-4 text-green-300" />
              ) : (
                <XCircle className="h-4 w-4 text-red-300" />
              )}
              <Battery className="h-4 w-4 text-white/70" />
            </div>
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 animate-fade-in">
        
        {/* Truck Info Card */}
        <Card className="gradient-card shadow-card card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 responsive-text-xl">
              <Truck className="h-5 w-5 text-primary" />
              Informações do Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Nome</span>
                <p className="font-semibold">{truckData?.name}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Placa</span>
                <p className="font-semibold font-mono">{truckData?.plate}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Modelo</span>
                <p className="font-semibold">{truckData?.model} ({truckData?.year})</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Status</span>
                <Badge variant={
                  truckData?.status === 'in-route' ? 'default' : 
                  truckData?.status === 'maintenance' ? 'destructive' : 'secondary'
                } className="animate-scale-in">
                  {truckData?.status === 'in-route' ? 'Em Rota' : 
                   truckData?.status === 'maintenance' ? 'Manutenção' : 'Disponível'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Status Card */}
        {truckData?.currentRoute && (
          <Card className="gradient-card shadow-card card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 responsive-text-xl">
                <Navigation className="h-5 w-5 text-primary" />
                Rota Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Nome</span>
                  <span className="font-semibold text-right">{truckData.currentRoute.name}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Progresso</span>
                    <span className="text-sm font-medium">
                      {truckData.currentRoute.completedPoints}/{truckData.currentRoute.pointsCount}
                    </span>
                  </div>
                  <Progress value={routeProgress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span className="font-medium">{Math.round(routeProgress)}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {truckData.currentRoute.description && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground text-xs">Descrição:</span>
                    <p className="text-sm mt-1">{truckData.currentRoute.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location Card */}
        {truckData?.location && (
          <Card className="gradient-card shadow-card card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 responsive-text-xl">
                <MapIcon className="h-5 w-5 text-green-500" />
                Localização Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">Latitude</span>
                  <p className="font-mono font-medium">{truckData.location.lat.toFixed(6)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Longitude</span>
                  <p className="font-mono font-medium">{truckData.location.lng.toFixed(6)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tracking Status Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary responsive-text-xl">
              <MapPin className="h-5 w-5" />
              Sistema de Rastreamento
              <div className="ml-auto flex items-center gap-2">
                {trackingStatus.isTracking ? (
                  <div className="w-3 h-3 rounded-full status-online"></div>
                ) : (
                  <div className="w-3 h-3 rounded-full status-offline"></div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-sm">Status</span>
                  <div className="flex items-center gap-2">
                    {trackingStatus.isTracking ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-semibold">
                      {trackingStatus.isTracking ? 'Ativo' : 'Desconectado'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-muted-foreground text-sm">Pontos</span>
                  <p className="font-semibold">{trackingStatus.dataPoints}</p>
                </div>
              </div>
              
              {trackingStatus.lastUpdate && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-sm">Última atualização</span>
                  <p className="text-sm font-medium">{trackingStatus.lastUpdate}</p>
                </div>
              )}
              
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">Sistema Conectado</p>
                    <p className="text-muted-foreground mt-1">
                      O rastreamento está funcionando normalmente para garantir sua segurança.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={updateTrackingStatus} 
            variant="outline"
            className="h-12 card-hover"
          >
            <Clock className="h-4 w-4 mr-2" />
            Atualizar Status
          </Button>
          
          {!trackingStatus.isTracking && truckData && (
            <Button 
              onClick={() => startMandatoryTracking(truckData.id)} 
              className="h-12 gradient-primary text-white"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Reconectar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileDriver;
