
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
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  
  const [points, setPoints] = useState<RoutePoint[]>([
    { id: '1', address: '', cep: '', lat: 0, lng: 0, order: 1, type: 'origin' as const },
    { id: '2', address: '', cep: '', lat: 0, lng: 0, order: 2, type: 'destination' as const }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (editingRoute) {
        setFormData({
          name: editingRoute.name || '',
          description: editingRoute.description || ''
        });
        setPoints(editingRoute.points || [
          { id: '1', address: '', cep: '', lat: 0, lng: 0, order: 1, type: 'origin' as const },
          { id: '2', address: '', cep: '', lat: 0, lng: 0, order: 2, type: 'destination' as const }
        ]);
      } else {
        setFormData({ name: '', description: '' });
        setPoints([
          { id: '1', address: '', cep: '', lat: 0, lng: 0, order: 1, type: 'origin' as const },
          { id: '2', address: '', cep: '', lat: 0, lng: 0, order: 2, type: 'destination' as const }
        ]);
      }
      setShowPreview(false);
      setPreviewData(null);
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
    const newPoints = [...points];
    newPoints.splice(-1, 0, newPoint);
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

  const handleOptimizeAndPreview = async () => {
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
      const optimizedData = await optimizeRoute(points);
      setPreviewData({
        ...optimizedData,
        name: formData.name,
        description: formData.description,
        points: points
      });
      setShowPreview(true);
    } catch (error) {
      toast({
        title: "Erro ao otimizar rota",
        description: "Tente novamente ou verifique os dados inseridos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoute = async () => {
    if (!previewData) return;

    try {
      setLoading(true);
      
      const routeData = {
        name: previewData.name,
        description: previewData.description,
        points: previewData.points,
        totalDistance: previewData.totalDistance,
        estimatedTime: previewData.estimatedTime,
        optimizedOrder: previewData.optimizedOrder,
        status: 'active' as const
      };

      await createRoute(routeData);
      
      toast({
        title: "Rota criada com sucesso!",
        description: `A rota ${previewData.name} foi otimizada e está pronta para uso.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao criar rota",
        description: "Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPointLabel = (point: RoutePoint, index: number) => {
    if (point.type === 'origin') return 'Origem';
    if (point.type === 'destination') return 'Destino';
    return `Ponto ${index}`;
  };

  if (showPreview && previewData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia da Rota Otimizada</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-lg">{previewData.name}</h3>
                {previewData.description && (
                  <p className="text-gray-600">{previewData.description}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Distância Total</div>
                <div className="text-xl font-bold text-blue-600">{previewData.totalDistance.toFixed(2)} km</div>
                <div className="text-sm text-gray-600">Tempo Estimado</div>
                <div className="text-lg font-semibold text-green-600">{previewData.estimatedTime}</div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">Sequência Otimizada:</h4>
              <div className="space-y-2">
                {previewData.points
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((point: any, index: number) => (
                  <div key={point.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      point.type === 'origin' ? 'bg-green-500' :
                      point.type === 'destination' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{point.address}</p>
                      <p className="text-xs text-gray-600 capitalize">{point.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowPreview(false)}
              >
                Voltar para Edição
              </Button>
              <Button 
                onClick={handleCreateRoute}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Criando...' : 'Criar Rota'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRoute ? 'Editar Rota' : 'Criar Nova Rota'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
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
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleOptimizeAndPreview}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Otimizando...' : 'Otimizar e Visualizar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteModal;
