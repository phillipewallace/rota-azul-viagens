/**
 * Geradores de PDF do módulo Ponto Digital.
 * - Espelho individual: relatório mensal por funcionário (Portaria MTP 671/2021 art. 84).
 * - Espelho consolidado: resumo do período de todos os funcionários com jornada vinculada.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Employee, Jornada, Punch } from './pontoUtils';
import { computeDay, groupPunchesByDay, minutesToHHmm } from './pontoUtils';

const PRIMARY: [number, number, number] = [5, 105, 82];   // emerald-700
const MUTED:   [number, number, number] = [100, 116, 139]; // slate-500
const BORDER:  [number, number, number] = [226, 232, 240]; // slate-200

export interface EmpresaCab {
  razao_social?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  cei?: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const brDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const brDateOnly = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${pad2(d)}/${pad2(m)}/${y}`;
};
const hhmm = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

const drawHeader = (doc: jsPDF, empresa: EmpresaCab, title: string, subtitle: string) => {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(empresa.razao_social || 'Empresa', 14, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const meta = [empresa.cnpj ? `CNPJ ${empresa.cnpj}` : '', empresa.cei ? `CEI ${empresa.cei}` : '', empresa.endereco || '']
    .filter(Boolean).join('  ·  ');
  if (meta) doc.text(meta, 14, 16);
  doc.setFontSize(9);
  doc.text(title, W - 14, 10, { align: 'right' });
  doc.setFontSize(8);
  doc.text(subtitle, W - 14, 16, { align: 'right' });
  doc.setTextColor(0, 0, 0);
};

const drawFooter = (doc: jsPDF) => {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  const now = new Date().toLocaleString('pt-BR');
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.line(14, H - 12, W - 14, H - 12);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Gerado em ${now} · Portaria MTP 671/2021`, 14, H - 7);
    doc.text(`Página ${i}/${pages}`, W - 14, H - 7, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
};

// ---------- Espelho individual ----------
export function generateEspelhoIndividualPdf(opts: {
  empresa: EmpresaCab;
  employee: Employee;
  jornada?: Jornada;
  punches: Punch[]; // já filtrados no funcionário/mês
  month: string;    // "YYYY-MM"
  filename?: string;
}) {
  const { empresa, employee, jornada, punches, month } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const [y, m] = month.split('-').map(Number);
  const periodo = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  drawHeader(doc, empresa, 'Espelho de Ponto', `Competência: ${periodo}`);

  // Bloco identificação
  doc.setFontSize(9);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(14, 28, W - 28, 20, 1.5, 1.5);
  const col = (x: number, label: string, value: string) => {
    doc.setTextColor(...MUTED); doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, 33);
    doc.setTextColor(0, 0, 0); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(value || '—', x, 38);
    doc.setFont('helvetica', 'normal');
  };
  col(18, 'Funcionário', employee.nome);
  col(80, 'Matrícula', employee.matricula || '—');
  col(115, 'CPF', employee.cpf || '—');
  col(155, 'PIS', employee.pis || '—');
  doc.setTextColor(...MUTED); doc.setFontSize(7);
  doc.text('CARGO', 18, 44);
  doc.text('JORNADA', 80, 44);
  doc.setTextColor(0, 0, 0); doc.setFontSize(8);
  doc.text(employee.cargo || '—', 30, 44);
  doc.text(
    jornada
      ? `${jornada.nome} · ${jornada.entrada || '--:--'}–${jornada.saidaAlmoco || '--:--'} · ${jornada.voltaAlmoco || '--:--'}–${jornada.saida || '--:--'}`
      : 'Sem jornada',
    98, 44,
  );

  // Tabela diária
  const daysInMonth = new Date(y, m, 0).getDate();
  const wk = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const jornadaSafe: Jornada = jornada ?? {
    id: '', nome: '—', cargaSemanal: 44,
    entrada: '', saidaAlmoco: '', voltaAlmoco: '', saida: '', tolerancia: 0, diasSemana: [1, 2, 3, 4, 5],
  };
  let totTrab = 0, totPrev = 0, totExtra = 0, totAtraso = 0, totSaldo = 0;
  const body: string[][] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const iso = `${month}-${pad2(i)}`;
    const dayDate = new Date(y, m - 1, i);
    const pts = punches
      .filter((p) => p.timestamp.startsWith(iso))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const isWorkday = jornadaSafe.diasSemana.includes(dayDate.getDay());
    const d = computeDay(pts, jornadaSafe, iso);
    if (pts.length) { totTrab += d.trabalhado; totExtra += d.extra; totAtraso += d.atraso; totSaldo += d.saldo; }
    if (isWorkday) totPrev += d.previsto || 0;
    body.push([
      `${pad2(i)}/${pad2(m)}`,
      wk[dayDate.getDay()],
      hhmm(d.entrada?.timestamp),
      hhmm(d.saidaAlmoco?.timestamp),
      hhmm(d.voltaAlmoco?.timestamp),
      hhmm(d.saida?.timestamp),
      minutesToHHmm(d.trabalhado),
      minutesToHHmm(d.previsto || 0),
      (d.saldo >= 0 ? '+' : '') + minutesToHHmm(d.saldo),
    ]);
  }

  autoTable(doc, {
    startY: 52,
    head: [['Data', 'Dia', 'Entrada', 'S. Almoço', 'V. Almoço', 'Saída', 'Trabalhado', 'Previsto', 'Saldo']],
    body,
    styles: { fontSize: 8, cellPadding: 1.6, halign: 'center' },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  const endY = (doc as any).lastAutoTable.finalY + 6;
  // Totais
  autoTable(doc, {
    startY: endY,
    head: [['Trabalhado', 'Previsto', 'Extras', 'Atrasos', 'Saldo do mês']],
    body: [[
      minutesToHHmm(totTrab),
      minutesToHHmm(totPrev),
      minutesToHHmm(totExtra),
      minutesToHHmm(totAtraso),
      (totSaldo >= 0 ? '+' : '') + minutesToHHmm(totSaldo),
    ]],
    styles: { fontSize: 9, cellPadding: 2.5, halign: 'center', fontStyle: 'bold' },
    headStyles: { fillColor: [241, 245, 249], textColor: 15, halign: 'center' },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  const sigY = (doc as any).lastAutoTable.finalY + 20;
  doc.setDrawColor(...BORDER);
  doc.line(20, sigY, 90, sigY);
  doc.line(W - 90, sigY, W - 20, sigY);
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text('Assinatura do funcionário', 55, sigY + 4, { align: 'center' });
  doc.text('Assinatura da empresa', W - 55, sigY + 4, { align: 'center' });

  drawFooter(doc);
  doc.save(opts.filename || `Espelho_${employee.matricula || employee.nome}_${month}.pdf`);
}

// ---------- Espelho consolidado (Relatórios) ----------
export function generateEspelhoConsolidadoPdf(opts: {
  empresa: EmpresaCab;
  employees: Employee[];
  jornadas: Jornada[];
  punches: Punch[];
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  filename?: string;
}) {
  const { empresa, employees, jornadas, punches, from, to } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  drawHeader(doc, empresa, 'Espelho de Ponto — Consolidado', `Período: ${brDateOnly(from)} a ${brDateOnly(to)}`);

  const jornadaById = new Map(jornadas.map((j) => [j.id, j]));
  const rows: string[][] = [];
  let empIncluidos = 0;

  for (const e of employees) {
    const j = jornadaById.get(e.jornadaId);
    if (!j) continue; // regra: apenas funcionários com jornada vinculada
    empIncluidos++;
    const grouped = groupPunchesByDay(punches.filter((p) => p.employeeId === e.id));
    let dias = 0, trab = 0, prev = 0, extra = 0, atraso = 0;
    for (const [date, arr] of grouped) {
      if (date < from || date > to) continue;
      const d = computeDay(arr, j, date);
      if (!d.incompleto) dias++;
      trab += d.trabalhado; prev += d.previsto; extra += d.extra; atraso += d.atraso;
    }
    const saldo = trab - prev;
    rows.push([
      e.matricula || '—',
      e.nome,
      e.cargo || '—',
      j.nome,
      String(dias),
      minutesToHHmm(trab),
      minutesToHHmm(prev),
      minutesToHHmm(extra),
      minutesToHHmm(atraso),
      (saldo >= 0 ? '+' : '') + minutesToHHmm(saldo),
    ]);
  }

  if (rows.length === 0) {
    doc.setFontSize(10); doc.setTextColor(...MUTED);
    doc.text('Nenhum funcionário com jornada vinculada no período.', 14, 40);
    drawFooter(doc);
    doc.save(opts.filename || `Espelho_Consolidado_${from}_a_${to}.pdf`);
    return { included: 0 };
  }

  autoTable(doc, {
    startY: 28,
    head: [['Matrícula', 'Funcionário', 'Cargo', 'Jornada', 'Dias', 'Trabalhado', 'Previsto', 'Extras', 'Atrasos', 'Saldo']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'left', cellWidth: 22 },
      1: { halign: 'left' },
      2: { halign: 'left' },
      3: { halign: 'left' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  const endY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(
    `${empIncluidos} funcionário(s) considerados. Funcionários sem jornada vinculada foram omitidos.`,
    14, endY,
  );

  drawFooter(doc);
  doc.save(opts.filename || `Espelho_Consolidado_${from}_a_${to}.pdf`);
  return { included: empIncluidos };
}
