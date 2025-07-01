
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useRoutes } from '@/hooks/useRoutes';
import { useRoutesCRUD } from '@/hooks/useRoutesCRUD';
import { RouteForm } from '@/components/RouteForm';
import { Route as RouteType } from '@/hooks/useRoutes';

const Routes = () => {
  const { toast } = useToast();
  const [editingRoute, setEditingRoute] = useState<RouteType | null>(null);
  const [showRouteForm, setShowRouteForm] = useState(false);

  const { routes, loading: routesLoading } = useRoutes();
  const { updateRoute, deleteRoute, isLoading: routeCrudLoading } = useRoutesCRUD();

  const handleUpdateRoute = async (data: Partial<RouteType>) => {
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

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary'
    } as const;
    const labels = {
      active: 'Ativa',
      inactive: 'Inativa'
    };
    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Rotas" 
        subtitle="Gerenciamento de rotas de entrega"
      >
        <Button onClick={() => setShowRouteForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Rota
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardContent className="p-6">
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
                      <TableCell>{getStatusBadge(route.status)}</TableCell>
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
      </div>

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

export default Routes;
