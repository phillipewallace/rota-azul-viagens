
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { Truck } from '@/hooks/useTrucks';

interface LinkRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  truck?: Truck | null;
  onSuccess?: () => void;
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const LinkRouteModal: React.FC<LinkRouteModalProps> = ({
  open,
  onOpenChange,
  truck,
  onSuccess
}) => {
  const { toast } = useToast();
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { trucks, loading: trucksLoading, refetch: refetchTrucks } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  // Reset form when modal opens/closes or truck changes
  useEffect(() => {
    if (open) {
      setSelectedTruck(truck?.id || '');
      setSelectedRoute('');
    } else {
      setSelectedTruck('');
      setSelectedRoute('');
    }
  }, [open, truck]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck || !selectedRoute) {
      toast({
        title: "Seleção incompleta",
        description: "Selecione um caminhão e uma rota.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/trucks/link-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          truckId: selectedTruck,
          routeId: selectedRoute,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao vincular rota');
      }

      const truckData = trucks?.find(t => t.id === selectedTruck);
      const routeData = routes?.find(r => r.id === selectedRoute);

      toast({
        title: "Rota vinculada com sucesso!",
        description: `${truckData?.name} foi vinculado à ${routeData?.name}. O veículo está pronto para iniciar a jornada.`,
      });

      // Refresh trucks data
      if (refetchTrucks) {
        await refetchTrucks();
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error linking route:', error);
      toast({
        title: "Erro ao vincular rota",
        description: error.message || "Tente novamente ou verifique se os dados estão corretos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const availableTrucks = trucks?.filter(truck => truck.status === 'available') || [];
  const activeRoutes = routes?.filter(route => route.status === 'active') || [];

  const formatDistance = (distance: any): string => {
    if (distance === null || distance === undefined) return '0';
    const numDistance = typeof distance === 'string' ? parseFloat(distance) : distance;
    return isNaN(numDistance) ? '0' : numDistance.toFixed(1);
  };

  const formatPointCount = (points: any): number => {
    if (!points) return 0;
    if (Array.isArray(points)) return points.length;
    if (typeof points === 'string') {
      try {
        const parsed = JSON.parse(points);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular Rota ao Caminhão</DialogTitle>
          <DialogDescription>
            Selecione um caminhão disponível e uma rota ativa para criar a vinculação.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="truck">Selecionar Caminhão</Label>
            <Select value={selectedTruck} onValueChange={setSelectedTruck} disabled={trucksLoading || isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={trucksLoading ? "Carregando..." : "Escolha um caminhão"} />
              </SelectTrigger>
              <SelectContent>
                {availableTrucks.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{truck.name} - {truck.plate}</span>
                      <span className="ml-2 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                        Disponível
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableTrucks.length === 0 && !trucksLoading && (
              <p className="text-sm text-gray-500 mt-1">Nenhum caminhão disponível</p>
            )}
          </div>

          <div>
            <Label htmlFor="route">Selecionar Rota</Label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute} disabled={routesLoading || isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={routesLoading ? "Carregando..." : "Escolha uma rota"} />
              </SelectTrigger>
              <SelectContent>
                {activeRoutes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{route.name}</span>
                      <span className="text-sm text-gray-500">
                        {formatPointCount(route.points)} pontos • {formatDistance(route.totalDistance)}km
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeRoutes.length === 0 && !routesLoading && (
              <p className="text-sm text-gray-500 mt-1">Nenhuma rota ativa disponível</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedTruck || !selectedRoute || isLoading}>
              {isLoading ? 'Vinculando...' : 'Vincular Rota'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LinkRouteModal;
