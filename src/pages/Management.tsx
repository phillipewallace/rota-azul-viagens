
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, BarChart3, TrendingUp, FileText } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useManagement } from '@/hooks/useManagement';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { ManagementFilters } from '@/components/ManagementFilters';
import { ManagementMetrics } from '@/components/ManagementMetrics';
import { ManagementTables } from '@/components/ManagementTables';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const Management = () => {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('all');
  const [selectedRoute, setSelectedRoute] = useState('all');

  const {
    stats,
    performance,
    routeUsage,
    truckPerformance,
    loading,
    loadPerformance,
    loadRouteUsage,
    loadTruckPerformance,
    exportReport
  } = useManagement();

  const { trucks } = useTrucks();
  const { routes } = useRoutes();

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
      routeId: selectedRoute !== 'all' ? selectedRoute : undefined,
    };

    loadPerformance(filters);
    loadRouteUsage({ startDate: filters.startDate, endDate: filters.endDate });
    loadTruckPerformance({ startDate: filters.startDate, endDate: filters.endDate });

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
    setSelectedRoute('all');
    
    loadPerformance();
    loadRouteUsage();
    loadTruckPerformance();

    toast({
      title: 'Filtros limpos',
      description: 'Todos os filtros foram removidos.',
    });
  };

  const handleExportReport = async () => {
    try {
      const filters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        format: 'json',
      };

      const reportData = await exportReport(filters);
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-gestao-${startDate}-${endDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Relatório exportado',
        description: 'O relatório foi baixado com sucesso.',
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Ocorreu um erro ao exportar o relatório.',
        variant: 'destructive',
      });
    }
  };

  // Prepare chart data
  const chartData = performance.slice(0, 10).reverse().map(item => ({
    date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    viagens: item.trips,
    distancia: Math.round(item.total_distance)
  }));

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Gestão & Analytics" 
        subtitle="Dashboard executivo com métricas e relatórios detalhados"
      >
        <Button onClick={handleExportReport} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Relatório
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Filtros Avançados */}
        <ManagementFilters
          startDate={startDate}
          endDate={endDate}
          selectedTruck={selectedTruck}
          selectedRoute={selectedRoute}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onTruckChange={setSelectedTruck}
          onRouteChange={setSelectedRoute}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          trucks={trucks}
          routes={routes}
        />

        {/* Métricas Principais */}
        <ManagementMetrics stats={stats} loading={loading} />

        {/* Gráficos de Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Viagens por Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="viagens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Distância Percorrida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value} km`, 'Distância']} />
                    <Line 
                      type="monotone" 
                      dataKey="distancia" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabelas de Dados */}
        <ManagementTables
          truckPerformance={truckPerformance}
          routeUsage={routeUsage}
          loading={loading}
        />

        {/* Relatórios Rápidos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
                <div className="font-semibold mb-1">Relatório Semanal</div>
                <div className="text-sm text-gray-600">Performance dos últimos 7 dias</div>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
                <div className="font-semibold mb-1">Análise de Rotas</div>
                <div className="text-sm text-gray-600">Eficiência e otimização</div>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
                <div className="font-semibold mb-1">Manutenção Preventiva</div>
                <div className="text-sm text-gray-600">Cronograma de manutenções</div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Management;
