
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  status: string;
  driver?: string;
  currentRoute?: {
    id: string;
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
    console.log('🔍 Buscando caminhão por placa:', plate);
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`);
    if (!response.ok) {
      throw new Error('Caminhão não encontrado');
    }
    const data = await response.json();
    console.log('✅ Dados do caminhão recebidos:', data);
    return data;
  };

  const updateTruckLocationMutation = useMutation({
    mutationFn: async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
      console.log('📍 Atualizando localização do caminhão:', { truckId, lat, lng });
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar localização');
      const result = await response.json();
      console.log('✅ Localização atualizada com sucesso');
      return result;
    },
    onSuccess: () => {
      // Invalidar queries relacionadas ao rastreamento
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    },
  });

  const updateRoutePointMutation = useMutation({
    mutationFn: async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
      console.log('🎯 Atualizando ponto da rota:', { truckId, pointId, completed });
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar ponto da rota');
      const result = await response.json();
      console.log('✅ Ponto da rota atualizado com sucesso');
      return result;
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const finishRouteMutation = useMutation({
    mutationFn: async (truckId: string) => {
      console.log('🏁 Finalizando rota do caminhão:', truckId);
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Erro ao finalizar rota');
      const result = await response.json();
      console.log('✅ Rota finalizada com sucesso');
      return result;
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    },
  });

  return {
    getTruckByPlate,
    updateTruckLocation: updateTruckLocationMutation.mutateAsync,
    updateRoutePoint: updateRoutePointMutation.mutateAsync,
    finishRoute: finishRouteMutation.mutateAsync,
    isUpdatingLocation: updateTruckLocationMutation.isPending,
    isUpdatingRoute: updateRoutePointMutation.isPending,
    isFinishingRoute: finishRouteMutation.isPending,
  };
};
