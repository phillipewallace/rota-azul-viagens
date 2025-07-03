
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  status: string;
  currentRoute?: {
    name: string;
    points: Array<{
      id: string;
      address: string;
      lat: number;
      lng: number;
      order: number;
      type: 'origin' | 'destination' | 'waypoint';
      completed: boolean;
    }>;
  };
  location?: {
    lat: number;
    lng: number;
  };
}

export const useMobile = () => {
  const queryClient = useQueryClient();

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`);
    if (!response.ok) {
      throw new Error('Caminhão não encontrado');
    }
    return response.json();
  };

  const updateTruckLocationMutation = useMutation({
    mutationFn: async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar localização');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  const updateRoutePointMutation = useMutation({
    mutationFn: async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar ponto da rota');
      return response.json();
    },
  });

  return {
    getTruckByPlate,
    updateTruckLocation: updateTruckLocationMutation.mutateAsync,
    updateRoutePoint: updateRoutePointMutation.mutateAsync,
    isUpdatingLocation: updateTruckLocationMutation.isPending,
    isUpdatingRoute: updateRoutePointMutation.isPending,
  };
};
