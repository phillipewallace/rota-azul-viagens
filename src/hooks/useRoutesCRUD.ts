
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '@/services/config';
import { Route } from './useRoutes';

export const useRoutesCRUD = () => {
  const queryClient = useQueryClient();

  const updateRoute = useMutation({
    mutationFn: async ({ id, route }: { id: string; route: Partial<Route> }) => {
      console.log(`🔄 [ROUTES CRUD] Atualizando rota ${id}:`, route);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar rota');
      }

      const result = await response.json();
      console.log(`✅ [ROUTES CRUD] Rota atualizada com sucesso`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir rota');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  const resetRoute = useMutation({
    mutationFn: async (id: string) => {
      console.log(`🔄 [ROUTES CRUD] Resetando rota ${id}`);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/routes/${id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ [ROUTES CRUD] Erro ao resetar rota:`, errorData);
        throw new Error(errorData.error || 'Erro ao resetar rota');
      }

      const result = await response.json();
      console.log(`✅ [ROUTES CRUD] Rota resetada:`, result);
      return result;
    },
    onSuccess: (data) => {
      console.log(`✅ [ROUTES CRUD] Invalidando queries após reset`);
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
    },
  });

  return {
    updateRoute: updateRoute.mutateAsync,
    deleteRoute: deleteRoute.mutateAsync,
    resetRoute: resetRoute.mutateAsync,
    isLoading: updateRoute.isPending || deleteRoute.isPending || resetRoute.isPending,
  };
};
