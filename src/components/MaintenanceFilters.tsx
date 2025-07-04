
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Filter, RefreshCw, Plus } from 'lucide-react';

interface MaintenanceFiltersProps {
  startDate: string;
  endDate: string;
  selectedTruck: string;
  selectedStatus: string;
  selectedType: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onTruckChange: (truckId: string) => void;
  onStatusChange: (status: string) => void;
  onTypeChange: (type: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onNewMaintenance: () => void;
  trucks: Array<{ id: string; name: string; plate: string }>;
}

export const MaintenanceFilters: React.FC<MaintenanceFiltersProps> = ({
  startDate,
  endDate,
  selectedTruck,
  selectedStatus,
  selectedType,
  onStartDateChange,
  onEndDateChange,
  onTruckChange,
  onStatusChange,
  onTypeChange,
  onApplyFilters,
  onResetFilters,
  onNewMaintenance,
  trucks
}) => {
  const maintenanceTypes = [
    { value: 'preventiva', label: 'Preventiva' },
    { value: 'corretiva', label: 'Corretiva' },
    { value: 'preditiva', label: 'Preditiva' },
    { value: 'revisao', label: 'Revisão' },
    { value: 'inspecao', label: 'Inspeção' }
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pendente' },
    { value: 'in_progress', label: 'Em Andamento' },
    { value: 'completed', label: 'Concluída' }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Manutenção
          </CardTitle>
          <Button onClick={onNewMaintenance}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Manutenção
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Data Inicial</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="end-date">Data Final</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Caminhão</Label>
            <Select value={selectedTruck} onValueChange={onTruckChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os caminhões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os caminhões</SelectItem>
                {trucks.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    {truck.name} - {truck.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={selectedStatus} onValueChange={onStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={selectedType} onValueChange={onTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {maintenanceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onApplyFilters} className="flex-1">
            <Filter className="h-4 w-4 mr-2" />
            Aplicar Filtros
          </Button>
          <Button variant="outline" onClick={onResetFilters}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
