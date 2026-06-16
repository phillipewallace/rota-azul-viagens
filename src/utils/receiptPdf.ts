/**
 * Recibo de Locação — PDF premium, alinhado ao modelo "MICBAN".
 * Cabeçalho com gradiente da empresa, dados completos e área de assinatura elegante.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { loadPdfImage, fitContain } from '@/utils/pdfImage';
import type { Receipt } from '@/services/contracts';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D   = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
const maskDoc = (d?: string) => {
  if (!d) return '';
  const x = d.replace(/\D/g, '');
  if (x.length === 11) return maskCpf(x);
  if (x.length === 14) return maskCnpj(x);
  return d;
};

const PRIMARY: [number, number, number] = [16, 42, 96];     // azul corporativo
const ACCENT:  [number, number, number] = [212, 175, 55];   // dourado

export async function generateReceiptPdf(rec: Receipt) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const snap = rec.snapshot || {};
  const co = snap.company || {};
  const cu = snap.customer || {};
  const ct = snap.contract || {};

  // ---------- Cabeçalho com faixa azul + acento dourado ----------
  const HEADER_H = 42;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, HEADER_H, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, HEADER_H, W, 1.5, 'F');

  // Caixa Nº/data à direita — definida antes para calcular espaço do texto
  const boxW = 58, boxH = 30, boxX = W - M - boxW, boxY = 6;

  // logo — caixa branca com aspect ratio preservado
  let textX = M;
  const logo = co.logoDataUrl || co.logoUrl;
  if (logo) {
    try {
      const img = await loadPdfImage(logo);
      const cardX = M, cardY = 6, cardW = 30, cardH = 30;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'F');
      const fit = fitContain(img, cardX, cardY, cardW, cardH, 2);
      doc.addImage(img.dataUrl, img.format, fit.x, fit.y, fit.w, fit.h, undefined, 'FAST');
      textX = cardX + cardW + 5;
    } catch { /* ignore */ }
  }

  // ---- empresa (com largura limitada para não invadir a caixa da direita) ----
  const textMaxW = boxX - textX - 4;
  doc.setTextColor(255, 255, 255);

  // Nome — auto-ajuste de fonte para caber em 1 linha quando possível
  const rawName = String(co.razaoSocial || '—').toUpperCase();
  doc.setFont('helvetica', 'bold');
  let nameSize = 13;
  doc.setFontSize(nameSize);
  while (nameSize > 8 && doc.getTextWidth(rawName) > textMaxW) {
    nameSize -= 0.5;
    doc.setFontSize(nameSize);
  }
  let lineY = 13;
  if (doc.getTextWidth(rawName) <= textMaxW) {
    doc.text(rawName, textX, lineY); lineY += 6;
  } else {
    const wrapped = doc.splitTextToSize(rawName, textMaxW).slice(0, 2);
    for (const w of wrapped) { doc.text(w, textX, lineY); lineY += 5; }
    lineY += 1;
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const lin = [
    co.cnpj ? `CNPJ ${maskCnpj(co.cnpj)}` : null,
    co.inscricaoEstadual ? `IE ${co.inscricaoEstadual}` : null,
  ].filter(Boolean).join('  ·  ');
  if (lin) { doc.text(lin, textX, lineY, { maxWidth: textMaxW }); lineY += 5; }
  const end = [co.endereco, co.cidade && `${co.cidade}/${co.estado || ''}`, co.cep && `CEP ${co.cep}`]
    .filter(Boolean).join(' · ');
  if (end) {
    const wEnd = doc.splitTextToSize(end, textMaxW).slice(0, 2);
    for (const w of wEnd) { doc.text(w, textX, lineY); lineY += 4.5; }
  }
  const cont = [co.telefone, co.email].filter(Boolean).join('  ·  ');
  if (cont) doc.text(cont, textX, lineY, { maxWidth: textMaxW });

  // Caixa Nº/data à direita
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('RECIBO Nº', boxX + 3, boxY + 6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(rec.numero, boxX + boxW - 3, boxY + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Emissão', boxX + 3, boxY + 20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(D(rec.dataEmissao), boxX + boxW - 3, boxY + 20, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.text('Vencimento', boxX + 3, boxY + 27);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(D(rec.dataVencimento), boxX + boxW - 3, boxY + 27, { align: 'right' });

  // ---------- Título ----------
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('RECIBO DE LOCAÇÃO DE BENS MÓVEIS', W / 2, 50, { align: 'center' });

  // ---------- Valor em destaque ----------
  const valor = Number(rec.valor || 0);
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(M, 56, W - 2 * M, 18, 2, 2, 'F');
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.4);
  doc.line(M, 56, M, 74); // barra lateral
  doc.setFillColor(...PRIMARY);
  doc.rect(M, 56, 1.5, 18, 'F');
  doc.setTextColor(100, 110, 130); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('VALOR RECEBIDO', M + 6, 62);
  doc.setTextColor(...PRIMARY); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text(BRL(valor), M + 6, 71);
  // Tag pago
  if (rec.pago) {
    doc.setFillColor(16, 130, 80);
    doc.roundedRect(W - M - 30, 60, 26, 10, 5, 5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('PAGO', W - M - 17, 67, { align: 'center' });
  }

  // ---------- Cliente ----------
  let y = 84;
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('DADOS DO LOCATÁRIO', M, y);
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6);
  doc.line(M, y + 1, M + 50, y + 1);
  y += 6;

  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const linhas: string[] = [];
  linhas.push(`Nome / Razão Social:  ${cu.name || '—'}`);
  if (cu.document) linhas.push(
    `${cu.document.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}:  ${maskDoc(cu.document)}`
  );
  const endCli = [cu.address, cu.numero, cu.bairro].filter(Boolean).join(', ');
  if (endCli) linhas.push(`Endereço:  ${endCli}`);
  const muni = [cu.cidade && `${cu.cidade}/${cu.estado || ''}`, cu.cep && `CEP ${cu.cep}`]
    .filter(Boolean).join(' · ');
  if (muni) linhas.push(`Município:  ${muni}`);
  for (const l of linhas) {
    const wrap = doc.splitTextToSize(l, W - 2 * M);
    for (const w of wrap) { doc.text(w, M, y); y += 5; }
  }

  // ---------- Tabela de itens ----------
  y += 4;
  const descLocacao = ct.descricao || `Locação mensal — Contrato ${ct.numero || ''}`.trim();
  autoTable(doc, {
    startY: y,
    head: [['Qtd', 'Unid', 'Descrição da Locação', 'Valor Unitário', 'Total']],
    body: [['1', 'MÊS', descLocacao, BRL(valor), BRL(valor)]],
    styles: { fontSize: 9, cellPadding: 3, lineColor: [220, 224, 230] },
    headStyles: { fillColor: PRIMARY, textColor: 255, halign: 'center', fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right',  cellWidth: 30 },
      4: { halign: 'right',  cellWidth: 30, fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  });
  let afterY = (doc as any).lastAutoTable.finalY + 4;

  autoTable(doc, {
    startY: afterY,
    head: [['Competência', 'Vencimento', 'Total da Locação']],
    body: [[formatComp(rec.competencia), D(rec.dataVencimento), BRL(valor)]],
    styles: { fontSize: 9.5, cellPadding: 3 },
    headStyles: { fillColor: [240, 242, 247], textColor: PRIMARY, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold', textColor: PRIMARY } },
    margin: { left: M, right: M },
  });
  afterY = (doc as any).lastAutoTable.finalY + 8;

  // ---------- Nota legal ----------
  doc.setFillColor(252, 248, 232);
  doc.roundedRect(M, afterY, W - 2 * M, 14, 1.5, 1.5, 'F');
  doc.setTextColor(120, 90, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('NÃO INCIDÊNCIA DE ISSQN', M + 3, afterY + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(
    'Conforme Lei Complementar nº 116/2003 de 31/07/2003 — locação de bens móveis não está sujeita à incidência de ISSQN.',
    M + 3, afterY + 10, { maxWidth: W - 2 * M - 6 }
  );
  afterY += 22;

  // ---------- Frase de quitação ----------
  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const txt =
    `Recebi(emos) de ${cu.name || co.razaoSocial || ''} a quantia de ${BRL(valor)} ` +
    `referente à locação mensal de bens móveis na competência ${formatComp(rec.competencia)}, ` +
    `dando plena, geral e irrevogável quitação para nada mais ter que reclamar.`;
  const wrap = doc.splitTextToSize(txt, W - 2 * M);
  doc.text(wrap, M, afterY); afterY += wrap.length * 5 + 14;

  // ---------- Assinatura ----------
  if (afterY > H - 50) { doc.addPage(); afterY = 30; }
  doc.text(`${co.cidade || 'Belo Horizonte'}, ${D(rec.dataEmissao)}.`, M, afterY);
  afterY += 22;

  doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.3);
  doc.line(M + 25, afterY, W - M - 25, afterY);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PRIMARY);
  doc.text(String(co.razaoSocial || '—').toUpperCase(), W / 2, afterY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
  if (co.cnpj) doc.text(`CNPJ ${maskCnpj(co.cnpj)}`, W / 2, afterY + 10, { align: 'center' });
  doc.text('LOCADORA', W / 2, afterY + 15, { align: 'center' });

  // rodapé
  doc.setFontSize(7); doc.setTextColor(140, 140, 140);
  doc.text(
    `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}`,
    W / 2, H - 6, { align: 'center' }
  );

  doc.save(`Recibo-${rec.numero}.pdf`);
}

function formatComp(c: string) {
  const [a, m] = (c || '').split('-');
  const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return m ? `${meses[Number(m)] || m}/${a}` : c;
}

/** Aceita data URL ou URL pública/relativa; devolve dataURL. */
export async function toDataUrl(src: string): Promise<string> {
  if (!src) throw new Error('empty');
  if (src.startsWith('data:')) return src;
  const url = toAbsoluteUrl(src);
  const r = await fetch(url, { credentials: 'omit', mode: 'cors' });
  if (!r.ok) throw new Error('logo fetch failed');
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
