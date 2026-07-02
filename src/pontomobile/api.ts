import { API_BASE_URL } from '@/services/config';

// Chaves isoladas: o pontomobile NÃO compartilha sessão com o sistema principal.
const TOKEN_KEY = 'pm_auth_token';
const USER_KEY = 'pm_user_data';

function authHeaders(): HeadersInit {
  const t = localStorage.getItem(TOKEN_KEY);
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
    if (r.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
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
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function currentUser(): MobileUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function currentToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
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
  const qs = new URLSearchParams({ funcionario_id: funcionarioId, from, to, include_photo: 'false' });
  const url = `${API_BASE_URL}/ponto/punches?${qs.toString()}`;
  const r = await fetch(url, { headers: authHeaders() });
  return handle<TodayPunch[]>(r);
}

export async function listMonthPunches(funcionarioId: string, ref: Date): Promise<TodayPunch[]> {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();
  const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).toISOString();
  const qs = new URLSearchParams({
    funcionario_id: funcionarioId,
    from,
    to,
    limit: '200',
    include_photo: 'false',
  });
  const url = `${API_BASE_URL}/ponto/punches?${qs.toString()}`;
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

// ============================================================
// Justificativas
// ============================================================
export type JustTipo = 'atestado' | 'falta' | 'esquecimento' | 'outro';
export type JustStatus = 'pendente' | 'aprovada' | 'recusada';

export interface Justification {
  id: string;
  funcionario_id: string;
  data: string;
  tipo: JustTipo;
  motivo: string;
  horario?: string | null;
  anexo_url?: string | null;
  status: JustStatus;
  criado_em: string;
  observacao_revisao?: string | null;
}

export async function listMyJustifications(funcionarioId: string): Promise<Justification[]> {
  const r = await fetch(`${API_BASE_URL}/ponto/justifications?funcionario_id=${funcionarioId}`, {
    headers: authHeaders(),
  });
  return handle<Justification[]>(r);
}

export interface CreateJustInput {
  funcionario_id: string;
  data: string;   // YYYY-MM-DD
  tipo: JustTipo;
  motivo: string;
  horario?: string;
  anexo_url?: string;
}

export async function createJustification(input: CreateJustInput): Promise<Justification> {
  const r = await fetch(`${API_BASE_URL}/ponto/justifications`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return handle<Justification>(r);
}
