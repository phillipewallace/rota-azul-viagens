
import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Truck {
  id: number;
  name: string;
  status: 'moving' | 'stopped';
  speed: number;
  route: string;
  eta: string;
}

const TrackingPanel = () => {
  const trucks: Truck[] = [
    { id: 1, name: 'Caminhão 001', status: 'moving', speed: 45, route: 'SP → RJ', eta: '14:30' },
    { id: 2, name: 'Caminhão 002', status: 'stopped', speed: 0, route: 'SP → MG', eta: '16:45' },
    { id: 3, name: 'Caminhão 003', status: 'moving', speed: 52, route: 'SP → PR', eta: '12:15' }
  ];

  return (
    <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <h2 className="font-semibold text-gray-800">Rastreamento em Tempo Real</h2>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {trucks.map((truck) => (
          <Card key={truck.id} className="p-3 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">{truck.name}</h3>
              <Badge 
                variant={truck.status === 'moving' ? 'default' : 'destructive'}
                className={truck.status === 'moving' ? 'bg-green-500' : 'bg-red-500'}
              >
                <div className={`w-2 h-2 rounded-full mr-1 ${truck.status === 'moving' ? 'bg-green-200' : 'bg-red-200'}`}></div>
                {truck.status === 'moving' ? 'Em movimento' : 'Parado'}
              </Badge>
            </div>
            
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Velocidade:</span>
                <span className="font-medium">{truck.speed} km/h</span>
              </div>
              <div className="flex justify-between">
                <span>Rota:</span>
                <span className="font-medium">{truck.route}</span>
              </div>
              <div className="flex justify-between">
                <span>ETA:</span>
                <span className="font-medium flex items-center gap-1">
                  <span>🕐</span> {truck.eta}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TrackingPanel;
