
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, PieChart } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useMaintenanceManagement } from '@/hooks/useMaintenanceManagement';
import { useTrucks } from '@/hooks/useTrucks';
import { MaintenanceFilters } from '@/components/MaintenanceFilters';
import { MaintenanceStats } from '@/components/MaintenanceStats';
import { MaintenanceTable } from '@/components/MaintenanceTable';
import { MaintenanceModal } from '@/components/MaintenanceModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';

const Management = () => {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const {
    stats,
    maintenanceRecords,
    costsSummary,
    loading,
    loadMaintenanceRecords,
    loadCostsSummary,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
  } = useMaintenanceManagement();

  const { trucks } = useTrucks();

  // Set default dates (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const handleApplyFilters = () => {
    const filters = {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      truckId: selectedTruck !== 'all' ? selectedTruck : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      type: selectedType !== 'all' ? selectedType : undefined,
    };

    loadMaintenanceRecords(filters);
    loadCostsSummary({ startDate: filters.startDate, endDate: filters.endDate });

    toast({
      title: 'Filtros aplicados',
      description: 'Os dados foram atualizados com os filtros selecionados.',
    });
  };

  const handleResetFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    setSelectedTruck('all');
    setSelectedStatus('all');
    setSelectedType('all');
    
    loadMaintenanceRecords();
    loadCostsSummary();

    toast({
      title: 'Filtros limpos',
      description: 'Todos os filtros foram removidos.',
    });
  };

  const handleNewMaintenance = () => {
    setEditingRecord(null);
    setShowModal(true);
  };

  const handleEditMaintenance = (record: any) => {
    setEditingRecord(record);
    setShowModal(true);
  };

  const handleSaveMaintenance = async (data: any) => {
    try {
      if (editingRecord) {
        await updateMaintenance(editingRecord.id, data);
        toast({
          title: 'Manutenção atualizada',
          description: 'O registro foi atualizado com sucesso.',
        });
      } else {
        await createMaintenance(data);
        toast({
          title: 'Manutenção criada',
          description: 'O registro foi criado com sucesso.',
        });
      }
      setShowModal(false);
      setEditingRecord(null);
    } catch (error) {
      console.error('Error saving maintenance:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao salvar o registro.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro de manutenção?')) {
      try {
        await deleteMaintenance(id);
        toast({
          title: 'Manutenção excluída',
          description: 'O registro foi excluído com sucesso.',
        });
      } catch (error) {
        console.error('Error deleting maintenance:', error);
        toast({
          title: 'Erro ao excluir',
          description: 'Ocorreu um erro ao excluir o registro.',
          variant: 'destructive',
        });
      }
    }
  };

  // Prepare chart data
  const chartData = costsSummary.map(item => ({
    tipo: item.maintenance_type.charAt(0).toUpperCase() + item.maintenance_type.slice(1),
    custo: item.total_cost,
    quantidade: item.count
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Gestão de Manutenções" 
        subtitle="Controle completo das manutenções da frota"
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Filtros */}
        <MaintenanceFilters
          startDate={startDate}
          endDate={endDate}
          selectedTruck={selectedTruck}
          selectedStatus={selectedStatus}
          selectedType={selectedType}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onTruckChange={setSelectedTruck}
          onStatusChange={setSelectedStatus}
          onTypeChange={setSelectedType}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          onNewMaintenance={handleNewMaintenance}
          trucks={trucks}
        />

        {/* Estatísticas */}
        <MaintenanceStats stats={stats} loading={loading} />

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Custos por Tipo de Manutenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tipo" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`R$ ${value}`, 'Custo Total']} />
                    <Bar dataKey="custo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribuição por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="quantidade"
                      label={({ tipo, quantidade }) => `${tipo}: ${quantidade}`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Registros */}
        <MaintenanceTable
          records={maintenanceRecords}
          loading={loading}
          onEdit={handleEditMaintenance}
          onDelete={handleDeleteMaintenance}
        />

        {/* Modal de Manutenção */}
        <MaintenanceModal
          open={showModal}
          onOpenChange={setShowModal}
          editingRecord={editingRecord}
          onSave={handleSaveMaintenance}
          trucks={trucks}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Management;
