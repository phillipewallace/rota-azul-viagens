
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoutes } from '@/hooks/useRoutes';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';

interface LinkRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  truck: {
    id: string;
    name: string;
    plate: string;
  } | null;
  onSuccess: () => void;
}

const LinkRouteModal: React.FC<LinkRouteModalProps> = ({ isOpen, onClose, truck, onSuccess }) => {
  const { routes } = useRoutes();
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRouteId || !truck) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/trucks/${truck.id}/link-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ routeId: selectedRouteId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // ✅ NOVA TRATATIVA: Erro específico para rota já vinculada
        if (errorData.code === 'ROUTE_ALREADY_LINKED') {
          toast.error(
            `${errorData.error}\n\nRota já está sendo usada por: ${errorData.linkedTruck.name} (${errorData.linkedTruck.plate})`,
            {
              duration: 5000,
              action: {
                label: 'Entendi',
                onClick: () => {},
              },
            }
          );
          return;
        }
        
        throw new Error(errorData.error || 'Erro ao vincular rota');
      }

      const data = await response.json();
      toast.success(`Rota "${data.routeName}" vinculada ao caminhão "${data.truckName}" com sucesso!`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao vincular rota:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao vincular rota');
    } finally {
      setLoading(false);
    }
  };

  const availableRoutes = routes.filter(route => route.status === 'active');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Vincular Rota ao Caminhão</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Caminhão: <span className="font-semibold">{truck?.name} ({truck?.plate})</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Selecionar Rota:</label>
            <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma rota" />
              </SelectTrigger>
              <SelectContent>
                {availableRoutes.map(route => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.name} ({route.points.length} pontos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedRouteId || loading}
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
