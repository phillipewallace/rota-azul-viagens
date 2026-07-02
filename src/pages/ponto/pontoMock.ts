/**
 * Mock data + tipos para o módulo de Ponto Eletrônico.
 * Front-only por enquanto — backend virá depois. Nada persiste.
 */

export type EmployeeStatus = 'ativo' | 'ferias' | 'afastado' | 'desligado';

export interface Employee {
  id: string;
  nome: string;
  matricula: string;
  cpf: string;
  pis: string;
  cargo: string;
  departamento: string;
  admissao: string; // ISO date
  status: EmployeeStatus;
  jornadaId: string;
  bancoHoras: number; // minutos (positivo = crédito, negativo = débito)
  email?: string;
  telefone?: string;
}

export interface Jornada {
  id: string;
  nome: string;
  cargaSemanal: number; // horas
  entrada: string; // HH:mm
  saidaAlmoco: string;
  voltaAlmoco: string;
  saida: string;
  tolerancia: number; // minutos (Portaria 671: até 10min/dia sem hora extra)
  diasSemana: number[]; // 0=dom, 6=sab
}

export type PunchType = 'entrada' | 'saida-almoco' | 'volta-almoco' | 'saida';
export type PunchOrigin = 'web' | 'mobile' | 'manual' | 'importado';

export interface Punch {
  id: string;
  employeeId: string;
  timestamp: string; // ISO
  tipo: PunchType;
  origem: PunchOrigin;
  latitude?: number;
  longitude?: number;
  endereco?: string;
  nsr: number; // Número Sequencial de Registro (Portaria 671)
  hash: string; // assinatura simulada
  ajustado?: boolean;
  motivoAjuste?: string;
}

export type JustificationStatus = 'pendente' | 'aprovada' | 'recusada';
export type JustificationType =
  | 'falta'
  | 'atraso'
  | 'saida-antecipada'
  | 'esquecimento'
  | 'atestado'
  | 'folga'
  | 'ferias'
  | 'licenca';

export interface Justification {
  id: string;
  employeeId: string;
  data: string; // ISO date
  tipo: JustificationType;
  status: JustificationStatus;
  motivo: string;
  anexoUrl?: string;
  criadoEm: string;
  revisadoPor?: string;
  revisadoEm?: string;
}

export const JORNADAS: Jornada[] = [
  {
    id: 'j-comercial',
    nome: 'Comercial 44h',
    cargaSemanal: 44,
    entrada: '08:00',
    saidaAlmoco: '12:00',
    voltaAlmoco: '13:00',
    saida: '17:48',
    tolerancia: 10,
    diasSemana: [1, 2, 3, 4, 5],
  },
  {
    id: 'j-operacional',
    nome: 'Operacional 6x1',
    cargaSemanal: 44,
    entrada: '07:00',
    saidaAlmoco: '11:00',
    voltaAlmoco: '12:00',
    saida: '15:20',
    tolerancia: 10,
    diasSemana: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'j-administrativa',
    nome: 'Administrativa 40h',
    cargaSemanal: 40,
    entrada: '09:00',
    saidaAlmoco: '12:00',
    voltaAlmoco: '13:00',
    saida: '18:00',
    tolerancia: 10,
    diasSemana: [1, 2, 3, 4, 5],
  },
];

export const EMPLOYEES: Employee[] = [
  {
    id: 'e-001',
    nome: 'Ana Beatriz Souza',
    matricula: '0001',
    cpf: '123.456.789-00',
    pis: '120.12345.67-8',
    cargo: 'Analista Administrativa',
    departamento: 'Administrativo',
    admissao: '2022-03-14',
    status: 'ativo',
    jornadaId: 'j-administrativa',
    bancoHoras: 320,
    email: 'ana@alchemy.com',
    telefone: '(11) 91234-5678',
  },
  {
    id: 'e-002',
    nome: 'Bruno Carvalho',
    matricula: '0002',
    cpf: '987.654.321-00',
    pis: '120.98765.43-2',
    cargo: 'Motorista',
    departamento: 'Operações',
    admissao: '2021-08-02',
    status: 'ativo',
    jornadaId: 'j-operacional',
    bancoHoras: -85,
  },
  {
    id: 'e-003',
    nome: 'Carla Menezes',
    matricula: '0003',
    cpf: '456.789.123-00',
    pis: '120.45678.91-3',
    cargo: 'Coordenadora Comercial',
    departamento: 'Comercial',
    admissao: '2020-01-20',
    status: 'ativo',
    jornadaId: 'j-comercial',
    bancoHoras: 780,
  },
  {
    id: 'e-004',
    nome: 'Diego Ramos',
    matricula: '0004',
    cpf: '321.654.987-00',
    pis: '120.32165.49-8',
    cargo: 'Auxiliar de Operações',
    departamento: 'Operações',
    admissao: '2023-05-10',
    status: 'ferias',
    jornadaId: 'j-operacional',
    bancoHoras: 0,
  },
  {
    id: 'e-005',
    nome: 'Eduarda Lima',
    matricula: '0005',
    cpf: '741.852.963-00',
    pis: '120.74185.29-6',
    cargo: 'Financeiro',
    departamento: 'Administrativo',
    admissao: '2019-11-05',
    status: 'ativo',
    jornadaId: 'j-administrativa',
    bancoHoras: 120,
  },
  {
    id: 'e-006',
    nome: 'Felipe Nogueira',
    matricula: '0006',
    cpf: '159.753.486-00',
    pis: '120.15975.34-8',
    cargo: 'Mecânico',
    departamento: 'Manutenção',
    admissao: '2022-09-18',
    status: 'afastado',
    jornadaId: 'j-operacional',
    bancoHoras: -240,
  },
  {
    id: 'e-007',
    nome: 'Gabriela Santos',
    matricula: '0007',
    cpf: '852.963.741-00',
    pis: '120.85296.37-4',
    cargo: 'Recepcionista',
    departamento: 'Administrativo',
    admissao: '2024-02-01',
    status: 'ativo',
    jornadaId: 'j-comercial',
    bancoHoras: 45,
  },
  {
    id: 'e-008',
    nome: 'Henrique Alves',
    matricula: '0008',
    cpf: '369.258.147-00',
    pis: '120.36925.81-4',
    cargo: 'Motorista',
    departamento: 'Operações',
    admissao: '2023-07-22',
    status: 'ativo',
    jornadaId: 'j-operacional',
    bancoHoras: 210,
  },
];

const rand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const buildPunchesForEmployee = (emp: Employee, days: number, startNsr: number): Punch[] => {
  const j = JORNADAS.find((x) => x.id === emp.jornadaId)!;
  const r = rand(parseInt(emp.id.replace(/\D/g, ''), 10) || 1);
  const out: Punch[] = [];
  let nsr = startNsr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days; i >= 1; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    if (!j.diasSemana.includes(day.getDay())) continue;
    if (emp.status === 'ferias' || emp.status === 'afastado') continue;

    const times: [PunchType, string][] = [
      ['entrada', j.entrada],
      ['saida-almoco', j.saidaAlmoco],
      ['volta-almoco', j.voltaAlmoco],
      ['saida', j.saida],
    ];
    times.forEach(([tipo, hhmm]) => {
      const [h, m] = hhmm.split(':').map(Number);
      const jitter = Math.round((r() - 0.5) * 20); // ±10 min
      const d = new Date(day);
      d.setHours(h, m + jitter, Math.floor(r() * 60), 0);
      out.push({
        id: `p-${emp.id}-${i}-${tipo}`,
        employeeId: emp.id,
        timestamp: d.toISOString(),
        tipo,
        origem: r() > 0.4 ? 'mobile' : 'web',
        latitude: -23.55 + (r() - 0.5) * 0.05,
        longitude: -46.63 + (r() - 0.5) * 0.05,
        endereco: 'Alameda Santos, 1000 — São Paulo/SP',
        nsr: nsr++,
        hash: Math.random().toString(36).slice(2, 10).toUpperCase(),
      });
    });
  }
  return out;
};

let nsrCounter = 1000;
export const PUNCHES: Punch[] = EMPLOYEES.flatMap((e) => {
  const arr = buildPunchesForEmployee(e, 30, nsrCounter);
  nsrCounter += arr.length;
  return arr;
});

export const JUSTIFICATIONS: Justification[] = [
  {
    id: 'ju-001',
    employeeId: 'e-002',
    data: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    tipo: 'atraso',
    status: 'pendente',
    motivo: 'Trânsito intenso na Marginal Tietê.',
    criadoEm: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'ju-002',
    employeeId: 'e-001',
    data: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
    tipo: 'atestado',
    status: 'aprovada',
    motivo: 'Consulta médica — atestado 4h.',
    anexoUrl: '#',
    criadoEm: new Date(Date.now() - 6 * 86400000).toISOString(),
    revisadoPor: 'RH',
    revisadoEm: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'ju-003',
    employeeId: 'e-005',
    data: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
    tipo: 'esquecimento',
    status: 'pendente',
    motivo: 'Esqueci de registrar a saída para o almoço.',
    criadoEm: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'ju-004',
    employeeId: 'e-008',
    data: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
    tipo: 'folga',
    status: 'aprovada',
    motivo: 'Folga compensatória por trabalho em feriado.',
    criadoEm: new Date(Date.now() - 11 * 86400000).toISOString(),
    revisadoPor: 'RH',
    revisadoEm: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'ju-005',
    employeeId: 'e-006',
    data: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
    tipo: 'licenca',
    status: 'aprovada',
    motivo: 'Licença médica INSS.',
    criadoEm: new Date(Date.now() - 16 * 86400000).toISOString(),
    revisadoPor: 'RH',
    revisadoEm: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

// Utils --------------------------------------------------------------------
export const minutesToHHmm = (min: number) => {
  const sign = min < 0 ? '-' : '';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const diffMinutes = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

export interface DayComputed {
  date: string; // YYYY-MM-DD
  entrada?: Punch;
  saidaAlmoco?: Punch;
  voltaAlmoco?: Punch;
  saida?: Punch;
  trabalhado: number; // minutos
  previsto: number;
  saldo: number; // trabalhado - previsto
  atraso: number;
  extra: number;
  incompleto: boolean;
}

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

  const [eh, em] = jornada.entrada.split(':').map(Number);
  const [sh, sm] = jornada.saida.split(':').map(Number);
  const [ah, am] = jornada.saidaAlmoco.split(':').map(Number);
  const [vh, vm] = jornada.voltaAlmoco.split(':').map(Number);
  const previsto = (sh * 60 + sm) - (vh * 60 + vm) + (ah * 60 + am) - (eh * 60 + em);

  day.trabalhado = Math.max(0, trabalhado);
  day.previsto = previsto;
  day.saldo = day.trabalhado - previsto;
  day.atraso = day.entrada
    ? Math.max(0, diffMinutes(new Date(new Date(day.entrada.timestamp).setHours(eh, em, 0, 0)), new Date(day.entrada.timestamp)))
    : 0;
  day.extra = Math.max(0, day.saldo);
  day.incompleto = !(day.entrada && day.saidaAlmoco && day.voltaAlmoco && day.saida);
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
