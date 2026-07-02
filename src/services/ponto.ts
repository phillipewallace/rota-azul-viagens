import { API_BASE_URL } from './config';

export interface Jornada {
  id: string;
  nome: string;
  carga_semanal: number;
  entrada: string;
  saida_almoco?: string | null;
  volta_almoco?: string | null;
  saida: string;
  tolerancia_min: number;
  dias_semana: number[];
  ativa: boolean;
}

export interface Punch {
  id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  matricula?: string;
  timestamp: string;
  tipo: 'entrada' | 'saida-almoco' | 'volta-almoco' | 'saida';
  origem: 'web' | 'mobile' | 'manual' | 'importado';
  latitude?: number | null;
  longitude?: number | null;
  endereco?: string | null;
  nsr: number;
  hash: string;
  foto_url?: string | null;
  ajustado: boolean;
  motivo_ajuste?: string | null;
}

export interface Justification {
  id: string;
  funcionario_id: string;
  funcionario_nome?: string;
  matricula?: string;
  data: string;
  tipo: 'falta' | 'atraso' | 'saida-antecipada' | 'esquecimento' | 'atestado' | 'folga' | 'ferias' | 'licenca';
  status: 'pendente' | 'aprovada' | 'recusada';
  motivo: string;
  anexo_url?: string | null;
  criado_em: string;
  revisado_por?: string | null;
  revisado_em?: string | null;
}

export interface Closure {
  id: string;
  competencia: string;
  fechado_em: string;
  fechado_por: string;
  assinatura: string;
  total_funcionarios: number;
  total_horas_min: number;
  observacoes?: string | null;
}

export interface PontoSettings {
  razao_social?: string | null;
  cnpj?: string | null;
  cei?: string | null;
  endereco?: string | null;
  fuso_horario: string;
  usar_geoloc: boolean;
  exigir_foto: boolean;
  banco_horas_ativo: boolean;
  limite_credito_min: number;
  limite_debito_min: number;
}

export interface DashboardStats {
  funcionarios: Record<string, number>;
  total_funcionarios: number;
  batidas_hoje: number;
  presentes_hoje: number;
  justificativas_pendentes: number;
  ultimos_fechamentos: { competencia: string; fechado_em: string }[];
}

function h(): HeadersInit {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let m = `HTTP ${r.status}`;
    try { const b = await r.json(); m = b.error || m; } catch {}
    throw new Error(m);
  }
  return r.status === 204 ? (undefined as any) : r.json();
}

const base = `${API_BASE_URL}/ponto`;

export const pontoService = {
  // Jornadas
  listJornadas: (): Promise<Jornada[]> => fetch(`${base}/jornadas`, { headers: h() }).then(j),
  createJornada: (b: Partial<Jornada>) => fetch(`${base}/jornadas`, { method: 'POST', headers: h(), body: JSON.stringify(b) }).then<Jornada>(j),
  updateJornada: (id: string, b: Partial<Jornada>) => fetch(`${base}/jornadas/${id}`, { method: 'PUT', headers: h(), body: JSON.stringify(b) }).then<Jornada>(j),
  deleteJornada: (id: string) => fetch(`${base}/jornadas/${id}`, { method: 'DELETE', headers: h() }).then<void>(j),

  // Punches
  listPunches: (p?: { funcionario_id?: string; from?: string; to?: string; limit?: number }): Promise<Punch[]> => {
    const qs = new URLSearchParams();
    if (p?.funcionario_id) qs.set('funcionario_id', p.funcionario_id);
    if (p?.from) qs.set('from', p.from);
    if (p?.to) qs.set('to', p.to);
    if (p?.limit) qs.set('limit', String(p.limit));
    return fetch(`${base}/punches?${qs}`, { headers: h() }).then(j);
  },
  createPunch: (b: Partial<Punch>) => fetch(`${base}/punches`, { method: 'POST', headers: h(), body: JSON.stringify(b) }).then<Punch>(j),
  adjustPunch: (id: string, b: { timestamp?: string; motivo: string }) =>
    fetch(`${base}/punches/${id}/adjust`, { method: 'PUT', headers: h(), body: JSON.stringify(b) }).then<Punch>(j),

  // Justificativas
  listJustifications: (p?: { status?: string; funcionario_id?: string }): Promise<Justification[]> => {
    const qs = new URLSearchParams();
    if (p?.status) qs.set('status', p.status);
    if (p?.funcionario_id) qs.set('funcionario_id', p.funcionario_id);
    return fetch(`${base}/justifications?${qs}`, { headers: h() }).then(j);
  },
  createJustification: (b: Partial<Justification>) =>
    fetch(`${base}/justifications`, { method: 'POST', headers: h(), body: JSON.stringify(b) }).then<Justification>(j),
  reviewJustification: (id: string, b: { status: 'aprovada' | 'recusada'; observacao?: string }) =>
    fetch(`${base}/justifications/${id}/review`, { method: 'PUT', headers: h(), body: JSON.stringify(b) }).then<Justification>(j),
  batchReview: (b: { ids: string[]; status: 'aprovada' | 'recusada'; observacao?: string }) =>
    fetch(`${base}/justifications/batch-review`, { method: 'POST', headers: h(), body: JSON.stringify(b) }).then<{ updated: number }>(j),

  // Fechamentos
  listClosures: (): Promise<Closure[]> => fetch(`${base}/closures`, { headers: h() }).then(j),
  createClosure: (b: { competencia: string; observacoes?: string }) =>
    fetch(`${base}/closures`, { method: 'POST', headers: h(), body: JSON.stringify(b) }).then<Closure>(j),
  deleteClosure: (competencia: string) =>
    fetch(`${base}/closures/${competencia}`, { method: 'DELETE', headers: h() }).then<void>(j),

  // Settings
  getSettings: (): Promise<PontoSettings> => fetch(`${base}/settings`, { headers: h() }).then(j),
  updateSettings: (b: Partial<PontoSettings>) =>
    fetch(`${base}/settings`, { method: 'PUT', headers: h(), body: JSON.stringify(b) }).then<PontoSettings>(j),

  // Banco de horas — ajustes
  listBankAdjustments: (funcionario_id?: string) => {
    const qs = funcionario_id ? `?funcionario_id=${funcionario_id}` : '';
    return fetch(`${base}/bank-adjustments${qs}`, { headers: h() }).then<any[]>(j);
  },
  createBankAdjustment: (b: { funcionario_id: string; minutos: number; motivo: string }) =>
    fetch(`${base}/bank-adjustments`, { method: 'POST', headers: h(), body: JSON.stringify(b) }).then<any>(j),

  // Dashboard
  dashboard: (): Promise<DashboardStats> => fetch(`${base}/dashboard`, { headers: h() }).then(j),
};
