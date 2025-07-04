
import { useQuery } from '@tanstack/react-query';

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

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useDrivers = () => {
  const { data: drivers = [], isLoading: loading, refetch: loadDrivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      try {
        console.log('🚛 Fetching drivers from API...');
        const response = await fetch(`${API_BASE_URL}/drivers`);
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Drivers loaded:', data.length);
          return data;
        }
        throw new Error('Failed to fetch drivers');
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
