
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface LinkRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LinkRouteModal = ({ open, onOpenChange }: LinkRouteModalProps) => {
  const { toast } = useToast();
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');

  const trucks = [
    { id: '1', name: 'Caminhão 001', status: 'Disponível' },
    { id: '2', name: 'Caminhão 002', status: 'Em rota' },
    { id: '3', name: 'Caminhão 003', status: 'Disponível' },
    { id: '4', name: 'Caminhão 004', status: 'Manutenção' }
  ];

  const routes = [
    { id: '1', name: 'Rota SP-RJ', distance: '450 km', time: '6h 30min' },
    { id: '2', name: 'Rota SP-MG', distance: '320 km', time: '4h 45min' },
    { id: '3', name: 'Rota SP-PR', distance: '280 km', time: '4h 15min' },
    { id: '4', name: 'Rota RJ-ES', distance: '180 km', time: '2h 30min' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck || !selectedRoute) return;

    const truck = trucks.find(t => t.id === selectedTruck);
    const route = routes.find(r => r.id === selectedRoute);

    toast({
      title: "Rota vinculada com sucesso!",
      description: `${truck?.name} foi vinculado à ${route?.name}. O veículo está pronto para iniciar a jornada.`,
    });

    setSelectedTruck('');
    setSelectedRoute('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular Rota ao Caminhão</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="truck">Selecionar Caminhão</Label>
            <Select value={selectedTruck} onValueChange={setSelectedTruck}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um caminhão" />
              </SelectTrigger>
              <SelectContent>
                {trucks.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{truck.name}</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        truck.status === 'Disponível' ? 'bg-green-100 text-green-800' :
                        truck.status === 'Em rota' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {truck.status}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="route">Selecionar Rota</Label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma rota" />
              </SelectTrigger>
              <SelectContent>
                {routes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{route.name}</span>
                      <span className="text-sm text-gray-500">{route.distance} • {route.time}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedTruck || !selectedRoute}>
              Vincular Rota
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LinkRouteModal;
