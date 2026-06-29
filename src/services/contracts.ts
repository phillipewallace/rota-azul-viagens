import { API_BASE_URL } from './config';

const headers = () => {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};
async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error || 'Erro na requisição');
  }
  return r.json();
}

// ===== Doc settings (numeração)
export interface DocSetting {
  doc: 'ORC' | 'OS' | 'CTR' | 'REC';
  startNumber: number;
  includeYear: boolean;
  padding: number;
  prefix?: string;
}
export const docSettingsService = {
  list: () => req<DocSetting[]>('GET', '/erp/doc-settings'),
  update: (doc: string, data: Partial<DocSetting>) => req<{ ok: true }>('PUT', `/erp/doc-settings/${doc}`, data),
};

// ===== Contratos
export interface Contract {
  id: string;
  numero: string;
  companyId?: string;
  customerId?: string;
  osId?: string;
  origem: 'manual' | 'sistema';
  descricao?: string;
  tipoContrato?: 'locacao' | 'evento' | 'obra';
  dataInicio: string;
  dataFim?: string | null;
  dataEvento?: string | null;
  dataRecolhimento?: string | null;
  localEvento?: string | null;
  horaEntrega?: string | null;
  valorTotalEvento?: number | null;
  diaVencimento: number;
  valorMensal: number;
  frete?: number | null;

  renovacaoAutomatica: boolean;
  ativo: boolean;
  encerradoEm?: string | null;
  motivoEncerramento?: string | null;
  pdfUrl?: string | null;
  observacoes?: string | null;
  companySnapshot?: any;
  customerSnapshot?: any;
  createdAt: string;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  companyLogoUrl?: string;
  customerName?: string;
  customerDocument?: string;
  osNumero?: string;
}
export const contractsService = {
  list: (params?: { ativo?: boolean; customerId?: string }) => {
    const q = new URLSearchParams();
    if (params?.ativo !== undefined) q.set('ativo', String(params.ativo));
    if (params?.customerId) q.set('customerId', params.customerId);
    const s = q.toString();
    return req<Contract[]>('GET', `/erp/contracts${s ? '?' + s : ''}`);
  },
  get: (id: string) => req<Contract>('GET', `/erp/contracts/${id}`),
  create: (data: Partial<Contract>) => req<{ id: string; numero: string }>('POST', '/erp/contracts', data),
  update: (id: string, data: Partial<Contract>) => req<{ ok: true }>('PUT', `/erp/contracts/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/contracts/${id}`),
};

// ===== Recibos
export type ReceiptStatus = 'aberto' | 'pago' | 'parcial' | 'cancelado';
export type FormaPagamento = 'pix' | 'dinheiro' | 'boleto' | 'cartao' | 'transferencia' | 'outro';

export interface Receipt {
  id: string;
  numero: string;
  contractId: string;
  competencia: string; // YYYY-MM
  dataEmissao: string;
  dataVencimento?: string;
  valor: number;
  pago: boolean;
  status: ReceiptStatus;
  formaPagamento?: FormaPagamento | null;
  dataPagamento?: string | null;
  valorPago?: number | null;
  canceladoEm?: string | null;
  motivoCancelamento?: string | null;
  snapshot: any;
  pdfGeradoEm?: string;
  createdAt: string;
  contractNumero?: string;
  diaVencimento?: number;
  valorMensal?: number;
  contractAtivo?: boolean;
  renovacaoAutomatica?: boolean;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerDocument?: string;
}
export interface PendingReceipt {
  contractId: string;
  contractNumero: string;
  valorMensal: number;
  diaVencimento: number;
  dataInicio: string;
  renovacaoAutomatica: boolean;
  companyId?: string;
  customerId?: string;
  companyRazaoSocial?: string;
  companyCnpj?: string;
  customerName?: string;
  customerDocument?: string;
}
export interface ReceiptsSummaryPoint {
  competencia: string;
  recebido: number;
  aberto: number;
  gasto: number;
  resultado: number;
}
export const receiptsService = {
  list: (params?: { contractId?: string; competencia?: string; pago?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.contractId) q.set('contractId', params.contractId);
    if (params?.competencia) q.set('competencia', params.competencia);
    if (params?.pago !== undefined) q.set('pago', String(params.pago));
    const s = q.toString();
    return req<Receipt[]>('GET', `/erp/receipts${s ? '?' + s : ''}`);
  },
  pending: (competencia?: string) =>
    req<{ competencia: string; pendentes: PendingReceipt[] }>(
      'GET', `/erp/receipts/pending${competencia ? '?competencia=' + competencia : ''}`),
  generate: (body: { contractId: string; competencia?: string; valor?: number; pago?: boolean; regerar?: boolean }) =>
    req<{ ok: true; id: string; numero: string; regerado?: boolean }>('POST', '/erp/receipts/generate', body),
  remove: (id: string, force = false) =>
    req<{ ok: true }>('DELETE', `/erp/receipts/${id}${force ? '?force=1' : ''}`),
  cancel: (id: string, motivo: string) =>
    req<{ ok: true }>('POST', `/erp/receipts/${id}/cancel`, { motivo }),
  summary: (months = 12) =>
    req<{ series: ReceiptsSummaryPoint[] }>('GET', `/erp/receipts/summary?months=${months}`),
};

// ===== Gastos
export interface Expense {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  fornecedor?: string;
  notaFiscal?: string;
  anexoUrl?: string;
  observacoes?: string;
  origem?: 'manual' | 'manutencao';
  createdAt?: string;
}
export const expensesService = {
  list: (params?: { from?: string; to?: string; categoria?: string; origem?: 'manual' | 'manutencao' | 'all' }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to)   q.set('to', params.to);
    if (params?.categoria) q.set('categoria', params.categoria);
    if (params?.origem && params.origem !== 'all') q.set('origem', params.origem);
    const s = q.toString();
    return req<Expense[]>('GET', `/erp/expenses${s ? '?' + s : ''}`);
  },
  create: (data: Partial<Expense>) => req<Expense>('POST', '/erp/expenses', data),
  update: (id: string, data: Partial<Expense>) => req<{ ok: true }>('PUT', `/erp/expenses/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/expenses/${id}`),
};

// ===== Categorias de gastos (dinâmicas)
export interface ExpenseCategory {
  id: string;
  key: string;
  label: string;
  color?: string | null;
  ativo: boolean;
  ordem: number;
}
export const expenseCategoriesService = {
  list: () => req<ExpenseCategory[]>('GET', '/erp/expense-categories'),
  create: (data: { key?: string; label: string; color?: string; ordem?: number }) =>
    req<ExpenseCategory>('POST', '/erp/expense-categories', data),
  update: (id: string, data: Partial<ExpenseCategory>) =>
    req<{ ok: true }>('PUT', `/erp/expense-categories/${id}`, data),
  remove: (id: string) => req<{ ok: true; inactivated?: boolean }>('DELETE', `/erp/expense-categories/${id}`),
};

// ===== Gastos recorrentes
export interface RecurringExpense {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  diaMes: number;
  fornecedor?: string | null;
  observacoes?: string | null;
  ativo: boolean;
  lastGeneratedCompetencia?: string | null;
  createdAt?: string;
}
export const recurringExpensesService = {
  list: () => req<RecurringExpense[]>('GET', '/erp/recurring-expenses'),
  create: (data: Partial<RecurringExpense>) =>
    req<RecurringExpense>('POST', '/erp/recurring-expenses', data),
  update: (id: string, data: Partial<RecurringExpense>) =>
    req<{ ok: true }>('PUT', `/erp/recurring-expenses/${id}`, data),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/erp/recurring-expenses/${id}`),
  run: (competencia?: string) =>
    req<{ ok: true; competencia: string; geradas: number; totalAtivas: number }>(
      'POST', `/erp/recurring-expenses/run${competencia ? '?competencia=' + competencia : ''}`),
};

// ===== Mark receipt paid / unpaid (with rich payment info)
export const receiptsExtraService = {
  markPaid: async (contractId: string, competencia: string, valor?: number) =>
    receiptsService.generate({ contractId, competencia, valor, pago: true }),
  togglePaid: async (
    receiptId: string,
    pago: boolean,
    extra?: { formaPagamento?: FormaPagamento; dataPagamento?: string; valorPago?: number }
  ) => {
    const r = await fetch(`${API_BASE_URL}/erp/receipts/${receiptId}/pago`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ pago, ...(extra || {}) }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erro');
    return r.json();
  },
};
