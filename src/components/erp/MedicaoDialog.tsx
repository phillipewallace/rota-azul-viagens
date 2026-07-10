/**
 * Nova/Editar Medição — permite escolher cliente e adicionar manualmente
 * contratos (nenhum vem marcado por padrão). Cada item vira uma linha
 * editável (descrição, qtd, valor unit., desconto por item). Rodapé com
 * desconto geral e observações.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { contractsService, type Contract } from '@/services/contracts';
import { medicoesService, type Medicao, type MedicaoItem } from '@/services/medicoes';
import { erpService, type ErpCompany } from '@/services/erp';
import { formatDateBR } from '@/utils/dateFormat';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  competencia: string;
  periodoInicioDefault?: string;
  periodoFimDefault?: string;
  editing?: Medicao | null;
  onSaved: (id: string) => void;
}

type Row = MedicaoItem & { key: string };

const rowFromContract = (c: Contract, periodoInicio: string, periodoFim: string): Row => ({
  key: `c-${c.id}-${Math.random()}`,
  contractId: c.id,
  contractNumero: c.numero,
  descricao: c.descricao || `Locação — Contrato ${c.numero}`,
  quantidade: 1,
  unidade: 'MÊS',
  valorUnit: Number(c.valorMensal || 0),
  descontoItem: 0,
  valorTotal: Number(c.valorMensal || 0),
  periodoInicio,
  periodoFim,
});

const rowEmpty = (): Row => ({
  key: `m-${Math.random()}`,
  contractId: null,
  contractNumero: null,
  descricao: '',
  quantidade: 1,
  unidade: 'UN',
  valorUnit: 0,
  descontoItem: 0,
  valorTotal: 0,
  periodoInicio: null,
  periodoFim: null,
});

export const MedicaoDialog: React.FC<Props> = ({
  open, onOpenChange, competencia, periodoInicioDefault, periodoFimDefault, editing, onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>('');
  const [customerDocument, setCustomerDocument] = useState<string>('');
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [periodoIni, setPeriodoIni] = useState(periodoInicioDefault || '');
  const [periodoFim, setPeriodoFim] = useState(periodoFimDefault || '');

  const [rows, setRows] = useState<Row[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState('');

  const [addContractSearch, setAddContractSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      contractsService.list({ ativo: true }).catch(() => [] as Contract[]),
      erpService.listCompanies().catch(() => [] as ErpCompany[]),
    ]).then(([cs, comps]) => {
      setContracts(cs);
      setCompanies(comps);
    }).finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCustomerId(editing.customerId || null);
      setCustomerLabel(editing.customerName || editing.clienteNome || '');
      setCustomerDocument(editing.customerDocument || editing.clienteDocumento || '');
      setCompanyId(editing.companyId || null);
      setPeriodoIni(editing.periodoInicio || periodoInicioDefault || '');
      setPeriodoFim(editing.periodoFim || periodoFimDefault || '');
      setDesconto(Number(editing.desconto || 0));
      setObservacoes(editing.observacoes || '');
      setRows((editing.items || []).map((it, i) => ({ ...it, key: `e-${i}` })));
    } else {
      setCustomerId(null); setCustomerLabel(''); setCustomerDocument('');
      setCompanyId(null);
      setPeriodoIni(periodoInicioDefault || '');
      setPeriodoFim(periodoFimDefault || '');
      setDesconto(0);
      setObservacoes('');
      setRows([]);
    }
  }, [open, editing, periodoInicioDefault, periodoFimDefault]);

  // Clientes distintos (via contratos ativos) — fonte simples pra picker.
  const customers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; document?: string }>();
    for (const c of contracts) {
      if (!c.customerId) continue;
      const key = c.customerId;
      if (!map.has(key)) {
        map.set(key, { id: c.customerId, name: c.customerName || '(sem nome)', document: c.customerDocument });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [contracts]);

  // Contratos disponíveis do cliente escolhido, menos os já adicionados.
  const contratosDoCliente = useMemo(() => {
    if (!customerId) return [];
    const usados = new Set(rows.map(r => r.contractId).filter(Boolean) as string[]);
    return contracts
      .filter(c => c.customerId === customerId && !usados.has(c.id))
      .filter(c => !addContractSearch || `${c.numero} ${c.descricao || ''}`.toLowerCase().includes(addContractSearch.toLowerCase()));
  }, [contracts, customerId, rows, addContractSearch]);

  const recalcRow = (r: Row): Row => {
    const total = Math.max(0, Number(r.quantidade || 0) * Number(r.valorUnit || 0) - Number(r.descontoItem || 0));
    return { ...r, valorTotal: total };
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => r.key === key ? recalcRow({ ...r, ...patch }) : r));
  };
  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));

  const addContract = (c: Contract) => {
    setRows(prev => [...prev, rowFromContract(c, periodoIni, periodoFim)]);
    if (!customerId && c.customerId) {
      setCustomerId(c.customerId);
      setCustomerLabel(c.customerName || '');
      setCustomerDocument(c.customerDocument || '');
    }
    if (!companyId && c.companyId) setCompanyId(c.companyId);
  };

  const addFreeItem = () => setRows(prev => [...prev, rowEmpty()]);

  const subtotal = rows.reduce((s, r) => s + Number(r.valorTotal || 0), 0);
  const total = Math.max(0, subtotal - Number(desconto || 0));

  const canSave = rows.length > 0 && !!customerId;

  const save = async () => {
    if (!canSave) { toast.error('Selecione um cliente e ao menos 1 item.'); return; }
    setSaving(true);
    try {
      const payload = {
        customerId: customerId || undefined,
        companyId: companyId || undefined,
        competencia,
        periodoInicio: periodoIni || undefined,
        periodoFim: periodoFim || undefined,
        desconto: Number(desconto || 0),
        observacoes: observacoes || undefined,
        items: rows.map((r, i) => ({
          contractId: r.contractId || null,
          contractNumero: r.contractNumero || null,
          descricao: r.descricao || '—',
          quantidade: Number(r.quantidade || 0),
          unidade: r.unidade || 'UN',
          valorUnit: Number(r.valorUnit || 0),
          descontoItem: Number(r.descontoItem || 0),
          periodoInicio: r.periodoInicio || null,
          periodoFim: r.periodoFim || null,
          ordem: i,
        })),
      };
      if (editing) {
        await medicoesService.update(editing.id, payload);
        toast.success(`Medição ${editing.numero} atualizada`);
        onSaved(editing.id);
      } else {
        const r = await medicoesService.create(payload);
        toast.success(`Medição ${r.numero} gerada`);
        onSaved(r.id);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar medição ${editing.numero}` : 'Nova medição'}</DialogTitle>
          <DialogDescription>
            Consolide produtos, quantidades e valores de um ou mais contratos do mesmo cliente para envio ao cliente antes do faturamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Cliente + empresa emissora + período */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={customerId || ''}
                disabled={!!editing}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setCustomerId(id);
                  const c = customers.find(x => x.id === id);
                  setCustomerLabel(c?.name || '');
                  setCustomerDocument(c?.document || '');
                  setRows([]); // troca de cliente limpa itens
                }}
              >
                <option value="">— Selecione —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.document ? ` · ${c.document}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Empresa emissora</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={companyId || ''}
                onChange={(e) => setCompanyId(e.target.value || null)}
              >
                <option value="">— Padrão do contrato —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.razaoSocial}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Período início</Label>
                <Input type="date" value={periodoIni} onChange={(e) => setPeriodoIni(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Período fim</Label>
                <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Adicionar contratos */}
          <div className="rounded-md border p-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-sm font-medium">Adicionar contratos ativos do cliente</div>
              <Input
                placeholder="Buscar por nº ou descrição…"
                className="max-w-xs"
                value={addContractSearch}
                onChange={(e) => setAddContractSearch(e.target.value)}
                disabled={!customerId}
              />
            </div>
            {!customerId && <div className="text-xs text-muted-foreground">Selecione um cliente para listar seus contratos.</div>}
            {customerId && contratosDoCliente.length === 0 && (
              <div className="text-xs text-muted-foreground">Nenhum contrato disponível{rows.length ? ' (todos já adicionados)' : ''}.</div>
            )}
            <div className="flex flex-wrap gap-2">
              {contratosDoCliente.map(c => (
                <Button
                  key={c.id}
                  variant="outline" size="sm" type="button"
                  onClick={() => addContract(c)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {c.numero} · {BRL(c.valorMensal)}
                </Button>
              ))}
              <Button variant="ghost" size="sm" type="button" onClick={addFreeItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Item avulso
              </Button>
            </div>
          </div>

          {/* Tabela de itens */}
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-2 py-2 w-8">#</th>
                  <th className="px-2 py-2 min-w-[220px]">Descrição</th>
                  <th className="px-2 py-2 w-20">Qtd</th>
                  <th className="px-2 py-2 w-16">Un</th>
                  <th className="px-2 py-2 w-32">V. unit.</th>
                  <th className="px-2 py-2 w-28">Desc. item</th>
                  <th className="px-2 py-2 w-32 text-right">Total</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-6 text-xs">
                    Adicione ao menos 1 item.
                  </td></tr>
                )}
                {rows.map((r, idx) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-2 py-1 text-xs text-muted-foreground">
                      {idx + 1}
                      {r.contractNumero && <div><Badge variant="outline" className="text-[10px]">{r.contractNumero}</Badge></div>}
                    </td>
                    <td className="px-2 py-1">
                      <Input value={r.descricao} onChange={(e) => updateRow(r.key, { descricao: e.target.value })} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.01" min="0" value={r.quantidade}
                        onChange={(e) => updateRow(r.key, { quantidade: Number(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1">
                      <Input value={r.unidade || ''} onChange={(e) => updateRow(r.key, { unidade: e.target.value })} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.01" min="0" value={r.valorUnit}
                        onChange={(e) => updateRow(r.key, { valorUnit: Number(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.01" min="0" value={r.descontoItem}
                        onChange={(e) => updateRow(r.key, { descontoItem: Number(e.target.value) })} />
                    </td>
                    <td className="px-2 py-1 text-right font-medium">{BRL(r.valorTotal)}</td>
                    <td className="px-2 py-1">
                      <Button variant="ghost" size="icon" onClick={() => removeRow(r.key)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rodapé: desconto + obs + totais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
            <div className="rounded-md border p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{BRL(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Desconto geral</span>
                <Input type="number" step="0.01" min="0" className="h-8 w-32 text-right"
                  value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
              </div>
              <div className="flex items-center justify-between text-base border-t pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary">{BRL(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !canSave}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editing ? 'Salvar alterações' : 'Gerar medição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
