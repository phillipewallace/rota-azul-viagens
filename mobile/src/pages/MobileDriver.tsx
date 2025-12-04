/**
 * MobileDriver - Tela principal do app de motoristas
 * 
 * Funcionalidades:
 * - Login por placa do veículo
 * - Exibição da rota do dia vinculada ao caminhão
 * - Visualização e execução de paradas
 * - Integração com deep links de localização (WhatsApp)
 * - Persistência de estado entre sessões
 * 
 * IMPORTANTE: Mantém compatibilidade com drag & drop da StopsList
 */

import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { Truck, LogOut, RefreshCw, MapPin, User } from 'lucide-react';
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

  // Persistência de estado
  const [persistedState, setPersistedState] = useState<{
    isLoggedIn: boolean;
    plateNumber: string;
    truckData: TruckData | null;
    routeProgress: any;
  } | null>(null);

  const { getTruckByPlate, updateRoutePoint, finishRoute } = useMobile();
  const { hasRouteChanged, newRouteData, acceptRouteUpdate, dismissRouteUpdate, checkForRouteUpdates } = useRouteSync(fullTruckData);

  /**
   * Listener para compartilhamento de localização via deep link
   * Quando usuário abre localização do WhatsApp com o app, redireciona para criar parada
   */
  useEffect(() => {
    const unsubscribe = sharedLocationStore.subscribe((state) => {
      if (state.isFromShare && isLoggedIn && fullTruckData?.currentRoute) {
        console.log('📍 [MOBILE DRIVER] Compartilhamento recebido, abrindo lista de paradas');
        setShowStopsList(true);
      }
    });

    // Verificar se há conteúdo pendente de compartilhamento (caso tenha feito login após)
    const checkPendingShare = () => {
      const sharedState = sharedLocationStore.getState();
      if (sharedState.isFromShare && sharedState.sharedContent && isLoggedIn && fullTruckData?.currentRoute) {
        console.log('📍 [MOBILE DRIVER] Conteúdo pendente encontrado, abrindo lista');
        setShowStopsList(true);
      }
    };

    if (isLoggedIn && fullTruckData?.currentRoute) {
      checkPendingShare();
    }

    return unsubscribe;
  }, [isLoggedIn, fullTruckData]);

  // Carregar estado persistido na inicialização
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

  // Persistir estado sempre que mudar
  const persistState = (state: any) => {
    try {
      localStorage.setItem('mobile-driver-state', JSON.stringify(state));
      console.log('💾 [MOBILE] Estado persistido com sucesso');
    } catch (error) {
      console.error('❌ [MOBILE] Erro ao persistir estado:', error);
    }
  };

  // Recarregar dados do caminhão preservando progresso
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
      
      // Persistir estado
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

      // Verificar se há conteúdo compartilhado pendente após login
      setTimeout(() => {
        const sharedState = sharedLocationStore.getState();
        if (sharedState.isFromShare && sharedState.sharedContent && data.currentRoute) {
          console.log('📍 [MOBILE] Abrindo parada extra após login bem-sucedido');
          setShowStopsList(true);
        }
      }, 500);
      
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
    
    // Limpar estado persistido
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

  // Atualizar progresso local quando ponto for marcado
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

  // Tela de Login
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
        {/* Safe area top */}
        <div className="safe-top" />
        
        {/* Conteúdo centralizado */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <Card className="w-full max-w-sm shadow-2xl border-0 overflow-hidden">
            {/* Header do card com gradiente */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Alchemy Rotas</h1>
              <p className="text-blue-100 text-sm mt-1">Sistema de Gerenciamento de Rotas</p>
            </div>

            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                Acesso do Motorista
              </h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  <strong className="font-semibold">Erro:</strong> {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Campo de Placa */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Placa do Veículo
                  </label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="ABC-1234"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={loading}
                      className="pl-10 h-14 text-lg font-semibold text-center tracking-wider uppercase border-2 focus:border-blue-500"
                      maxLength={8}
                    />
                  </div>
                </div>

                {/* Botão de Login */}
                <Button 
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                  onClick={handleLogin} 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-6">
                Insira a placa do seu veículo para acessar sua rota do dia
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Safe area bottom */}
        <div className="pb-safe" />
      </div>
    );
  }

  // Tela Principal (Logado)
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Área de conteúdo rolável */}
      <div className="flex-1 overflow-y-auto">
        <div className="safe-top" />
        
        <div className="w-full max-w-4xl mx-auto p-4 space-y-4 pb-32">
          {/* Header do motorista */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{truckData?.name}</h2>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      <span className="font-semibold">{truckData?.plate}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => checkForRouteUpdates()}
                    title="Atualizar"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon"
                    onClick={handleLogout}
                    title="Sair"
                  >
                    <LogOut className="h-4 w-4" />
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
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">Nenhuma rota ativa no momento</p>
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
      {fullTruckData?.currentRoute && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-50">
          <div className="p-4 max-w-4xl mx-auto">
            <Button 
              className="w-full h-14 text-lg font-bold shadow-md"
              onClick={() => setShowStopsList(true)}
            >
              <MapPin className="h-5 w-5 mr-2" />
              Ver Paradas ({fullTruckData.currentRoute.points?.length || 0})
            </Button>
          </div>
          <div className="pb-safe bg-white" />
        </div>
      )}
    </div>
  );
};

export default MobileDriver;
