
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, MapPin, Calculator, Clock, Route as RouteIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { geocodingService } from '@/services/geocoding';
import { googleMapsService } from '@/services/googleMaps';

interface RoutePoint {
  id: string;
  name: string;
  address: string;
  cep: string;
  lat: number;
  lng: number;
  type: 'origin' | 'destination' | 'waypoint';
  order: number;
}

interface CreateRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRouteCreated: (route: any) => void;
}

const CreateRouteModal = ({ open, onOpenChange, onRouteCreated }: CreateRouteModalProps) => {
  const [routeName, setRouteName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [newPointName, setNewPointName] = useState('');
  const [newPointCep, setNewPointCep] = useState('');
  const [newPointType, setNewPointType] = useState<'origin' | 'destination' | 'waypoint'>('waypoint');
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const { toast } = useToast();

  const addPoint = async () => {
    if (!newPointName.trim() || !newPointCep.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setIsAddingPoint(true);
    try {
      const geocodeResult = await geocodingService.getAddressByCep(newPointCep);
      
      const newPoint: RoutePoint = {
        id: Date.now().toString(),
        name: newPointName,
        address: geocodeResult.address,
        cep: geocodeResult.cep,
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        type: newPointType,
        order: points.length
      };

      setPoints(prev => [...prev, newPoint]);
      setNewPointName('');
      setNewPointCep('');
      toast({ title: 'Ponto adicionado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao buscar endereço', variant: 'destructive' });
    } finally {
      setIsAddingPoint(false);
    }
  };

  const removePoint = (id: string) => {
    setPoints(prev => prev.filter(p => p.id !== id));
    setOptimizationResult(null);
  };

  const optimizeRoute = async () => {
    if (points.length < 2) {
      toast({ title: 'Adicione pelo menos 2 pontos', variant: 'destructive' });
      return;
    }

    setIsOptimizing(true);
    try {
      const result = await googleMapsService.optimizeRoute(points);
      setOptimizationResult(result);
      toast({ title: 'Rota otimizada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao otimizar rota', variant: 'destructive' });
    } finally {
      setIsOptimizing(false);
    }
  };

  const createRoute = () => {
    if (!routeName.trim()) {
      toast({ title: 'Digite um nome para a rota', variant: 'destructive' });
      return;
    }

    if (points.length < 2) {
      toast({ title: 'Adicione pelo menos 2 pontos', variant: 'destructive' });
      return;
    }

    const route = {
      name: routeName,
      description,
      status,
      points: points,
      totalDistance: optimizationResult?.totalDistance || 0,
      estimatedTime: optimizationResult?.estimatedTime || '0h 0min',
      optimizedOrder: optimizationResult?.optimizedOrder || points.map(p => p.id),
      polyline: optimizationResult?.polyline || ''
    };

    onRouteCreated(route);
    resetForm();
  };

  const resetForm = () => {
    setRouteName('');
    setDescription('');
    setStatus('active');
    setPoints([]);
    setOptimizationResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RouteIcon className="w-5 h-5" />
            Nova Rota
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informações da Rota */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="routeName">Nome da Rota</Label>
              <Input
                id="routeName"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Ex: Rota Centro"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional da rota"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: 'active' | 'inactive') => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Adicionar Ponto */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4" />
                  <h4 className="font-medium">Adicionar Ponto</h4>
                </div>
                
                <div>
                  <Label>Nome do Local</Label>
                  <Input
                    value={newPointName}
                    onChange={(e) => setNewPointName(e.target.value)}
                    placeholder="Ex: Centro de Distribuição"
                  />
                </div>

                <div>
                  <Label>CEP</Label>
                  <Input
                    value={newPointCep}
                    onChange={(e) => setNewPointCep(e.target.value)}
                    placeholder="12345-678"
                  />
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select value={newPointType} onValueChange={(value: 'origin' | 'destination' | 'waypoint') => setNewPointType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="origin">Origem</SelectItem>
                      <SelectItem value="waypoint">Ponto Intermediário</SelectItem>
                      <SelectItem value="destination">Destino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={addPoint} disabled={isAddingPoint} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  {isAddingPoint ? 'Adicionando...' : 'Adicionar Ponto'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Pontos da Rota */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Pontos da Rota ({points.length})</h4>
              {points.length >= 2 && (
                <Button onClick={optimizeRoute} disabled={isOptimizing} variant="outline" size="sm">
                  <Calculator className="w-4 h-4 mr-2" />
                  {isOptimizing ? 'Otimizando...' : 'Otimizar'}
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {points.map((point, index) => (
                <Card key={point.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={point.type === 'origin' ? 'default' : point.type === 'destination' ? 'destructive' : 'secondary'}>
                            {point.type === 'origin' ? 'Origem' : point.type === 'destination' ? 'Destino' : 'Parada'}
                          </Badge>
                          <span className="text-sm text-gray-500">#{index + 1}</span>
                        </div>
                        <p className="font-medium text-sm">{point.name}</p>
                        <p className="text-xs text-gray-500">{point.address}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePoint(point.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {points.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum ponto adicionado</p>
                </div>
              )}
            </div>

            {/* Resultado da Otimização */}
            {optimizationResult && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4" />
                    <h4 className="font-medium">Rota Otimizada</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Distância Total:</span>
                      <span className="font-medium">{optimizationResult.totalDistance.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tempo Estimado:</span>
                      <span className="font-medium">{optimizationResult.estimatedTime}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={createRoute} disabled={points.length < 2}>
            <RouteIcon className="w-4 h-4 mr-2" />
            Criar Rota
          </Button>
          <Button variant="outline" onClick={resetForm}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteModal;
