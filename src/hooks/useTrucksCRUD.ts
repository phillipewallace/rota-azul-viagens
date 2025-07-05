
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck } from './useTrucks';

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useTrucksCRUD = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (truck: Omit<Truck, 'id'>) => {
      const response = await fetch(`${API_BASE_URL}/trucks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(truck),
      });
      if (!response.ok) throw new Error('Erro ao criar caminhão');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, truck }: { id: string; truck: Partial<Truck> }) => {
      const response = await fetch(`${API_BASE_URL}/trucks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(truck),
      });
      if (!response.ok) throw new Error('Erro ao atualizar caminhão');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/trucks/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao excluir caminhão');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  return {
    createTruck: createMutation.mutateAsync,
    updateTruck: updateMutation.mutateAsync,
    deleteTruck: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
