
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle, Clock, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useMobile, TruckMobileData, RoutePoint } from '@/hooks/useMobile';
import { useGeolocation } from '@/hooks/useGeolocation';
import MobileRouteMap from '@/components/MobileRouteMap';

interface MobileRouteProps {
  truckData: TruckMobileData;
  onFinishRoute: () => void;
}

const MobileRoute: React.FC<MobileRouteProps> = ({ truckData, onFinishRoute }) => {
  const { updateTruckLocation, updateRoutePoint, finishRoute, isUpdatingRoute } = useMobile();
  const { position, getCurrentPosition, watchPosition, clearWatch } = useGeolocation();
  const [watchId, setWatchId] = useState<string | null>(null);

  useEffect(() => {
    // Iniciar rastreamento de localização
    const id = watchPosition((newPosition) => {
      if (truckData.id && newPosition) {
        updateTruckLocation({
          truckId: truckData.id,
          lat: newPosition.lat,
          lng: newPosition.lng
        }).catch(err => console.error('Erro ao atualizar localização:', err));
      }
    });

    setWatchId(id);

    return () => {
      if (id) {
        clearWatch(id);
      }
    };
  }, [truckData.id]);

  const handlePointComplete = async (point: RoutePoint) => {
    try {
      if (!truckData.currentRoute) return;
      
      await updateRoutePoint({
        truckId: truckData.id,
        pointId: point.id,
        completed: !point.completed
      });
      
      toast.success(
        point.completed 
          ? 'Ponto desmarcado como concluído' 
          : 'Ponto marcado como concluído!'
      );
    } catch (error) {
      toast.error('Erro ao atualizar ponto da rota');
      console.error('Erro:', error);
    }
  };

  const handleFinishRoute = async () => {
    try {
      await finishRoute(truckData.id);
      toast.success('Rota finalizada com sucesso!');
      onFinishRoute();
    } catch (error) {
      toast.error('Erro ao finalizar rota');
      console.error('Erro:', error);
    }
  };

  const allPointsCompleted = truckData.currentRoute?.points.every(p => p.completed) || false;
  const completedCount = truckData.currentRoute?.points.filter(p => p.completed).length || 0;
  const totalPoints = truckData.currentRoute?.points.length || 0;

  if (!truckData.currentRoute) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma rota ativa</h3>
            <p className="text-gray-600">Você não possui uma rota atribuída no momento.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Header com informações da rota */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              {truckData.currentRoute.name}
            </span>
            <Badge variant={allPointsCompleted ? "default" : "secondary"}>
              {completedCount}/{totalPoints}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            {truckData.currentRoute.description || 'Rota de entrega'}
          </p>
          
          {/* Progresso */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalPoints) * 100}%` }}
            />
          </div>

          {/* Mapa da rota */}
          <MobileRouteMap route={truckData.currentRoute} />
        </CardContent>
      </Card>

      {/* Lista de pontos */}
      <div className="space-y-3">
        {truckData.currentRoute.points
          .sort((a, b) => a.order - b.order)
          .map((point, index) => (
            <Card key={point.id} className={point.completed ? 'bg-green-50 border-green-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                        {index + 1}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {point.type === 'origin' ? 'Origem' : 
                         point.type === 'destination' ? 'Destino' : 'Parada'}
                      </span>
                    </div>
                    <p className="font-medium mb-1">{point.address}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                    </div>
                  </div>
                  
                  <Button
                    variant={point.completed ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePointComplete(point)}
                    disabled={isUpdatingRoute}
                    className="ml-2"
                  >
                    {point.completed ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Concluído
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-1" />
                        Marcar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
        ))}
      </div>

      {/* Botão finalizar rota */}
      {allPointsCompleted && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold text-green-800 mb-2">Todos os pontos concluídos!</h3>
            <p className="text-sm text-green-700 mb-4">
              Você pode finalizar a rota agora.
            </p>
            <Button 
              onClick={handleFinishRoute}
              className="w-full"
              disabled={isUpdatingRoute}
            >
              {isUpdatingRoute ? 'Finalizando...' : 'Finalizar Rota'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Informações de localização */}
      {position && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>
                Localização atual: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
              </span>
              {position.accuracy && (
                <span className="text-xs">
                  (±{Math.round(position.accuracy)}m)
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileRoute;
