
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { routesService } from '@/services/routes';

export interface Route {
  id: string;
  name: string;
  description?: string;
  points: any[];
  totalDistance?: number;
  estimatedTime?: string;
  status: 'active' | 'inactive' | 'completed';
  optimizedOrder?: string[];
  polyline?: string;
}

export const useRoutesCRUD = () => {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const createRouteMutation = useMutation({
    mutationFn: async (routeData: Omit<Route, 'id'>) => {
      return await routesService.createRoute(routeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, route }: { id: string; route: Partial<Route> }) => {
      return await routesService.updateRoute(id, route);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await routesService.deleteRoute(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    }
  });

  const createRoute = async (routeData: Omit<Route, 'id'>) => {
    setIsLoading(true);
    try {
      return await createRouteMutation.mutateAsync(routeData);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoute = async (id: string, routeData: Partial<Route>) => {
    setIsLoading(true);
    try {
      return await updateRouteMutation.mutateAsync({ id, route: routeData });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRoute = async (id: string) => {
    setIsLoading(true);
    try {
      return await deleteRouteMutation.mutateAsync(id);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createRoute,
    updateRoute,
    deleteRoute,
    isLoading
  };
};
