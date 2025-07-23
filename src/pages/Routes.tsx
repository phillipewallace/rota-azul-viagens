
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Navigation, Eye, ArrowLeft, RefreshCw, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { useRoutes } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import CreateRouteModal from '@/components/CreateRouteModal';
import RouteMapPreview from '@/components/RouteMapPreview';
import { toast } from 'sonner';

const Routes = () => {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [viewingRoute, setViewingRoute] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { routes, loading, loadRoutes } = useRoutes();
  const { deleteRoute, updateRoute, resetRoute, isLoading } = useRoutesCRUD();

  // Garantir que routes sempre seja um array
  const safeRoutes = Array.isArray(routes) ? routes : [];

  // Função para forçar refresh
  const forceRefresh = async () => {
    console.log('🔄 [ROUTES PAGE] Iniciando refresh forçado');
    setRefreshKey(prev => prev + 1);
    
    try {
      await loadRoutes();
      console.log('✅ [ROUTES PAGE] Refresh concluído com sucesso');
    } catch (error) {
      console.error('❌ [ROUTES PAGE] Erro durante refresh:', error);
    }
  };

  // Refresh quando a página for focada
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 [ROUTES PAGE] Página focada - atualizando dados');
      forceRefresh();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleEdit = (route: any) => {
    if (!route?.id) {
      toast.error('Erro: dados da rota inválidos');
      return;
    }

    if (route.status === 'completed') {
      toast.error('Não é possível editar uma rota concluída');
      return;
    }
    
    console.log('🔧 [ROUTES PAGE] Preparando edição da rota:', route.name);
    
    // Validar e preparar dados da rota
    const safeRoute = {
      ...route,
      points: Array.isArray(route.points) ? route.points : [],
      totalDistance: route.totalDistance || 0,
      estimatedTime: route.estimatedTime || '0min',
      optimizedOrder: Array.isArray(route.optimizedOrder) ? route.optimizedOrder : []
    };
    
    console.log('🔧 [ROUTES PAGE] Dados da rota para edição:', {
      id: safeRoute.id.substring(0, 8) + '...',
      name: safeRoute.name,
      pointsCount: safeRoute.points.length,
      totalDistance: safeRoute.totalDistance
    });
    
    setViewingRoute(null);
    setEditingRoute(safeRoute);
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!id) {
      toast.error('Erro: ID da rota inválido');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta rota?')) {
      try {
        await deleteRoute(id);
        toast.success('Rota excluída com sucesso!');
        await forceRefresh();
      } catch (error: any) {
        console.error('Error deleting route:', error);
        toast.error('Erro ao excluir rota');
      }
    }
  };

  const handleReactivate = async (route: any) => {
    if (!route?.id) {
      toast.error('Erro: dados da rota inválidos');
      return;
    }

    try {
      await updateRoute({ id: route.id, route: { status: 'active' } });
      toast.success('Rota reativada com sucesso!');
      await forceRefresh();
    } catch (error) {
      console.error('Error reactivating route:', error);
      toast.error('Erro ao reativar rota');
    }
  };

  const handleReset = async (route: any) => {
    if (!route?.id) {
      toast.error('Erro: dados da rota inválidos');
      return;
    }

    if (window.confirm(`Tem certeza que deseja resetar a rota "${route.name}"?`)) {
      try {
        await resetRoute(route.id);
        toast.success('Rota resetada com sucesso!');
        await forceRefresh();
      } catch (error: any) {
        console.error('Error resetting route:', error);
        toast.error('Erro ao resetar rota');
      }
    }
  };

  const handleView = (route: any) => {
    if (!route?.id) {
      toast.error('Erro: dados da rota inválidos');
      return;
    }

    console.log('👁️ [ROUTES PAGE] Visualizando rota:', route.name);
    console.log('👁️ [ROUTES PAGE] Dados da rota:', {
      id: route.id.substring(0, 8) + '...',
      name: route.name,
      pointsCount: Array.isArray(route.points) ? route.points.length : 0,
      totalDistance: route.totalDistance
    });
    
    // Validar e preparar dados da rota
    const safeRoute = {
      ...route,
      points: Array.isArray(route.points) ? route.points : [],
      totalDistance: route.totalDistance || 0,
      estimatedTime: route.estimatedTime || '0min'
    };
    
    setIsCreateModalOpen(false);
    setEditingRoute(null);
    setViewingRoute(safeRoute);
  };

  const handleCloseModal = async () => {
    console.log('❌ [ROUTES PAGE] Fechando modal e forçando refresh');
    setIsCreateModalOpen(false);
    setEditingRoute(null);
    
    // Forçar refresh após fechar modal
    await forceRefresh();
  };

  const handleNewRoute = () => {
    console.log('➕ [ROUTES PAGE] Criando nova rota');
    setViewingRoute(null);
    setEditingRoute(null);
    setIsCreateModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      completed: 'outline'
    } as const;
    const labels = {
      active: 'Ativa',
      inactive: 'Inativa',
      completed: 'Concluída'
    };
    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando rotas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rotas</h1>
              <p className="text-gray-600 mt-2">Gerencie as rotas do sistema</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={forceRefresh}
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              onClick={handleNewRoute}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Rota
            </Button>
          </div>
        </div>

        {/* Lista de Rotas */}
        {safeRoutes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Navigation className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma rota encontrada</h3>
              <p className="text-gray-600 mb-6">Comece criando sua primeira rota</p>
              <Button onClick={handleNewRoute}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Rota
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {safeRoutes.map((route) => {
              if (!route?.id) return null;

              const safePoints = Array.isArray(route.points) ? route.points : [];
              const completedPoints = safePoints.filter(p => p?.completed) || [];

              return (
                <Card key={route.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="flex items-center gap-2">
                        <Navigation className="h-5 w-5 text-blue-600" />
                        {route.name || 'Rota sem nome'}
                      </CardTitle>
                      {getStatusBadge(route.status || 'active')}
                    </div>
                    {route.description && (
                      <p className="text-sm text-gray-600">{route.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Pontos:</span>
                        <span className="text-sm">
                          {safePoints.length} locais
                          {safePoints.length > 0 && (
                            <span className="text-green-600 ml-1">
                              ({completedPoints.length} ✅)
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {route.totalDistance && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Distância:</span>
                          <span className="text-sm">{Number(route.totalDistance).toFixed(2)} km</span>
                        </div>
                      )}
                      
                      {route.estimatedTime && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Tempo est.:</span>
                          <span className="text-sm">{route.estimatedTime}</span>
                        </div>
                      )}

                      {safePoints.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Pontos principais:</p>
                          <div className="space-y-1">
                            {safePoints.slice(0, 2).map((point, index) => {
                              if (!point) return null;
                              return (
                                <div key={`${route.id}-point-${index}`} className="flex items-center gap-2 text-xs text-gray-600">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{point.address || 'Endereço não definido'}</span>
                                  {point.completed && <span className="text-green-600">✅</span>}
                                </div>
                              );
                            })}
                            {safePoints.length > 2 && (
                              <p className="text-xs text-gray-500">
                                +{safePoints.length - 2} pontos adicionais
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(route)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      {route.status === 'completed' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivate(route)}
                          className="flex-1 text-green-600 hover:text-green-700"
                          disabled={isLoading}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reativar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(route)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReset(route)}
                        className="text-orange-600 hover:text-orange-700 hover:border-orange-300"
                        disabled={isLoading}
                        title="Resetar rota"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(route.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal de Criação/Edição */}
        <CreateRouteModal 
          open={isCreateModalOpen} 
          onOpenChange={setIsCreateModalOpen}
          editingRoute={editingRoute}
          onSuccess={handleCloseModal}
        />

        {/* Modal de Visualização */}
        {viewingRoute && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Detalhes da Rota</h2>
                <Button variant="outline" onClick={() => setViewingRoute(null)}>
                  Fechar
                </Button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{viewingRoute.name || 'Rota sem nome'}</h3>
                    {viewingRoute.description && (
                      <p className="text-gray-600">{viewingRoute.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">Status:</p>
                      {getStatusBadge(viewingRoute.status || 'active')}
                    </div>
                    <div>
                      <p className="font-medium">Total de Pontos:</p>
                      <p>{(viewingRoute.points || []).length}</p>
                    </div>
                    {viewingRoute.totalDistance && (
                      <div>
                        <p className="font-medium">Distância Total:</p>
                        <p>{Number(viewingRoute.totalDistance).toFixed(2)} km</p>
                      </div>
                    )}
                    {viewingRoute.estimatedTime && (
                      <div>
                        <p className="font-medium">Tempo Estimado:</p>
                        <p>{viewingRoute.estimatedTime}</p>
                      </div>
                    )}
                  </div>

                  {Array.isArray(viewingRoute.points) && viewingRoute.points.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Pontos da Rota:</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {viewingRoute.points.map((point: any, index: number) => {
                          if (!point) return null;
                          return (
                            <div key={`${viewingRoute.id}-detail-point-${point.id || index}`} className="flex items-center gap-3 p-3 border rounded-lg">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                                point.type === 'origin' ? 'bg-green-500' :
                                point.type === 'destination' ? 'bg-red-500' : 'bg-yellow-500'
                              }`}>
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{point.address || 'Endereço não definido'}</p>
                                <p className="text-sm text-gray-600 capitalize">{point.type || 'waypoint'}</p>
                                {point.cep && <p className="text-sm text-gray-500">CEP: {point.cep}</p>}
                                {point.completed && (
                                  <p className="text-xs text-green-600 font-medium">✅ Concluído</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-3">Preview da Rota:</h4>
                  <RouteMapPreview route={viewingRoute} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Routes;
