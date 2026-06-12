import { API_BASE_URL } from './config';

const authHeaders = () => {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || 'Erro na requisição');
  }
  return res.json();
}

export type Modalidade = 'diaria' | 'mensal';
export type TipoLocacao = 'obra' | 'evento' | 'industria' | 'outro';
export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido';

export interface QuoteItem {
  id?: string;
  produto: string;
  descricao?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal?: number;
  ordem?: number;
}

export interface Quote {
  id: string;
  numero: string;
  companyId?: string;
  customerId?: string;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerDocument?: string;
  customerSnapshot?: any;
  companySnapshot?: any;
  modalidade: Modalidade;
  tipoLocacao?: TipoLocacao;
  dataEmissao: string;
  validadeDias: number;
  dataEntrega?: string | null;
  dataRecolhimento?: string | null;
  enderecoEntrega?: string | null;
  limpezasSemanais?: number | null;
  observacoes?: string;
  condicoesPagamento?: string;
  descontoPct: number;
  frete: number;
  subtotal: number;
  total: number;
  status: QuoteStatus;
  pdfGeradoEm?: string;
  createdAt: string;
  updatedAt: string;
  items?: QuoteItem[];
}

export const quotesService = {
  list: (params?: { status?: string; customerId?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return req<Quote[]>('GET', `/erp/quotes${q ? '?' + q : ''}`);
  },
  get: (id: string) => req<Quote>('GET', `/erp/quotes/${id}`),
  create: (data: Partial<Quote>) => req<{ id: string; numero: string }>('POST', '/erp/quotes', data),
  update: (id: string, data: Partial<Quote>) => req<{ ok: true }>('PUT', `/erp/quotes/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/quotes/${id}`),
  convertToOs: (id: string, body?: { dias?: number }) =>
    req<{ ok: true; osId: string; osNumero: string; sanitariosReservados: number }>(
      'POST', `/erp/quotes/${id}/convert-to-os`, body || {}),
};

export interface ServiceOrder {
  id: string;
  numero: string;
  quoteId?: string;
  companyId?: string;
  customerId?: string;
  customerName?: string;
  customerAddress?: string;
  customerLat?: number;
  customerLng?: number;
  companyRazaoSocial?: string;
  modalidade: Modalidade;
  tipoLocacao?: TipoLocacao;
  dataInicio: string;
  dataFimPrevista?: string;
  dataFechamento?: string;
  dataEntrega?: string | null;
  dataRecolhimento?: string | null;
  limpezasSemanais?: number | null;
  enderecoEntrega?: string | null;
  qtdReservada?: number;
  status: 'aberta' | 'fechada' | 'cancelada';
  valorTotal: number;
  observacoes?: string;
  createdAt: string;
  emAtraso?: boolean;
  sanitariosAlocados?: number;
  sanitariosEntregues?: number;
}

export const serviceOrdersService = {
  list: (params?: { status?: string; overdue?: boolean }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => {
        if (v !== undefined && v !== null && v !== '') acc[k] = String(v);
        return acc;
      }, {})
    ).toString();
    return req<ServiceOrder[]>('GET', `/erp/service-orders${q ? '?' + q : ''}`);
  },
  get: (id: string) => req<ServiceOrder & { sanitarios: any[]; items: any[]; companySnapshot: any; customer_snapshot?: any; quote_id?: string }>('GET', `/erp/service-orders/${id}`),
  create: (data: any) => req<{ id: string; numero: string }>('POST', '/erp/service-orders', data),
  close: (id: string, body?: { descricao?: string }) => req<{ ok: true; recolhidos?: boolean }>('POST', `/erp/service-orders/${id}/close`, body || {}),
  upcoming: () => req<Array<{ id: string; numero: string; dataEntrega: string; tipoLocacao?: string; enderecoEntrega?: string; customerName?: string; hoje: boolean; amanha: boolean }>>('GET', `/erp/service-orders/notifications/upcoming`),
  deliver: (id: string, body: { sanitarioNumeros: string[]; address?: string; notes?: string }) =>
    req<{ ok: true; delivered: string[] }>('POST', `/erp/service-orders/${id}/deliver`, body),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/service-orders/${id}`),
  overdueCount: () => req<{ overdue: number }>('GET', `/erp/service-orders/overdue/count`),
  financial: (params?: { from?: string; to?: string; status?: string; tipoLocacao?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => {
        if (v) acc[k] = String(v); return acc;
      }, {})
    ).toString();
    return req<{ rows: any[]; totals: { total: number; fechadas: number; abertas: number; count: number } }>(
      'GET', `/erp/service-orders/financial/summary${q ? '?' + q : ''}`);
  },
  movements: (params?: { from?: string; to?: string; sanitarioNumero?: string; type?: string; limit?: number }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => {
        if (v !== undefined && v !== null && v !== '') acc[k] = String(v); return acc;
      }, {})
    ).toString();
    return req<any[]>('GET', `/erp/service-orders/movements/history${q ? '?' + q : ''}`);
  },
  financialComplete: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).reduce((acc: any, [k, v]) => { if (v) acc[k] = String(v); return acc; }, {})
    ).toString();
    return req<{
      periodo: { from: string | null; to: string | null };
      os: any[]; items: any[]; sanitarios: any[]; manutencoes: any[];
      breakdowns: { porStatus: any[]; porModalidade: any[]; porTipoLocacao: any[]; porEmpresa: any[] };
      totais: {
        receitaTotal: number; receitaFechadas: number; receitaAbertas: number;
        receitaEmAtraso: number; custoManutencao: number; resultadoLiquido: number;
        qtdOs: number; qtdManutencoes: number;
      };
    }>('GET', `/erp/service-orders/financial/complete${q ? '?' + q : ''}`);
  },
};
