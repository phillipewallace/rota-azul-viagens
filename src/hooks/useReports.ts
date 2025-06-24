
import { useState, useEffect } from 'react';
import { apiService } from '@/services/api';

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

export const useReports = () => {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [monthlyPerformance, setMonthlyPerformance] = useState<MonthlyPerformance[]>([]);
  const [routeUsage, setRouteUsage] = useState<RouteUsage[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, performanceData, usageData, maintenanceStats] = await Promise.all([
        apiService.getReportStats(),
        apiService.getMonthlyPerformance(),
        apiService.getRouteUsage(),
        apiService.getMaintenanceStats()
      ]);

      setStats(statsData);
      setMonthlyPerformance(performanceData);
      setRouteUsage(usageData);
      setMaintenanceData(maintenanceStats);
      
      console.log('Reports loaded successfully');
    } catch (err) {
      setError('Erro ao carregar relatórios');
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

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
