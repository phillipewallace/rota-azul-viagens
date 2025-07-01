
import { useQuery } from '@tanstack/react-query';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  license: string;
  status: 'available' | 'on-route' | 'off-duty';
  currentRoute?: string;
  totalTrips: number;
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

const fetchDrivers = async (): Promise<Driver[]> => {
  const response = await fetch(`${API_BASE_URL}/drivers`);
  if (!response.ok) {
    throw new Error('Erro ao carregar motoristas');
  }
  return response.json();
};

export const useDrivers = () => {
  const { data: drivers = [], isLoading: loading, error } = useQuery({
    queryKey: ['drivers'],
    queryFn: fetchDrivers,
    retry: 2,
  });

  return {
    drivers,
    loading,
    error: error ? 'Erro ao carregar motoristas' : null,
  };
};
