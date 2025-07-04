
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Wrench, Calendar, DollarSign, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useTrucks } from '@/hooks/useTrucks';
import { useForm } from 'react-hook-form';

interface MaintenanceRecord {
  id: string;
  truckId: string;
  truckName: string;
  maintenanceType: string;
  description: string;
  scheduledDate: string;
  completedDate?: string;
  cost?: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
}

interface MaintenanceFormData {
  truckId: string;
  maintenanceType: string;
  description: string;
  scheduledDate: string;
  cost?: number;
  notes?: string;
}

const Management = () => {
  const { toast } = useToast();
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceRecord | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { trucks } = useTrucks();
  const { register, handleSubmit, setValue, watch, reset } = useForm<MaintenanceFormData>();

  const truckId = watch('truckId');

  const handleCreateMaintenance = async (data: MaintenanceFormData) => {
    setLoading(true);
    try {
      const truck = trucks.find(t => t.id === data.truckId);
      const newMaintenance: MaintenanceRecord = {
        id: Date.now().toString(),
        truckId: data.truckId,
        truckName: truck?.name || 'Desconhecido',
        maintenanceType: data.maintenanceType,
        description: data.description,
        scheduledDate: data.scheduledDate,
        cost: data.cost,
        status: 'scheduled',
        notes: data.notes
      };
      
      setMaintenanceRecords(prev => [...prev, newMaintenance]);
      setShowMaintenanceForm(false);
      reset();
      toast({ title: 'Manutenção agendada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao agendar manutenção', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMaintenance = async (data: MaintenanceFormData) => {
    if (!editingMaintenance) return;
    
    setLoading(true);
    try {
      const truck = trucks.find(t => t.id === data.truckId);
      const updatedMaintenance: MaintenanceRecord = {
        ...editingMaintenance,
        truckId: data.truckId,
        truckName: truck?.name || 'Desconhecido',
        maintenanceType: data.maintenanceType,
        description: data.description,
        scheduledDate: data.scheduledDate,
        cost: data.cost,
        notes: data.notes
      };
      
      setMaintenanceRecords(prev => 
        prev.map(m => m.id === editingMaintenance.id ? updatedMaintenance : m)
      );
      setEditingMaintenance(null);
      reset();
      toast({ title: 'Manutenção atualizada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar manutenção', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaintenance = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta manutenção?')) {
      setMaintenanceRecords(prev => prev.filter(m => m.id !== id));
      toast({ title: 'Manutenção excluída com sucesso!' });
    }
  };

  const handleStatusChange = (id: string, status: MaintenanceRecord['status']) => {
    setMaintenanceRecords(prev => 
      prev.map(m => m.id === id ? { 
        ...m, 
        status,
        completedDate: status === 'completed' ? new Date().toISOString().split('T')[0] : undefined
      } : m)
    );
    toast({ title: 'Status atualizado com sucesso!' });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'scheduled': 'default',
      'in-progress': 'secondary',
      'completed': 'default',
      'cancelled': 'destructive'
    } as const;
    
    const labels = {
      'scheduled': 'Agendada',
      'in-progress': 'Em Andamento',
      'completed': 'Concluída',
      'cancelled': 'Cancelada'
    };
    
    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>;
  };

  const openForm = (maintenance?: MaintenanceRecord) => {
    if (maintenance) {
      setEditingMaintenance(maintenance);
      setValue('truckId', maintenance.truckId);
      setValue('maintenanceType', maintenance.maintenanceType);
      setValue('description', maintenance.description);
      setValue('scheduledDate', maintenance.scheduledDate);
      setValue('cost', maintenance.cost);
      setValue('notes', maintenance.notes);
    } else {
      setShowMaintenanceForm(true);
      reset();
    }
  };

  const closeForm = () => {
    setShowMaintenanceForm(false);
    setEditingMaintenance(null);
    reset();
  };

  const stats = {
    total: maintenanceRecords.length,
    scheduled: maintenanceRecords.filter(m => m.status === 'scheduled').length,
    inProgress: maintenanceRecords.filter(m => m.status === 'in-progress').length,
    completed: maintenanceRecords.filter(m => m.status === 'completed').length,
    totalCost: maintenanceRecords.reduce((sum, m) => sum + (m.cost || 0), 0)
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Gerenciamento de Manutenções" 
        subtitle="Agende e gerencie todas as manutenções da frota"
      >
        <Button onClick={() => openForm()}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Manutenção
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Agendadas</p>
                  <p className="text-2xl font-bold">{stats.scheduled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Em Andamento</p>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-green-500 rounded-full" />
                <div>
                  <p className="text-sm text-muted-foreground">Concluídas</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Custo Total</p>
                  <p className="text-2xl font-bold">R$ {stats.totalCost.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Manutenções */}
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caminhão</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data Agendada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceRecords.map((maintenance) => (
                  <TableRow key={maintenance.id}>
                    <TableCell className="font-medium">{maintenance.truckName}</TableCell>
                    <TableCell>{maintenance.maintenanceType}</TableCell>
                    <TableCell>{new Date(maintenance.scheduledDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Select 
                        value={maintenance.status} 
                        onValueChange={(value) => handleStatusChange(maintenance.id, value as MaintenanceRecord['status'])}
                      >
                        <SelectTrigger className="w-32">
                          {getStatusBadge(maintenance.status)}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Agendada</SelectItem>
                          <SelectItem value="in-progress">Em Andamento</SelectItem>
                          <SelectItem value="completed">Concluída</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>R$ {(maintenance.cost || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openForm(maintenance)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteMaintenance(maintenance.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Formulário */}
      <Dialog open={showMaintenanceForm || !!editingMaintenance} onOpenChange={closeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMaintenance ? 'Editar Manutenção' : 'Nova Manutenção'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(editingMaintenance ? handleUpdateMaintenance : handleCreateMaintenance)} className="space-y-4">
            <div>
              <Label htmlFor="truckId">Caminhão</Label>
              <Select value={truckId} onValueChange={(value) => setValue('truckId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um caminhão" />
                </SelectTrigger>
                <SelectContent>
                  {trucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.name} - {truck.plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maintenanceType">Tipo de Manutenção</Label>
              <Select onValueChange={(value) => setValue('maintenanceType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preventiva">Preventiva</SelectItem>
                  <SelectItem value="Corretiva">Corretiva</SelectItem>
                  <SelectItem value="Revisão">Revisão</SelectItem>
                  <SelectItem value="Troca de Óleo">Troca de Óleo</SelectItem>
                  <SelectItem value="Pneus">Pneus</SelectItem>
                  <SelectItem value="Freios">Freios</SelectItem>
                  <SelectItem value="Motor">Motor</SelectItem>
                  <SelectItem value="Elétrica">Elétrica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea {...register('description', { required: true })} placeholder="Descreva a manutenção..." />
            </div>

            <div>
              <Label htmlFor="scheduledDate">Data Agendada</Label>
              <Input type="date" {...register('scheduledDate', { required: true })} />
            </div>

            <div>
              <Label htmlFor="cost">Custo Estimado (R$)</Label>
              <Input type="number" step="0.01" {...register('cost', { valueAsNumber: true })} placeholder="0,00" />
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea {...register('notes')} placeholder="Observações adicionais..." />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {editingMaintenance ? 'Atualizar' : 'Agendar'} Manutenção
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Management;
