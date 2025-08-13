
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, CheckCircle2, Clock } from 'lucide-react';
import { useBackgroundTracking } from '@/hooks/useBackgroundTracking';

interface MobileRouteMapProps {
  truckData: {
    id: string;
    name: string;
    plate: string;
    currentRoute?: {
      id: string;
      name: string;
      points: Array<{
        id: string;
        address: string;
        lat: number;
        lng: number;
        order: number;
        type: 'origin' | 'destination' | 'waypoint';
        completed?: boolean;
        completedAt?: string;
      }>;
    };
  };
  onLocationUpdate?: (location: { lat: number; lng: number }) => void;
  onPointUpdate?: (pointId: string, completed: boolean) => void;
  onFinishRoute?: (routeId: string) => void;
}

const MobileRouteMap: React.FC<MobileRouteMapProps> = ({ 
  truckData, 
  onLocationUpdate, 
  onPointUpdate, 
  onFinishRoute 
}) => {
  const { trackingData, isTracking, loading, error, startTracking, stopTracking } = useBackgroundTracking(
    truckData?.id, 
    truckData?.currentRoute?.points || []
  );

  const [currentLocationIndex, setCurrentLocationIndex] = useState(0);

  // Calcular próximo ponto não completado
  const nextPoint = truckData?.currentRoute?.points
    ?.sort((a, b) => a.order - b.order)
    ?.find(point => !point.completed);

  const completedPoints = truckData?.currentRoute?.points?.filter(p => p.completed) || [];
  const totalPoints = truckData?.currentRoute?.points?.length || 0;

  const handleTogglePoint = (pointId: string, completed: boolean) => {
    if (onPointUpdate) {
      onPointUpdate(pointId, completed);
    }
  };

  const handleFinishRoute = () => {
    if (truckData?.currentRoute?.id && onFinishRoute) {
      onFinishRoute(truckData.currentRoute.id);
    }
  };

  // Auto-callback para atualização de localização
  useEffect(() => {
    if (trackingData?.currentLocation && onLocationUpdate) {
      onLocationUpdate({
        lat: trackingData.currentLocation.lat,
        lng: trackingData.currentLocation.lng
      });
    }
  }, [trackingData?.currentLocation, onLocationUpdate]);

  if (!truckData?.currentRoute) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhuma rota ativa</h3>
          <p className="text-gray-500">Aguardando rota ser atribuída pelo sistema</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status do Rastreamento */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="font-medium">
                {isTracking ? 'Rastreamento Ativo' : 'Rastreamento Inativo'}
              </span>
            </div>
            <Button
              size="sm"
              variant={isTracking ? "destructive" : "default"}
              onClick={isTracking ? stopTracking : startTracking}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : isTracking ? 'Parar' : 'Iniciar'}
            </Button>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Localização Atual */}
      {trackingData?.currentLocation && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Localização Atual</span>
            </div>
            <div className="text-sm text-gray-600">
              <p>Lat: {trackingData.currentLocation.lat.toFixed(6)}</p>
              <p>Lng: {trackingData.currentLocation.lng.toFixed(6)}</p>
              {trackingData.currentLocation.speed && (
                <p>Velocidade: {Math.round(trackingData.currentLocation.speed)} km/h</p>
              )}
              <p className="text-xs mt-1">
                Atualizado: {trackingData.currentLocation.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Próximo Destino */}
      {trackingData?.nextDestination && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-orange-500" />
              <span className="font-medium">Próximo Destino</span>
            </div>
            <div className="space-y-1">
              <p className="font-medium">{trackingData.nextDestination.address}</p>
              <div className="flex gap-4 text-sm text-gray-600">
                <span>📏 {trackingData.nextDestination.distance}</span>
                <span>⏱️ {trackingData.nextDestination.durationInTraffic}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progresso da Rota */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">Progresso da Rota</span>
            <Badge variant="secondary">
              {completedPoints.length}/{totalPoints}
            </Badge>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedPoints.length / totalPoints) * 100}%` }}
            />
          </div>

          {/* Lista de Pontos */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {truckData.currentRoute.points
              .sort((a, b) => a.order - b.order)
              .map((point, index) => (
                <div 
                  key={point.id} 
                  className={`flex items-center justify-between p-2 rounded border ${
                    point.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-medium w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium truncate">{point.address}</p>
                      {point.completedAt && (
                        <p className="text-xs text-gray-500">
                          Concluído: {new Date(point.completedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant={point.completed ? "secondary" : "default"}
                    onClick={() => handleTogglePoint(point.id, !point.completed)}
                    className="ml-2"
                  >
                    {point.completed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))
            }
          </div>

          {/* Botão Finalizar Rota */}
          {completedPoints.length === totalPoints && totalPoints > 0 && (
            <div className="mt-4">
              <Button 
                className="w-full" 
                onClick={handleFinishRoute}
                variant="default"
              >
                🏁 Finalizar Rota
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações da Rota Completa */}
      {trackingData?.route && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-2">Resumo da Rota</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Distância Total:</span>
                <p className="font-medium">{trackingData.route.totalDistance}</p>
              </div>
              <div>
                <span className="text-gray-600">Tempo no Trânsito:</span>
                <p className="font-medium">{trackingData.route.totalDurationInTraffic}</p>
              </div>
              <div>
                <span className="text-gray-600">Pontos Restantes:</span>
                <p className="font-medium">{trackingData.route.remainingPoints}</p>
              </div>
              <div>
                <span className="text-gray-600">Concluídos:</span>
                <p className="font-medium">{trackingData.route.completedPoints}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileRouteMap;
