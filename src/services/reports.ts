
import { ReportStats, MonthlyPerformance, RouteUsage, MaintenanceStats } from '@/hooks/useReports';
import { BaseApiService } from './base';

export class ReportsService extends BaseApiService {
  async getReportStats(): Promise<ReportStats> {
    return this.request<ReportStats>('/reports/stats');
  }

  async getMonthlyPerformance(): Promise<MonthlyPerformance[]> {
    return this.request<MonthlyPerformance[]>('/reports/monthly-performance');
  }

  async getRouteUsage(): Promise<RouteUsage[]> {
    return this.request<RouteUsage[]>('/reports/route-usage');
  }

  async getMaintenanceStats(): Promise<MaintenanceStats[]> {
    return this.request<MaintenanceStats[]>('/reports/maintenance-stats');
  }
}

export const reportsService = new ReportsService();
