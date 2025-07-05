
import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports';

export const useReports = () => {
  const reportStats = useQuery({
    queryKey: ['report-stats'],
    queryFn: () => reportsService.getReportStats(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const monthlyPerformance = useQuery({
    queryKey: ['monthly-performance'],
    queryFn: () => reportsService.getMonthlyPerformance(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const routeUsage = useQuery({
    queryKey: ['route-usage'],
    queryFn: () => reportsService.getRouteUsage(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const maintenanceStats = useQuery({
    queryKey: ['maintenance-stats'],
    queryFn: () => reportsService.getMaintenanceStats(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    reportStats,
    monthlyPerformance,
    routeUsage,
    maintenanceStats,
  };
};
