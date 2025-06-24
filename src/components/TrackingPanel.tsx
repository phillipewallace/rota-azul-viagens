
import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTrucks } from '@/hooks/useTrucks';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';

const TrackingPanel = () => {
  const { trucks, loading, error, loadTrucks } = useTrucks();

  if (loading) {
    return (
      <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="h-4 bg-gray-300 rounded w-32"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
        <div className="text-red-500 text-sm mb-2">{error}</div>
        <Button size="sm" onClick={loadTrucks} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <h2 className="font-semibold text-gray-800">Rastreamento em Tempo Real</h2>
        </div>
        <Button size="sm" onClick={loadTrucks} variant="ghost">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {trucks.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>Nenhum caminhão encontrado</p>
          <p className="text-xs mt-1">Verifique a conexão com o servidor</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {trucks.map((truck) => (
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
                  <span>Modelo:</span>
                  <span className="font-medium">{truck.model} ({truck.year})</span>
                </div>
                {truck.driver && (
                  <div className="flex justify-between">
                    <span>Motorista:</span>
                    <span className="font-medium">{truck.driver}</span>
                  </div>
                )}
                {truck.currentRoute && (
                  <div className="flex justify-between">
                    <span>Rota:</span>
                    <span className="font-medium">{truck.currentRoute}</span>
                  </div>
                )}
                {truck.location && (
                  <div className="flex justify-between">
                    <span>Localização:</span>
                    <span className="font-medium text-xs">
                      {truck.location.lat.toFixed(4)}, {truck.location.lng.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrackingPanel;
