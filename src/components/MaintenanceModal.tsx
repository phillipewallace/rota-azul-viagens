
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface MaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MaintenanceModal = ({ open, onOpenChange }: MaintenanceModalProps) => {
  const { toast } = useToast();
  const [selectedTruck, setSelectedTruck] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  const trucks = [
    { id: '1', name: 'Caminhão 001', status: 'Ativo', km: '85.240', lastMaintenance: '2024-05-15' },
    { id: '2', name: 'Caminhão 002', status: 'Em manutenção', km: '92.180', lastMaintenance: '2024-04-20' },
    { id: '3', name: 'Caminhão 003', status: 'Ativo', km: '67.890', lastMaintenance: '2024-06-01' }
  ];

  const maintenanceTypes = [
    'Revisão Preventiva',
    'Troca de Óleo',
    'Revisão dos Freios',
    'Manutenção do Motor',
    'Revisão da Suspensão',
    'Manutenção Corretiva',
    'Inspeção Geral'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck || !maintenanceType) return;

    const truck = trucks.find(t => t.id === selectedTruck);
    
    toast({
      title: "Manutenção agendada com sucesso!",
      description: `${maintenanceType} agendada para ${truck?.name} em ${new Date(scheduledDate).toLocaleDateString('pt-BR')}.`,
    });

    setSelectedTruck('');
    setMaintenanceType('');
    setDescription('');
    setScheduledDate('');
    onOpenChange(false);
  };

  const selectedTruckData = trucks.find(t => t.id === selectedTruck);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Manutenção por Caminhão</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
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
                      <Badge variant={truck.status === 'Ativo' ? 'default' : 'destructive'}>
                        {truck.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTruckData && (
            <Card className="p-4 bg-gray-50">
              <h3 className="font-semibold mb-2">Informações do Veículo</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Quilometragem:</span>
                  <p className="font-medium">{selectedTruckData.km} km</p>
                </div>
                <div>
                  <span className="text-gray-600">Última Manutenção:</span>
                  <p className="font-medium">{new Date(selectedTruckData.lastMaintenance).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="maintenanceType">Tipo de Manutenção</Label>
              <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o tipo de manutenção" />
                </SelectTrigger>
                <SelectContent>
                  {maintenanceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="scheduledDate">Data Agendada</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição da Manutenção</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva os serviços a serem realizados..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!selectedTruck || !maintenanceType}>
                Agendar Manutenção
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaintenanceModal;
