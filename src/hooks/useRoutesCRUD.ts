
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Route } from './useRoutes';

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useRoutesCRUD = () => {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ id, route }: { id: string; route: Partial<Route> }) => {
      const response = await fetch(`${API_BASE_URL}/routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      });
      if (!response.ok) throw new Error('Erro ao atualizar rota');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/routes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao excluir rota');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  return {
    updateRoute: updateMutation.mutateAsync,
    deleteRoute: deleteMutation.mutateAsync,
    isLoading: updateMutation.isPending || deleteMutation.isPending,
  };
};
