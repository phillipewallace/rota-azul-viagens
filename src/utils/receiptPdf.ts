/**
 * Recibo de Locação — PDF estilo "MICBAN" (modelo enviado pelo usuário).
 * Cabeçalho com logo da empresa emissora + dados de cliente, itens e total.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';
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

export async function generateReceiptPdf(rec: Receipt) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  const snap = rec.snapshot || {};
  const co = snap.company || {};
  const cu = snap.customer || {};
  const ct = snap.contract || {};

  // Logo (se disponível)
  let logoEnd = M;
  const logo = co.logoDataUrl || co.logoUrl;
  if (logo) {
    try {
      const dataUrl = await toDataUrl(logo);
      doc.addImage(dataUrl, 'JPEG', M, 10, 26, 26, undefined, 'FAST');
      logoEnd = M + 30;
    } catch { /* ignora se falhar */ }
  }

  // Cabeçalho empresa
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(co.razaoSocial || '—', logoEnd, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const lin1 = [co.telefone].filter(Boolean).join(' • ');
  if (lin1) doc.text(lin1, logoEnd, 20);
  const lin2 = [co.endereco, co.cidade, co.estado].filter(Boolean).join(', ');
  if (lin2) doc.text(lin2, logoEnd, 24);
  const lin3 = [
    co.cnpj ? `CNPJ: ${maskCnpj(co.cnpj)}` : null,
    co.inscricaoEstadual ? `Insc. Est.: ${co.inscricaoEstadual}` : null,
    co.cep ? `CEP ${co.cep}` : null,
  ].filter(Boolean).join(' • ');
  if (lin3) doc.text(lin3, logoEnd, 28);

  // Título
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.line(M, 40, W - M, 40);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('RECIBO DE LOCAÇÃO', W / 2, 47, { align: 'center' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('DE BENS MÓVEIS', W / 2, 52, { align: 'center' });

  // Caixa Nº / Data
  const numero = rec.numero;
  const boxX = W - M - 60;
  doc.rect(boxX, 56, 60, 14);
  doc.setFontSize(8); doc.text('Nº', boxX + 2, 60);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(numero, boxX + 30, 62, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Data de emissão', boxX + 2, 67);
  doc.setFont('helvetica', 'bold'); doc.text(D(rec.dataEmissao), boxX + 58, 67, { align: 'right' });

  // Dados do cliente
  let y = 56;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DADOS DO CLIENTE / DESTINATÁRIO', M, y);
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Destinatário: ${cu.name || '—'}`, M, y); y += 4.5;
  const end = [cu.address, cu.numero, cu.bairro].filter(Boolean).join(', ');
  if (end) { doc.text(`Endereço: ${end}`, M, y, { maxWidth: boxX - M - 4 }); y += 4.5; }
  const muni = [cu.cidade && `Município: ${cu.cidade}`, cu.estado && `UF: ${cu.estado}`, cu.cep && `CEP: ${cu.cep}`]
    .filter(Boolean).join(' | ');
  if (muni) { doc.text(muni, M, y); y += 4.5; }
  if (cu.document) { doc.text(`${cu.document.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'}: ${maskDoc(cu.document)}`, M, y); y += 4.5; }
  doc.text('Natureza: Locação de bens móveis (sem incidência de ISSQN)', M, y); y += 6;

  // Tabela itens (linha única com base no contrato)
  const descLocacao = ct.descricao || `Locação mensal — Contrato ${ct.numero || ''}`.trim();
  autoTable(doc, {
    startY: y,
    head: [['Qtd', 'Unid', 'Descrição da Locação', 'Valor Unitário (R$)', 'Total (R$)']],
    body: [['1', 'MÊS', descLocacao, BRL(Number(rec.valor)), BRL(Number(rec.valor))]],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 32 },
    },
    margin: { left: M, right: M },
  });
  let afterY = (doc as any).lastAutoTable.finalY + 4;

  // Período / total
  autoTable(doc, {
    startY: afterY,
    head: [['DATA / PERÍODO DA LOCAÇÃO', 'VALOR TOTAL DA LOCAÇÃO (R$)']],
    body: [[`Competência: ${formatComp(rec.competencia)}${rec.dataVencimento ? ` | Vencimento: ${D(rec.dataVencimento)}` : ''}`, BRL(Number(rec.valor))]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [230, 230, 230], textColor: 0 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: M, right: M },
  });
  afterY = (doc as any).lastAutoTable.finalY + 6;

  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('NÃO INCIDÊNCIA DE ISSQN CONFORME LEI COMPLEMENTAR 116/2003 DE 31/07/2003', M, afterY);
  afterY += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const txt = `Recebi(emos) de ${co.razaoSocial || ''} os serviços deste Recibo de Locação de Bens Móveis.`;
  const wrap = doc.splitTextToSize(txt, W - 2 * M);
  doc.text(wrap, M, afterY); afterY += wrap.length * 4.5 + 14;

  // Assinatura
  doc.text(`${co.cidade || 'Belo Horizonte'}, _____/_____/__________`, M, afterY); afterY += 14;
  doc.line(M, afterY, M + 70, afterY);
  doc.line(M + 80, afterY, M + 130, afterY);
  doc.line(M + 140, afterY, W - M, afterY);
  doc.setFontSize(8);
  doc.text('Assinatura', M, afterY + 4);
  doc.text('Nome', M + 80, afterY + 4);
  doc.text('CPF', M + 140, afterY + 4);

  doc.setFontSize(7); doc.setTextColor(120);
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} · ${co.razaoSocial || ''}`,
    W / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' }
  );

  doc.save(`Recibo-${numero}.pdf`);
}

function formatComp(c: string) {
  const [a, m] = (c || '').split('-');
  const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return m ? `${meses[Number(m)] || m}/${a}` : c;
}

/** Aceita data URL ou URL pública; devolve dataURL JPEG/PNG. */
export async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  const url = src.startsWith('/') ? src : src;
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error('logo fetch failed');
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
