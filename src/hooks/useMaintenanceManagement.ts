
import { useState, useEffect } from 'react';

export interface MaintenanceStats {
  trucks: {
    total: number;
    available: number;
    in_route: number;
    in_maintenance: number;
  };
  maintenance: {
    total_maintenances: number;
    completed: number;
    pending: number;
    in_progress: number;
  };
  upcoming: {
    upcoming_count: number;
  };
  costs: {
    total_cost: number;
    avg_cost: number;
  };
}

export interface MaintenanceRecord {
  id: string;
  truck_id: string;
  truck_name: string;
  truck_plate: string;
  maintenance_type: string;
  description: string;
  scheduled_date: string;
  cost: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface CostSummary {
  maintenance_type: string;
  count: number;
  total_cost: number;
  avg_cost: number;
}

const API_BASE_URL = import.meta.env.MODE === 'production' 
  ? 'https://your-api-domain.com/api' 
  : 'http://localhost:3001/api';

export const useMaintenanceManagement = () => {
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [costsSummary, setCostsSummary] = useState<CostSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/management/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading maintenance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenanceRecords = async (filters: {
    startDate?: string;
    endDate?: string;
    truckId?: string;
    status?: string;
    type?: string;
  } = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/management/maintenance?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMaintenanceRecords(data);
      }
    } catch (error) {
      console.error('Error loading maintenance records:', error);
    }
  };

  const loadCostsSummary = async (filters: {
    startDate?: string;
    endDate?: string;
  } = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/management/costs-summary?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCostsSummary(data);
      }
    } catch (error) {
      console.error('Error loading costs summary:', error);
    }
  };

  const createMaintenance = async (maintenance: Omit<MaintenanceRecord, 'id' | 'truck_name' | 'truck_plate' | 'created_at' | 'updated_at'>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/management/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenance),
      });
      
      if (response.ok) {
        await loadMaintenanceRecords();
        await loadStats();
        return await response.json();
      }
      throw new Error('Failed to create maintenance record');
    } catch (error) {
      console.error('Error creating maintenance:', error);
      throw error;
    }
  };

  const updateMaintenance = async (id: string, maintenance: Partial<MaintenanceRecord>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/management/maintenance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenance),
      });
      
      if (response.ok) {
        await loadMaintenanceRecords();
        await loadStats();
        return await response.json();
      }
      throw new Error('Failed to update maintenance record');
    } catch (error) {
      console.error('Error updating maintenance:', error);
      throw error;
    }
  };

  const deleteMaintenance = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/management/maintenance/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        await loadMaintenanceRecords();
        await loadStats();
      }
      throw new Error('Failed to delete maintenance record');
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadStats();
    loadMaintenanceRecords();
    loadCostsSummary();
  }, []);

  return {
    stats,
    maintenanceRecords,
    costsSummary,
    loading,
    loadStats,
    loadMaintenanceRecords,
    loadCostsSummary,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
  };
};
