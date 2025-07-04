import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRoutes, RoutePoint } from '@/hooks/useRoutes';

interface CreateRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRoute?: any;
  onSuccess?: () => void;
}

const CreateRouteModal = ({ open, onOpenChange, editingRoute, onSuccess }: CreateRouteModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { createRoute, updateRoute, getAddressByCep } = useRoutes();

  useEffect(() => {
    if (editingRoute) {
      setName(editingRoute.name);
      setDescription(editingRoute.description || '');
      setPoints(editingRoute.points || []);
    } else {
      setName('');
      setDescription('');
      setPoints([]);
    }
  }, [editingRoute]);

  const addPoint = () => {
    const newPoint: RoutePoint = {
      id: Date.now().toString(),
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: points.length,
      type: points.length === 0 ? 'origin' : 'waypoint',
      pointType: 'entrega'
    };
    setPoints([...points, newPoint]);
  };

  const updatePoint = (index: number, field: string, value: any) => {
    const newPoints = [...points];
    newPoints[index][field] = value;
    setPoints(newPoints);
  };

  const removePoint = (index: number) => {
    if (points.length <= 2) {
      toast({
        title: 'Uma rota deve ter ao menos dois pontos',
        description: 'Não é possível remover mais pontos.',
        variant: 'destructive',
      });
      return;
    }
    const newPoints = [...points];
    newPoints.splice(index, 1);
    setPoints(newPoints);
  };

  const handleCepSearch = async (index: number) => {
    setLoading(true);
    try {
      const cep = points[index].cep;
      const addressData = await getAddressByCep(cep);

      if (addressData) {
        updatePoint(index, 'address', addressData.address);
        updatePoint(index, 'lat', addressData.lat);
        updatePoint(index, 'lng', addressData.lng);
      } else {
        toast({
          title: 'CEP não encontrado',
          description: 'Não foi possível encontrar o endereço para o CEP informado.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error searching CEP:', error);
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Ocorreu um erro ao buscar o endereço pelo CEP.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: 'Nome da rota é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (points.length < 2) {
      toast({
        title: 'Adicione ao menos dois pontos à rota',
        variant: 'destructive',
      });
      return;
    }

    const routeData = {
      name: name,
      description: description,
      points: points,
      totalDistance: 0,
      estimatedTime: '00:00',
      optimizedOrder: [],
      status: 'active'
    };

    try {
      if (editingRoute) {
        await updateRoute(editingRoute.id, routeData);
        toast({
          title: 'Rota atualizada com sucesso!',
        });
      } else {
        await createRoute(routeData);
        toast({
          title: 'Rota criada com sucesso!',
        });
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating/updating route:', error);
      toast({
        title: 'Erro ao criar/atualizar rota',
        description: 'Ocorreu um erro ao salvar a rota. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRoute ? 'Editar Rota' : 'Criar Nova Rota'}</DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para {editingRoute ? 'editar' : 'criar'} uma nova rota.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6">
          {/* Nome e Descrição */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome da Rota</Label>
              <Input
                id="name"
                placeholder="Ex: Rota Centro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Rota que passa pelo centro da cidade"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Pontos da Rota */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pontos da Rota</h3>
              <Button type="button" onClick={addPoint} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Ponto
              </Button>
            </div>

            {points.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum ponto adicionado. Clique em "Adicionar Ponto" para começar.
              </div>
            ) : (
              <div className="space-y-4">
                {points.map((point, index) => (
                  <Card key={point.id} className="p-4">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Ponto {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            point.type === 'origin' ? 'default' : 
                            point.type === 'destination' ? 'destructive' : 'secondary'
                          }>
                            {point.type === 'origin' ? 'Origem' :
                             point.type === 'destination' ? 'Destino' : 'Parada'}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePoint(index)}
                            disabled={points.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>CEP</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="00000-000"
                              value={point.cep}
                              onChange={(e) => updatePoint(index, 'cep', e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleCepSearch(index)}
                              disabled={loading || !point.cep}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <Label>Tipo</Label>
                          <Select
                            value={point.pointType || 'entrega'}
                            onValueChange={(value: 'limpeza' | 'entrega' | 'recolhimento') => 
                              updatePoint(index, 'pointType', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entrega">Entrega</SelectItem>
                              <SelectItem value="recolhimento">Recolhimento</SelectItem>
                              <SelectItem value="limpeza">Limpeza</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>Endereço</Label>
                        <Input
                          placeholder="Digite o endereço completo"
                          value={point.address}
                          onChange={(e) => updatePoint(index, 'address', e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {editingRoute ? 'Salvar Alterações' : 'Criar Rota'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteModal;
