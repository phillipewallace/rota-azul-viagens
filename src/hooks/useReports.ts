
import { useState, useEffect } from 'react';

export interface ReportStats {
  totalRoutes: number;
  activeRoutes: number;
  totalTrucks: number;
  availableTrucks: number;
  completedTrips: number;
  totalKm: number;
  pendingMaintenance: number;
}

export interface MonthlyPerformance {
  month: string;
  trips: number;
  totalKm: number;
}

export interface RouteUsage {
  name: string;
  usage: number;
}

export interface MaintenanceStats {
  type: string;
  count: number;
  averageCost: number;
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useReports = () => {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [monthlyPerformance, setMonthlyPerformance] = useState<MonthlyPerformance[]>([]);
  const [routeUsage, setRouteUsage] = useState<RouteUsage[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Mock data for development
        setStats({
          totalRoutes: 15,
          activeRoutes: 8,
          totalTrucks: 12,
          availableTrucks: 7,
          completedTrips: 145,
          totalKm: 12500,
          pendingMaintenance: 3
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({
        totalRoutes: 15,
        activeRoutes: 8,
        totalTrucks: 12,
        availableTrucks: 7,
        completedTrips: 145,
        totalKm: 12500,
        pendingMaintenance: 3
      });
    }
  };

  const loadMonthlyPerformance = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/monthly-performance`);
      if (response.ok) {
        const data = await response.json();
        setMonthlyPerformance(data);
      } else {
        // Mock data
        setMonthlyPerformance([
          { month: '2024-01', trips: 25, totalKm: 2500 },
          { month: '2024-02', trips: 30, totalKm: 3200 },
          { month: '2024-03', trips: 28, totalKm: 2800 }
        ]);
      }
    } catch (error) {
      console.error('Error loading monthly performance:', error);
      setMonthlyPerformance([
        { month: '2024-01', trips: 25, totalKm: 2500 },
        { month: '2024-02', trips: 30, totalKm: 3200 },
        { month: '2024-03', trips: 28, totalKm: 2800 }
      ]);
    }
  };

  const loadRouteUsage = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/route-usage`);
      if (response.ok) {
        const data = await response.json();
        setRouteUsage(data);
      } else {
        // Mock data
        setRouteUsage([
          { name: 'Rota Centro', usage: 15 },
          { name: 'Rota Zona Sul', usage: 12 },
          { name: 'Rota Norte', usage: 8 }
        ]);
      }
    } catch (error) {
      console.error('Error loading route usage:', error);
      setRouteUsage([
        { name: 'Rota Centro', usage: 15 },
        { name: 'Rota Zona Sul', usage: 12 },
        { name: 'Rota Norte', usage: 8 }
      ]);
    }
  };

  const loadMaintenanceStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/maintenance-stats`);
      if (response.ok) {
        const data = await response.json();
        setMaintenanceStats(data);
      } else {
        // Mock data
        setMaintenanceStats([
          { type: 'Preventiva', count: 25, averageCost: 500 },
          { type: 'Corretiva', count: 15, averageCost: 800 },
          { type: 'Pneus', count: 10, averageCost: 300 }
        ]);
      }
    } catch (error) {
      console.error('Error loading maintenance stats:', error);
      setMaintenanceStats([
        { type: 'Preventiva', count: 25, averageCost: 500 },
        { type: 'Corretiva', count: 15, averageCost: 800 },
        { type: 'Pneus', count: 10, averageCost: 300 }
      ]);
    }
  };

  const getReportData = async (month: string, year: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reports/data?month=${month}&year=${year}`);
      if (response.ok) {
        return await response.json();
      } else {
        // Mock data
        return {
          period: `${month}/${year}`,
          totalTrips: 45,
          totalKm: 4500,
          activeDrivers: 12,
          activeTrucks: 8,
          completedRoutes: 15,
          pendingMaintenance: 2
        };
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      return {
        period: `${month}/${year}`,
        totalTrips: 45,
        totalKm: 4500,
        activeDrivers: 12,
        activeTrucks: 8,
        completedRoutes: 15,
        pendingMaintenance: 2
      };
    }
  };

  const getReportStats = async () => {
    return stats;
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadStats(),
      loadMonthlyPerformance(),
      loadRouteUsage(),
      loadMaintenanceStats()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return {
    stats,
    monthlyPerformance,
    routeUsage,
    maintenanceStats,
    loading,
    reload: loadAllData,
    getReportData,
    getReportStats
  };
};
