
import React, { useState } from 'react';
import { Plus, Edit, Trash2, MapPin, Navigation, Eye, ArrowLeft, RefreshCw } from 'lucide-react';
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

  const { routes, loading, loadRoutes } = useRoutes();
  const { deleteRoute, updateRoute, isLoading } = useRoutesCRUD();

  const handleEdit = (route: any) => {
    if (route.status === 'completed') {
      toast.error('Não é possível editar uma rota concluída');
      return;
    }
    setEditingRoute(route);
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta rota?')) {
      try {
        await deleteRoute(id);
        toast.success('Rota excluída com sucesso!');
        loadRoutes();
      } catch (error) {
        console.error('Error deleting route:', error);
        toast.error('Erro ao excluir rota');
      }
    }
  };

  const handleReactivate = async (route: any) => {
    try {
      await updateRoute({ id: route.id, route: { status: 'active' } });
      toast.success('Rota reativada com sucesso!');
      loadRoutes();
    } catch (error) {
      console.error('Error reactivating route:', error);
      toast.error('Erro ao reativar rota');
    }
  };

  const handleView = (route: any) => {
    setViewingRoute(route);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingRoute(null);
    setViewingRoute(null);
    loadRoutes();
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
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Rota
            </Button>
          </div>
        </div>

        {/* Lista de Rotas */}
        {routes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Navigation className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma rota encontrada</h3>
              <p className="text-gray-600 mb-6">Comece criando sua primeira rota</p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Rota
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => (
              <Card key={route.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-blue-600" />
                      {route.name}
                    </CardTitle>
                    {getStatusBadge(route.status)}
                  </div>
                  {route.description && (
                    <p className="text-sm text-gray-600">{route.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Pontos:</span>
                      <span className="text-sm">{route.points?.length || 0} locais</span>
                    </div>
                    
                    {route.totalDistance && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Distância:</span>
                        <span className="text-sm">{route.totalDistance.toFixed(2)} km</span>
                      </div>
                    )}
                    
                    {route.estimatedTime && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Tempo est.:</span>
                        <span className="text-sm">{route.estimatedTime}</span>
                      </div>
                    )}

                    {route.points && route.points.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Pontos principais:</p>
                        <div className="space-y-1">
                          {route.points.slice(0, 2).map((point, index) => (
                            <div key={point.id} className="flex items-center gap-2 text-xs text-gray-600">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{point.address}</span>
                            </div>
                          ))}
                          {route.points.length > 2 && (
                            <p className="text-xs text-gray-500">
                              +{route.points.length - 2} pontos adicionais
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
                      onClick={() => handleDelete(route.id)}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modais */}
        <CreateRouteModal 
          open={isCreateModalOpen} 
          onOpenChange={setIsCreateModalOpen}
          editingRoute={editingRoute}
          onSuccess={handleCloseModal}
        />

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
                    <h3 className="font-semibold text-lg">{viewingRoute.name}</h3>
                    {viewingRoute.description && (
                      <p className="text-gray-600">{viewingRoute.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">Status:</p>
                      {getStatusBadge(viewingRoute.status)}
                    </div>
                    <div>
                      <p className="font-medium">Total de Pontos:</p>
                      <p>{viewingRoute.points?.length || 0}</p>
                    </div>
                    {viewingRoute.totalDistance && (
                      <div>
                        <p className="font-medium">Distância Total:</p>
                        <p>{viewingRoute.totalDistance.toFixed(2)} km</p>
                      </div>
                    )}
                    {viewingRoute.estimatedTime && (
                      <div>
                        <p className="font-medium">Tempo Estimado:</p>
                        <p>{viewingRoute.estimatedTime}</p>
                      </div>
                    )}
                  </div>

                  {viewingRoute.points && viewingRoute.points.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Pontos da Rota:</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {viewingRoute.points
                          .sort((a: any, b: any) => a.order - b.order)
                          .map((point: any, index: number) => (
                          <div key={point.id} className="flex items-center gap-3 p-3 border rounded-lg">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                              point.type === 'origin' ? 'bg-green-500' :
                              point.type === 'destination' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{point.address}</p>
                              <p className="text-sm text-gray-600 capitalize">{point.type}</p>
                              {point.cep && <p className="text-sm text-gray-500">CEP: {point.cep}</p>}
                            </div>
                          </div>
                        ))}
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
      
      <div className="h-20 md:hidden" />
    </div>
  );
};

export default Routes;
