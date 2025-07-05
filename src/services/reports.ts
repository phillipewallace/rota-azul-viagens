
import { BaseApiService } from './base';

export interface ReportStats {
  totalTrucks: number;
  activeTrucks: number;
  totalRoutes: number;
  completedRoutes: number;
  maintenanceAlerts: number;
}

export interface MonthlyPerformance {
  month: string;
  completedRoutes: number;
  totalDistance: number;
  fuelConsumption: number;
}

export interface RouteUsage {
  routeName: string;
  usageCount: number;
  averageTime: number;
}

export interface MaintenanceStats {
  scheduled: number;
  overdue: number;
  completed: number;
}

class ReportsService extends BaseApiService {
  async getReportStats(): Promise<ReportStats> {
    console.log('📊 Fetching report stats...');
    return this.request<ReportStats>('/reports/stats');
  }

  async getMonthlyPerformance(): Promise<MonthlyPerformance[]> {
    console.log('📈 Fetching monthly performance...');
    return this.request<MonthlyPerformance[]>('/reports/monthly-performance');
  }

  async getRouteUsage(): Promise<RouteUsage[]> {
    console.log('🗺️ Fetching route usage...');
    return this.request<RouteUsage[]>('/reports/route-usage');
  }

  async getMaintenanceStats(): Promise<MaintenanceStats> {
    console.log('🔧 Fetching maintenance stats...');
    return this.request<MaintenanceStats>('/reports/maintenance-stats');
  }
}

export const reportsService = new ReportsService();
