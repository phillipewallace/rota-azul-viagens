
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Truck {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: 'available' | 'in-route' | 'maintenance';
  currentRoute?: string;
  currentRouteName?: string;
  driver?: string;
  driverName?: string;
  lastMaintenance: string;
  mileage: number;
  location?: {
    lat: number;
    lng: number;
  };
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

const fetchTrucks = async (): Promise<Truck[]> => {
  const response = await fetch(`${API_BASE_URL}/trucks`);
  if (!response.ok) {
    throw new Error('Erro ao carregar caminhões');
  }
  return response.json();
};

const updateTruckLocationApi = async (truckId: string, lat: number, lng: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/trucks/${truckId}/location`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lat, lng, timestamp: new Date().toISOString() }),
  });
  
  if (!response.ok) {
    throw new Error('Erro ao atualizar localização do caminhão');
  }
};

export const useTrucks = () => {
  const queryClient = useQueryClient();

  const { data: trucks = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['trucks'],
    queryFn: fetchTrucks,
    refetchInterval: 30000,
    retry: 2,
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) =>
      updateTruckLocationApi(truckId, lat, lng),
    onSuccess: (_, { truckId, lat, lng }) => {
      queryClient.setQueryData(['trucks'], (oldData: Truck[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(truck => 
          truck.id === truckId 
            ? { ...truck, location: { lat, lng } }
            : truck
        );
      });
    },
  });

  const updateTruckLocation = (truckId: string, lat: number, lng: number) => {
    updateLocationMutation.mutate({ truckId, lat, lng });
  };

  const loadTrucks = async () => {
    queryClient.invalidateQueries({ queryKey: ['trucks'] });
  };

  return {
    trucks,
    loading,
    error: error ? 'Erro ao carregar caminhões' : null,
    loadTrucks,
    updateTruckLocation,
    refetch
  };
};
