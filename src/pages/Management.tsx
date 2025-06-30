
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Truck, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { useTrucksCRUD } from '@/hooks/useTrucksCRUD';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import { TruckForm } from '@/components/TruckForm';
import { RouteForm } from '@/components/RouteForm';
import { Truck } from '@/hooks/useTrucks';
import { Route } from '@/hooks/useRoutes';

const Management = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'trucks' | 'routes'>('trucks');
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [showTruckForm, setShowTruckForm] = useState(false);
  const [showRouteForm, setShowRouteForm] = useState(false);

  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();
  const { createTruck, updateTruck, deleteTruck, isLoading: truckCrudLoading } = useTrucksCRUD();
  const { updateRoute, deleteRoute, isLoading: routeCrudLoading } = useRoutesCRUD();

  const handleCreateTruck = async (data: Omit<Truck, 'id'>) => {
    try {
      await createTruck(data);
      setShowTruckForm(false);
      toast({ title: 'Caminhão criado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao criar caminhão', variant: 'destructive' });
    }
  };

  const handleUpdateTruck = async (data: Omit<Truck, 'id'>) => {
    if (!editingTruck) return;
    try {
      await updateTruck({ id: editingTruck.id, truck: data });
      setEditingTruck(null);
      toast({ title: 'Caminhão atualizado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar caminhão', variant: 'destructive' });
    }
  };

  const handleDeleteTruck = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este caminhão?')) {
      try {
        await deleteTruck(id);
        toast({ title: 'Caminhão excluído com sucesso!' });
      } catch (error) {
        toast({ title: 'Erro ao excluir caminhão', variant: 'destructive' });
      }
    }
  };

  const handleUpdateRoute = async (data: Partial<Route>) => {
    if (!editingRoute) return;
    try {
      await updateRoute({ id: editingRoute.id, route: data });
      setEditingRoute(null);
      toast({ title: 'Rota atualizada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar rota', variant: 'destructive' });
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta rota?')) {
      try {
        await deleteRoute(id);
        toast({ title: 'Rota excluída com sucesso!' });
      } catch (error) {
        toast({ title: 'Erro ao excluir rota', variant: 'destructive' });
      }
    }
  };

  const getStatusBadge = (status: string, type: 'truck' | 'route') => {
    if (type === 'truck') {
      const variants = {
        available: 'default',
        'in-route': 'secondary',
        maintenance: 'destructive'
      } as const;
      const labels = {
        available: 'Disponível',
        'in-route': 'Em Rota',
        maintenance: 'Manutenção'
      };
      return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
    } else {
      const variants = {
        active: 'default',
        inactive: 'secondary'
      } as const;
      const labels = {
        active: 'Ativa',
        inactive: 'Inativa'
      };
      return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Gerenciamento" 
        subtitle="Gerencie caminhões e rotas do sistema"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'trucks' ? 'default' : 'outline'}
            onClick={() => setActiveTab('trucks')}
          >
            <Truck className="w-4 h-4 mr-2" />
            Caminhões
          </Button>
          <Button
            variant={activeTab === 'routes' ? 'default' : 'outline'}
            onClick={() => setActiveTab('routes')}
          >
            <RouteIcon className="w-4 h-4 mr-2" />
            Rotas
          </Button>
        </div>

        {activeTab === 'trucks' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Caminhões</CardTitle>
              <Button onClick={() => setShowTruckForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Caminhão
              </Button>
            </CardHeader>
            <CardContent>
              {trucksLoading ? (
                <div className="text-center py-8">Carregando caminhões...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Km</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trucks.map((truck) => (
                      <TableRow key={truck.id}>
                        <TableCell className="font-medium">{truck.name}</TableCell>
                        <TableCell>{truck.plate}</TableCell>
                        <TableCell>{truck.model}</TableCell>
                        <TableCell>{truck.year}</TableCell>
                        <TableCell>{getStatusBadge(truck.status, 'truck')}</TableCell>
                        <TableCell>{truck.driver || '-'}</TableCell>
                        <TableCell>{truck.mileage.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTruck(truck)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteTruck(truck.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'routes' && (
          <Card>
            <CardHeader>
              <CardTitle>Rotas</CardTitle>
            </CardHeader>
            <CardContent>
              {routesLoading ? (
                <div className="text-center py-8">Carregando rotas...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Distância</TableHead>
                      <TableHead>Tempo Estimado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map((route) => (
                      <TableRow key={route.id}>
                        <TableCell className="font-medium">{route.name}</TableCell>
                        <TableCell>{route.description || '-'}</TableCell>
                        <TableCell>{route.points.length} pontos</TableCell>
                        <TableCell>{route.totalDistance.toFixed(1)} km</TableCell>
                        <TableCell>{route.estimatedTime || '-'}</TableCell>
                        <TableCell>{getStatusBadge(route.status, 'route')}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingRoute(route)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRoute(route.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Truck Form Dialog */}
      <Dialog open={showTruckForm || !!editingTruck} onOpenChange={(open) => {
        if (!open) {
          setShowTruckForm(false);
          setEditingTruck(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTruck ? 'Editar Caminhão' : 'Novo Caminhão'}
            </DialogTitle>
          </DialogHeader>
          <TruckForm
            truck={editingTruck || undefined}
            onSubmit={editingTruck ? handleUpdateTruck : handleCreateTruck}
            onCancel={() => {
              setShowTruckForm(false);
              setEditingTruck(null);
            }}
            isLoading={truckCrudLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Route Form Dialog */}
      <Dialog open={showRouteForm || !!editingRoute} onOpenChange={(open) => {
        if (!open) {
          setShowRouteForm(false);
          setEditingRoute(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? 'Editar Rota' : 'Nova Rota'}
            </DialogTitle>
          </DialogHeader>
          <RouteForm
            route={editingRoute || undefined}
            onSubmit={handleUpdateRoute}
            onCancel={() => {
              setShowRouteForm(false);
              setEditingRoute(null);
            }}
            isLoading={routeCrudLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Management;
