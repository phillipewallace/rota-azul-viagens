import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, CheckCircle2, Clock } from 'lucide-react';

interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  completed: boolean;
  name?: string;
}

interface RouteExecutionCardProps {
  points: RoutePoint[];
  onPointComplete: (pointId: string, completed: boolean) => Promise<void>;
  onFinishRoute: () => Promise<void>;
}

const RouteExecutionCard: React.FC<RouteExecutionCardProps> = ({
  points,
  onPointComplete,
  onFinishRoute
}) => {
  const [routeStarted, setRouteStarted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Encontrar próximo ponto não concluído
  const nextPoint = points.find(p => !p.completed);
  const allCompleted = points.every(p => p.completed);

  const handleStartRoute = () => {
    setRouteStarted(true);
  };

  const handleCompletePoint = async (pointId: string) => {
    setLoading(true);
    try {
      await onPointComplete(pointId, true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const handleFinishRoute = async () => {
    const confirm = window.confirm('Deseja finalizar a rota?');
    if (!confirm) return;

    setLoading(true);
    try {
      await onFinishRoute();
      setRouteStarted(false);
    } finally {
      setLoading(false);
    }
  };

  if (!routeStarted) {
    return (
      <Card>
        <CardContent className="p-4">
          <Button
            onClick={handleStartRoute}
            className="w-full gap-2"
            size="lg"
          >
            <Clock className="h-5 w-5" />
            Iniciar Rota
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (allCompleted) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-2">
            Todas as paradas concluídas!
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Você completou todas as paradas da rota
          </p>
          <Button
            onClick={handleFinishRoute}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Finalizando...' : 'Finalizar Rota'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!nextPoint) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span className="font-semibold">
              Próxima Parada ({points.indexOf(nextPoint) + 1}/{points.length})
            </span>
          </div>
          
          {nextPoint.name && (
            <p className="font-medium text-gray-900 mb-1">
              {nextPoint.name}
            </p>
          )}
          
          <p className="text-sm text-gray-600">
            {nextPoint.address}
          </p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => handleOpenInMaps(nextPoint.lat, nextPoint.lng)}
            variant="outline"
            className="w-full gap-2"
          >
            <Navigation className="h-4 w-4" />
            Abrir no Google Maps
          </Button>

          <Button
            onClick={() => handleCompletePoint(nextPoint.id)}
            disabled={loading}
            className="w-full gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? 'Marcando...' : 'Marcar como Concluída'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteExecutionCard;
