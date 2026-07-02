import { API_BASE_URL } from './config';

export interface Cargo {
  id: number;
  nome: string;
}

const authHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function req<T>(method: string, path = '', body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/cargos${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro na requisição');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const cargosService = {
  list: () => req<Cargo[]>('GET'),
  create: (nome: string) => req<Cargo>('POST', '', { nome }),
  remove: (id: number) => req<void>('DELETE', `/${id}`),
};
