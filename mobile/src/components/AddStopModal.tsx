import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { sharedLocationStore } from '@/store/sharedLocationStore';

interface AddStopModalProps {
  points: Array<{ id: string; name?: string; address: string }>;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    stopType: string;
    location: string;
    insertBeforeId?: string;
  }) => void;
}

const AddStopModal: React.FC<AddStopModalProps> = ({ points, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [stopType, setStopType] = useState('Entrega');
  const [location, setLocation] = useState('');
  const [insertPosition, setInsertPosition] = useState<string>('end');

  // Pré-preencher com localização compartilhada, se houver
  useEffect(() => {
    const sharedState = sharedLocationStore.getState();
    if (sharedState.sharedContent) {
      console.log('📍 [ADD STOP MODAL] Preenchendo com localização compartilhada');
      setLocation(sharedState.sharedContent);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor, preencha o nome do cliente/ponto');
      return;
    }

    if (!location.trim()) {
      alert('Por favor, preencha o endereço ou localização');
      return;
    }

    const data = {
      name: name.trim(),
      stopType,
      location: location.trim(),
      insertBeforeId: insertPosition !== 'end' ? insertPosition : undefined
    };

    onAdd(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Adicionar Parada Extra</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <Label htmlFor="name">Nome do cliente/ponto *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                required
              />
            </div>

            {/* Tipo de Parada */}
            <div>
              <Label htmlFor="stopType">Tipo de parada</Label>
              <select
                id="stopType"
                value={stopType}
                onChange={(e) => setStopType(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="Coleta">Coleta</option>
                <option value="Serviço">Serviço</option>
                <option value="Entrega">Entrega</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Localização */}
            <div>
              <Label htmlFor="location">Endereço ou link de localização *</Label>
              <textarea
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Cole aqui o endereço ou link do Google Maps"
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Você pode colar links do Google Maps, WhatsApp ou digitar o endereço
              </p>
            </div>

            {/* Posição na Rota */}
            <div>
              <Label>Posição na rota</Label>
              <div className="space-y-2 mt-2">
                {points.map((point, index) => (
                  <label
                    key={point.id}
                    className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="position"
                      value={point.id}
                      checked={insertPosition === point.id}
                      onChange={(e) => setInsertPosition(e.target.value)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      Antes da parada {index + 1} - {point.name || point.address.substring(0, 40)}...
                    </span>
                  </label>
                ))}
                
                <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="position"
                    value="end"
                    checked={insertPosition === 'end'}
                    onChange={(e) => setInsertPosition(e.target.value)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">No final da rota (padrão)</span>
                </label>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Adicionar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddStopModal;
