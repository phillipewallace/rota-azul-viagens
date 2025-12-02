
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';
import { useMobile, TruckMobileData } from '@/hooks/useMobile';
import { useRouteSync } from '@/hooks/useRouteSync';
import RouteUpdateNotification from '@/components/RouteUpdateNotification';
import RouteInfoCard from '@/components/RouteInfoCard';
import RouteExecutionCard from '@/components/RouteExecutionCard';
import StopsList from './StopsList';
import { sharedLocationStore } from '@/store/sharedLocationStore';

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
  const [showStopsList, setShowStopsList] = useState(false);

  // ✅ NOVO: Persistência de estado
  const [persistedState, setPersistedState] = useState<{
    isLoggedIn: boolean;
    plateNumber: string;
    truckData: TruckData | null;
    routeProgress: any;
  } | null>(null);

  const { getTruckByPlate, updateRoutePoint, finishRoute } = useMobile();
  const { hasRouteChanged, newRouteData, acceptRouteUpdate, dismissRouteUpdate, checkForRouteUpdates } = useRouteSync(fullTruckData);

  // Listener para compartilhamento de localização
  useEffect(() => {
    const unsubscribe = sharedLocationStore.subscribe((state) => {
      if (state.isFromShare && isLoggedIn && fullTruckData?.currentRoute) {
        console.log('📍 [MOBILE DRIVER] Compartilhamento recebido, abrindo lista');
        setShowStopsList(true);
      }
    });

    return unsubscribe;
  }, [isLoggedIn, fullTruckData]);

  // ✅ CAREGAR ESTADO PERSISTIDO NA INICIALIZAÇÃO
  useEffect(() => {
    const loadPersistedState = () => {
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

  // ✅ PERSISTIR ESTADO SEMPRE QUE MUDAR
  const persistState = (state: any) => {
    try {
      localStorage.setItem('mobile-driver-state', JSON.stringify(state));
      console.log('💾 [MOBILE] Estado persistido com sucesso');
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao persistir estado:', error);
    }
  };

  // ✅ RECARREGAR DADOS DO CAMINHÃO PRESERVANDO PROGRESSO
  const reloadTruckData = async (plate: string) => {
    try {
      console.log('🔄 [MOBILE] Recarregando dados do caminhão:', plate);
      
      const updatedData = await getTruckByPlate(plate);
      console.log('✅ [MOBILE] Dados atualizados recebidos:', updatedData);
      
      setFullTruckData(updatedData);
      
      // ✅ PRESERVAR PROGRESSO DA ROTA SALVO LOCALMENTE
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
      
      // ✅ PERSISTIR ESTADO
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
      toast.success(`Bem-vindo, ${data.name}!`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      console.error('❌ [MOBILE] Erro no login:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (truckData?.id) {
      updateActiveTrackingInStorage(truckData.id, false);
    }
    
    // ✅ LIMPAR ESTADO PERSISTIDO
    localStorage.removeItem('mobile-driver-state');
    
    setIsLoggedIn(false);
    setTruckData(null);
    setFullTruckData(null);
    setPlateNumber('');
    setError(null);
    setPersistedState(null);
    
    toast.success('Logout realizado com sucesso');
    console.log('👋 [MOBILE] Logout realizado');
  };

  // ✅ ATUALIZAR PROGRESSO LOCAL QUANDO PONTO FOR MARCADO
  const handlePointUpdate = async (pointId: string, completed: boolean) => {
    try {
      if (!fullTruckData?.id) return;
      
      // Atualizar no backend
      await updateRoutePoint({
        truckId: fullTruckData.id,
        pointId,
        completed
      });
      
      // ✅ ATUALIZAR ESTADO LOCAL E PERSISTIR
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

  const handleFinishRoute = async () => {
    if (!fullTruckData?.id) return;

    try {
      await finishRoute(fullTruckData.id);
      
      // Limpar estado
      const clearedData = {
        ...fullTruckData,
        currentRoute: null
      };
      
      setFullTruckData(clearedData);
      
      const stateToSave = {
        isLoggedIn: true,
        plateNumber,
        truckData,
        routeProgress: {}
      };
      persistState(stateToSave);
      
      toast.success('Rota finalizada com sucesso!');
      
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao finalizar rota:', error);
      toast.error('Erro ao finalizar rota');
    }
  };

  // Callback para atualizar dados após mudanças na lista de paradas
  const handleStopsUpdate = async () => {
    if (plateNumber) {
      await reloadTruckData(plateNumber);
    }
  };

  // Se estiver mostrando lista de paradas
  if (showStopsList && fullTruckData?.currentRoute) {
    return (
      <StopsList
        routeId={fullTruckData.currentRoute.id}
        truckId={fullTruckData.id}
        initialPoints={fullTruckData.currentRoute.points}
        onBack={() => {
          setShowStopsList(false);
          handleStopsUpdate();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {isLoggedIn ? (
        <>
          {/* Área de conteúdo rolável */}
          <div className="flex-1 overflow-y-auto pb-32">
            <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
              {/* Header do motorista */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h2 className="text-xl font-semibold">Painel do Motorista</h2>
                      <p className="text-gray-600">
                        {truckData?.name} - <span className="font-medium">{truckData?.plate}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => checkForRouteUpdates()}>
                        Atualizar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleLogout}>
                        Sair
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

              {/* Sem rota ativa */}
              {!fullTruckData?.currentRoute && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">Nenhuma rota ativa no momento</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Aguarde a atribuição de uma rota pelo administrador
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Card de Informações da Rota */}
              {fullTruckData?.currentRoute && (
                <RouteInfoCard
                  routeName={fullTruckData.currentRoute.name}
                  totalStops={fullTruckData.currentRoute.points?.length || 0}
                  completedStops={fullTruckData.currentRoute.points?.filter(p => p.completed).length || 0}
                  onViewStops={() => setShowStopsList(true)}
                />
              )}

              {/* Card de Execução da Rota */}
              {fullTruckData?.currentRoute && (
                <RouteExecutionCard
                  points={fullTruckData.currentRoute.points}
                  onPointComplete={handlePointUpdate}
                  onFinishRoute={handleFinishRoute}
                />
              )}
            </div>
          </div>

          {/* Footer fixo com safe-area */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
            <div className="p-4 pb-safe max-w-4xl mx-auto">
              {fullTruckData?.currentRoute && (
                <Button 
                  className="w-full h-14 text-lg font-semibold"
                  onClick={() => setShowStopsList(true)}
                >
                  Ver Paradas da Rota ({fullTruckData.currentRoute.points?.length || 0})
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-sm">
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
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="text-center text-lg h-12"
                />
                <Button className="w-full h-12 text-lg" onClick={handleLogin} disabled={loading}>
                  {loading ? 'Carregando...' : 'Entrar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MobileDriver;
