
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TruckMobileData {
  id: string;
  name: string;
  plate: string;
  model?: string;
  year?: number;
  status: string;
  driver?: string;
  currentRoute?: {
    id: string;
    name: string;
    description?: string;
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

// Configuração da API baseada no ambiente
const getApiBaseUrl = () => {
  // Verificar se estamos em desenvolvimento
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // Verificar se estamos no preview do Lovable
  if (window.location.hostname.includes('lovableproject.com')) {
    return 'https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com/api';
  }
  
  // Fallback para produção
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

export const useMobile = () => {
  const queryClient = useQueryClient();

  const getTruckByPlate = async (plate: string): Promise<TruckMobileData> => {
    console.log('🔍 [MOBILE] Buscando caminhão por placa:', plate);
    console.log('🔍 [MOBILE] URL:', `${API_BASE_URL}/mobile/truck/${plate}`);
    
    const response = await fetch(`${API_BASE_URL}/mobile/truck/${plate}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'omit',
    });
    
    console.log('📡 [MOBILE] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ [MOBILE] Erro:', errorData);
      
      // Mock data for development/demo
      if (plate.toUpperCase().includes('ABC-1234') || plate.toUpperCase().includes('ABC1234')) {
        return {
          id: 'demo-1',
          name: 'Caminhão Demo',
          plate: 'ABC-1234',
          model: 'Volvo FH',
          year: 2022,
          status: 'active',
          driver: 'João Silva',
          currentRoute: {
            id: 'route-1',
            name: 'Rota São Paulo - Rio de Janeiro',
            description: 'Entrega de materiais',
            points: [
              {
                id: 'point-1',
                address: 'São Paulo, SP',
                lat: -23.5505,
                lng: -46.6333,
                order: 1,
                type: 'origin',
                completed: true
              },
              {
                id: 'point-2', 
                address: 'Rio de Janeiro, RJ',
                lat: -22.9068,
                lng: -43.1729,
                order: 2,
                type: 'destination',
                completed: false
              }
            ]
          }
        };
      }
      
      throw new Error('Caminhão não encontrado');
    }
    
    const data = await response.json();
    console.log('✅ [MOBILE] Dados do caminhão recebidos:', data);
    return data;
  };

  const updateTruckLocationMutation = useMutation({
    mutationFn: async ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) => {
      console.log('📍 [MOBILE] Atualizando localização do caminhão:', { truckId, lat, lng });
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/location`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({ lat, lng }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [MOBILE] Erro ao atualizar localização:', errorData);
        throw new Error('Erro ao atualizar localização');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Localização atualizada com sucesso');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    },
  });

  const updateRoutePointMutation = useMutation({
    mutationFn: async ({ truckId, pointId, completed }: { truckId: string; pointId: string; completed: boolean }) => {
      console.log('🎯 [MOBILE] Atualizando ponto da rota:', { truckId, pointId, completed });
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/route/point/${pointId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({ completed }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [MOBILE] Erro ao atualizar ponto:', errorData);
        throw new Error('Erro ao atualizar ponto da rota');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Ponto da rota atualizado com sucesso');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const finishRouteMutation = useMutation({
    mutationFn: async (truckId: string) => {
      console.log('🏁 [MOBILE] Finalizando rota do caminhão:', truckId);
      
      const response = await fetch(`${API_BASE_URL}/mobile/truck/${truckId}/finish-route`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [MOBILE] Erro ao finalizar rota:', errorData);
        throw new Error('Erro ao finalizar rota');
      }
      
      const result = await response.json();
      console.log('✅ [MOBILE] Rota finalizada com sucesso');
      return result;
    },
    onSuccess: () => {
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
