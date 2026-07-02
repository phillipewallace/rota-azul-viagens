/**
 * Geradores client-side dos relatórios do Ponto.
 * - AFD: layout Portaria MTP 671/2021 art. 85 (arquivo texto).
 * - Demais: CSV (UTF-8 com BOM, separador ;) — abre direto no Excel BR.
 */
import type { Employee, Jornada, Punch, Justification } from './pontoUtils';
import { computeDay, groupPunchesByDay, minutesToHHmm } from './pontoUtils';

// ---------- helpers ----------
const pad = (v: string | number, len: number, ch = '0') => String(v).padStart(len, ch);
const padR = (v: string, len: number) => v.padEnd(len, ' ').slice(0, len);
const onlyDigits = (s = '') => s.replace(/\D+/g, '');
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate(), 2)}${pad(d.getMonth() + 1, 2)}${d.getFullYear()}`;
};
const fmtDateSlash = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate(), 2)}/${pad(d.getMonth() + 1, 2)}/${d.getFullYear()}`;
};
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours(), 2)}${pad(d.getMinutes(), 2)}`;
};

export const download = (filename: string, content: string, mime = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

const csv = (rows: (string | number)[][]) =>
  '\uFEFF' + rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');

export const downloadCSV = (name: string, rows: (string | number)[][]) =>
  download(name, csv(rows), 'text/csv;charset=utf-8');

// ---------- AFD (Portaria 671/2021 art. 85, layout Portaria 1.510/2009 estendido) ----------
export function generateAFD(opts: {
  empresa: { razao_social?: string | null; cnpj?: string | null; cei?: string | null };
  punches: Punch[];
  employees: Employee[];
}): string {
  const { empresa, punches, employees } = opts;
  const empById = new Map(employees.map((e) => [e.id, e]));
  const cnpj = pad(onlyDigits(empresa.cnpj || ''), 14);
  const cei = pad(onlyDigits(empresa.cei || ''), 12);
  const razao = padR(empresa.razao_social || '', 150);

  const sorted = [...punches].sort((a, b) => a.nsr - b.nsr);
  const first = sorted[0]?.timestamp ?? new Date().toISOString();
  const last = sorted[sorted.length - 1]?.timestamp ?? new Date().toISOString();
  const geracao = new Date().toISOString();

  const lines: string[] = [];
  // Header (tipo 1)
  lines.push(
    pad(1, 9) + '1' + cnpj + cei + razao +
    fmtDate(first) + fmtDate(last) + fmtDate(geracao) + fmtTime(geracao)
  );

  // Registros (tipo 3 = marcação de ponto)
  sorted.forEach((p, i) => {
    const e = empById.get(p.employeeId);
    const pis = pad(onlyDigits(e?.pis || ''), 12);
    lines.push(
      pad(i + 2, 9) + '3' + fmtDate(p.timestamp) + fmtTime(p.timestamp) + pis
    );
  });

  // Trailer (tipo 9)
  const totalMarc = sorted.length;
  lines.push(
    pad(lines.length + 1, 9) + '9' +
    pad(totalMarc, 9) + pad(0, 9) + pad(0, 9) + pad(0, 9) + '9'
  );

  return lines.join('\r\n') + '\r\n';
}

// ---------- CSVs ----------
export function generateEspelhoCSV(opts: {
  employees: Employee[]; punches: Punch[]; jornadas: Jornada[];
  from: string; to: string;
}) {
  const rows: (string | number)[][] = [['Funcionário', 'Matrícula', 'Data', 'Entrada', 'Saída Almoço', 'Volta Almoço', 'Saída', 'Trabalhado', 'Previsto', 'Saldo']];
  for (const e of opts.employees) {
    const j = opts.jornadas.find((x) => x.id === e.jornadaId);
    if (!j) continue;
    const emp = opts.punches.filter((p) => p.employeeId === e.id);
    const grouped = groupPunchesByDay(emp);
    for (const [date, arr] of grouped) {
      if (date < opts.from || date > opts.to) continue;
      const d = computeDay(arr, j, date);
      rows.push([
        e.nome, e.matricula, fmtDateSlash(date),
        d.entrada ? new Date(d.entrada.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
        d.saidaAlmoco ? new Date(d.saidaAlmoco.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
        d.voltaAlmoco ? new Date(d.voltaAlmoco.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
        d.saida ? new Date(d.saida.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
        minutesToHHmm(d.trabalhado), minutesToHHmm(d.previsto),
        (d.saldo >= 0 ? '+' : '') + minutesToHHmm(d.saldo),
      ]);
    }
  }
  return rows;
}

export function generateFolhaCSV(opts: { employees: Employee[]; punches: Punch[]; jornadas: Jornada[]; from: string; to: string; }) {
  const rows: (string | number)[][] = [['Departamento', 'Funcionário', 'Matrícula', 'Dias trabalhados', 'Horas trabalhadas', 'Horas previstas', 'Saldo']];
  const byDept = new Map<string, Employee[]>();
  opts.employees.forEach((e) => {
    const k = e.departamento || 'Sem departamento';
    if (!byDept.has(k)) byDept.set(k, []);
    byDept.get(k)!.push(e);
  });
  for (const [dept, emps] of byDept) {
    for (const e of emps) {
      const j = opts.jornadas.find((x) => x.id === e.jornadaId);
      if (!j) continue;
      const grouped = groupPunchesByDay(opts.punches.filter((p) => p.employeeId === e.id));
      let dias = 0, trab = 0, prev = 0;
      for (const [date, arr] of grouped) {
        if (date < opts.from || date > opts.to) continue;
        const d = computeDay(arr, j, date);
        if (!d.incompleto) dias++;
        trab += d.trabalhado; prev += d.previsto;
      }
      rows.push([dept, e.nome, e.matricula, dias, minutesToHHmm(trab), minutesToHHmm(prev), (trab - prev >= 0 ? '+' : '') + minutesToHHmm(trab - prev)]);
    }
  }
  return rows;
}

export function generateHorasExtrasCSV(opts: { employees: Employee[]; punches: Punch[]; jornadas: Jornada[]; from: string; to: string; }) {
  const rows: (string | number)[][] = [['Funcionário', 'Matrícula', 'Data', 'Extra (min)', 'Extra (h:mm)']];
  for (const e of opts.employees) {
    const j = opts.jornadas.find((x) => x.id === e.jornadaId);
    if (!j) continue;
    const grouped = groupPunchesByDay(opts.punches.filter((p) => p.employeeId === e.id));
    for (const [date, arr] of grouped) {
      if (date < opts.from || date > opts.to) continue;
      const d = computeDay(arr, j, date);
      if (d.extra > 0) rows.push([e.nome, e.matricula, fmtDateSlash(date), d.extra, minutesToHHmm(d.extra)]);
    }
  }
  return rows;
}

export function generateAbsenteismoCSV(opts: { employees: Employee[]; justifications: Justification[]; from: string; to: string; }) {
  const rows: (string | number)[][] = [['Funcionário', 'Matrícula', 'Data', 'Tipo', 'Status', 'Motivo']];
  const empById = new Map(opts.employees.map((e) => [e.id, e]));
  for (const j of opts.justifications) {
    if (j.data < opts.from || j.data > opts.to) continue;
    const e = empById.get(j.employeeId);
    if (!e) continue;
    rows.push([e.nome, e.matricula, fmtDateSlash(j.data), j.tipo, j.status, j.motivo]);
  }
  return rows;
}

export function generateBancoHorasCSV(opts: { employees: Employee[] }) {
  const rows: (string | number)[][] = [['Funcionário', 'Matrícula', 'Departamento', 'Saldo (min)', 'Saldo (h:mm)']];
  opts.employees.filter((e) => e.status !== 'desligado').forEach((e) =>
    rows.push([e.nome, e.matricula, e.departamento, e.bancoHoras, (e.bancoHoras >= 0 ? '+' : '') + minutesToHHmm(e.bancoHoras)])
  );
  return rows;
}

export function generateAnaliticoCSV(opts: { employees: Employee[]; punches: Punch[]; jornadas: Jornada[]; justifications: Justification[]; from: string; to: string; }) {
  const rows: (string | number)[][] = [['Métrica', 'Valor']];
  const totalEmp = opts.employees.filter((e) => e.status === 'ativo').length;
  const totalPunches = opts.punches.filter((p) => p.timestamp.slice(0, 10) >= opts.from && p.timestamp.slice(0, 10) <= opts.to).length;
  const pendentes = opts.justifications.filter((j) => j.status === 'pendente').length;
  let totExtra = 0, totPrev = 0, totTrab = 0;
  for (const e of opts.employees) {
    const j = opts.jornadas.find((x) => x.id === e.jornadaId);
    if (!j) continue;
    const grouped = groupPunchesByDay(opts.punches.filter((p) => p.employeeId === e.id));
    for (const [date, arr] of grouped) {
      if (date < opts.from || date > opts.to) continue;
      const d = computeDay(arr, j, date);
      totExtra += d.extra; totPrev += d.previsto; totTrab += d.trabalhado;
    }
  }
  rows.push(['Período', `${fmtDateSlash(opts.from)} — ${fmtDateSlash(opts.to)}`]);
  rows.push(['Funcionários ativos', totalEmp]);
  rows.push(['Batidas no período', totalPunches]);
  rows.push(['Justificativas pendentes', pendentes]);
  rows.push(['Horas trabalhadas', minutesToHHmm(totTrab)]);
  rows.push(['Horas previstas', minutesToHHmm(totPrev)]);
  rows.push(['Horas extras', minutesToHHmm(totExtra)]);
  rows.push(['Aderência (%)', totPrev ? ((totTrab / totPrev) * 100).toFixed(1) : '0.0']);
  return rows;
}
