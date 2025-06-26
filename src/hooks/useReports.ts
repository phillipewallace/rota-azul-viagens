
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['reportStats'],
    queryFn: () => apiService.getReportStats(),
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const { data: monthlyPerformance = [], isLoading: performanceLoading } = useQuery({
    queryKey: ['monthlyPerformance'],
    queryFn: () => apiService.getMonthlyPerformance(),
    refetchInterval: 60000, // Atualiza a cada minuto
  });

  const { data: routeUsage = [], isLoading: routeLoading } = useQuery({
    queryKey: ['routeUsage'],
    queryFn: () => apiService.getRouteUsage(),
    refetchInterval: 60000,
  });

  const { data: maintenanceData = [], isLoading: maintenanceLoading } = useQuery({
    queryKey: ['maintenanceStats'],
    queryFn: () => apiService.getMaintenanceStats(),
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
