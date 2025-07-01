
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Truck as TruckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useTrucks } from '@/hooks/useTrucks';
import { useTrucksCRUD } from '@/hooks/useTrucksCRUD';
import { TruckForm } from '@/components/TruckForm';
import { Truck as TruckType } from '@/hooks/useTrucks';

const Trucks = () => {
  const { toast } = useToast();
  const [editingTruck, setEditingTruck] = useState<TruckType | null>(null);
  const [showTruckForm, setShowTruckForm] = useState(false);

  const { trucks, loading: trucksLoading } = useTrucks();
  const { createTruck, updateTruck, deleteTruck, isLoading: truckCrudLoading } = useTrucksCRUD();

  const handleCreateTruck = async (data: Omit<TruckType, 'id'>) => {
    try {
      await createTruck(data);
      setShowTruckForm(false);
      toast({ title: 'Caminhão criado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao criar caminhão', variant: 'destructive' });
    }
  };

  const handleUpdateTruck = async (data: Omit<TruckType, 'id'>) => {
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

  const getStatusBadge = (status: string) => {
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
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Caminhões" 
        subtitle="Gerenciamento da frota de caminhões"
      >
        <Button onClick={() => setShowTruckForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Caminhão
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardContent className="p-6">
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
                      <TableCell>{getStatusBadge(truck.status)}</TableCell>
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
    </div>
  );
};

export default Trucks;
