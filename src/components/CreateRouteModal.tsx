
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRoutes, RoutePoint } from "@/hooks/useRoutes";
import { Plus, X, MapPin } from "lucide-react";
import { RoutePreviewModal } from './RoutePreviewModal';

interface CreateRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRoute?: any;
  onSuccess?: () => void;
}

const CreateRouteModal = ({ open, onOpenChange, editingRoute, onSuccess }: CreateRouteModalProps) => {
  const { toast } = useToast();
  const { createRoute, updateRoute, getAddressByCep, optimizeRoute } = useRoutes();
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  
  const [points, setPoints] = useState<RoutePoint[]>([]);
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
        setPoints(editingRoute.points || getInitialPoints());
      } else {
        setFormData({ name: '', description: '' });
        setPoints(getInitialPoints());
      }
      setShowPreview(false);
      setPreviewData(null);
    } else {
      // Clear form when closing
      setFormData({ name: '', description: '' });
      setPoints(getInitialPoints());
      setShowPreview(false);
      setPreviewData(null);
    }
  }, [open, editingRoute]);

  const getInitialPoints = (): RoutePoint[] => [
    { id: '1', address: '', cep: '', lat: 0, lng: 0, order: 1, type: 'origin' as const },
    { id: '2', address: '', cep: '', lat: 0, lng: 0, order: 2, type: 'destination' as const }
  ];

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
      console.error('Error optimizing route:', error);
      toast({
        title: "Erro ao otimizar rota",
        description: "Tente novamente ou verifique os dados inseridos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoute = async () => {
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
        polyline: previewData.polyline,
        status: 'active' as const
      };

      if (editingRoute) {
        await updateRoute(editingRoute.id, routeData);
        toast({
          title: "Rota atualizada com sucesso!",
          description: `A rota ${previewData.name} foi otimizada e atualizada.`,
        });
      } else {
        await createRoute(routeData);
        toast({
          title: "Rota criada com sucesso!",
          description: `A rota ${previewData.name} foi otimizada e está pronta para uso.`,
        });
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving route:', error);
      toast({
        title: `Erro ao ${editingRoute ? 'atualizar' : 'criar'} rota`,
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

  return (
    <>
      <Dialog open={open && !showPreview} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? 'Editar Rota' : 'Criar Nova Rota'}
            </DialogTitle>
            <DialogDescription>
              {editingRoute ? 'Edite os dados da rota e otimize novamente se necessário.' : 'Crie uma nova rota otimizada inserindo os pontos de parada.'}
            </DialogDescription>
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

      {previewData && (
        <RoutePreviewModal
          open={showPreview}
          onOpenChange={(open) => {
            if (!open) {
              setShowPreview(false);
              setPreviewData(null);
            }
          }}
          previewData={previewData}
          onSave={handleSaveRoute}
          onBack={() => setShowPreview(false)}
          loading={loading}
          isEditing={!!editingRoute}
        />
      )}
    </>
  );
};

export default CreateRouteModal;
