
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoutes, Route } from './useRoutes';

export const useRoutesCRUD = () => {
  const queryClient = useQueryClient();
  const { createRoute: createRouteService, updateRoute: updateRouteService, deleteRoute: deleteRouteService } = useRoutes();

  const createMutation = useMutation({
    mutationFn: async (route: Omit<Route, 'id' | 'createdAt'>) => {
      return await createRouteService(route);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, route }: { id: string; route: Partial<Route> }) => {
      return await updateRouteService(id, route);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteRouteService(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  return {
    createRoute: createMutation.mutateAsync,
    updateRoute: updateMutation.mutateAsync,
    deleteRoute: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
