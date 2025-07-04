
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Driver } from './useDrivers';

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export interface DriverDependencies {
  trucks: Array<{ id: string; name: string; plate: string }>;
  tripsCount: number;
  canDelete: boolean;
}

export const useDriversCRUD = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (driver: Omit<Driver, 'id' | 'totalTrips' | 'truckCount'>) => {
      const response = await fetch(`${API_BASE_URL}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driver),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar motorista');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, driver }: { id: string; driver: Partial<Driver> }) => {
      const response = await fetch(`${API_BASE_URL}/drivers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driver),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar motorista');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const checkDependenciesMutation = useMutation({
    mutationFn: async (id: string): Promise<DriverDependencies> => {
      const response = await fetch(`${API_BASE_URL}/drivers/${id}/dependencies`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao verificar dependências');
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, force = false }: { id: string; force?: boolean }) => {
      const response = await fetch(`${API_BASE_URL}/drivers/${id}?force=${force}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir motorista');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  return {
    createDriver: createMutation.mutateAsync,
    updateDriver: updateMutation.mutateAsync,
    deleteDriver: deleteMutation.mutateAsync,
    checkDependencies: checkDependenciesMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || checkDependenciesMutation.isPending,
  };
};
