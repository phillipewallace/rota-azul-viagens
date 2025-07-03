
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';

interface LinkRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LinkRouteModal = ({ open, onOpenChange }: LinkRouteModalProps) => {
  const { toast } = useToast();
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck || !selectedRoute) return;

    setIsLoading(true);
    try {
      // Fazer a requisição para vincular rota ao caminhão
      const response = await fetch('http://localhost:3001/api/trucks/link-route', {
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
        throw new Error('Erro ao vincular rota');
      }

      const truck = trucks.find(t => t.id === selectedTruck);
      const route = routes.find(r => r.id === selectedRoute);

      toast({
        title: "Rota vinculada com sucesso!",
        description: `${truck?.name} foi vinculado à ${route?.name}. O veículo está pronto para iniciar a jornada.`,
      });

      setSelectedTruck('');
      setSelectedRoute('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao vincular rota",
        description: "Tente novamente ou verifique se os dados estão corretos.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const availableTrucks = trucks.filter(truck => truck.status === 'available');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular Rota ao Caminhão</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="truck">Selecionar Caminhão</Label>
            <Select value={selectedTruck} onValueChange={setSelectedTruck} disabled={trucksLoading}>
              <SelectTrigger>
                <SelectValue placeholder={trucksLoading ? "Carregando..." : "Escolha um caminhão"} />
              </SelectTrigger>
              <SelectContent>
                {availableTrucks.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{truck.name} - {truck.plate}</span>
                      <span className="ml-2 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                        {truck.status === 'available' ? 'Disponível' : truck.status}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="route">Selecionar Rota</Label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute} disabled={routesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={routesLoading ? "Carregando..." : "Escolha uma rota"} />
              </SelectTrigger>
              <SelectContent>
                {routes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{route.name}</span>
                      <span className="text-sm text-gray-500">
                        {route.points?.length || 0} pontos • {route.totalDistance?.toFixed(1)}km
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
