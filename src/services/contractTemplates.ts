/**
 * Serviço de modelos de contrato (Obra / Evento).
 * Os modelos são globais e editáveis pela página de Configurações.
 */
const API = (import.meta as any).env?.VITE_API_URL || '/api';

function token() { return localStorage.getItem('token') || ''; }
async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json() as Promise<T>;
}

export type ContractTemplateTipo = 'obra' | 'evento';

export interface ContractTemplate {
  tipo: ContractTemplateTipo;
  titulo: string;
  corpoHtml: string;
  atualizadoEm?: string;
}

export const contractTemplatesService = {
  list:  () => req<ContractTemplate[]>('GET', '/erp/contract-templates'),
  get:   (tipo: ContractTemplateTipo) => req<ContractTemplate>('GET', `/erp/contract-templates/${tipo}`),
  save:  (tipo: ContractTemplateTipo, data: { titulo: string; corpoHtml: string }) =>
           req<{ ok: true }>('PUT', `/erp/contract-templates/${tipo}`, data),
  reset: (tipo: ContractTemplateTipo) =>
           req<{ ok: true }>('POST', `/erp/contract-templates/${tipo}/reset`),
};
