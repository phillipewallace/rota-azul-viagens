
import React, { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTrucks } from '@/hooks/useTrucks';

const TrackingPanel = () => {
  const { trucks, loading } = useTrucks();
  const [realTimeData, setRealTimeData] = useState<any[]>([]);

  useEffect(() => {
    // Simular dados em tempo real
    const interval = setInterval(() => {
      const updatedTrucks = trucks.map(truck => ({
        ...truck,
        speed: truck.status === 'in-route' ? Math.floor(Math.random() * 60) + 20 : 0,
        eta: truck.status === 'in-route' ? 
          new Date(Date.now() + Math.random() * 4 * 60 * 60 * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) :
          '--:--'
      }));
      setRealTimeData(updatedTrucks);
    }, 5000);

    return () => clearInterval(interval);
  }, [trucks]);

  const displayTrucks = realTimeData.length > 0 ? realTimeData : trucks;

  if (loading) {
    return (
      <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <h2 className="font-semibold text-gray-800">Rastreamento em Tempo Real</h2>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {displayTrucks.map((truck) => (
          <Card key={truck.id} className="p-3 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">{truck.name}</h3>
              <Badge 
                variant={truck.status === 'in-route' ? 'default' : truck.status === 'maintenance' ? 'destructive' : 'secondary'}
                className={
                  truck.status === 'in-route' ? 'bg-green-500' : 
                  truck.status === 'maintenance' ? 'bg-red-500' : 
                  'bg-gray-500'
                }
              >
                <div className={`w-2 h-2 rounded-full mr-1 ${
                  truck.status === 'in-route' ? 'bg-green-200' : 
                  truck.status === 'maintenance' ? 'bg-red-200' : 
                  'bg-gray-200'
                }`}></div>
                {truck.status === 'in-route' ? 'Em movimento' : 
                 truck.status === 'maintenance' ? 'Manutenção' : 'Disponível'}
              </Badge>
            </div>
            
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Placa:</span>
                <span className="font-medium">{truck.plate}</span>
              </div>
              <div className="flex justify-between">
                <span>Velocidade:</span>
                <span className="font-medium">{truck.speed || 0} km/h</span>
              </div>
              {truck.currentRoute && (
                <div className="flex justify-between">
                  <span>Rota:</span>
                  <span className="font-medium">{truck.currentRoute}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>ETA:</span>
                <span className="font-medium flex items-center gap-1">
                  <span>🕐</span> {truck.eta || '--:--'}
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
