
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
    } catch (err) {
      setError('Erro ao carregar caminhões');
      console.error('Error loading trucks:', err);
      // Dados mockados para desenvolvimento
      const mockTrucks: Truck[] = [
        {
          id: '1',
          name: 'Caminhão 001',
          plate: 'ABC-1234',
          model: 'Volvo FH',
          year: 2020,
          status: 'available',
          lastMaintenance: '2024-05-15',
          mileage: 85240,
          location: { lat: -23.5505, lng: -46.6333 }
        },
        {
          id: '2',
          name: 'Caminhão 002',
          plate: 'DEF-5678',
          model: 'Scania R450',
          year: 2019,
          status: 'in-route',
          currentRoute: 'SP → MG',
          lastMaintenance: '2024-04-20',
          mileage: 92180,
          location: { lat: -23.5605, lng: -46.6433 }
        }
      ];
      setTrucks(mockTrucks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  return {
    trucks,
    loading,
    error,
    loadTrucks
  };
};
