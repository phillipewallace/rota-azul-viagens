
import React, { useState } from 'react';
import { Plus, Edit, Trash2, ArrowLeft, User, Phone, Mail, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from 'react-router-dom';
import { useDrivers } from '@/hooks/useDrivers';
import { useDriversCRUD } from '@/hooks/useDriversCRUD';
import { DriverForm } from '@/components/DriverForm';
import { toast } from 'sonner';

const Drivers = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);

  const { drivers, loading, loadDrivers } = useDrivers();
  const { createDriver, updateDriver, deleteDriver, isLoading } = useDriversCRUD();

  const handleEdit = (driver: any) => {
    setEditingDriver(driver);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este motorista?')) {
      try {
        await deleteDriver(id);
        toast.success('Motorista excluído com sucesso!');
        loadDrivers();
      } catch (error) {
        console.error('Error deleting driver:', error);
        toast.error('Erro ao excluir motorista');
      }
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingDriver) {
        await updateDriver({ id: editingDriver.id, driver: data });
        toast.success('Motorista atualizado com sucesso!');
      } else {
        await createDriver(data);
        toast.success('Motorista criado com sucesso!');
      }
      setIsModalOpen(false);
      setEditingDriver(null);
      loadDrivers();
    } catch (error) {
      console.error('Error saving driver:', error);
      toast.error('Erro ao salvar motorista');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === 'active' ? 'default' : 'secondary'}>
        {status === 'active' ? 'Ativo' : 'Inativo'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando motoristas...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Motoristas</h1>
              <p className="text-gray-600 mt-2">Gerencie os motoristas do sistema</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Motorista
            </Button>
          </div>
        </div>

        {/* Lista de Motoristas */}
        {drivers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum motorista encontrado</h3>
              <p className="text-gray-600 mb-6">Comece adicionando seu primeiro motorista</p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Motorista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {drivers.map((driver) => (
              <Card key={driver.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      {driver.name}
                    </CardTitle>
                    {getStatusBadge(driver.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{driver.phone}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{driver.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">CNH: {driver.license}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(driver)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(driver.id)}
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

        {/* Modal para criar/editar motorista */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
              </DialogTitle>
            </DialogHeader>
            <DriverForm
              driver={editingDriver}
              onSubmit={handleSubmit}
              onCancel={handleCloseModal}
              isLoading={isLoading}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="h-20 md:hidden" />
    </div>
  );
};

export default Drivers;
