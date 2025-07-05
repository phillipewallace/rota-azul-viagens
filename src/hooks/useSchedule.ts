
import { useQuery } from '@tanstack/react-query';
import { BaseApiService } from '@/services/base';

export interface Schedule {
  id: string;
  truckId: string;
  truck: string;
  route: string;
  driverId: string;
  driver: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
}

class ScheduleService extends BaseApiService {
  async getSchedules(): Promise<Schedule[]> {
    return this.request<Schedule[]>('/schedules');
  }
}

const scheduleService = new ScheduleService();

export const useSchedule = () => {
  const { data: schedules = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => scheduleService.getSchedules(),
    retry: 2,
  });

  return {
    schedules,
    loading,
    error: error ? 'Erro ao carregar agendamentos' : null,
    refetch,
  };
};
