
import { useState, useEffect } from 'react';

export interface ManagementStats {
  trucks: {
    total: number;
    available: number;
    in_route: number;
    maintenance: number;
  };
  drivers: {
    total: number;
    active: number;
  };
  routes: {
    total: number;
    active: number;
  };
  trips: {
    total_trips: number;
    total_distance: number;
    avg_duration: number;
  };
}

export interface PerformanceData {
  date: string;
  trips: number;
  total_distance: number;
  avg_duration: number;
  truck_name?: string;
  route_name?: string;
}

export interface RouteUsageData {
  name: string;
  id: string;
  usage_count: number;
  total_distance: number;
  avg_duration: number;
}

export interface TruckPerformanceData {
  name: string;
  id: string;
  plate: string;
  trips_count: number;
  total_distance: number;
  avg_duration: number;
  status: string;
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useManagement = () => {
  const [stats, setStats] = useState<ManagementStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [routeUsage, setRouteUsage] = useState<RouteUsageData[]>([]);
  const [truckPerformance, setTruckPerformance] = useState<TruckPerformanceData[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/management/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformance = async (filters: {
    startDate?: string;
    endDate?: string;
    truckId?: string;
    routeId?: string;
  } = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/management/performance?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPerformance(data);
      }
    } catch (error) {
      console.error('Error loading performance:', error);
    }
  };

  const loadRouteUsage = async (filters: {
    startDate?: string;
    endDate?: string;
  } = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/management/route-usage?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRouteUsage(data);
      }
    } catch (error) {
      console.error('Error loading route usage:', error);
    }
  };

  const loadTruckPerformance = async (filters: {
    startDate?: string;
    endDate?: string;
  } = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/management/truck-performance?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTruckPerformance(data);
      }
    } catch (error) {
      console.error('Error loading truck performance:', error);
    }
  };

  const exportReport = async (filters: {
    startDate?: string;
    endDate?: string;
    format?: string;
  } = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/management/export?${params}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadStats();
    loadPerformance();
    loadRouteUsage();
    loadTruckPerformance();
  }, []);

  return {
    stats,
    performance,
    routeUsage,
    truckPerformance,
    loading,
    loadStats,
    loadPerformance,
    loadRouteUsage,
    loadTruckPerformance,
    exportReport,
  };
};
