
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCcw } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { DashboardKPIs } from "@/components/analytics/DashboardKPIs";
import { TrendsChart } from "@/components/analytics/TrendsChart";
import { HistoryTable } from "@/components/analytics/HistoryTable";
import { ExecutionDetails } from "@/components/analytics/ExecutionDetails";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import PageHeader from "@/components/PageHeader";
import { RouteExecution, ExecutionDetail } from "@/services/analytics";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Analytics = () => {
  const [period, setPeriod] = useState(30);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filtros de histórico
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    dashboardData,
    trends,
    performance,
    history,
    loading,
    loadDashboard,
    loadTrends,
    loadPerformance,
    loadHistory,
    loadExecutionDetail,
    reload
  } = useAnalytics();

  useEffect(() => {
    reload(period);
  }, [period]);

  useEffect(() => {
    const filters: any = {
      page: currentPage,
      limit: 20
    };

    if (statusFilter !== 'all') filters.status = statusFilter;
    if (startDate) filters.startDate = startDate.toISOString();
    if (endDate) filters.endDate = endDate.toISOString();

    loadHistory(filters);
  }, [statusFilter, startDate, endDate, currentPage]);

  const handleViewDetails = async (execution: RouteExecution) => {
    const details = await loadExecutionDetail(execution.id);
    if (details) {
      setSelectedExecution(details);
      setDetailsOpen(true);
    } else {
      toast.error('Erro ao carregar detalhes da execução');
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
    setCurrentPage(1);
  };

  const handleExportPDF = () => {
    toast.info('Exportação de PDF em desenvolvimento');
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      <PageHeader
        title="Análises & Histórico"
        subtitle="Dashboard de estatísticas e histórico de execuções de rotas"
      />

      {/* Seletor de Período */}
      <div className="flex justify-between items-center">
        <Select value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v))}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => reload(period)} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {loading && !dashboardData ? (
            <div className="text-center py-8">Carregando dados...</div>
          ) : dashboardData ? (
            <>
              <DashboardKPIs data={dashboardData.kpis} />
              
              <TrendsChart data={trends} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Motoristas</CardTitle>
                    <CardDescription>Ranking por rotas concluídas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.topDrivers.length > 0 ? (
                      <div className="space-y-3">
                        {dashboardData.topDrivers.map((driver, index) => (
                          <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{driver.driverName}</p>
                              <p className="text-sm text-muted-foreground">
                                {driver.routesCompleted}/{driver.routesExecuted} rotas
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">{driver.avgCompletion.toFixed(1)}%</p>
                              <p className="text-xs text-muted-foreground">conclusão</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Caminhões</CardTitle>
                    <CardDescription>Ranking por rotas executadas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.topTrucks.length > 0 ? (
                      <div className="space-y-3">
                        {dashboardData.topTrucks.map((truck, index) => (
                          <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{truck.truckName}</p>
                              <p className="text-sm text-muted-foreground">{truck.plate}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">{truck.routesExecuted}</p>
                              <p className="text-xs text-muted-foreground">
                                {truck.totalDistance.toFixed(1)} km
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalyticsFilters
                status={statusFilter}
                onStatusChange={setStatusFilter}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                onReset={handleResetFilters}
              />
            </CardContent>
          </Card>

          {loading && !history ? (
            <div className="text-center py-8">Carregando histórico...</div>
          ) : history ? (
            <Card>
              <CardHeader>
                <CardTitle>Execuções de Rotas</CardTitle>
                <CardDescription>
                  {history.pagination.total} execuções encontradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HistoryTable 
                  data={history.data} 
                  onViewDetails={handleViewDetails}
                />
                
                {history.pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="px-4 py-2">
                      Página {currentPage} de {history.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={currentPage === history.pagination.totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          {loading && !performance ? (
            <div className="text-center py-8">Carregando performance...</div>
          ) : performance ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Ranking de Motoristas</CardTitle>
                  <CardDescription>Performance detalhada por motorista</CardDescription>
                </CardHeader>
                <CardContent>
                  {performance.drivers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Concluídas</TableHead>
                          <TableHead>Distância</TableHead>
                          <TableHead>Pontos</TableHead>
                          <TableHead>% Conclusão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performance.drivers.map((driver) => (
                          <TableRow key={driver.id}>
                            <TableCell className="font-medium">{driver.name}</TableCell>
                            <TableCell>{driver.totalRoutes}</TableCell>
                            <TableCell>{driver.completedRoutes}</TableCell>
                            <TableCell>{driver.totalDistance.toFixed(1)} km</TableCell>
                            <TableCell>{driver.totalPointsCompleted}</TableCell>
                            <TableCell>{driver.avgCompletion.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking de Caminhões</CardTitle>
                  <CardDescription>Performance detalhada por veículo</CardDescription>
                </CardHeader>
                <CardContent>
                  {performance.trucks.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Caminhão</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>Total de Rotas</TableHead>
                          <TableHead>Distância Total</TableHead>
                          <TableHead>% Conclusão Média</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performance.trucks.map((truck) => (
                          <TableRow key={truck.id}>
                            <TableCell className="font-medium">{truck.name}</TableCell>
                            <TableCell>{truck.plate}</TableCell>
                            <TableCell>{truck.totalRoutes}</TableCell>
                            <TableCell>{truck.totalDistance.toFixed(1)} km</TableCell>
                            <TableCell>{truck.avgCompletion.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>

      <ExecutionDetails
        execution={selectedExecution}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedExecution(null);
        }}
      />
    </div>
  );
};

export default Analytics;
