
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useTrucks } from '@/hooks/useTrucks';
import { useTrucksCRUD } from '@/hooks/useTrucksCRUD';
import { TruckModal } from '@/components/TruckModal';
import LinkRouteModal from '@/components/LinkRouteModal';

const Trucks = () => {
  const { trucks, loading } = useTrucks();
  const { createTruck, updateTruck, deleteTruck } = useTrucksCRUD();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<any>(null);
  const [selectedTruck, setSelectedTruck] = useState<any>(null);

  const filteredTrucks = trucks.filter(truck =>
    truck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    truck.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTruck = async (truckData: any) => {
    try {
      await createTruck(truckData);
      setIsModalOpen(false);
      toast.success('Caminhão criado com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar caminhão');
    }
  };

  const handleUpdateTruck = async (truckData: any) => {
    try {
      await updateTruck(editingTruck.id, truckData);
      setIsModalOpen(false);
      setEditingTruck(null);
      toast.success('Caminhão atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar caminhão');
    }
  };

  const handleDeleteTruck = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este caminhão?')) {
      try {
        await deleteTruck(id);
        toast.success('Caminhão excluído com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir caminhão');
      }
    }
  };

  const handleEditTruck = (truck: any) => {
    setEditingTruck(truck);
    setIsModalOpen(true);
  };

  const handleLinkRoute = (truck: any) => {
    setSelectedTruck(truck);
    setIsLinkModalOpen(true);
  };

  const handleLinkSuccess = () => {
    // Refresh trucks data after successful link
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Caminhões</h1>
          <p className="text-gray-600">Gerencie a frota de caminhões</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo Caminhão
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Caminhões</CardTitle>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar caminhões..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTrucks.map((truck) => (
              <div key={truck.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="font-semibold">{truck.name}</h3>
                    <p className="text-sm text-gray-600">{truck.plate}</p>
                    <p className="text-xs text-gray-500">{truck.model} - {truck.year}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={truck.status === 'available' ? 'default' : 'secondary'}>
                    {truck.status === 'available' ? 'Disponível' : truck.status === 'in-route' ? 'Em Rota' : 'Manutenção'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLinkRoute(truck)}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Vincular Rota
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditTruck(truck)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTruck(truck.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TruckModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingTruck(null);
        }}
        truck={editingTruck}
        onSubmit={editingTruck ? handleUpdateTruck : handleCreateTruck}
      />

      <LinkRouteModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        truck={selectedTruck}
        onSuccess={handleLinkSuccess}
      />
    </div>
  );
};

export default Trucks;
