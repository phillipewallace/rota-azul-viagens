/**
 * ERP — Orçamentos: lista, editor com múltiplos itens, PDF profissional,
 * conversão em OS (reserva sanitários do estoque automaticamente).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, FileText, Trash2, Search, Loader2, Save, Download,
  CheckCircle2, RefreshCcw, FileDown, AlertCircle, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { quotesService, Quote, QuoteItem } from '@/services/quotes';
import { erpService, ErpCompany } from '@/services/erp';
import { useCustomers } from '@/hooks/useCustomers';
import { generateQuotePdf } from '@/utils/quotePdf';
import { generateContractPdf } from '@/utils/contractPdf';
import { FileSignature } from 'lucide-react';
import { OBSERVACAO_FIXA_LOCACAO, describeFormaPagamento, calcVencimentoBoleto, type FormaPagamento } from '@/utils/fixedObservations';
import { formatDateBR } from '@/utils/dateFormat';

import { confirmDialog } from '@/lib/confirm';
const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface EditorState {
  id?: string;
  companyId?: string;
  customerId?: string;
  modalidade: 'diaria' | 'mensal';
  tipoLocacao?: 'obra' | 'evento' | 'industria' | 'outro';
  validadeDias: number;
  dataEntrega?: string;
  dataRecolhimento?: string;
  enderecoEntrega?: string;
  limpezasSemanais?: number;
  descontoPct: number;
  frete: number;
  observacoes: string;
  condicoesPagamento: string;
  formaPagamento?: FormaPagamento;
  status: Quote['status'];
  items: QuoteItem[];
}

let __itemUid = 0;
const withUid = <T extends object>(it: T): T & { __uid: number } => ({ ...(it as T), __uid: ++__itemUid });

const emptyEditor = (): EditorState => ({
  modalidade: 'mensal', tipoLocacao: 'evento', validadeDias: 15, descontoPct: 0, frete: 0,
  dataEntrega: '', dataRecolhimento: '', enderecoEntrega: '', limpezasSemanais: 1,
  observacoes: '', condicoesPagamento: '',
  formaPagamento: 'boleto',
  status: 'rascunho',
  items: [withUid({ produto: 'Sanitário Químico Standard', descricao: '', quantidade: 1, valorUnitario: 0 })],
});

const statusBadge: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-700',
  enviado: 'bg-blue-100 text-blue-700',
  aprovado: 'bg-green-100 text-green-700',
  recusado: 'bg-red-100 text-red-700',
  convertido: 'bg-purple-100 text-purple-700',
};

const ErpQuotes: React.FC = () => {
  const [list, setList] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const { customers } = useCustomers();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [qs, cs] = await Promise.all([quotesService.list(), erpService.listCompanies()]);
      setList(qs); setCompanies(cs);
    } catch (e: any) { toast.error(e.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(q =>
      q.numero?.toLowerCase().includes(s) ||
      q.customerName?.toLowerCase().includes(s) ||
      q.companyRazaoSocial?.toLowerCase().includes(s)
    );
  }, [list, search]);

  // ---- Editor helpers ----
  const subtotal = useMemo(() => {
    if (!editing) return 0;
    return editing.items.reduce((acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0);
  }, [editing]);
  const total = useMemo(() => {
    if (!editing) return 0;
    const desc = subtotal * (Number(editing.descontoPct) || 0) / 100;
    return Math.max(0, subtotal - desc + (Number(editing.frete) || 0));
  }, [subtotal, editing]);

  const openNew = () => setEditing(emptyEditor());
  const openEdit = async (id: string) => {
    try {
      const q = await quotesService.get(id);
      setEditing({
        id: q.id, companyId: q.companyId, customerId: q.customerId,
        modalidade: q.modalidade, tipoLocacao: (q as any).tipoLocacao || undefined,
        validadeDias: q.validadeDias,
        dataEntrega: q.dataEntrega ? String(q.dataEntrega).slice(0, 10) : '',
        dataRecolhimento: q.dataRecolhimento ? String(q.dataRecolhimento).slice(0, 10) : '',
        enderecoEntrega: q.enderecoEntrega || '',
        limpezasSemanais: q.limpezasSemanais ?? undefined,
        descontoPct: Number(q.descontoPct), frete: Number(q.frete),
        observacoes: q.observacoes || '', condicoesPagamento: q.condicoesPagamento || '',
        formaPagamento: (q.formaPagamento as FormaPagamento) || 'boleto',
        status: q.status,
        items: q.items?.length ? q.items : [{ produto: '', quantidade: 1, valorUnitario: 0 }],
      });
    } catch (e: any) { toast.error(e.message); }
  };

  const updateItem = (i: number, patch: Partial<QuoteItem>) => {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });
  };
  const addItem = () => editing && setEditing({ ...editing, items: [...editing.items, { produto: '', quantidade: 1, valorUnitario: 0 }] });
  const removeItem = (i: number) => editing && setEditing({ ...editing, items: editing.items.filter((_, idx) => idx !== i) });

  const save = async (): Promise<Quote | null> => {
    if (!editing) return null;
    if (!editing.companyId) { toast.error('Selecione a empresa emissora'); return null; }
    if (!editing.customerId) { toast.error('Selecione o cliente'); return null; }
    if (!editing.items.length) { toast.error('Adicione pelo menos 1 item'); return null; }
    setSaving(true);
    try {
      let id = editing.id;
      const payload: any = { ...editing };
      if (payload.tipoLocacao === 'evento' || payload.tipoLocacao === 'outro') payload.limpezasSemanais = undefined;
      // Sincroniza o texto livre com a forma escolhida (compat. com PDFs antigos).
      payload.condicoesPagamento = describeFormaPagamento(payload.formaPagamento, payload.dataEntrega);
      if (id) await quotesService.update(id, payload);
      else {
        const r = await quotesService.create(payload);
        id = r.id;
      }
      toast.success('Orçamento salvo');
      await load();
      const full = await quotesService.get(id!);
      setEditing({
        id: full.id, companyId: full.companyId, customerId: full.customerId,
        modalidade: full.modalidade, tipoLocacao: (full as any).tipoLocacao || undefined,
        validadeDias: full.validadeDias,
        dataEntrega: full.dataEntrega ? String(full.dataEntrega).slice(0, 10) : '',
        dataRecolhimento: full.dataRecolhimento ? String(full.dataRecolhimento).slice(0, 10) : '',
        enderecoEntrega: full.enderecoEntrega || '',
        limpezasSemanais: full.limpezasSemanais ?? undefined,
        descontoPct: Number(full.descontoPct), frete: Number(full.frete),
        observacoes: full.observacoes || '', condicoesPagamento: full.condicoesPagamento || '',
        formaPagamento: (full.formaPagamento as FormaPagamento) || 'boleto',
        status: full.status, items: full.items || [],
      });
      return full;
    } catch (e: any) { toast.error(e.message); return null; }
    finally { setSaving(false); }
  };

  const exportPdf = async () => {
    const q = await save();
    if (!q) return;
    try { generateQuotePdf(q); toast.success('PDF gerado'); }
    catch (e: any) { toast.error('Erro ao gerar PDF: ' + e.message); }
  };

  const exportContract = async () => {
    const q = await save();
    if (!q) return;
    try {
      generateContractPdf({
        numero: q.numero,
        tipo: 'orcamento',
        tipoContrato: (() => {
          const t = ((q as any).tipoLocacao || '').toLowerCase();
          if (t === 'evento') return 'evento';
          if (t === 'obra') return 'obra';
          return 'locacao';
        })(),
        modalidade: q.modalidade,
        dataEmissao: q.dataEmissao,
        dataEntrega: q.dataEntrega,
        dataRecolhimento: (q as any).dataRecolhimento || null,
        horaEntrega: (q as any).horaEntrega || null,
        localEvento: (q as any).localEvento || null,
        validadeDias: q.validadeDias,
        limpezasSemanais: q.limpezasSemanais,
        enderecoEntrega: q.enderecoEntrega,
        observacoes: q.observacoes,
        condicoesPagamento: q.condicoesPagamento,
        formaPagamento: q.formaPagamento || null,
        dataVencimento: q.formaPagamento === 'boleto' ? calcVencimentoBoleto(q.dataEntrega) : null,
        frete: q.frete,
        total: q.total,
        companySnapshot: q.companySnapshot,
        customerSnapshot: q.customerSnapshot,
        companyRazaoSocial: q.companyRazaoSocial,
        companyCnpj: q.companyCnpj,
        customerName: q.customerName,
        items: q.items,
      });

      toast.success('Contrato gerado');
    } catch (e: any) { toast.error('Erro ao gerar contrato: ' + e.message); }
  };

  const convertToOs = async () => {
    if (!editing?.id) { toast.error('Salve o orçamento antes'); return; }
    const dias = editing.modalidade === 'diaria'
      ? parseInt(prompt('Quantos dias de locação?', '1') || '1') || 1
      : 30;
    try {
      const r = await quotesService.convertToOs(editing.id, { dias });
      toast.success(`OS ${r.osNumero} criada · ${r.sanitariosReservados} sanitário(s) reservado(s)`);
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeQuote = async (id: string) => {
    if (!(await confirmDialog({ description: 'Excluir este orçamento?', destructive: true }))) return;
    try { await quotesService.remove(id); toast.success('Excluído'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Orçamentos</h1>
            <Badge variant="secondary">{list.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" />Recarregar</Button>
            <Button size="sm" onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" />Novo orçamento
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por número, cliente ou empresa…"
                     value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum orçamento</p>
            <p className="text-sm">Clique em "Novo orçamento" para começar.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(q => (
              <Card key={q.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm">{q.numero}</div>
                      <div className="text-sm font-semibold truncate">{q.customerName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{q.companyRazaoSocial}</div>
                    </div>
                    <Badge className={statusBadge[q.status]}>{q.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{q.modalidade === 'diaria' ? '🗓 Diária' : '📅 Mensal'}</span>
                    <span>{formatDateBR(q.dataEmissao)}</span>
                  </div>
                  {q.tipoLocacao && (
                    <Badge variant="outline" className="text-[10px]">
                      {q.tipoLocacao === 'obra' ? '🏗️ Obra' :
                       q.tipoLocacao === 'evento' ? '🎉 Evento' :
                       q.tipoLocacao === 'industria' ? '🏭 Indústria' : 'Outro'}
                    </Badge>
                  )}
                  <div className="text-right font-bold text-lg text-primary">{BRL(q.total)}</div>
                  <div className="flex gap-1 pt-2 border-t">
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => openEdit(q.id)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-blue-700 hover:bg-blue-50"
                            title="Duplicar orçamento"
                            onClick={async () => {
                              try {
                                const r = await quotesService.duplicate(q.id);
                                toast.success(`Orçamento ${r.numero} criado`);
                                await load();
                                openEdit(r.id);
                              } catch (e: any) { toast.error(e.message); }
                            }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {q.status !== 'convertido' && (
                      <Button size="sm" variant="ghost" className="text-purple-700 hover:bg-purple-50"
                              title="Converter em Ordem de Serviço"
                              onClick={async () => {
                                if (!(await confirmDialog({ description: `Converter ${q.numero} em OS?`, destructive: true }))) return;
                                const dias = q.modalidade === 'diaria'
                                  ? parseInt(prompt('Dias de locação?', '1') || '1') || 1 : 30;
                                try {
                                  const r = await quotesService.convertToOs(q.id, { dias });
                                  toast.success(`OS ${r.osNumero} criada · ${r.sanitariosReservados} reservados`);
                                  load();
                                } catch (e: any) { toast.error(e.message); }
                              }}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => removeQuote(q.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Editar orçamento` : 'Novo orçamento'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {/* Cabeçalho do orçamento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Empresa emissora (CNPJ) *</label>
                  <select className="w-full border rounded-md h-10 px-2 bg-background"
                          value={editing.companyId || ''}
                          onChange={e => setEditing({ ...editing, companyId: e.target.value || undefined })}>
                    <option value="">— Selecione —</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.razaoSocial} · {c.cnpj}</option>
                    ))}
                  </select>
                  {!companies.length && (
                    <p className="text-[10px] text-orange-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" /> Cadastre uma empresa em Configurações.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cliente *</label>
                  <select className="w-full border rounded-md h-10 px-2 bg-background"
                          value={editing.customerId || ''}
                          onChange={e => setEditing({ ...editing, customerId: e.target.value || undefined })}>
                    <option value="">— Selecione —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customerName}{c.document ? ` · ${c.document}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Modalidade *</label>
                  <div className="flex gap-1">
                    <Button type="button" variant={editing.modalidade === 'diaria' ? 'default' : 'outline'}
                            size="sm" className="flex-1"
                            onClick={() => setEditing({ ...editing, modalidade: 'diaria' })}>Diária</Button>
                    <Button type="button" variant={editing.modalidade === 'mensal' ? 'default' : 'outline'}
                            size="sm" className="flex-1"
                            onClick={() => setEditing({ ...editing, modalidade: 'mensal' })}>Mensal</Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo de locação</label>
                  <div className="flex gap-1 flex-wrap">
                    {([
                      { v: 'obra', l: '🏗️ Obra' },
                      { v: 'evento', l: '🎉 Evento' },
                      { v: 'industria', l: '🏭 Indústria' },
                      { v: 'outro', l: 'Outro' },
                    ] as const).map(o => (
                      <Button key={o.v} type="button" size="sm"
                              variant={editing.tipoLocacao === o.v ? 'default' : 'outline'}
                              onClick={() => setEditing({ ...editing, tipoLocacao: o.v })}>
                        {o.l}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data de entrega (opcional)</label>
                  <Input type="date" value={editing.dataEntrega || ''}
                         onChange={e => setEditing({ ...editing, dataEntrega: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Pode ficar em branco e ser preenchida depois.
                  </p>
                </div>
                {editing.modalidade === 'mensal' && editing.tipoLocacao !== 'evento' && editing.tipoLocacao !== 'outro' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Limpezas por semana</label>
                    <Input type="number" min={0} max={7} step={1}
                           value={editing.limpezasSemanais ?? ''}
                           onChange={e => setEditing({ ...editing, limpezasSemanais: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Quantidade de manutenções/limpezas previstas por semana.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Endereço de entrega</label>
                  <Textarea rows={2} value={editing.enderecoEntrega || ''}
                            onChange={e => setEditing({ ...editing, enderecoEntrega: e.target.value })}
                            placeholder="Endereço onde os sanitários serão instalados (usado no contrato e ao vincular sanitários)" />
                </div>
                {editing.tipoLocacao === 'evento' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Data de recolhimento</label>
                    <Input type="date" value={editing.dataRecolhimento || ''}
                           onChange={e => setEditing({ ...editing, dataRecolhimento: e.target.value })} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Em eventos, o fechamento da OS dispara o recolhimento automático.
                    </p>
                  </div>
                )}
              </div>

              {/* Tabela de itens */}
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr_90px_120px_120px_40px] gap-2 px-3 py-2 bg-gray-100 text-xs font-semibold">
                  <div>Produto</div>
                  <div>Descrição</div>
                  <div className="text-right">Qtd</div>
                  <div className="text-right">Valor Unit.</div>
                  <div className="text-right">Total</div>
                  <div />
                </div>
                {editing.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2fr_90px_120px_120px_40px] gap-2 px-3 py-2 border-t items-center">
                    <Input value={it.produto} placeholder="Ex.: Sanitário Standard"
                           onChange={e => updateItem(i, { produto: e.target.value })} />
                    <Input value={it.descricao || ''} placeholder="Opcional"
                           onChange={e => updateItem(i, { descricao: e.target.value })} />
                    <Input type="number" min={0} step="0.01" className="text-right"
                           value={it.quantidade}
                           onChange={e => updateItem(i, { quantidade: parseFloat(e.target.value) || 0 })} />
                    <Input type="number" min={0} step="0.01" className="text-right"
                           value={it.valorUnitario}
                           onChange={e => updateItem(i, { valorUnitario: parseFloat(e.target.value) || 0 })} />
                    <div className="text-right text-sm font-semibold tabular-nums">
                      {BRL(Number(it.quantidade) * Number(it.valorUnitario))}
                    </div>
                    <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50"
                            aria-label="Remover item do orçamento"
                            onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="px-3 py-2 border-t bg-gray-50">
                  <Button size="sm" variant="ghost" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />Adicionar item
                  </Button>
                </div>
              </div>

              {/* Resumo + condições */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Forma de pagamento *</label>
                    <div className="flex gap-1">
                      {([
                        { v: 'cartao', l: '💳 Cartão' },
                        { v: 'pix', l: '⚡ PIX' },
                        { v: 'boleto', l: '🧾 Boleto' },
                      ] as const).map(o => (
                        <Button key={o.v} type="button" size="sm" className="flex-1"
                                variant={editing.formaPagamento === o.v ? 'default' : 'outline'}
                                onClick={() => setEditing({ ...editing, formaPagamento: o.v })}>
                          {o.l}
                        </Button>
                      ))}
                    </div>
                    {editing.formaPagamento === 'boleto' && (
                      <p className="text-[11px] text-blue-700 mt-1">
                        Vencimento do boleto: <strong>{formatDateBR(calcVencimentoBoleto(editing.dataEntrega))}</strong>
                        {' '}(28 dias após a entrega — regra fixa).
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Observações livres</label>
                    <Textarea rows={2} value={editing.observacoes}
                              onChange={e => setEditing({ ...editing, observacoes: e.target.value })}
                              placeholder="Observações específicas deste orçamento (opcional)" />
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900 whitespace-pre-line">
                    <div className="font-semibold mb-1">Observações fixas (sempre incluídas no orçamento e na OS):</div>
                    {OBSERVACAO_FIXA_LOCACAO}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Validade (dias)</label>
                      <Input type="number" min={1} value={editing.validadeDias}
                             onChange={e => setEditing({ ...editing, validadeDias: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Desconto (%)</label>
                      <Input type="number" min={0} max={100} step="0.01" value={editing.descontoPct}
                             onChange={e => setEditing({ ...editing, descontoPct: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Frete (R$)</label>
                      <Input type="number" min={0} step="0.01" value={editing.frete}
                             onChange={e => setEditing({ ...editing, frete: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span className="tabular-nums">{BRL(subtotal)}</span></div>
                  <div className="flex justify-between text-sm text-red-700">
                    <span>Desconto ({editing.descontoPct || 0}%)</span>
                    <span className="tabular-nums">- {BRL(subtotal * (editing.descontoPct || 0) / 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm"><span>Frete</span><span className="tabular-nums">{BRL(editing.frete)}</span></div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg text-primary">
                    <span>Total</span><span className="tabular-nums">{BRL(total)}</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <select className="w-full border rounded-md h-10 px-2 bg-background"
                            value={editing.status}
                            onChange={e => setEditing({ ...editing, status: e.target.value as Quote['status'] })}>
                      <option value="rascunho">Rascunho</option>
                      <option value="enviado">Enviado</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="recusado">Recusado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Fechar</Button>
            <Button variant="outline" onClick={exportPdf} disabled={saving}>
              <FileDown className="h-4 w-4 mr-1" />Salvar e gerar PDF
            </Button>
            <Button variant="outline" onClick={exportContract} disabled={saving} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <FileSignature className="h-4 w-4 mr-1" />Gerar contrato
            </Button>
            <Button variant="outline" onClick={convertToOs} disabled={!editing?.id}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Converter em OS
            </Button>
            <Button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErpQuotes;
