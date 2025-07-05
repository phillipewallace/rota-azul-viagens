
import { useQuery } from '@tanstack/react-query';
import { BaseApiService } from '@/services/base';

export interface Driver {
  id: string;
  name: string;
  license: string;
  licenseCategory?: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  hireDate?: string;
  currentRoute?: string;
  totalTrips?: number;
  truckCount?: number;
}

class DriversService extends BaseApiService {
  async getDrivers(): Promise<Driver[]> {
    return this.request<Driver[]>('/drivers');
  }
}

const driversService = new DriversService();

export const useDrivers = () => {
  const { data: drivers = [], isLoading: loading, refetch: loadDrivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      try {
        console.log('🚛 Fetching drivers from API...');
        const data = await driversService.getDrivers();
        console.log('✅ Drivers loaded:', data.length);
        return data;
      } catch (error) {
        console.error('❌ Error loading drivers:', error);
        // Mock data for development
        return [
          { id: '1', name: 'João Silva', license: 'CNH123456', phone: '(11) 99999-9999', email: 'joao@email.com', status: 'active' },
          { id: '2', name: 'Maria Santos', license: 'CNH654321', phone: '(11) 88888-8888', email: 'maria@email.com', status: 'active' }
        ];
      }
    },
  });

  return {
    drivers,
    loading,
    loadDrivers
  };
};
