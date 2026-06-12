/**
 * Geração de Contrato de Locação (PDF) baseado no modelo da locadora.
 * Funciona tanto para Orçamentos quanto para Ordens de Serviço.
 *
 * Estrutura mantida fiel ao contrato modelo, com placeholders preenchidos
 * automaticamente a partir dos dados de empresa emissora (LOCADORA),
 * cliente (LOCATÁRIA) e do orçamento/OS.
 */
import jsPDF from 'jspdf';
import { maskCnpj, maskCpf } from '@/utils/brazilianDocs';

const BRL = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateLong = (d?: string | Date | null) => {
  if (!d) return '____ de ______________ de ______';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '____ de ______________ de ______';
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
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
  // Versão simplificada (até milhões). Suficiente para valores de contrato.
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

export interface ContractSource {
  numero: string;                       // ORC-... ou OS-...
  tipo: 'orcamento' | 'os';
  modalidade?: 'diaria' | 'mensal';
  dataEmissao?: string | null;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  dataFimPrevista?: string | null;
  validadeDias?: number | null;
  limpezasSemanais?: number | null;
  enderecoEntrega?: string | null;
  observacoes?: string | null;
  condicoesPagamento?: string | null;
  frete?: number | null;
  total: number;
  // snapshots ou objetos relacionais
  companySnapshot?: any;
  customerSnapshot?: any;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerAddress?: string;
  // itens (do orçamento). Se vier, calcula qtd de banheiros e valor unitário.
  items?: Array<{
    produto?: string;
    descricao?: string | null;
    quantidade?: number | string;
    valorUnitario?: number | string;
    valorTotal?: number | string;
  }>;
}

export function generateContractPdf(src: ContractSource) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const maxW = W - M * 2;

  const company = src.companySnapshot || {};
  const customer = src.customerSnapshot || {};

  // ----- Helpers de layout -----
  let y = 0;
  let pageNum = 1;

  const drawHeader = () => {
    doc.setFillColor(20, 38, 84);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const head = (company.razao_social || src.companyRazaoSocial || 'LOCADORA').toUpperCase();
    doc.text(head, M, 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('LOCAÇÃO DE BANHEIROS QUÍMICOS E SERVIÇOS DE TRANSPORTE', M, 13);
    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = () => {
    doc.setDrawColor(200);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    const left = [company.razao_social, company.cnpj ? `CNPJ ${maskCnpj(company.cnpj)}` : null]
      .filter(Boolean).join(' · ');
    doc.text(left || '', M, H - 9);
    doc.text(`Contrato ${src.numero} · Página ${pageNum}`, W - M, H - 9, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const newPage = () => {
    drawFooter();
    doc.addPage();
    pageNum += 1;
    drawHeader();
    y = 26;
  };

  const ensure = (need: number) => {
    if (y + need > H - 22) newPage();
  };

  const writeParagraph = (text: string, opts?: { bold?: boolean; size?: number; lineGap?: number; align?: 'left' | 'justify' }) => {
    const size = opts?.size ?? 10;
    const gap = opts?.lineGap ?? 1.6;
    const applyStyle = () => {
      doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
    };
    applyStyle();
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensure(size * 0.45 + gap);
      applyStyle(); // re-aplica após eventual quebra de página (drawHeader reseta a fonte)
      doc.text(line, M, y);
      y += size * 0.45 + gap;
    }
  };


  const writeClause = (title: string, body: () => void) => {
    ensure(16);
    y += 3;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(title, M, y);
    y += 6;
    body();
  };

  // ----- Início do documento -----
  drawHeader();
  y = 28;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('CONTRATO DE LOCAÇÃO E PRESTAÇÃO DE SERVIÇOS', W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Documento de referência: ${src.numero}  ·  Emissão: ${fmtDateBr(src.dataEmissao || src.dataInicio)}`, W / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // --- Bloco de identificação das partes ---
  const enderecoEmpresa = [
    company.endereco, company.numero, company.bairro,
    [company.cidade, company.estado].filter(Boolean).join('/'),
    company.cep ? `CEP ${company.cep}` : null,
  ].filter(Boolean).join(', ');

  const enderecoCliente = [
    customer.address || src.customerAddress, customer.numero, customer.bairro,
    [customer.cidade, customer.estado].filter(Boolean).join('/'),
  ].filter(Boolean).join(', ');

  const docLocadora = company.cnpj ? maskCnpj(company.cnpj) : (src.companyCnpj ? maskCnpj(src.companyCnpj) : '____________');
  const ieLocadora = company.inscricao_estadual ? `Inscrição Estadual nº ${company.inscricao_estadual}` : '';
  const docLocataria = customer.document ? maskDoc(customer.document) : '____________';

  const intro =
    `Contrato de Locação e Prestação de Serviços que entre si firmam, de um lado, a empresa ` +
    `${(company.razao_social || src.companyRazaoSocial || '____________').toUpperCase()}, ` +
    `inscrita no CNPJ sob o nº ${docLocadora}${ieLocadora ? ', ' + ieLocadora : ''}` +
    `${company.inscricao_municipal ? `, Inscrição Municipal nº ${company.inscricao_municipal}` : ''}, ` +
    `com sede ${enderecoEmpresa ? 'na ' + enderecoEmpresa : '_______________'}, ` +
    `doravante denominada LOCADORA; e, de outro lado, ` +
    `${(customer.customer_name || customer.customerName || src.customerName || '____________').toUpperCase()}, ` +
    `inscrita no ${docLocataria.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ'} sob o nº ${docLocataria}, ` +
    `${enderecoCliente ? 'com endereço ' + enderecoCliente : 'com endereço __________________'}, ` +
    `doravante denominada LOCATÁRIA, ajustam entre si as cláusulas e condições a seguir:`;

  writeParagraph(intro, { size: 10 });

  // --- Cláusula I — Do Objeto ---
  const itens = src.items || [];
  const sanitItens = itens.filter(it => /sanit|banheiro/i.test(String(it.produto || '')) || /sanit|banheiro/i.test(String(it.descricao || '')));
  const qtdSanit = (sanitItens.length ? sanitItens : itens)
    .reduce((acc, it) => acc + (parseInt(String(it.quantidade || 0)) || 0), 0) || 1;
  const valorUnitario = sanitItens[0]
    ? Number(sanitItens[0].valorUnitario || 0)
    : (itens[0] ? Number(itens[0].valorUnitario || 0) : Number(src.total || 0));

  const limp = src.limpezasSemanais ?? (src.modalidade === 'mensal' ? 1 : null);
  const limpTxt = limp != null && limp > 0
    ? `${limp} (${valorPorExtenso(limp).replace(/ reais.*/, '')}) vez${limp > 1 ? 'es' : ''} por semana`
    : 'conforme cronograma acordado entre as partes';

  writeClause('CLÁUSULA I – DO OBJETO', () => {
    writeParagraph(
      `1.1. O presente contrato tem por objeto a locação de ${qtdSanit} (${valorPorExtenso(qtdSanit).replace(/ reais.*/, '')}) ` +
      `banheiro${qtdSanit > 1 ? 's' : ''} químico${qtdSanit > 1 ? 's' : ''} móve${qtdSanit > 1 ? 'is' : 'l'}, ` +
      `de propriedade da LOCADORA, à LOCATÁRIA, para uso temporário em atividades operacionais, canteiros de obras ou ` +
      `quaisquer outras situações que exijam a disponibilização de instalações sanitárias móveis, exclusivamente no local ` +
      `situado em ${src.enderecoEntrega || enderecoCliente || '___________________________'}.`
    );
    writeParagraph(
      `Parágrafo único – Caberá à LOCADORA, a partir do dia ${fmtDateBr(src.dataEntrega || src.dataInicio)}, ` +
      `a responsabilidade pela retirada dos dejetos, bem como pela higienização dos equipamentos ${limpTxt}.`
    );
    writeParagraph(
      `1.2. Os banheiros químicos serão entregues pela LOCADORA no local indicado pela LOCATÁRIA, devidamente higienizados, ` +
      `em condições de uso, e deverão ser mantidos conforme cronograma de limpeza e manutenção acordado entre as partes.`
    );
    writeParagraph(
      `1.3. A LOCADORA efetuará a entrega e a retirada dos equipamentos nos locais indicados pela LOCATÁRIA, conforme ` +
      `cronograma previamente acordado entre as partes, com antecedência mínima de 72 (setenta e duas) horas.`
    );
    writeParagraph(
      `1.4. A transferência ou mudança de local de instalação dos equipamentos por parte da LOCATÁRIA, sem prévia ` +
      `autorização da LOCADORA, será de responsabilidade exclusiva da LOCATÁRIA pelo retorno ao local inicial.`
    );
  });

  // --- Cláusula II — Vigência ---
  const vigencia = src.modalidade === 'diaria'
    ? `O presente contrato terá prazo determinado, com início em ${fmtDateBr(src.dataInicio || src.dataEntrega)} ` +
      `e término previsto em ${fmtDateBr(src.dataFimPrevista)}, sob regime de locação diária. ` +
      `Eventual prorrogação dependerá de acordo expresso entre as partes.`
    : `O presente contrato terá prazo inicial de 01 (um) mês, podendo ser prorrogado ou encerrado antecipadamente, ` +
      `conforme a necessidade da LOCATÁRIA.`;

  writeClause('CLÁUSULA II – DA VIGÊNCIA, RENOVAÇÃO E DEVOLUÇÃO DOS BENS LOCADOS', () => {
    writeParagraph(`II.1. ${vigencia}`);
    if (src.modalidade !== 'diaria') {
      writeParagraph(
        `Parágrafo primeiro – Caso a LOCATÁRIA opte pela devolução antecipada dos sanitários antes do término do período ` +
        `mensal contratado, não haverá cobrança proporcional, sendo devido o valor integral referente ao mês completo de locação.`
      );
      writeParagraph(
        `Parágrafo segundo – O valor da locação será reajustado anualmente, a cada 12 (doze) meses, com base na variação ` +
        `do Índice Geral de Preços – Mercado (IGP-M/FGV), ou em periodicidade menor, caso a legislação vigente assim o permita.`
      );
      writeParagraph(
        `II.2. Caso a LOCATÁRIA não comunique à LOCADORA, por escrito, com antecedência mínima de 07 (sete) dias do ` +
        `término do prazo contratual, sua intenção de não renovar este contrato, bem como não realize a devolução integral ` +
        `dos equipamentos locados até o último dia de vigência, o presente contrato será automaticamente renovado por igual ` +
        `período, com emissão de nova fatura.`
      );
    }
    writeParagraph(
      `II.3. O término do contrato somente será considerado efetivado após a entrega de todos os bens locados, em ` +
      `perfeitas condições de funcionamento, sem qualquer anormalidade, no depósito da LOCADORA, que realizará a devida conferência.`
    );
    writeParagraph(
      `Parágrafo único – Caso os equipamentos apresentem defeitos ou avarias, a LOCADORA apresentará orçamento de reparo ` +
      `à LOCATÁRIA para ciência, realizando posteriormente o faturamento dos custos correspondentes.`
    );
  });

  // --- Cláusula III — Obrigações ---
  writeClause('CLÁUSULA III – DAS OBRIGAÇÕES DAS PARTES', () => {
    writeParagraph(
      `III.1. Compete à LOCADORA: (a) entregar os equipamentos higienizados e em pleno funcionamento; (b) realizar a ` +
      `manutenção e a limpeza conforme cronograma acordado; (c) retirar os equipamentos ao término da vigência.`
    );
    writeParagraph(
      `III.2. Compete à LOCATÁRIA: (a) zelar pela integridade dos equipamentos, respondendo por danos decorrentes de uso ` +
      `indevido; (b) garantir o acesso da equipe técnica da LOCADORA para entrega, manutenção e recolhimento; ` +
      `(c) comunicar previamente qualquer alteração de endereço, prazo ou quantidade contratada.`
    );
    writeParagraph(
      `§1º – A LOCADORA se exime de qualquer responsabilidade por atrasos ou falhas na prestação dos serviços caso ` +
      `informações de acesso, endereço ou contato não sejam previamente repassadas.`
    );
    writeParagraph(
      `§2º – Caso haja necessidade de apresentação de documentos como PCMSO, PPRA, ASO, treinamentos obrigatórios (NRs) ` +
      `ou similares, os custos serão integralmente arcados pela LOCATÁRIA.`
    );
  });

  // --- Cláusula IV — Pagamento ---
  const freteVal = Number(src.frete) || 0;
  const totalContrato = Number(src.total) || 0;
  // Quando há frete cadastrado, o valor de locação corresponde ao total MENOS o frete
  // (o frete é cobrado uma única vez, então não compõe o valor mensal nem o valor diário recorrente).
  const valorLocacao = freteVal > 0 && totalContrato > freteVal ? totalContrato - freteVal : totalContrato;
  const valorUnitFinal = freteVal > 0 && valorUnitario > 0 && itens.length === 1 && qtdSanit > 0
    ? Math.max(0, (totalContrato - freteVal) / qtdSanit)
    : valorUnitario;

  writeClause('CLÁUSULA IV – DO PAGAMENTO', () => {
    if (src.modalidade === 'diaria') {
      writeParagraph(
        `IV.1. A locação será cobrada de forma integral pelo período contratado, no valor de ${BRL(valorLocacao)} ` +
        `(${valorPorExtenso(valorLocacao)}), referente a ${qtdSanit} unidade${qtdSanit > 1 ? 's' : ''} pelo período ` +
        `de ${fmtDateBr(src.dataInicio || src.dataEntrega)} a ${fmtDateBr(src.dataFimPrevista)}` +
        `${freteVal > 0 ? ', sendo este valor exclusivo de frete' : ''}.`
      );
    } else {
      writeParagraph(
        `IV.1. A locação do(s) banheiro(s) químico(s) será cobrada mensalmente, sendo certo que o valor das locações se ` +
        `refere sempre ao mês integral, independentemente do número de dias de uso, não havendo cobrança proporcional.`
      );
      writeParagraph(
        `IV.3. O valor mensal por unidade será de ${BRL(valorUnitFinal)} (${valorPorExtenso(valorUnitFinal)}), perfazendo ` +
        `o valor mensal de locação de ${BRL(valorLocacao)} (${valorPorExtenso(valorLocacao)}) para ${qtdSanit} ` +
        `unidade${qtdSanit > 1 ? 's' : ''} contratada${qtdSanit > 1 ? 's' : ''}` +
        `${freteVal > 0 ? ', valor este que NÃO inclui o frete previsto na Cláusula IV.4 abaixo' : ''}.`
      );
    }

    writeParagraph(
      `O pagamento será efetuado por meio de boleto bancário, cujo vencimento constará expressamente no próprio boleto ` +
      `e na respectiva nota fiscal, juntamente com a indicação do período da locação.`
    );
    if (src.condicoesPagamento) {
      writeParagraph(`Condições específicas: ${src.condicoesPagamento}`);
    }
    writeParagraph(
      `Parágrafo único – O atraso no pagamento sujeitará a LOCATÁRIA à incidência de multa de 2% (dois por cento) sobre o ` +
      `valor devido, juros moratórios de 1% (um por cento) ao mês e correção monetária pelo IGP-M/FGV. Decorrido o prazo de ` +
      `30 (trinta) dias de inadimplência, a LOCADORA poderá considerar o contrato rescindido de pleno direito, ` +
      `procedendo à inclusão do nome da LOCATÁRIA nos cadastros de inadimplentes (SPC/SERASA) e ao protesto da dívida ` +
      `em cartório, independentemente de notificação prévia.`
    );
    writeParagraph(
      `IV.2. Os boletos bancários serão enviados para o e-mail informado pela LOCATÁRIA no momento da contratação, ` +
      `acompanhados das respectivas notas fiscais e faturas.`
    );
    if (freteVal > 0) {
      writeParagraph(
        `IV.4. DO FRETE (cobrança única) – O valor referente ao frete de entrega e recolhimento dos equipamentos será ` +
        `cobrado UMA ÚNICA VEZ, no importe de ${BRL(freteVal)} (${valorPorExtenso(freteVal)}), lançado integralmente ` +
        `na primeira nota fiscal emitida em favor da LOCATÁRIA, não se repetindo nas faturas subsequentes ` +
        `${src.modalidade === 'mensal' ? 'mensais' : 'do período'} e não compondo, portanto, o valor recorrente da locação ` +
        `previsto nas cláusulas anteriores.`
      );
    }
  });

  // --- Cláusula V — Foro ---
  writeClause('CLÁUSULA V – DO FORO', () => {
    writeParagraph(
      `V.1. Fica eleito o foro da comarca de ${company.cidade || '____________'} para dirimir quaisquer dúvidas ` +
      `referentes a este contrato. E por estarem justos e contratados, os representantes das partes assinam o presente ` +
      `instrumento na presença das testemunhas abaixo, em duas vias de igual teor e forma para um só efeito.`
    );
  });

  if (src.observacoes) {
    writeClause('OBSERVAÇÕES COMPLEMENTARES', () => {
      writeParagraph(src.observacoes!);
    });
  }

  // --- Local e data ---
  y += 4;
  ensure(60);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(
    `${company.cidade || '____________'}, ${fmtDateLong(src.dataEmissao || src.dataInicio || new Date().toISOString())}.`,
    M, y
  );
  y += 16;

  // --- Assinaturas ---
  ensure(50);
  const colW = (W - M * 2 - 14) / 2;
  // LOCADORA
  doc.line(M, y, M + colW, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text((company.razao_social || src.companyRazaoSocial || 'LOCADORA').toUpperCase(), M, y + 5);
  doc.setFont('helvetica', 'normal');
  if (company.cnpj || src.companyCnpj) {
    doc.text(`CNPJ ${maskCnpj(company.cnpj || src.companyCnpj || '')}`, M, y + 10);
  }
  doc.setTextColor(120); doc.setFontSize(8);
  doc.text('LOCADORA', M, y + 15);
  doc.setTextColor(0);

  // LOCATÁRIA
  const x2 = M + colW + 14;
  doc.line(x2, y, x2 + colW, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text((customer.customer_name || src.customerName || 'LOCATÁRIA').toUpperCase(), x2, y + 5);
  doc.setFont('helvetica', 'normal');
  if (customer.document) doc.text(`${customer.document.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ'} ${maskDoc(customer.document)}`, x2, y + 10);
  doc.setTextColor(120); doc.setFontSize(8);
  doc.text('LOCATÁRIA', x2, y + 15);
  doc.setTextColor(0);

  y += 28;
  ensure(20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Testemunhas:', M, y);
  y += 10;
  doc.line(M, y, M + colW, y);
  doc.text('Nome:', M, y + 4);
  doc.text('CPF:', M, y + 9);
  doc.line(x2, y, x2 + colW, y);
  doc.text('Nome:', x2, y + 4);
  doc.text('CPF:', x2, y + 9);

  drawFooter();

  const filename = `contrato-${src.numero}.pdf`;
  doc.save(filename);
}
