
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRoutes, RoutePoint } from "@/hooks/useRoutes";
import { Plus, X, MapPin } from "lucide-react";

interface CreateRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRoute?: any;
}

const CreateRouteModal = ({ open, onOpenChange, editingRoute }: CreateRouteModalProps) => {
  const { toast } = useToast();
  const { createRoute, getAddressByCep, optimizeRoute } = useRoutes();
  
  // Estado inicial
  const getInitialFormData = () => ({
    name: editingRoute?.name || '',
    description: editingRoute?.description || ''
  });

  const getInitialPoints = () => {
    if (editingRoute?.points && editingRoute.points.length > 0) {
      return editingRoute.points.map((point: any, index: number) => ({
        ...point,
        id: point.id || (index + 1).toString(),
        order: index + 1
      }));
    }
    return [
      { id: '1', address: '', cep: '', lat: 0, lng: 0, order: 1, type: 'origin' as const },
      { id: '2', address: '', cep: '', lat: 0, lng: 0, order: 2, type: 'destination' as const }
    ];
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [points, setPoints] = useState<RoutePoint[]>(getInitialPoints);
  const [loading, setLoading] = useState(false);

  // Limpar/resetar formulário quando modal abrir/fechar
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
      setPoints(getInitialPoints());
    } else {
      // Limpar quando fechar
      setFormData({ name: '', description: '' });
      setPoints([
        { id: '1', address: '', cep: '', lat: 0, lng: 0, order: 1, type: 'origin' as const },
        { id: '2', address: '', cep: '', lat: 0, lng: 0, order: 2, type: 'destination' as const }
      ]);
    }
  }, [open, editingRoute]);

  const addWaypoint = () => {
    const newPoint: RoutePoint = {
      id: Date.now().toString(),
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: points.length,
      type: 'waypoint'
    };
    // Inserir antes do último ponto (destino)
    const newPoints = [...points];
    newPoints.splice(-1, 0, newPoint);
    // Reordenar
    const reorderedPoints = newPoints.map((p, index) => ({ ...p, order: index + 1 }));
    setPoints(reorderedPoints);
  };

  const removeWaypoint = (id: string) => {
    const pointToRemove = points.find(p => p.id === id);
    if (pointToRemove && (pointToRemove.type === 'origin' || pointToRemove.type === 'destination')) {
      toast({
        title: "Não é possível remover",
        description: "Não é possível remover o ponto de origem ou destino.",
        variant: "destructive"
      });
      return;
    }

    const filteredPoints = points.filter(p => p.id !== id);
    const reorderedPoints = filteredPoints.map((p, index) => ({ ...p, order: index + 1 }));
    setPoints(reorderedPoints);
  };

  const updatePoint = (id: string, field: keyof RoutePoint, value: any) => {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const searchAddressByCep = async (pointId: string, cep: string) => {
    if (cep.length !== 8) return;

    try {
      setLoading(true);
      const addressData = await getAddressByCep(cep);
      updatePoint(pointId, 'address', addressData.address);
      updatePoint(pointId, 'lat', addressData.lat);
      updatePoint(pointId, 'lng', addressData.lng);
      
      toast({
        title: "Endereço encontrado!",
        description: `Endereço: ${addressData.address}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar endereço",
        description: "Verifique se o CEP está correto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || points.some(p => !p.address)) {
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Otimiza a rota antes de criar/atualizar
      const optimizedData = await optimizeRoute(points);
      
      const routeData = {
        name: formData.name,
        description: formData.description,
        points: points,
        totalDistance: optimizedData.totalDistance,
        estimatedTime: optimizedData.estimatedTime,
        optimizedOrder: optimizedData.optimizedOrder,
        status: 'active' as const
      };

      await createRoute(routeData);
      
      toast({
        title: editingRoute ? "Rota atualizada com sucesso!" : "Rota criada com sucesso!",
        description: `A rota ${formData.name} foi ${editingRoute ? 'atualizada' : 'otimizada'} e está pronta para uso.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: editingRoute ? "Erro ao atualizar rota" : "Erro ao criar rota",
        description: "Tente novamente ou verifique os dados inseridos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const getPointLabel = (point: RoutePoint, index: number) => {
    if (point.type === 'origin') return 'Origem';
    if (point.type === 'destination') return 'Destino';
    return `Ponto ${index}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRoute ? 'Editar Rota Multi-pontos' : 'Criar Nova Rota Multi-pontos'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome da Rota *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Rota SP Multi-destinos"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Pontos da Rota</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWaypoint}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Ponto
              </Button>
            </div>

            {points.map((point, index) => (
              <div key={point.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{getPointLabel(point, index)}</span>
                  </div>
                  {point.type === 'waypoint' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWaypoint(point.id)}
                      className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`cep-${point.id}`}>CEP</Label>
                    <Input
                      id={`cep-${point.id}`}
                      value={point.cep}
                      onChange={(e) => {
                        const cep = e.target.value.replace(/\D/g, '');
                        updatePoint(point.id, 'cep', cep);
                        if (cep.length === 8) {
                          searchAddressByCep(point.id, cep);
                        }
                      }}
                      placeholder="12345678"
                      maxLength={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`address-${point.id}`}>Endereço</Label>
                    <Input
                      id={`address-${point.id}`}
                      value={point.address}
                      onChange={(e) => updatePoint(point.id, 'address', e.target.value)}
                      placeholder="Endereço será preenchido automaticamente"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processando...' : (editingRoute ? 'Atualizar Rota' : 'Criar e Otimizar Rota')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteModal;
