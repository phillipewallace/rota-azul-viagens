
import { useState, useEffect } from 'react';
import { apiService } from '@/services/api';

export interface Truck {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  status: 'available' | 'in-route' | 'maintenance';
  currentRoute?: string;
  driver?: string;
  lastMaintenance: string;
  mileage: number;
  location?: {
    lat: number;
    lng: number;
  };
}

export const useTrucks = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrucks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTrucks();
      setTrucks(data);
      console.log('Trucks loaded successfully:', data);
    } catch (err) {
      setError('Erro ao carregar caminhões');
      console.error('Error loading trucks:', err);
      setTrucks([]); // Limpa os dados em caso de erro
    } finally {
      setLoading(false);
    }
  };

  const updateTruckLocation = async (truckId: string, lat: number, lng: number) => {
    try {
      await apiService.updateTruckLocation(truckId, lat, lng);
      // Atualiza o estado local
      setTrucks(prev => prev.map(truck => 
        truck.id === truckId 
          ? { ...truck, location: { lat, lng } }
          : truck
      ));
    } catch (err) {
      console.error('Error updating truck location:', err);
    }
  };

  useEffect(() => {
    loadTrucks();
    // Atualiza a cada 30 segundos
    const interval = setInterval(loadTrucks, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    trucks,
    loading,
    error,
    loadTrucks,
    updateTruckLocation
  };
};
