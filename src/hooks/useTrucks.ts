
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trucksService } from '@/services/trucks';
import { toast } from '@/hooks/use-toast';

export interface Truck {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: 'available' | 'in_transit' | 'maintenance';
  location?: {
    lat: number;
    lng: number;
    lastUpdate: string;
  };
  currentRoute?: {
    id: string;
    name: string;
  };
  driver?: {
    id: string;
    name: string;
  };
  lastMaintenance?: string;
  nextMaintenance?: string;
  fuelLevel?: number;
  mileage?: number;
}

export const useTrucks = () => {
  const queryClient = useQueryClient();

  // OTIMIZAÇÃO: Query com cache melhorado
  const {
    data: trucks = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['trucks'],
    queryFn: () => trucksService.getTrucks(),
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const createTruckMutation = useMutation({
    mutationFn: (truck: Omit<Truck, 'id'>) => trucksService.createTruck(truck),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      toast({
        title: "Sucesso",
        description: "Caminhão cadastrado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar caminhão. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateTruckMutation = useMutation({
    mutationFn: ({ id, truck }: { id: string; truck: Partial<Truck> }) => 
      trucksService.updateTruck(id, truck),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      toast({
        title: "Sucesso",
        description: "Caminhão atualizado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro", 
        description: "Erro ao atualizar caminhão. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ truckId, lat, lng }: { truckId: string; lat: number; lng: number }) =>
      trucksService.updateTruckLocation(truckId, lat, lng),
    onSuccess: () => {
      // OTIMIZAÇÃO: Invalidação específica apenas para tracking
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      queryClient.invalidateQueries({ queryKey: ['tracking'] });
    },
  });

  return {
    trucks,
    isLoading,
    error,
    refetch,
    createTruck: createTruckMutation.mutateAsync,
    updateTruck: updateTruckMutation.mutateAsync,
    updateLocation: updateLocationMutation.mutateAsync,
    isCreating: createTruckMutation.isPending,
    isUpdating: updateTruckMutation.isPending,
    isUpdatingLocation: updateLocationMutation.isPending,
  };
};

// OTIMIZAÇÃO: Hook específico para truck único
export const useTruck = (id: string) => {
  return useQuery({
    queryKey: ['truck', id],
    queryFn: () => trucksService.getTrucks().then(trucks => trucks.find(t => t.id === id)),
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
};
