import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, Route, Calendar, Users, Settings, Plus, MapPin, Navigation, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { useDrivers } from '@/hooks/useDrivers';
import { useSchedule } from '@/hooks/useSchedule';
import { useReports } from '@/hooks/useReports';
import { TruckModal } from '@/components/TruckModal';
import LinkRouteModal from '@/components/LinkRouteModal';

const Index = () => {
  const { user } = useAuth();
  const { trucks, loading: trucksLoading, refetch: refetchTrucks } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();
  const { drivers, loading: driversLoading } = useDrivers();
  const { schedules, loading: schedulesLoading } = useSchedule();
  const { reload: reloadReports } = useReports();
  
  const [selectedTruck, setSelectedTruck] = useState<any>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalDistance: 0,
    totalRoutes: 0,
    averageDistance: 0,
    totalSchedules: 0
  });

  useEffect(() => {
    const calculateStats = () => {
      let totalDistance = 0;
      routes.forEach(route => {
        totalDistance += route.totalDistance;
      });

      const averageDistance = routes.length > 0 ? totalDistance / routes.length : 0;

      setStats({
        totalDistance: parseFloat(totalDistance.toFixed(1)),
        totalRoutes: routes.length,
        averageDistance: parseFloat(averageDistance.toFixed(1)),
        totalSchedules: schedules.length
      });
    };

    calculateStats();
  }, [routes, schedules]);

  const handleLinkRoute = (truck: any) => {
    setSelectedTruck(truck);
    setIsLinkModalOpen(true);
  };

  const handleLinkSuccess = () => {
    refetchTrucks();
  };

  const handleGenerateReport = () => {
    reloadReports();
  };

  const isLoading = trucksLoading || routesLoading || driversLoading || schedulesLoading;

  if (isLoading) {
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
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Bem-vindo, {user?.name || 'Usuário'}</p>
        </div>
        <Button onClick={handleGenerateReport} className="bg-blue-600 hover:bg-blue-700">
          Gerar Relatório
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Caminhões</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trucks.length}</div>
            <p className="text-xs text-gray-600">caminhões registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rotas Ativas</CardTitle>
            <Route className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{routes.length}</div>
            <p className="text-xs text-gray-600">rotas disponíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Motoristas</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers.length}</div>
            <p className="text-xs text-gray-600">motoristas cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
            <p className="text-xs text-gray-600">agendamentos ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Trucks Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Caminhões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trucks.map((truck) => (
              <div key={truck.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Truck className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{truck.name}</h3>
                    <p className="text-sm text-gray-600">{truck.plate}</p>
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
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Routes Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-green-600" />
            Rotas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {routes.slice(0, 5).map((route) => (
              <div key={route.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <MapPin className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{route.name}</h3>
                    <p className="text-sm text-gray-600">{route.points.length} pontos</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {route.totalDistance.toFixed(1)} km
                  </Badge>
                  <Badge variant="outline">
                    {route.estimatedTime}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <LinkRouteModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        truck={selectedTruck}
        onSuccess={handleLinkSuccess}
      />
    </div>
  );
};

export default Index;
