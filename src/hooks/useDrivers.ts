
import { useQuery } from '@tanstack/react-query';
import { BaseApiService } from '@/services/base';

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  license_number: string;
  license_category: string;
  hire_date: string;
  status: 'active' | 'inactive' | 'on_leave';
  current_truck_id?: string;
}

const driversService = new BaseApiService();

export const useDrivers = () => {
  const query = useQuery({
    queryKey: ['drivers'],
    queryFn: async (): Promise<Driver[]> => {
      console.log('🚛 Fetching drivers from API...');
      return driversService.request<Driver[]>('/drivers');
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    ...query,
    drivers: query.data || [],
    loading: query.isLoading,
  };
};
