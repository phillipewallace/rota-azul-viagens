
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { routesService } from '@/services/routes';
import { Route } from '@/hooks/useRoutes';

export const useRoutesCRUD = () => {
  const queryClient = useQueryClient();

  const createRouteMutation = useMutation({
    mutationFn: (routeData: Omit<Route, 'id' | 'createdAt'>) => routesService.createRoute(routeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });

  const updateRouteMutation = useMutation({
    mutationFn: ({ id, route }: { id: string; route: Partial<Route> }) => 
      routesService.updateRoute(id, route),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (id: string) => routesService.deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });

  return {
    createRoute: createRouteMutation.mutateAsync,
    updateRoute: updateRouteMutation.mutateAsync,
    deleteRoute: deleteRouteMutation.mutateAsync,
    isLoading: createRouteMutation.isPending || updateRouteMutation.isPending || deleteRouteMutation.isPending
  };
};
