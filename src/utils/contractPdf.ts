/**
 * Geração de Contrato (PDF) a partir de templates editáveis pelo usuário.
 *
 * O corpo das cláusulas vem do backend (tabela erp_contract_templates) e é
 * editável na página de Configurações. Aqui montamos o contexto de variáveis
 * a partir do orçamento/OS/contrato e substituímos no HTML antes de renderizar.
 */
import jsPDF from 'jspdf';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';
import { contractTemplatesService, type ContractTemplate, type ContractTemplateTipo } from '@/services/contractTemplates';
import { renderHtmlToPdf } from '@/utils/htmlToPdf';

const BRL = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateLong = (d?: string | Date | null) => {
  if (!d) return '____ de ______________ de ______';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '____ de ______________ de ______';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${dt.getDate().toString().padStart(2, '0')} de ${meses[dt.getMonth()]} de ${dt.getFullYear()}`;
};

const fmtDateBr = (d?: string | Date | null) => {
  if (!d) return '___/___/______';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '___/___/______';
  return dt.toLocaleDateString('pt-BR');
};

function maskDoc(doc?: string) {
  if (!doc) return '';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return maskCpf(d);
  if (d.length === 14) return maskCnpj(d);
  return doc;
}

function valorPorExtenso(n: number): string {
  const num = Math.floor(n);
  const cents = Math.round((n - num) * 100);
  if (num === 0 && cents === 0) return 'zero reais';
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function ate999(v: number): string {
    if (v === 0) return '';
    if (v === 100) return 'cem';
    const c = Math.floor(v / 100);
    const r = v % 100;
    const parts: string[] = [];
    if (c) parts.push(centenas[c]);
    if (r < 20) { if (r) parts.push(unidades[r]); }
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(dezenas[d] + (u ? ' e ' + unidades[u] : ''));
    }
    return parts.join(' e ');
  }
  const milhares = Math.floor(num / 1000);
  const resto = num % 1000;
  let txt = '';
  if (milhares) txt += (milhares === 1 ? 'mil' : ate999(milhares) + ' mil');
  if (resto) txt += (txt ? (resto < 100 || resto % 100 === 0 ? ' e ' : ', ') : '') + ate999(resto);
  txt += ` ${num === 1 ? 'real' : 'reais'}`;
  if (cents) txt += ` e ${ate999(cents)} centavo${cents > 1 ? 's' : ''}`;
  return txt;
}

function numeroPorExtenso(n: number): string {
  return valorPorExtenso(n).replace(/ rea(?:l|is).*/, '');
}

export interface ContractSource {
  numero: string;
  tipo: 'orcamento' | 'os';
  tipoContrato?: 'locacao' | 'evento' | 'obra';
  modalidade?: 'diaria' | 'mensal';
  dataEmissao?: string | null;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  dataFimPrevista?: string | null;
  dataRecolhimento?: string | null;
  horaEntrega?: string | null;
  localEvento?: string | null;
  validadeDias?: number | null;
  limpezasSemanais?: number | null;
  enderecoEntrega?: string | null;
  observacoes?: string | null;
  condicoesPagamento?: string | null;
  dataVencimento?: string | null;
  frete?: number | null;

  total: number;
  companySnapshot?: any;
  customerSnapshot?: any;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerAddress?: string;
  items?: Array<{
    produto?: string;
    descricao?: string | null;
    quantidade?: number | string;
    valorUnitario?: number | string;
    valorTotal?: number | string;
  }>;
}

/** Constrói o dicionário de variáveis aplicado ao template. */
function buildContext(src: ContractSource): Record<string, string> {
  const company = src.companySnapshot || {};
  const customer = src.customerSnapshot || {};

  const enderecoEmpresa = [
    company.endereco, company.numero, company.bairro,
    [company.cidade, company.estado].filter(Boolean).join('/'),
    company.cep ? `CEP ${company.cep}` : null,
  ].filter(Boolean).join(', ');

  const enderecoCliente = [
    customer.address || src.customerAddress, customer.numero, customer.bairro,
    [customer.cidade, customer.estado].filter(Boolean).join('/'),
    customer.cep ? `CEP ${customer.cep}` : null,
  ].filter(Boolean).join(', ');

  const docLocadora = company.cnpj ? maskCnpj(company.cnpj) : (src.companyCnpj ? maskCnpj(src.companyCnpj) : '____________');
  const ieLocadora = company.inscricao_estadual ? `Inscrição Estadual nº ${company.inscricao_estadual}` : '';
  const imLocadora = company.inscricao_municipal ? `Inscrição Municipal nº ${company.inscricao_municipal}` : '';

  const docCli = customer.document ? maskDoc(customer.document) : '____________';
  const docCliLabel = (docCli.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ');

  // Objeto descritivo: usa a descrição real dos itens do orçamento (sem heurística).
  const items = src.items || [];
  const totalQtd = items.reduce((acc, it) => acc + (parseInt(String(it.quantidade || 0)) || 0), 0);
  let objetoDesc = '';
  if (items.length > 0) {
    const partes = items
      .filter(it => (parseInt(String(it.quantidade || 0)) || 0) > 0)
      .map(it => {
        const q = parseInt(String(it.quantidade || 0)) || 0;
        const nome = String(it.produto || it.descricao || 'item').trim();
        return `${String(q).padStart(2, '0')} (${numeroPorExtenso(q)}) ${nome}`;
      });
    if (partes.length === 1) objetoDesc = partes[0];
    else if (partes.length === 2) objetoDesc = `${partes[0]} e ${partes[1]}`;
    else if (partes.length > 2) objetoDesc = partes.slice(0, -1).join(', ') + ', e ' + partes[partes.length - 1];
  }
  if (!objetoDesc) {
    const q = totalQtd || 1;
    objetoDesc = `${String(q).padStart(2, '0')} (${numeroPorExtenso(q)}) banheiro${q > 1 ? 's' : ''} químico${q > 1 ? 's' : ''}`;
  }

  const valorTotal = Number(src.total) || 0;
  const freteVal = Number(src.frete) || 0;
  const valorRecorrente = freteVal > 0 && valorTotal > freteVal ? valorTotal - freteVal : valorTotal;
  const qtdSan = totalQtd || 1;
  const valorUnit = qtdSan > 0 ? valorRecorrente / qtdSan : valorRecorrente;
  const limp = src.limpezasSemanais ?? (src.modalidade === 'mensal' ? 1 : 0);

  return {
    'empresa.razao_social': String(company.razao_social || src.companyRazaoSocial || '____________'),
    'empresa.cnpj': docLocadora,
    'empresa.inscricao_estadual': ieLocadora,
    'empresa.inscricao_municipal': imLocadora,
    'empresa.endereco_completo': enderecoEmpresa || '____________',
    'empresa.cidade': String(company.cidade || '____________'),

    'cliente.nome': String(customer.customer_name || customer.customerName || src.customerName || '____________'),
    'cliente.documento': docCli,
    'cliente.documento_label': docCliLabel,
    'cliente.endereco_completo': enderecoCliente || '__________________',

    'contrato.numero': src.numero || '',
    'contrato.data_emissao': fmtDateBr(src.dataEmissao || src.dataInicio),
    'contrato.data_emissao_extenso': fmtDateLong(src.dataEmissao || src.dataInicio),
    'contrato.data_entrega': fmtDateBr(src.dataEntrega || src.dataInicio),
    'contrato.data_recolhimento': fmtDateBr(src.dataRecolhimento || src.dataFimPrevista),
    'contrato.hora_entrega': src.horaEntrega || '____',
    'contrato.local': src.localEvento || src.enderecoEntrega || enderecoCliente || '____________',
    'contrato.objeto_descricao': objetoDesc,

    'contrato.valor_total': BRL(valorTotal),
    'contrato.valor_total_extenso': valorPorExtenso(valorTotal),
    'contrato.valor_mensal': BRL(valorRecorrente),
    'contrato.valor_mensal_extenso': valorPorExtenso(valorRecorrente),
    'contrato.valor_unitario': BRL(valorUnit),
    'contrato.valor_unitario_extenso': valorPorExtenso(valorUnit),
    'contrato.qtd_sanitarios': String(qtdSan),
    'contrato.qtd_sanitarios_extenso': numeroPorExtenso(qtdSan),
    'contrato.frete': BRL(freteVal),
    'contrato.frete_extenso': valorPorExtenso(freteVal),
    'contrato.data_vencimento': fmtDateBr(src.dataVencimento),
    'contrato.data_vencimento_extenso': fmtDateLong(src.dataVencimento),
    'contrato.limpezas_semanais': String(limp || 1),
    'contrato.observacoes': src.observacoes || '',
  };
}

/** Substitui {{chave}} pelos valores do contexto. Tolerante a espaços. */
function applyTemplate(html: string, ctx: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const v = ctx[key];
    return v == null ? '' : String(v);
  });
}

function tipoToTemplateTipo(t?: 'locacao' | 'evento' | 'obra'): ContractTemplateTipo {
  return t === 'evento' ? 'evento' : 'obra';
}

export async function generateContractPdf(src: ContractSource, opts: { preview?: boolean } = {}) {
  const tipoTpl = tipoToTemplateTipo(src.tipoContrato);
  let template: ContractTemplate | null = null;
  try {
    template = await contractTemplatesService.get(tipoTpl);
  } catch (e) {
    // Em último caso, segue com um fallback mínimo para não bloquear a geração.
    template = {
      tipo: tipoTpl,
      titulo: tipoTpl === 'evento'
        ? 'CONTRATO DE PRESTAÇÃO DE LOCAÇÃO E SERVIÇOS — EVENTO'
        : 'CONTRATO DE LOCAÇÃO PARA OBRA — BANHEIROS QUÍMICOS',
      corpoHtml: `<p>Modelo de contrato não disponível. Configure em <strong>Configurações → Modelos de Contrato</strong>.</p>`,
    };
  }

  const ctx = buildContext(src);
  const corpoHtml = applyTemplate(template.corpoHtml, ctx);
  const titulo = applyTemplate(template.titulo, ctx);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const maxW = W - M * 2;
  const company = src.companySnapshot || {};

  let pageNum = 1;

  const drawHeader = () => {
    doc.setFillColor(20, 38, 84);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(String(company.razao_social || src.companyRazaoSocial || 'LOCADORA').toUpperCase(), M, 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(titulo, M, 13);
    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = () => {
    doc.setDrawColor(200);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
    const left = [company.razao_social, company.cnpj ? `CNPJ ${maskCnpj(company.cnpj)}` : null].filter(Boolean).join(' · ');
    doc.text(left || '', M, H - 9);
    doc.text(`Contrato ${src.numero} · Página ${pageNum}`, W - M, H - 9, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const newPage = (): number => {
    drawFooter();
    doc.addPage();
    pageNum += 1;
    drawHeader();
    return 26;
  };

  drawHeader();
  let y = 28;

  // Título
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(titulo, W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100);
  doc.text(`Documento: ${src.numero} · Emissão: ${fmtDateBr(src.dataEmissao || src.dataInicio)}`, W / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Renderiza o corpo do template
  const renderCtx = {
    doc, x: M, y, maxW,
    baseSize: 10,
    lineGap: 1.6,
    onBeforeWrite: (needed: number) => {
      if (renderCtx.y + needed > H - 22) {
        renderCtx.y = newPage();
      }
      return renderCtx.y;
    },
  };
  renderHtmlToPdf(renderCtx, corpoHtml);
  y = renderCtx.y;

  // Observações complementares (texto livre digitado no contrato)
  if (src.observacoes && src.observacoes.trim()) {
    if (y + 30 > H - 22) y = newPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    y += 3;
    doc.text('OBSERVAÇÕES COMPLEMENTARES', M, y);
    y += 6;
    const ctxObs = {
      doc, x: M, y, maxW, baseSize: 10, lineGap: 1.6,
      onBeforeWrite: (needed: number) => {
        if (ctxObs.y + needed > H - 22) ctxObs.y = newPage();
        return ctxObs.y;
      },
    };
    renderHtmlToPdf(ctxObs, `<p>${src.observacoes.replace(/\n/g, '<br>')}</p>`);
    y = ctxObs.y;
  }

  // Local e data
  if (y + 60 > H - 22) y = newPage();
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`${company.cidade || '____________'}, ${fmtDateLong(src.dataEmissao || src.dataInicio || new Date().toISOString())}.`, M, y);
  y += 16;

  // Assinaturas
  if (y + 50 > H - 22) y = newPage();
  const colW = (W - M * 2 - 14) / 2;
  doc.line(M, y, M + colW, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(String(company.razao_social || src.companyRazaoSocial || 'LOCADORA').toUpperCase(), M, y + 5);
  doc.setFont('helvetica', 'normal');
  if (company.cnpj || src.companyCnpj) doc.text(`CNPJ ${maskCnpj(company.cnpj || src.companyCnpj || '')}`, M, y + 10);
  doc.setTextColor(120); doc.setFontSize(8); doc.text('LOCADORA', M, y + 15); doc.setTextColor(0);

  const x2 = M + colW + 14;
  const customer = src.customerSnapshot || {};
  doc.line(x2, y, x2 + colW, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text(String(customer.customer_name || src.customerName || 'LOCATÁRIA').toUpperCase(), x2, y + 5);
  doc.setFont('helvetica', 'normal');
  if (customer.document) {
    const label = customer.document.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ';
    doc.text(`${label} ${maskDoc(customer.document)}`, x2, y + 10);
  }
  doc.setTextColor(120); doc.setFontSize(8);
  doc.text(tipoTpl === 'evento' ? 'CONTRATANTE' : 'LOCATÁRIA', x2, y + 15);
  doc.setTextColor(0);

  y += 28;
  if (y + 20 > H - 22) y = newPage();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Testemunhas:', M, y);
  y += 10;
  doc.line(M, y, M + colW, y); doc.text('Nome:', M, y + 4); doc.text('CPF:', M, y + 9);
  doc.line(x2, y, x2 + colW, y); doc.text('Nome:', x2, y + 4); doc.text('CPF:', x2, y + 9);

  drawFooter();

  const filename = tipoTpl === 'evento'
    ? `contrato-evento-${src.numero}.pdf`
    : `contrato-${src.numero}.pdf`;

  if (opts.preview) {
    // Abre o PDF em uma nova aba para visualização sem baixar.
    const blobUrl = doc.output('bloburl');
    const win = window.open(blobUrl, '_blank');
    if (!win) {
      // Pop-up bloqueado: força download como fallback.
      doc.save(filename);
    }
    return;
  }

  doc.save(filename);
}
