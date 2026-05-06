import { API_BASE_URL } from './config';

const authHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/erp${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro na requisição');
  }
  return res.json();
}

export interface ErpCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tracksExpiry: boolean;
  requiresSignedTerm: boolean;
}
export interface ErpItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  tracksExpiry: boolean;
  requiresSignedTerm: boolean;
  name: string;
  sku?: string;
  unit: string;
  currentQty: number;
  minQty: number;
  expiryDate?: string;
  expiryAlertDays: number;
  notes?: string;
  active: boolean;
}
export interface ErpEmployee {
  id: string;
  name: string;
  role?: string;
  cpf?: string;
  phone?: string;
  active: boolean;
}
export interface ErpMovement {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  type: 'in' | 'out' | 'adjust' | 'discard';
  qty: number;
  employeeId?: string;
  employeeName?: string;
  performedBy?: string;
  notes?: string;
  signedPdfUrl?: string;
  createdAt: string;
}
export interface ErpDashboard {
  lowStock: any[];
  expiring: any[];
  totals: { totalItems: number; totalCategories: number; totalEmployees: number };
  alertCount: number;
}

export const erpService = {
  // categories
  listCategories: () => req<ErpCategory[]>('GET', '/categories'),
  createCategory: (data: Partial<ErpCategory>) => req<ErpCategory>('POST', '/categories', data),
  updateCategory: (id: string, data: Partial<ErpCategory>) => req<ErpCategory>('PUT', `/categories/${id}`, data),
  deleteCategory: (id: string) => req<{ ok: true }>('DELETE', `/categories/${id}`),
  // items
  listItems: () => req<ErpItem[]>('GET', '/items'),
  createItem: (data: Partial<ErpItem>) => req<ErpItem>('POST', '/items', data),
  updateItem: (id: string, data: Partial<ErpItem>) => req<ErpItem>('PUT', `/items/${id}`, data),
  deleteItem: (id: string) => req<{ ok: true }>('DELETE', `/items/${id}`),
  // employees
  listEmployees: () => req<ErpEmployee[]>('GET', '/employees'),
  createEmployee: (data: Partial<ErpEmployee>) => req<ErpEmployee>('POST', '/employees', data),
  updateEmployee: (id: string, data: Partial<ErpEmployee>) => req<ErpEmployee>('PUT', `/employees/${id}`, data),
  deleteEmployee: (id: string) => req<{ ok: true }>('DELETE', `/employees/${id}`),
  // movements
  listMovements: (itemId?: string) =>
    req<ErpMovement[]>('GET', `/movements${itemId ? `?itemId=${itemId}` : ''}`),
  createMovement: (data: Partial<ErpMovement>) => req<ErpMovement>('POST', '/movements', data),
  // dashboard
  dashboard: () => req<ErpDashboard>('GET', '/dashboard'),
};

// File upload (re-uses existing /upload endpoint)
export async function uploadSignedPdf(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error('Falha ao enviar PDF');
  const data = await res.json();
  return data.url as string;
}
