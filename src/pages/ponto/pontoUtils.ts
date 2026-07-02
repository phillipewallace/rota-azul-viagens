/**
 * Utilitários puros do módulo Ponto Digital (sem dados mockados).
 * Tipos internos e adaptadores dos payloads do backend.
 */
import type { Punch as ApiPunch, Jornada as ApiJornada, Justification as ApiJustification } from '@/services/ponto';
import type { Funcionario } from '@/services/funcionarios';

// ---------- Tipos internos (compat com UI existente) ----------
export type PunchType = 'entrada' | 'saida-almoco' | 'volta-almoco' | 'saida';
export type PunchOrigin = 'web' | 'mobile' | 'manual' | 'importado';
export type JustificationStatus = 'pendente' | 'aprovada' | 'recusada';
export type JustificationType =
  | 'falta' | 'atraso' | 'saida-antecipada' | 'esquecimento'
  | 'atestado' | 'folga' | 'ferias' | 'licenca';

export interface Employee {
  id: string;
  nome: string;
  matricula: string;
  cpf: string;
  pis: string;
  cargo: string;
  departamento: string;
  admissao: string;
  status: 'ativo' | 'ferias' | 'afastado' | 'desligado';
  jornadaId: string;
  bancoHoras: number;
  email?: string;
  telefone?: string;
}

export interface Jornada {
  id: string;
  nome: string;
  cargaSemanal: number;
  entrada: string;
  saidaAlmoco: string;
  voltaAlmoco: string;
  saida: string;
  tolerancia: number;
  diasSemana: number[];
}

export interface Punch {
  id: string;
  employeeId: string;
  timestamp: string;
  tipo: PunchType;
  origem: PunchOrigin;
  latitude?: number;
  longitude?: number;
  endereco?: string;
  nsr: number;
  hash: string;
  fotoUrl?: string;
  ajustado?: boolean;
  motivoAjuste?: string;
}

export interface Justification {
  id: string;
  employeeId: string;
  data: string;
  tipo: JustificationType;
  status: JustificationStatus;
  motivo: string;
  horario?: string;
  anexoUrl?: string;
  criadoEm: string;
  revisadoPor?: string;
  revisadoEm?: string;
}

// ---------- Adaptadores backend → UI ----------
const trimTime = (t?: string | null) => (t ? t.slice(0, 5) : ''); // "HH:mm:ss" → "HH:mm"

export const toEmployee = (f: Funcionario): Employee => ({
  id: f.id,
  nome: f.nome,
  matricula: f.matricula,
  cpf: f.cpf ?? '',
  pis: f.pis ?? '',
  cargo: f.cargo ?? '',
  departamento: f.departamento ?? '',
  admissao: f.admissao ?? '',
  status: f.status,
  jornadaId: f.jornada_id ?? '',
  bancoHoras: f.banco_horas_min ?? 0,
  email: f.email ?? undefined,
  telefone: f.telefone ?? undefined,
});

export const toJornada = (j: ApiJornada): Jornada => ({
  id: j.id,
  nome: j.nome,
  cargaSemanal: Number(j.carga_semanal ?? 44),
  entrada: trimTime(j.entrada),
  saidaAlmoco: trimTime(j.saida_almoco),
  voltaAlmoco: trimTime(j.volta_almoco),
  saida: trimTime(j.saida),
  tolerancia: j.tolerancia_min ?? 10,
  diasSemana: j.dias_semana ?? [1, 2, 3, 4, 5],
});

export const toPunch = (p: ApiPunch): Punch => ({
  id: p.id,
  employeeId: p.funcionario_id,
  timestamp: p.timestamp,
  tipo: p.tipo,
  origem: p.origem,
  latitude: p.latitude ?? undefined,
  longitude: p.longitude ?? undefined,
  endereco: p.endereco ?? undefined,
  nsr: p.nsr,
  hash: p.hash,
  fotoUrl: p.foto_url ?? undefined,
  ajustado: p.ajustado,
  motivoAjuste: p.motivo_ajuste ?? undefined,
});

export const toJustification = (j: ApiJustification): Justification => ({
  id: j.id,
  employeeId: j.funcionario_id,
  data: j.data,
  tipo: j.tipo,
  status: j.status,
  motivo: j.motivo,
  horario: j.horario ? j.horario.slice(0, 5) : undefined,
  anexoUrl: j.anexo_url ?? undefined,
  criadoEm: j.criado_em,
  revisadoPor: j.revisado_por ?? undefined,
  revisadoEm: j.revisado_em ?? undefined,
});

// ---------- Utilidades ----------
export const minutesToHHmm = (min: number) => {
  const sign = min < 0 ? '-' : '';
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};

export const diffMinutes = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

export interface DayComputed {
  date: string;
  entrada?: Punch;
  saidaAlmoco?: Punch;
  voltaAlmoco?: Punch;
  saida?: Punch;
  trabalhado: number;
  previsto: number;
  saldo: number;
  atraso: number;
  extra: number;
  incompleto: boolean;
}

const HHMM = (s?: string) => {
  if (!s) return [0, 0];
  const [h, m] = s.split(':').map(Number);
  return [h || 0, m || 0];
};

export const computeDay = (punches: Punch[], jornada: Jornada, date: string): DayComputed => {
  const day = { date } as DayComputed;
  const byType = (t: PunchType) => punches.find((p) => p.tipo === t);
  day.entrada = byType('entrada');
  day.saidaAlmoco = byType('saida-almoco');
  day.voltaAlmoco = byType('volta-almoco');
  day.saida = byType('saida');

  let trabalhado = 0;
  if (day.entrada && day.saidaAlmoco)
    trabalhado += diffMinutes(new Date(day.entrada.timestamp), new Date(day.saidaAlmoco.timestamp));
  if (day.voltaAlmoco && day.saida)
    trabalhado += diffMinutes(new Date(day.voltaAlmoco.timestamp), new Date(day.saida.timestamp));
  if (!day.saidaAlmoco && !day.voltaAlmoco && day.entrada && day.saida)
    trabalhado += diffMinutes(new Date(day.entrada.timestamp), new Date(day.saida.timestamp));

  const [eh, em] = HHMM(jornada.entrada);
  const [sh, sm] = HHMM(jornada.saida);
  const [ah, am] = HHMM(jornada.saidaAlmoco);
  const [vh, vm] = HHMM(jornada.voltaAlmoco);
  const previsto = jornada.saidaAlmoco && jornada.voltaAlmoco
    ? (sh * 60 + sm) - (vh * 60 + vm) + (ah * 60 + am) - (eh * 60 + em)
    : (sh * 60 + sm) - (eh * 60 + em);

  day.trabalhado = Math.max(0, trabalhado);
  day.previsto = previsto;
  day.saldo = day.trabalhado - previsto;
  day.atraso = day.entrada
    ? Math.max(0, diffMinutes(new Date(new Date(day.entrada.timestamp).setHours(eh, em, 0, 0)), new Date(day.entrada.timestamp)))
    : 0;
  day.extra = Math.max(0, day.saldo);
  day.incompleto = !(day.entrada && day.saida);
  return day;
};

export const groupPunchesByDay = (punches: Punch[]) => {
  const map = new Map<string, Punch[]>();
  punches.forEach((p) => {
    const key = p.timestamp.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  });
  return map;
};

// ---------- Alertas ----------
export const proximoLimiteFerias = (admissaoISO: string, ref = new Date()): Date => {
  const adm = new Date(admissaoISO);
  const base = new Date(ref.getFullYear(), adm.getMonth(), adm.getDate());
  if (base <= ref) base.setFullYear(base.getFullYear() + 1);
  return base;
};

export const proximoAniversario = (dataISO: string, ref = new Date()): Date => {
  const d = new Date(dataISO);
  const nxt = new Date(ref.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (nxt < today) nxt.setFullYear(nxt.getFullYear() + 1);
  return nxt;
};

export const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86400000);

export const employeesMissingPunchToday = (
  employees: Employee[], punches: Punch[], jornadas: Jornada[],
): Employee[] => {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  const punchedIds = new Set(
    punches.filter((p) => p.tipo === 'entrada' && p.timestamp.startsWith(iso)).map((p) => p.employeeId),
  );
  return employees.filter((e) => {
    if (e.status !== 'ativo') return false;
    const j = jornadas.find((x) => x.id === e.jornadaId);
    if (!j || !j.diasSemana.includes(today.getDay())) return false;
    return !punchedIds.has(e.id);
  });
};

export const aniversariantesProximos = (
  employees: Employee[], dias = 7,
): Array<{ e: Employee; date: Date }> => {
  const ref = new Date();
  ref.setHours(0, 0, 0, 0);
  return employees
    .filter((e) => e.status === 'ativo' && e.admissao)
    .map((e) => ({ e, date: proximoAniversario(e.admissao, ref) }))
    .filter(({ date }) => {
      const d = daysBetween(ref, date);
      return d >= 0 && d <= dias;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const feriasVencendo = (
  employees: Employee[], dias = 60,
): Array<{ e: Employee; limite: Date; diasRest: number }> => {
  const ref = new Date();
  ref.setHours(0, 0, 0, 0);
  return employees
    .filter((e) => (e.status === 'ativo' || e.status === 'ferias') && e.admissao)
    .map((e) => {
      const limite = proximoLimiteFerias(e.admissao, ref);
      return { e, limite, diasRest: daysBetween(ref, limite) };
    })
    .filter((x) => x.diasRest <= dias)
    .sort((a, b) => a.diasRest - b.diasRest);
};

export const justificativasVencendo = (justs: Justification[], dias = 2): Justification[] => {
  const cutoff = Date.now() - dias * 86400000;
  return justs.filter((j) => j.status === 'pendente' && new Date(j.criadoEm).getTime() <= cutoff);
};
