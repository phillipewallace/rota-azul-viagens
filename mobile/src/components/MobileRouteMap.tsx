
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from 'lucide-react';

interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  type: 'origin' | 'destination' | 'stop';
  order: number;
  completed: boolean;
}

interface Route {
  id: string;
  name: string;
  description?: string;
  points: RoutePoint[];
}

interface MobileRouteMapProps {
  route: Route;
}

const MobileRouteMap: React.FC<MobileRouteMapProps> = ({ route }) => {
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">Mapa da Rota</h3>
        </div>
        
        <div className="bg-gray-100 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
          <div className="text-center text-gray-600">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Mapa será carregado aqui</p>
            <p className="text-xs mt-1">
              {route.points.length} pontos na rota
            </p>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500">
          <p>Rota: {route.name}</p>
          {route.description && (
            <p className="mt-1">{route.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MobileRouteMap;
