
import { useState, useEffect } from 'react';
import { 
  analyticsService, 
  DashboardData, 
  TrendData, 
  PerformanceData,
  HistoryResponse,
  HistoryFilters,
  ExecutionDetail
} from '@/services/analytics';

export const useAnalytics = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (period: number = 30) => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getDashboard(period);
      setDashboardData(data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      setError('Erro ao carregar dados do dashboard');
      // Fallback data
      setDashboardData({
        kpis: {
          totalRoutes: 0,
          completedRoutes: 0,
          activeRoutes: 0,
          cancelledRoutes: 0,
          totalPointsPlanned: 0,
          totalPointsCompleted: 0,
          totalDistance: 0,
          avgCompletion: 0,
          trucksUsed: 0,
          driversActive: 0
        },
        topDrivers: [],
        topTrucks: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async (period: number = 30) => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getTrends(period);
      setTrends(data);
    } catch (err) {
      console.error('Erro ao carregar tendências:', err);
      setError('Erro ao carregar tendências');
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformance = async (period: number = 30) => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getPerformance(period);
      setPerformance(data);
    } catch (err) {
      console.error('Erro ao carregar performance:', err);
      setError('Erro ao carregar dados de performance');
      setPerformance({ drivers: [], trucks: [] });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (filters: HistoryFilters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getHistory(filters);
      setHistory(data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setError('Erro ao carregar histórico');
      setHistory({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionDetail = async (id: string): Promise<ExecutionDetail | null> => {
    try {
      setLoading(true);
      setError(null);
      return await analyticsService.getExecutionDetail(id);
    } catch (err) {
      console.error('Erro ao carregar detalhes da execução:', err);
      setError('Erro ao carregar detalhes da execução');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reload = async (period: number = 30) => {
    await Promise.all([
      loadDashboard(period),
      loadTrends(period),
      loadPerformance(period)
    ]);
  };

  return {
    dashboardData,
    trends,
    performance,
    history,
    loading,
    error,
    loadDashboard,
    loadTrends,
    loadPerformance,
    loadHistory,
    loadExecutionDetail,
    reload
  };
};
