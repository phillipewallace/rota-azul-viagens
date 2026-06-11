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
  dataEmissao: string;
  validadeDias: number;
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
  companyRazaoSocial?: string;
  modalidade: Modalidade;
  dataInicio: string;
  dataFimPrevista?: string;
  dataFechamento?: string;
  status: 'aberta' | 'fechada' | 'cancelada';
  valorTotal: number;
  observacoes?: string;
  createdAt: string;
  emAtraso?: boolean;
  sanitariosAlocados?: number;
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
  get: (id: string) => req<ServiceOrder & { sanitarios: any[] }>('GET', `/erp/service-orders/${id}`),
  create: (data: any) => req<{ id: string; numero: string }>('POST', '/erp/service-orders', data),
  close: (id: string) => req<{ ok: true }>('POST', `/erp/service-orders/${id}/close`, {}),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/service-orders/${id}`),
  overdueCount: () => req<{ overdue: number }>('GET', `/erp/service-orders/overdue/count`),
};
