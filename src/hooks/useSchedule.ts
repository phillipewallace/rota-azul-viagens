
import { useQuery } from '@tanstack/react-query';

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

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

const fetchSchedules = async (): Promise<Schedule[]> => {
  const response = await fetch(`${API_BASE_URL}/schedules`);
  if (!response.ok) {
    throw new Error('Erro ao carregar agendamentos');
  }
  return response.json();
};

export const useSchedule = () => {
  const { data: schedules = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules,
    retry: 2,
  });

  return {
    schedules,
    loading,
    error: error ? 'Erro ao carregar agendamentos' : null,
    refetch,
  };
};
