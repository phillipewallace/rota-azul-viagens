
import { useState, useEffect } from 'react';

export interface Driver {
  id: string;
  name: string;
  license: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useDrivers = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/drivers`);
      if (response.ok) {
        const data = await response.json();
        setDrivers(data);
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
      // Mock data for development
      setDrivers([
        { id: '1', name: 'João Silva', license: 'CNH123456', phone: '(11) 99999-9999', email: 'joao@email.com', status: 'active' },
        { id: '2', name: 'Maria Santos', license: 'CNH654321', phone: '(11) 88888-8888', email: 'maria@email.com', status: 'active' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  return {
    drivers,
    loading,
    loadDrivers
  };
};
