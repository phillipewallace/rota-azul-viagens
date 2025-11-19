
import { BaseApiService } from './base';

export interface DashboardKPIs {
  totalRoutes: number;
  completedRoutes: number;
  activeRoutes: number;
  cancelledRoutes: number;
  totalPointsPlanned: number;
  totalPointsCompleted: number;
  totalDistance: number;
  avgCompletion: number;
  trucksUsed: number;
  driversActive: number;
}

export interface TopDriver {
  driverName: string;
  routesExecuted: number;
  routesCompleted: number;
  avgCompletion: number;
}

export interface TopTruck {
  truckName: string;
  plate: string;
  routesExecuted: number;
  totalDistance: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  topDrivers: TopDriver[];
  topTrucks: TopTruck[];
}

export interface TrendData {
  date: string;
  routesCount: number;
  completedCount: number;
  totalDistance: number;
  avgCompletion: number;
}

export interface DriverPerformance {
  id: string;
  name: string;
  totalRoutes: number;
  completedRoutes: number;
  avgCompletion: number;
  totalDistance: number;
  totalPointsCompleted: number;
}

export interface TruckPerformance {
  id: string;
  name: string;
  plate: string;
  totalRoutes: number;
  totalDistance: number;
  avgCompletion: number;
}

export interface PerformanceData {
  drivers: DriverPerformance[];
  trucks: TruckPerformance[];
}

export interface RouteExecution {
  id: string;
  routeId: string;
  routeName: string;
  routeDescription: string | null;
  truckId: string;
  truckName: string;
  truckPlate: string;
  driverId: string | null;
  driverName: string | null;
  totalPoints: number;
  totalDistance: number;
  estimatedDuration: number;
  startedAt: string;
  completedAt: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  pointsCompleted: number;
  actualDuration: number | null;
  completionPercentage: number;
}

export interface HistoryFilters {
  status?: 'in_progress' | 'completed' | 'cancelled';
  driverId?: string;
  truckId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface HistoryResponse {
  data: RouteExecution[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExecutionDetail extends RouteExecution {
  truck: {
    id: string;
    name: string;
    plate: string;
    model: string;
  };
  driver: {
    id: string;
    name: string;
    phone: string;
  } | null;
  pointsSnapshot: any[];
  createdAt: string;
  updatedAt: string;
}

export class AnalyticsService extends BaseApiService {
  async getDashboard(period: number = 30): Promise<DashboardData> {
    return this.request<DashboardData>(`/analytics/dashboard?period=${period}`);
  }

  async getTrends(period: number = 30): Promise<TrendData[]> {
    return this.request<TrendData[]>(`/analytics/trends?period=${period}`);
  }

  async getPerformance(period: number = 30): Promise<PerformanceData> {
    return this.request<PerformanceData>(`/analytics/performance?period=${period}`);
  }

  async getHistory(filters: HistoryFilters = {}): Promise<HistoryResponse> {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.driverId) params.append('driverId', filters.driverId);
    if (filters.truckId) params.append('truckId', filters.truckId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/analytics/history?${queryString}` : '/analytics/history';
    
    return this.request<HistoryResponse>(endpoint);
  }

  async getExecutionDetail(id: string): Promise<ExecutionDetail> {
    return this.request<ExecutionDetail>(`/analytics/history/${id}`);
  }

  async getRouteUsage(period: number = 30): Promise<RouteUsageData[]> {
    return this.request<RouteUsageData[]>(`/analytics/route-usage?period=${period}`);
  }

  async getMaintenanceSummary(period: number = 30): Promise<MaintenanceSummaryData[]> {
    return this.request<MaintenanceSummaryData[]>(`/analytics/maintenance-summary?period=${period}`);
  }

  async getMonthlyPerformance(period: number = 180): Promise<MonthlyPerformanceData[]> {
    return this.request<MonthlyPerformanceData[]>(`/analytics/monthly-performance?period=${period}`);
  }
}

export interface RouteUsageData {
  route_name: string;
  execution_count: number;
  total_distance: number;
}

export interface MaintenanceSummaryData {
  type: string;
  count: number;
  total_cost: number;
}

export interface MonthlyPerformanceData {
  month: string;
  total_executions: number;
  total_distance: number;
}

export const analyticsService = new AnalyticsService();
