
import { useQuery } from '@tanstack/react-query';
import { BaseApiService } from '@/services/base';

export interface Schedule {
  id: string;
  truck_id: string;
  route_id: string;
  driver_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  truck_name?: string;
  route_name?: string;
  driver_name?: string;
}

const scheduleService = new BaseApiService();

export const useSchedule = () => {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: async (): Promise<Schedule[]> => {
      console.log('📅 Fetching schedules from API...');
      return scheduleService.request<Schedule[]>('/schedules');
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};
