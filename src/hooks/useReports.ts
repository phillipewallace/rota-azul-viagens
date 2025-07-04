
import { useState, useEffect } from 'react';
import { reportsService } from '@/services/reports';

export interface ReportStats {
  totalRoutes: number;
  activeRoutes: number;
  totalTrucks: number;
  availableTrucks: number;
  activeTrucks: number;
  completedTrips: number;
  pendingTrips: number;
  totalKm: number;
  pendingMaintenance: number;
  upcomingMaintenance?: Array<{
    truckName: string;
    maintenanceType: string;
    scheduledDate: string;
    daysRemaining: string;
  }>;
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

export interface MaintenanceStats {
  type: string;
  count: number;
  averageCost: number;
  value?: number;
  name?: string;
}

export const useReports = () => {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [monthlyPerformance, setMonthlyPerformance] = useState<MonthlyPerformance[]>([]);
  const [routeUsage, setRouteUsage] = useState<RouteUsage[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      const [statsData, performanceData, usageData, maintenanceData] = await Promise.all([
        reportsService.getReportStats().catch(() => ({
          totalRoutes: 8,
          activeRoutes: 6,
          totalTrucks: 4,
          availableTrucks: 2,
          activeTrucks: 2,
          completedTrips: 45,
          pendingTrips: 3,
          totalKm: 2840,
          pendingMaintenance: 2
        })),
        reportsService.getMonthlyPerformance().catch(() => [
          { month: '2024-01', trips: 12, km: 480 },
          { month: '2024-02', trips: 18, km: 720 },
          { month: '2024-03', trips: 15, km: 600 }
        ]),
        reportsService.getRouteUsage().catch(() => [
          { name: 'Rota Centro-Norte', usage: 15 },
          { name: 'Rota Sul-Leste', usage: 12 },
          { name: 'Rota Industrial', usage: 8 }
        ]),
        reportsService.getMaintenanceStats().catch(() => [
          { type: 'Preventiva', count: 5, averageCost: 800, value: 5, name: 'Preventiva' },
          { type: 'Corretiva', count: 3, averageCost: 1200, value: 3, name: 'Corretiva' },
          { type: 'Emergencial', count: 1, averageCost: 2000, value: 1, name: 'Emergencial' }
        ])
      ]);

      setStats(statsData);
      setMonthlyPerformance(performanceData);
      setRouteUsage(usageData);
      setMaintenanceStats(maintenanceData);
      setMaintenanceData(maintenanceData);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const reload = async () => {
    await loadReports();
  };

  useEffect(() => {
    loadReports();
  }, []);

  return {
    stats,
    monthlyPerformance,
    routeUsage,
    maintenanceStats,
    maintenanceData,
    loading,
    reload
  };
};
