import { API_BASE_URL } from './config';

export type FuncionarioStatus = 'ativo' | 'ferias' | 'afastado' | 'desligado';

export interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  cpf?: string | null;
  pis?: string | null;
  rg?: string | null;
  email?: string | null;
  telefone?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  admissao?: string | null;
  desligamento?: string | null;
  status: FuncionarioStatus;
  jornada_id?: string | null;
  jornada_nome?: string | null;
  banco_horas_min: number;
  salario_base?: number | null;
  observacoes?: string | null;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type FuncionarioInput = Partial<Omit<Funcionario, 'id' | 'created_at' | 'updated_at' | 'jornada_nome'>> & {
  password?: string;
};


function h(): HeadersInit {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function j(r: Response): Promise<any> {
  if (!r.ok) {
    let m = `HTTP ${r.status}`;
    try { const b = await r.json(); m = b.error || m; } catch {}
    throw new Error(m);
  }
  return r.status === 204 ? (undefined as any) : r.json();
}

export const funcionariosService = {
  list: (params?: { status?: string; departamento?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.departamento) qs.set('departamento', params.departamento);
    if (params?.q) qs.set('q', params.q);
    return fetch(`${API_BASE_URL}/funcionarios?${qs}`, { headers: h() }).then(j);
  },
  get:    (id: string): Promise<Funcionario> => fetch(`${API_BASE_URL}/funcionarios/${id}`, { headers: h() }).then(j),
  create: (body: FuncionarioInput): Promise<Funcionario> =>
    fetch(`${API_BASE_URL}/funcionarios`, { method: 'POST', headers: h(), body: JSON.stringify(body) }).then(j),
  update: (id: string, body: FuncionarioInput): Promise<Funcionario> =>
    fetch(`${API_BASE_URL}/funcionarios/${id}`, { method: 'PUT', headers: h(), body: JSON.stringify(body) }).then(j),
  remove: (id: string): Promise<void> =>
    fetch(`${API_BASE_URL}/funcionarios/${id}`, { method: 'DELETE', headers: h() }).then(j),
};
