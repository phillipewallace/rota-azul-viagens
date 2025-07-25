import React, { useState } from 'react';
import { Plus, Edit, Trash2, MapPin, Truck as TruckIcon, Calendar, FileText, Settings, Wrench } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTrucks } from '@/hooks/useTrucks';
import { useTrucksCRUD } from '@/hooks/useTrucksCRUD';
import TruckForm from '@/components/TruckForm';
import LinkRouteModal from '@/components/LinkRouteModal';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';

const Trucks = () => {
  const { trucks, loading, error, refetch } = useTrucks();
  const { createTruck, updateTruck, deleteTruck } = useTrucksCRUD();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLinkRouteOpen, setIsLinkRouteOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);

  const handleCreateTruck = async (truckData) => {
    try {
      await createTruck(truckData);
      setIsModalOpen(false);
      toast.success('Caminhão criado com sucesso!');
      refetch();
    } catch (error) {
      toast.error('Erro ao criar caminhão: ' + error.message);
    }
  };

  const handleUpdateTruck = async (truckData) => {
    try {
      await updateTruck(editingTruck.id, truckData);
      setIsModalOpen(false);
      setEditingTruck(null);
      toast.success('Caminhão atualizado com sucesso!');
      refetch();
    } catch (error) {
      toast.error('Erro ao atualizar caminhão: ' + error.message);
    }
  };

  const handleDeleteTruck = async (id) => {
    try {
      await deleteTruck(id);
      toast.success('Caminhão excluído com sucesso!');
      refetch();
    } catch (error) {
      toast.error('Erro ao excluir caminhão: ' + error.message);
    }
  };

  const handleLinkRoute = (truck) => {
    setSelectedTruck(truck);
    setIsLinkRouteOpen(true);
  };

  const filteredTrucks = trucks.filter(truck => {
    const matchesSearch = truck.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         truck.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         truck.driver_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || truck.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'maintenance': return 'Manutenção';
      default: return 'Desconhecido';
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Carregando...</div>;
  if (error) return <div className="text-red-500 text-center">Erro: {error}</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="Gestão de Caminhões" 
        subtitle="Gerencie a frota de caminhões, motoristas e rotas"
      />

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <Input
            placeholder="Pesquisar por nome, placa ou motorista..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Novo Caminhão
        </Button>
      </div>

      {/* Trucks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTrucks.map((truck) => (
          <Card key={truck.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TruckIcon className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{truck.name}</CardTitle>
                </div>
                <Badge className={`${getStatusColor(truck.status)} border-0`}>
                  {getStatusText(truck.status)}
                </Badge>
              </div>
              <CardDescription className="text-sm text-gray-600">
                Placa: {truck.plate}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Motorista:</span>
                  <span>{truck.driver_name || 'Não atribuído'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Capacidade:</span>
                  <span>{truck.capacity || 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Rota atual:</span>
                  <span>{truck.current_route_name || 'Nenhuma'}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLinkRoute(truck)}
                  className="text-green-600 hover:text-green-700"
                >
                  <MapPin className="mr-1 h-3 w-3" />
                  Vincular Rota
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTruck(truck);
                    setIsModalOpen(true);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="mr-1 h-3 w-3" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o caminhão "{truck.name}"? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteTruck(truck.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTrucks.length === 0 && (
        <div className="text-center py-12">
          <TruckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Nenhum caminhão encontrado</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingTruck ? 'Editar Caminhão' : 'Criar Novo Caminhão'}
            </DialogTitle>
          </DialogHeader>
          <TruckForm
            truck={editingTruck}
            onSubmit={editingTruck ? handleUpdateTruck : handleCreateTruck}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingTruck(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Link Route Modal */}
      <LinkRouteModal
        isOpen={isLinkRouteOpen}
        onClose={() => {
          setIsLinkRouteOpen(false);
          setSelectedTruck(null);
        }}
        truck={selectedTruck}
        onSuccess={() => {
          refetch();
          setIsLinkRouteOpen(false);
          setSelectedTruck(null);
        }}
      />
    </div>
  );
};

export default Trucks;
