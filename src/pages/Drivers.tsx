
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Search, Phone, Mail, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useDrivers } from '@/hooks/useDrivers';
import { useDriversCRUD } from '@/hooks/useDriversCRUD';
import { DriverForm } from '@/components/DriverForm';
import { DriverDeleteDialog } from '@/components/DriverDeleteDialog';
import { Driver } from '@/hooks/useDrivers';
import { DriverDependencies } from '@/hooks/useDriversCRUD';

const Drivers = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dependencies, setDependencies] = useState<DriverDependencies | null>(null);

  const { drivers, loading } = useDrivers();
  const { createDriver, updateDriver, deleteDriver, checkDependencies, isLoading: driverCrudLoading } = useDriversCRUD();

  const handleCreateDriver = async (data: Omit<Driver, 'id'>) => {
    try {
      await createDriver(data);
      setShowDriverForm(false);
      toast({ title: 'Motorista criado com sucesso!' });
    } catch (error) {
      console.error('Error creating driver:', error);
      toast({ title: 'Erro ao criar motorista', variant: 'destructive' });
    }
  };

  const handleUpdateDriver = async (data: Omit<Driver, 'id'>) => {
    if (!editingDriver) return;
    try {
      await updateDriver({ id: editingDriver.id, driver: data });
      setEditingDriver(null);
      toast({ title: 'Motorista atualizado com sucesso!' });
    } catch (error) {
      console.error('Error updating driver:', error);
      toast({ title: 'Erro ao atualizar motorista', variant: 'destructive' });
    }
  };

  const handleDeleteDriverClick = async (driver: Driver) => {
    try {
      setDeletingDriver(driver);
      setShowDeleteDialog(true);
      setDependencies(null);
      
      // Check dependencies
      const deps = await checkDependencies(driver.id);
      setDependencies(deps);
    } catch (error) {
      console.error('Error checking dependencies:', error);
      toast({ title: 'Erro ao verificar dependências', variant: 'destructive' });
      setShowDeleteDialog(false);
    }
  };

  const handleConfirmDelete = async (force: boolean) => {
    if (!deletingDriver) return;
    
    try {
      await deleteDriver({ id: deletingDriver.id, force });
      setShowDeleteDialog(false);
      setDeletingDriver(null);
      setDependencies(null);
      
      if (force && dependencies?.trucks.length) {
        toast({ 
          title: 'Motorista excluído com sucesso!', 
          description: `Desvinculado de ${dependencies.trucks.length} caminhão(ões)` 
        });
      } else {
        toast({ title: 'Motorista excluído com sucesso!' });
      }
    } catch (error) {
      console.error('Error deleting driver:', error);
      toast({ title: 'Erro ao excluir motorista', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'on-route': return 'bg-blue-500';
      case 'off-duty': return 'bg-gray-500';
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'on-route': return 'Em Rota';
      case 'off-duty': return 'Folga';
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      default: return 'Indefinido';
    }
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Motoristas" 
        subtitle="Gerenciamento da equipe de motoristas"
      >
        <Button onClick={() => setShowDriverForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar Motorista
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar motoristas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando motoristas...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrivers.map((driver) => {
              const isFunc = driver.source === 'funcionario';
              return (
              <Card key={driver.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {driver.name}
                      {isFunc && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                          Funcionário
                        </Badge>
                      )}
                    </CardTitle>
                    <Badge className={getStatusColor(driver.status)}>
                      {getStatusText(driver.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{driver.phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{driver.email || '—'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{isFunc ? 'CPF' : 'CNH'}:</span> {driver.license || '—'}
                    </div>
                    {driver.truckCount !== undefined && driver.truckCount > 0 && (
                      <div className="text-sm text-blue-600">
                        <span className="font-medium">Caminhões:</span> {driver.truckCount}
                      </div>
                    )}
                    {isFunc ? (
                      <p className="text-xs text-muted-foreground mt-4">
                        Cadastro gerenciado em <a href="/funcionarios" className="text-primary hover:underline">Funcionários</a>.
                      </p>
                    ) : (
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setEditingDriver(driver)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteDriverClick(driver)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );})}

          </div>
        )}
      </div>

      {/* Driver Form Dialog */}
      <Dialog open={showDriverForm || !!editingDriver} onOpenChange={(open) => {
        if (!open) {
          setShowDriverForm(false);
          setEditingDriver(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
            </DialogTitle>
          </DialogHeader>
          <DriverForm
            driver={editingDriver || undefined}
            onSubmit={editingDriver ? handleUpdateDriver : handleCreateDriver}
            onCancel={() => {
              setShowDriverForm(false);
              setEditingDriver(null);
            }}
            isLoading={driverCrudLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DriverDeleteDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteDialog(false);
            setDeletingDriver(null);
            setDependencies(null);
          }
        }}
        driverName={deletingDriver?.name || ''}
        dependencies={dependencies}
        onConfirm={handleConfirmDelete}
        isLoading={driverCrudLoading}
      />
    </div>
  );
};

export default Drivers;
