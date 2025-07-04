
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoutes, Route } from './useRoutes';

export const useRoutesCRUD = () => {
  const queryClient = useQueryClient();
  const { createRoute: createRouteService, updateRoute: updateRouteService, deleteRoute: deleteRouteService } = useRoutes();

  const createMutation = useMutation({
    mutationFn: async (route: Omit<Route, 'id' | 'createdAt'>) => {
      console.log('Creating route:', route);
      return await createRouteService(route);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error) => {
      console.error('Error creating route:', error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, route }: { id: string; route: Partial<Route> }) => {
      console.log('Updating route with ID:', id, 'Data:', route);
      
      // Verificar se estamos tentando criar uma nova rota sem ID
      if (!id || id === 'undefined' || id === 'null' || typeof id !== 'string' || id.trim() === '') {
        console.log('No valid ID provided, creating new route instead');
        return await createRouteService(route as Omit<Route, 'id' | 'createdAt'>);
      }
      
      return await updateRouteService(id, route);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error) => {
      console.error('Error updating route:', error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting route with ID:', id);
      
      if (!id || id === 'undefined' || id === 'null' || typeof id !== 'string' || id.trim() === '') {
        throw new Error('ID da rota é obrigatório para exclusão');
      }
      
      return await deleteRouteService(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error) => {
      console.error('Error deleting route:', error);
    }
  });

  return {
    createRoute: createMutation.mutateAsync,
    updateRoute: updateMutation.mutateAsync,
    deleteRoute: deleteMutation.mutateAsync,
    isLoading: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
