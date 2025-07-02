
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Wrench, Calendar, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
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

interface MaintenanceRecord {
  id: string;
  truck_id: string;
  truck_name: string;
  maintenance_type: string;
  description: string;
  scheduled_date: string;
  completed_date?: string;
  cost?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

const Maintenance = () => {
  const { toast } = useToast();
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([
    {
      id: '1',
      truck_id: '1',
      truck_name: 'Caminhão 001',
      maintenance_type: 'Revisão Preventiva',
      description: 'Revisão geral do veículo',
      scheduled_date: '2024-07-15',
      status: 'scheduled',
      cost: 800
    },
    {
      id: '2',
      truck_id: '2',
      truck_name: 'Caminhão 002',
      maintenance_type: 'Troca de Óleo',
      description: 'Troca de óleo do motor',
      scheduled_date: '2024-07-10',
      completed_date: '2024-07-10',
      status: 'completed',
      cost: 250
    }
  ]);

  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    truck_id: '',
    maintenance_type: '',
    description: '',
    scheduled_date: '',
    cost: ''
  });

  const trucks = [
    { id: '1', name: 'Caminhão 001' },
    { id: '2', name: 'Caminhão 002' },
    { id: '3', name: 'Caminhão 003' }
  ];

  const maintenanceTypes = [
    'Revisão Preventiva',
    'Troca de Óleo',
    'Revisão dos Freios',
    'Manutenção do Motor',
    'Revisão da Suspensão',
    'Manutenção Corretiva',
    'Inspeção Geral'
  ];

  const handleCreateMaintenance = () => {
    setEditingRecord(null);
    setFormData({
      truck_id: '',
      maintenance_type: '',
      description: '',
      scheduled_date: '',
      cost: ''
    });
    setShowForm(true);
  };

  const handleEditMaintenance = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setFormData({
      truck_id: record.truck_id,
      maintenance_type: record.maintenance_type,
      description: record.description,
      scheduled_date: record.scheduled_date,
      cost: record.cost?.toString() || ''
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingRecord) {
      // Update existing record
      setMaintenanceRecords(prev => prev.map(record => 
        record.id === editingRecord.id 
          ? {
              ...record,
              truck_id: formData.truck_id,
              truck_name: trucks.find(t => t.id === formData.truck_id)?.name || '',
              maintenance_type: formData.maintenance_type,
              description: formData.description,
              scheduled_date: formData.scheduled_date,
              cost: formData.cost ? parseFloat(formData.cost) : undefined
            }
          : record
      ));
      toast({ title: 'Manutenção atualizada com sucesso!' });
    } else {
      // Create new record
      const newRecord: MaintenanceRecord = {
        id: Date.now().toString(),
        truck_id: formData.truck_id,
        truck_name: trucks.find(t => t.id === formData.truck_id)?.name || '',
        maintenance_type: formData.maintenance_type,
        description: formData.description,
        scheduled_date: formData.scheduled_date,
        status: 'scheduled',
        cost: formData.cost ? parseFloat(formData.cost) : undefined
      };
      setMaintenanceRecords(prev => [...prev, newRecord]);
      toast({ title: 'Manutenção agendada com sucesso!' });
    }
    
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este registro de manutenção?')) {
      setMaintenanceRecords(prev => prev.filter(record => record.id !== id));
      toast({ title: 'Registro de manutenção excluído com sucesso!' });
    }
  };

  const handleStatusChange = (id: string, newStatus: MaintenanceRecord['status']) => {
    setMaintenanceRecords(prev => prev.map(record => 
      record.id === id 
        ? {
            ...record,
            status: newStatus,
            completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined
          }
        : record
    ));
    toast({ title: 'Status atualizado com sucesso!' });
  };

  const getStatusBadge = (status: MaintenanceRecord['status']) => {
    const variants = {
      scheduled: 'default',
      in_progress: 'secondary',
      completed: 'default',
      cancelled: 'destructive'
    } as const;
    
    const labels = {
      scheduled: 'Agendada',
      in_progress: 'Em Andamento',
      completed: 'Concluída',
      cancelled: 'Cancelada'
    };
    
    const colors = {
      scheduled: 'bg-blue-500',
      in_progress: 'bg-yellow-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500'
    };

    return (
      <Badge className={`${colors[status]} text-white`}>
        {labels[status]}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Manutenções" 
        subtitle="Gerenciamento de manutenções da frota"
      >
        <Button onClick={handleCreateMaintenance}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Manutenção
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Agendadas</p>
                  <p className="text-2xl font-bold">
                    {maintenanceRecords.filter(r => r.status === 'scheduled').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-600">Em Andamento</p>
                  <p className="text-2xl font-bold">
                    {maintenanceRecords.filter(r => r.status === 'in_progress').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Concluídas</p>
                  <p className="text-2xl font-bold">
                    {maintenanceRecords.filter(r => r.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Custo Total</p>
                  <p className="text-2xl font-bold">
                    R$ {maintenanceRecords.reduce((sum, r) => sum + (r.cost || 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Maintenance Table */}
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caminhão</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data Agendada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.truck_name}</TableCell>
                    <TableCell>{record.maintenance_type}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{record.description}</TableCell>
                    <TableCell>{new Date(record.scheduled_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      {record.cost ? `R$ ${record.cost.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={record.status}
                          onValueChange={(value) => handleStatusChange(record.id, value as MaintenanceRecord['status'])}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Agendada</SelectItem>
                            <SelectItem value="in_progress">Em Andamento</SelectItem>
                            <SelectItem value="completed">Concluída</SelectItem>
                            <SelectItem value="cancelled">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditMaintenance(record)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(record.id)}
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

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar Manutenção' : 'Nova Manutenção'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="truck">Caminhão</Label>
              <Select value={formData.truck_id} onValueChange={(value) => setFormData({...formData, truck_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um caminhão" />
                </SelectTrigger>
                <SelectContent>
                  {trucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maintenance_type">Tipo de Manutenção</Label>
              <Select value={formData.maintenance_type} onValueChange={(value) => setFormData({...formData, maintenance_type: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {maintenanceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="scheduled_date">Data Agendada</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                required
              />
            </div>

            <div>
              <Label htmlFor="cost">Custo Estimado (R$)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({...formData, cost: e.target.value})}
                placeholder="0,00"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descreva os serviços a serem realizados..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingRecord ? 'Atualizar' : 'Agendar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Maintenance;
