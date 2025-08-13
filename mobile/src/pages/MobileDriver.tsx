
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';
import { useMobile, TruckMobileData } from '@/hooks/useMobile';
import { useRouteSync } from '@/hooks/useRouteSync';
import MobileRouteMap from '@/components/MobileRouteMap';
import RouteUpdateNotification from '@/components/RouteUpdateNotification';
import { backgroundTrackingService } from '@/services/backgroundTracking';
import { Capacitor } from '@capacitor/core';

interface TruckData {
  id: string;
  name: string;
  plate: string;
  model: string;
}

const MobileDriver = () => {
  const [plateNumber, setPlateNumber] = useState('');
  const [truckData, setTruckData] = useState<TruckData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullTruckData, setFullTruckData] = useState<TruckMobileData | null>(null);
  const [trackingStatus, setTrackingStatus] = useState({ isTracking: false, queueSize: 0 });

  // ✅ Persistência de estado
  const [persistedState, setPersistedState] = useState<{
    isLoggedIn: boolean;
    plateNumber: string;
    truckData: TruckData | null;
    routeProgress: any;
  } | null>(null);

  const { getTruckByPlate, updateTruckLocation, updateRoutePoint, finishRoute } = useMobile();
  const { hasRouteChanged, newRouteData, acceptRouteUpdate, dismissRouteUpdate, checkForRouteUpdates } = useRouteSync(fullTruckData);

  // ✅ Inicializar serviço de background na montagem do componente
  useEffect(() => {
    const initializeBackgroundService = async () => {
      try {
        await backgroundTrackingService.initialize();
        console.log('📱 [MOBILE] Serviço de background inicializado');
        
        // Atualizar status de tracking periodicamente
        const statusInterval = setInterval(() => {
          const status = backgroundTrackingService.getTrackingStatus();
          setTrackingStatus({
            isTracking: status.isTracking,
            queueSize: status.queueSize
          });
        }, 5000);

        return () => clearInterval(statusInterval);
      } catch (error) {
        console.error('❌ [MOBILE] Erro ao inicializar background service:', error);
      }
    };

    initializeBackgroundService();
  }, []);

  // ✅ Carregar estado persistido
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const saved = localStorage.getItem('mobile-driver-state');
        if (saved) {
          const parsedState = JSON.parse(saved);
          console.log('📱 [MOBILE] Carregando estado persistido:', parsedState);
          
          setPersistedState(parsedState);
          
          if (parsedState.isLoggedIn && parsedState.plateNumber && parsedState.truckData) {
            setIsLoggedIn(true);
            setPlateNumber(parsedState.plateNumber);
            setTruckData(parsedState.truckData);
            
            // ✅ INICIAR RASTREAMENTO OBRIGATÓRIO AUTOMATICAMENTE
            await startMandatoryTracking(parsedState.truckData);
            
            // Recarregar dados completos do caminhão
            reloadTruckData(parsedState.plateNumber);
          }
        }
      } catch (error) {
        console.error('❌ [MOBILE] Erro ao carregar estado persistido:', error);
        localStorage.removeItem('mobile-driver-state');
      }
    };

    loadPersistedState();
  }, []);

  // ✅ Iniciar rastreamento obrigatório
  const startMandatoryTracking = async (truck: TruckData) => {
    try {
      console.log('🟢 [MOBILE] Iniciando rastreamento obrigatório para:', truck.name);
      
      const trackingConfig = {
        truckId: truck.id,
        truckName: truck.name,
        plate: truck.plate,
        updateInterval: 10000 // 10 segundos
      };

      const success = await backgroundTrackingService.startTracking(trackingConfig);
      
      if (success) {
        toast.success('Rastreamento GPS ativado automaticamente', {
          description: 'Localização será monitorada continuamente'
        });
        
        // Mostrar status de tracking
        const status = backgroundTrackingService.getTrackingStatus();
        setTrackingStatus({
          isTracking: status.isTracking,
          queueSize: status.queueSize
        });
      }
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao iniciar rastreamento obrigatório:', error);
      toast.error('Erro ao ativar rastreamento GPS', {
        description: 'Verifique as permissões de localização'
      });
    }
  };

  // ✅ Persistir estado
  const persistState = (state: any) => {
    try {
      localStorage.setItem('mobile-driver-state', JSON.stringify(state));
      console.log('💾 [MOBILE] Estado persistido com sucesso');
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao persistir estado:', error);
    }
  };

  // ✅ Recarregar dados do caminhão
  const reloadTruckData = async (plate: string) => {
    try {
      console.log('🔄 [MOBILE] Recarregando dados do caminhão:', plate);
      
      const updatedData = await getTruckByPlate(plate);
      console.log('✅ [MOBILE] Dados atualizados recebidos:', updatedData);
      
      setFullTruckData(updatedData);
      
      // Preservar progresso da rota salvo localmente
      if (persistedState?.routeProgress && updatedData.currentRoute) {
        console.log('🔄 [MOBILE] Aplicando progresso salvo da rota');
        
        const mergedRoute = {
          ...updatedData.currentRoute,
          points: updatedData.currentRoute.points.map(point => {
            const savedProgress = persistedState.routeProgress[point.id];
            if (savedProgress) {
              return {
                ...point,
                completed: savedProgress.completed,
                completedAt: savedProgress.completedAt
              };
            }
            return point;
          })
        };
        
        setFullTruckData({
          ...updatedData,
          currentRoute: mergedRoute
        });
      }
      
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao recarregar dados:', error);
    }
  };

  const updateActiveTrackingInStorage = (truckId: string | null, isActive: boolean) => {
    try {
      const stored = localStorage.getItem('active-truck-tracking') || '[]';
      let activeTrucks = JSON.parse(stored);
      
      if (isActive && truckId && !activeTrucks.includes(truckId)) {
        activeTrucks.push(truckId);
      } else if (!isActive && truckId) {
        activeTrucks = activeTrucks.filter((id: string) => id !== truckId);
      }
      
      localStorage.setItem('active-truck-tracking', JSON.stringify(activeTrucks));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'active-truck-tracking',
        newValue: JSON.stringify(activeTrucks)
      }));
      
      console.log('📍 [MOBILE] Lista de rastreamento atualizada:', activeTrucks);
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao atualizar rastreamento:', error);
    }
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
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${plateNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      if (!response.ok) {
        throw new Error('Caminhão não encontrado');
      }

      const data = await response.json();
      console.log('✅ [MOBILE] Dados do caminhão recebidos:', data);
      
      setTruckData(data);
      setFullTruckData(data);
      setIsLoggedIn(true);
      
      // ✅ Persistir estado
      const stateToSave = {
        isLoggedIn: true,
        plateNumber,
        truckData: data,
        routeProgress: data.currentRoute ? 
          Object.fromEntries(
            data.currentRoute.points.map((p: any) => [
              p.id, 
              { completed: p.completed, completedAt: p.completedAt }
            ])
          ) : {}
      };
      persistState(stateToSave);
      
      updateActiveTrackingInStorage(data.id, true);
      
      // ✅ INICIAR RASTREAMENTO OBRIGATÓRIO IMEDIATAMENTE
      await startMandatoryTracking(data);
      
      toast.success(`Bem-vindo, ${data.name}!`, {
        description: 'Rastreamento GPS ativado automaticamente'
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('❌ [MOBILE] Erro no login:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (truckData?.id) {
      updateActiveTrackingInStorage(truckData.id, false);
    }
    
    // ⚠️ NOTA: Em produção, você pode querer manter o tracking ativo mesmo após logout
    // Para fins de demonstração, vamos parar o tracking
    try {
      await backgroundTrackingService.stopTracking();
      console.log('🔴 [MOBILE] Rastreamento interrompido no logout');
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao parar rastreamento:', error);
    }
    
    // Limpar estado persistido
    localStorage.removeItem('mobile-driver-state');
    
    setIsLoggedIn(false);
    setTruckData(null);
    setFullTruckData(null);
    setPlateNumber('');
    setError(null);
    setPersistedState(null);
    setTrackingStatus({ isTracking: false, queueSize: 0 });
    
    toast.success('Logout realizado com sucesso');
    console.log('👋 [MOBILE] Logout realizado');
  };

  // ✅ Atualizar progresso local quando ponto for marcado
  const handlePointUpdate = async (pointId: string, completed: boolean) => {
    try {
      if (!fullTruckData?.id) return;
      
      // Atualizar no backend
      await updateRoutePoint({
        truckId: fullTruckData.id,
        pointId,
        completed
      });
      
      // Atualizar estado local e persistir
      const updatedData = {
        ...fullTruckData,
        currentRoute: {
          ...fullTruckData.currentRoute!,
          points: fullTruckData.currentRoute!.points.map(p => 
            p.id === pointId 
              ? { ...p, completed, completedAt: completed ? new Date().toISOString() : undefined }
              : p
          )
        }
      };
      
      setFullTruckData(updatedData);
      
      // Persistir progresso
      const routeProgress = Object.fromEntries(
        updatedData.currentRoute!.points.map(p => [
          p.id, 
          { completed: p.completed, completedAt: p.completedAt }
        ])
      );
      
      const stateToSave = {
        isLoggedIn: true,
        plateNumber,
        truckData,
        routeProgress
      };
      persistState(stateToSave);
      
      console.log('✅ [MOBILE] Ponto atualizado e persistido:', pointId, completed);
      
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao atualizar ponto:', error);
      toast.error('Erro ao atualizar ponto da rota');
    }
  };

  // ✅ Função para forçar sincronização manual
  const handleForceSync = async () => {
    try {
      const success = await backgroundTrackingService.forcSync();
      if (success) {
        toast.success('Sincronização realizada com sucesso');
      } else {
        toast.warning('Nenhum dado para sincronizar');
      }
    } catch (error) {
      console.error('❌ [MOBILE] Erro na sincronização forçada:', error);
      toast.error('Erro na sincronização');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      {isLoggedIn ? (
        <div className="w-full max-w-4xl space-y-4">
          {/* Header do motorista com status de tracking */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">Painel do Motorista</h2>
                  <p className="text-gray-600">
                    {truckData?.name} - <span className="font-medium">{truckData?.plate}</span>
                  </p>
                  
                  {/* ✅ Status do rastreamento obrigatório */}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge 
                      variant={trackingStatus.isTracking ? "default" : "destructive"}
                      className={trackingStatus.isTracking ? "bg-green-500" : "bg-red-500"}
                    >
                      <div className={`w-2 h-2 rounded-full mr-1 ${
                        trackingStatus.isTracking ? 'bg-green-200 animate-pulse' : 'bg-red-200'
                      }`}></div>
                      {trackingStatus.isTracking ? 'GPS Ativo' : 'GPS Inativo'}
                    </Badge>
                    
                    {trackingStatus.queueSize > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {trackingStatus.queueSize} pendente(s)
                      </Badge>
                    )}
                    
                    {Capacitor.isNativePlatform() && (
                      <span className="text-xs text-gray-500">
                        Modo Nativo • Background Ativo
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {trackingStatus.queueSize > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleForceSync}
                    >
                      Sync ({trackingStatus.queueSize})
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => checkForRouteUpdates()}
                  >
                    Verificar Atualizações
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleLogout}>
                    Sair
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ✅ Aviso sobre rastreamento obrigatório */}
          {!trackingStatus.isTracking && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <p className="text-sm text-amber-800">
                    <strong>Atenção:</strong> O rastreamento GPS é obrigatório durante o expediente. 
                    Verifique as permissões de localização se o status estiver inativo.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notificação de atualização de rota */}
          {hasRouteChanged && newRouteData && (
            <RouteUpdateNotification
              onAccept={() => {
                const updatedData = acceptRouteUpdate(newRouteData);
                setFullTruckData(updatedData);
                
                // Atualizar estado persistido
                const stateToSave = {
                  isLoggedIn: true,
                  plateNumber,
                  truckData,
                  routeProgress: updatedData.currentRoute ? 
                    Object.fromEntries(
                      updatedData.currentRoute.points.map((p: any) => [
                        p.id, 
                        { completed: p.completed, completedAt: p.completedAt }
                      ])
                    ) : {}
                };
                persistState(stateToSave);
              }}
              onDismiss={dismissRouteUpdate}
            />
          )}

          {/* Mapa da rota */}
          {fullTruckData && (
            <MobileRouteMap 
              truckData={fullTruckData}
              onLocationUpdate={updateTruckLocation}
              onPointUpdate={handlePointUpdate}
              onFinishRoute={finishRoute}
            />
          )}
        </div>
      ) : (
        <Card className="w-96">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">
              Acessar Caminhão
            </h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                <strong className="font-bold">Erro:</strong>
                <span className="block sm:inline"> {error}</span>
              </div>
            )}

            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Número da placa"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                disabled={loading}
              />
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? 'Carregando...' : 'Entrar'}
              </Button>
              
              {/* ✅ Aviso sobre rastreamento obrigatório */}
              <div className="text-xs text-gray-600 text-center">
                <p>⚠️ Ao fazer login, o rastreamento GPS será ativado automaticamente</p>
                <p>Dispositivo da empresa • Monitoramento obrigatório</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileDriver;
