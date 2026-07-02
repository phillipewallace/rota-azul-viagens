import { API_BASE_URL } from '@/services/config';

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `Erro ${r.status}`;
    try {
      const d = await r.json();
      msg = d.error || d.message || msg;
    } catch {
      // ignora
    }
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export interface MobileUser {
  id: string;
  username: string;
  name: string;
  role: string;
  funcionario_id?: string;
}

export async function login(cpf: string, senha: string): Promise<{ token: string; user: MobileUser }> {
  const r = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cpf.replace(/\D/g, ''), password: senha }),
  });
  const data = await handle<{ token: string; user: MobileUser }>(r);
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('user_data', JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_data');
}

export function currentUser(): MobileUser | null {
  const raw = localStorage.getItem('user_data');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export interface TodayPunch {
  id: string;
  tipo: 'entrada' | 'saida-almoco' | 'volta-almoco' | 'saida';
  timestamp: string;
  endereco?: string | null;
  foto_url?: string | null;
}

export async function listTodayPunches(funcionarioId: string): Promise<TodayPunch[]> {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const url = `${API_BASE_URL}/ponto/punches?funcionario_id=${funcionarioId}&from=${from}&to=${to}`;
  const r = await fetch(url, { headers: authHeaders() });
  return handle<TodayPunch[]>(r);
}

export async function listMonthPunches(funcionarioId: string, ref: Date): Promise<TodayPunch[]> {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).toISOString();
  const url = `${API_BASE_URL}/ponto/punches?funcionario_id=${funcionarioId}&from=${from}&to=${to}&limit=500`;
  const r = await fetch(url, { headers: authHeaders() });
  return handle<TodayPunch[]>(r);
}

export interface CreatePunchInput {
  funcionario_id: string;
  tipo: TodayPunch['tipo'];
  latitude?: number;
  longitude?: number;
  endereco?: string;
  foto_base64?: string;
}

export async function createPunch(input: CreatePunchInput): Promise<TodayPunch> {
  const r = await fetch(`${API_BASE_URL}/ponto/punches`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...input, origem: 'mobile' }),
  });
  return handle<TodayPunch>(r);
}
