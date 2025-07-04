
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useRoutes } from '@/hooks/useRoutes';
import { useTrucks } from '@/hooks/useTrucks';
import { toast } from 'sonner';

interface LinkRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  truck?: any;
  onSuccess: () => void;
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

const LinkRouteModal: React.FC<LinkRouteModalProps> = ({
  open,
  onOpenChange,
  truck,
  onSuccess
}) => {
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const { routes } = useRoutes();
  const { trucks } = useTrucks();

  const availableRoutes = routes.filter(route => route.status === 'active');
  const availableTrucks = trucks.filter(truck => truck.status === 'available');

  const handleLinkRoute = async () => {
    const truckId = truck?.id || selectedTruckId;
    const routeId = selectedRouteId;

    if (!truckId || !routeId) {
      toast.error('Selecione um caminhão e uma rota');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/trucks/link-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ truckId, routeId }),
      });

      if (!response.ok) {
        throw new Error('Erro ao vincular rota');
      }

      toast.success('Rota vinculada com sucesso!');
      onSuccess();
      onOpenChange(false);
      setSelectedTruckId('');
      setSelectedRouteId('');
    } catch (error) {
      console.error('Error linking route:', error);
      toast.error('Erro ao vincular rota');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Rota ao Caminhão</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!truck && (
            <div>
              <label className="text-sm font-medium">Caminhão</label>
              <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um caminhão disponível" />
                </SelectTrigger>
                <SelectContent>
                  {availableTrucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.name} - {truck.plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {truck && (
            <div className="p-3 bg-gray-50 rounded border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{truck.name}</p>
                  <p className="text-sm text-gray-600">{truck.plate}</p>
                </div>
                <Badge variant="outline">
                  {truck.status === 'available' ? 'Disponível' : truck.status}
                </Badge>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Rota</label>
            <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma rota ativa" />
              </SelectTrigger>
              <SelectContent>
                {availableRoutes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    <div>
                      <div className="font-medium">{route.name}</div>
                      <div className="text-sm text-gray-500">
                        {route.points?.length || 0} pontos
                        {route.totalDistance && ` • ${route.totalDistance.toFixed(1)}km`}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleLinkRoute}
              disabled={loading || (!truck && !selectedTruckId) || !selectedRouteId}
            >
              {loading ? 'Vinculando...' : 'Vincular Rota'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkRouteModal;
