
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDrivers } from '@/hooks/useDrivers';
import { useRoutes } from '@/hooks/useRoutes';
import { Truck } from '@/hooks/useTrucks';

interface TruckFormProps {
  truck?: Truck;
  onSubmit: (data: Omit<Truck, 'id'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TruckForm: React.FC<TruckFormProps> = ({
  truck,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    name: truck?.name || '',
    plate: truck?.plate || '',
    model: truck?.model || '',
    year: truck?.year || new Date().getFullYear(),
    status: truck?.status || 'available',
    driver: truck?.driver || '',
    currentRoute: truck?.currentRoute || '',
    mileage: truck?.mileage || 0,
    lastMaintenance: truck?.lastMaintenance || ''
  });

  const { drivers } = useDrivers();
  const { routes } = useRoutes();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Nome do caminhão"
            required
          />
        </div>
        <div>
          <Label htmlFor="plate">Placa</Label>
          <Input
            id="plate"
            value={formData.plate}
            onChange={(e) => handleChange('plate', e.target.value.toUpperCase())}
            placeholder="ABC-1234"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="model">Modelo</Label>
          <Input
            id="model"
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder="Modelo do caminhão"
            required
          />
        </div>
        <div>
          <Label htmlFor="year">Ano</Label>
          <Input
            id="year"
            type="number"
            value={formData.year}
            onChange={(e) => handleChange('year', parseInt(e.target.value))}
            placeholder="2024"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="in-route">Em Rota</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="driver">Motorista</Label>
          <Select value={formData.driver} onValueChange={(value) => handleChange('driver', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o motorista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum motorista</SelectItem>
              {drivers?.map((driver) => (
                <SelectItem key={driver.id} value={driver.name}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="currentRoute">Rota Atual</Label>
          <Select value={formData.currentRoute} onValueChange={(value) => handleChange('currentRoute', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a rota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma rota</SelectItem>
              {routes?.map((route) => (
                <SelectItem key={route.id} value={route.name}>
                  {route.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="mileage">Quilometragem</Label>
          <Input
            id="mileage"
            type="number"
            value={formData.mileage}
            onChange={(e) => handleChange('mileage', parseInt(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="lastMaintenance">Última Manutenção</Label>
        <Input
          id="lastMaintenance"
          type="date"
          value={formData.lastMaintenance}
          onChange={(e) => handleChange('lastMaintenance', e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Salvando...' : truck ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
};
