import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/services/config';
import { usePolling } from './usePolling';

export interface Customer {
  id: string;
  customerName: string;
  address: string;
  cep: string;
  restroomsQty?: number;
  cleaningsQty?: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  // Novos campos cadastrais
  personType?: 'PF' | 'PJ';
  document?: string;          // CPF ou CNPJ
  ie?: string;
  im?: string;
  email?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  responsavelNome?: string;
  responsavelCpf?: string;
  tipoCliente?: string;       // eventos | obra | industria | outro
  createdAt?: string;
  updatedAt?: string;
}

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/customers`);
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      const data = await response.json();
      setCustomers(data || []);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  // Sincronização entre usuários: refaz fetch a cada 15s
  usePolling(fetchCustomers, 15000);

  const addCustomer = useCallback((customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
  }, []);
  const updateCustomer = useCallback((id: string, field: keyof Customer, value: any) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }, []);
  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  const saveCustomers = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customers }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao salvar clientes');
    }
    const result = await response.json();
    setCustomers(result.customers || customers);
    return result;
  }, [customers]);

  return { customers, loading, error, addCustomer, updateCustomer, deleteCustomer, saveCustomers, refetch: fetchCustomers };
};
