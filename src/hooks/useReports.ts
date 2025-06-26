
import { useQuery } from '@tanstack/react-query';

export interface ReportStats {
  totalRoutes: number;
  activeRoutes: number;
  totalTrucks: number;
  activeTrucks: number;
  totalKm: number;
  completedTrips: number;
  pendingTrips: number;
  upcomingMaintenance: {
    truckName: string;
    maintenanceType: string;
    scheduledDate: string;
    daysRemaining: number;
  }[];
}

export interface MonthlyPerformance {
  month: string;
  trips: number;
  km: number;
}

export interface RouteUsage {
  name: string;
  usage: number;
}

export interface MaintenanceData {
  name: string;
  value: number;
}

const API_BASE_URL = 'http://localhost:3001/api';

const fetchReportStats = async (): Promise<ReportStats> => {
  const response = await fetch(`${API_BASE_URL}/reports/stats`);
  if (!response.ok) {
    throw new Error('Erro ao carregar estatísticas');
  }
  return response.json();
};

const fetchMonthlyPerformance = async (): Promise<MonthlyPerformance[]> => {
  const response = await fetch(`${API_BASE_URL}/reports/monthly-performance`);
  if (!response.ok) {
    throw new Error('Erro ao carregar performance mensal');
  }
  return response.json();
};

const fetchRouteUsage = async (): Promise<RouteUsage[]> => {
  const response = await fetch(`${API_BASE_URL}/reports/route-usage`);
  if (!response.ok) {
    throw new Error('Erro ao carregar uso de rotas');
  }
  return response.json();
};

const fetchMaintenanceStats = async (): Promise<MaintenanceData[]> => {
  const response = await fetch(`${API_BASE_URL}/reports/maintenance-stats`);
  if (!response.ok) {
    throw new Error('Erro ao carregar estatísticas de manutenção');
  }
  return response.json();
};

export const useReports = () => {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['reportStats'],
    queryFn: fetchReportStats,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: monthlyPerformance = [], isLoading: performanceLoading } = useQuery({
    queryKey: ['monthlyPerformance'],
    queryFn: fetchMonthlyPerformance,
    refetchInterval: 60000, // Atualiza a cada minuto
  });

  const { data: routeUsage = [], isLoading: routeLoading } = useQuery({
    queryKey: ['routeUsage'],
    queryFn: fetchRouteUsage,
    refetchInterval: 60000,
  });

  const { data: maintenanceData = [], isLoading: maintenanceLoading } = useQuery({
    queryKey: ['maintenanceStats'],
    queryFn: fetchMaintenanceStats,
    refetchInterval: 60000,
  });

  const loading = statsLoading || performanceLoading || routeLoading || maintenanceLoading;
  const error = statsError ? 'Erro ao carregar relatórios' : null;

  const loadReports = async () => {
    // Esta função agora é desnecessária com o React Query, mas mantemos para compatibilidade
    console.log('Reports will be automatically refetched by React Query');
  };

  return {
    stats,
    monthlyPerformance,
    routeUsage,
    maintenanceData,
    loading,
    error,
    loadReports
  };
};
