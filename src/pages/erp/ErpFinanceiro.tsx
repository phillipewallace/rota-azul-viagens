/**
 * ERP · Financeiro — Pendentes / Recibos / Gastos.
 * Recibos: filtros por período/cliente/empresa/status + marcar pago sem gerar PDF.
 * Gastos: lista despesas manuais + manutenção, com totalizadores.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, Loader2, Download, RefreshCw, Receipt as ReceiptIcon,
  CalendarDays, CheckCircle2, AlertCircle, Filter, Plus, Trash2, Wrench, TrendingDown, TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  receiptsService, type Receipt, type PendingReceipt,
  receiptsExtraService, expensesService, type Expense,
} from '@/services/contracts';
import { uploadSignedPdf } from '@/services/erp';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { generateReceiptPdf } from '@/utils/receiptPdf';
import { formatDateBR } from '@/utils/dateFormat';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string) => s ? formatDateBR(s) : '—';

const compAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const formatComp = (c: string) => {
  const [a, m] = (c || '').split('-');
  const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return m ? `${meses[Number(m)]}/${a}` : c;
};

const ErpFinanceiro: React.FC = () => {
  const [competencia, setCompetencia] = useState(compAtual());
  const [pendentes, setPendentes] = useState<PendingReceipt[]>([]);
  const [recibos, setRecibos] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  // filtros recibos
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'aberto'>('all');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        receiptsService.pending(competencia),
        // Sem filtro de competência se from/to definidos
        receiptsService.list(filterFrom || filterTo ? {} : { competencia }),
      ]);
      setPendentes(p.pendentes);
      setRecibos(r);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [competencia, filterFrom, filterTo]);

  // [#11 alto] dependências completas — filtros client-side não disparam refetch
  // por design, mas `load` agora é estável via useCallback.
  useEffect(() => { load(); }, [load]);


  const recibosFiltrados = useMemo(() => {
    return recibos.filter(r => {
      if (filterStatus === 'pago' && !r.pago) return false;
      if (filterStatus === 'aberto' && r.pago) return false;
      if (filterCliente && !(r.customerName || '').toLowerCase().includes(filterCliente.toLowerCase())) return false;
      if (filterEmpresa && !(r.companyRazaoSocial || '').toLowerCase().includes(filterEmpresa.toLowerCase())) return false;
      if (filterFrom && new Date(r.dataEmissao) < new Date(filterFrom)) return false;
      if (filterTo   && new Date(r.dataEmissao) > new Date(filterTo)) return false;
      return true;
    });
  }, [recibos, filterStatus, filterCliente, filterEmpresa, filterFrom, filterTo]);

  const totals = useMemo(() => {
    const recebido = recibosFiltrados.filter(r => r.pago).reduce((a, r) => a + Number(r.valor || 0), 0);
    const aberto   = recibosFiltrados.filter(r => !r.pago).reduce((a, r) => a + Number(r.valor || 0), 0);
    const pendente = pendentes.reduce((a, p) => a + Number(p.valorMensal || 0), 0);
    return { recebido, aberto, pendente, total: recebido + aberto + pendente };
  }, [recibosFiltrados, pendentes]);

  const gerar = async (p: PendingReceipt, opts?: { semPdf?: boolean }) => {
    setWorking(p.contractId);
    try {
      const out = await receiptsService.generate({
        contractId: p.contractId, competencia, valor: Number(p.valorMensal), pago: true,
      });
      toast.success(`Recibo ${out.numero} gerado (pago)`);
      await load();
      if (!opts?.semPdf) {
        try {
          const list = await receiptsService.list({ competencia, contractId: p.contractId });
          const r = list.find(x => x.id === out.id);
          if (r) await generateReceiptPdf(r);
        } catch {}
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const regerar = async (r: Receipt) => {
    setWorking(r.id);
    try {
      await receiptsService.generate({ contractId: r.contractId, competencia: r.competencia, regerar: true, valor: Number(r.valor) });
      toast.success('Recibo re-gerado');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const togglePago = async (r: Receipt) => {
    setWorking(r.id);
    try {
      await receiptsExtraService.togglePaid(r.id, !r.pago);
      toast.success(r.pago ? 'Marcado em aberto' : 'Marcado como pago');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const baixar = async (r: Receipt) => {
    try { await generateReceiptPdf(r); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">
            <DollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Recibos, Contratos & Gastos</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Contratos ativos geram recibos mensais. Gastos puxam manutenções automaticamente.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Competência</Label>
            <Input type="month" value={competencia}
              onChange={(e) => setCompetencia(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPI label="Recebido" value={BRL(totals.recebido)} icon={CheckCircle2} accent="from-emerald-500 to-teal-600" />
        <KPI label="Em aberto" value={BRL(totals.aberto)} icon={AlertCircle} accent="from-amber-500 to-orange-600" />
        <KPI label="Pendente do mês" value={BRL(totals.pendente)} icon={AlertCircle} accent="from-rose-500 to-red-600" />
        <KPI label="Total previsto" value={BRL(totals.total)} icon={DollarSign} accent="from-indigo-500 to-purple-600" />
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes <Badge variant="outline" className="ml-2">{pendentes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="emitidos">
            Recibos <Badge variant="outline" className="ml-2">{recibosFiltrados.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="gastos">
            Gastos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        Nenhuma cobrança pendente para {formatComp(competencia)}.
                      </TableCell></TableRow>
                    )}
                    {pendentes.map(p => (
                      <TableRow key={p.contractId}>
                        <TableCell className="font-mono text-xs">{p.contractNumero}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.customerName || '—'}</TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[160px] truncate">{p.companyRazaoSocial || '—'}</TableCell>
                        <TableCell className="text-xs">dia {p.diaVencimento}</TableCell>
                        <TableCell className="text-right font-semibold">{BRL(Number(p.valorMensal))}</TableCell>
                        <TableCell className="text-right whitespace-nowrap space-x-1">
                          <Button size="sm" variant="outline" onClick={() => gerar(p, { semPdf: true })}
                            disabled={working === p.contractId} title="Apenas marcar pago, sem baixar PDF">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar pago
                          </Button>
                          <Button size="sm" onClick={() => gerar(p)} disabled={working === p.contractId}
                            className="bg-emerald-600 hover:bg-emerald-700">
                            {working === p.contractId
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              : <ReceiptIcon className="h-3.5 w-3.5 mr-1" />}
                            Gerar recibo
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emitidos">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3 items-end border-b">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <div>
                <Label className="text-xs">Cliente</Label>
                <Input value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
                  className="h-9 w-[180px]" placeholder="Nome do cliente" />
              </div>
              <div>
                <Label className="text-xs">Empresa</Label>
                <Input value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}
                  className="h-9 w-[180px]" placeholder="Razão social" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                  <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pago">Pagos</SelectItem>
                    <SelectItem value="aberto">Em aberto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                setFilterStatus('all'); setFilterCliente(''); setFilterEmpresa('');
                setFilterFrom(''); setFilterTo('');
              }}>Limpar</Button>
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recibosFiltrados.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">
                        Sem recibos para os filtros selecionados.
                      </TableCell></TableRow>
                    )}
                    {recibosFiltrados.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-bold">{r.numero}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">{r.contractNumero}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{r.customerName || '—'}</TableCell>
                        <TableCell className="text-xs">{D(r.dataEmissao)}</TableCell>
                        <TableCell className="text-xs">{D(r.dataVencimento)}</TableCell>
                        <TableCell className="text-right font-semibold">{BRL(Number(r.valor))}</TableCell>
                        <TableCell>
                          <button onClick={() => togglePago(r)} title="Alternar status"
                            className="cursor-pointer">
                            {r.pago
                              ? <Badge className="bg-emerald-600 hover:bg-emerald-700">Pago</Badge>
                              : <Badge variant="secondary">Em aberto</Badge>}
                          </button>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => baixar(r)}>
                            <Download className="h-3.5 w-3.5 mr-1" /> PDF
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => regerar(r)}
                            disabled={working === r.id} title="Re-gerar recibo">
                            {working === r.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RefreshCw className="h-3.5 w-3.5" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gastos">
          <GastosPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const KPI = ({ label, value, icon: Icon, accent }: any) => (
  <Card className="border-0 shadow-md overflow-hidden">
    <CardContent className="p-0">
      <div className={`bg-gradient-to-br ${accent} p-4 text-white`}>
        <Icon className="h-5 w-5 opacity-80 mb-2" />
        <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
        <p className="text-2xl font-bold mt-1 break-words">{value}</p>
      </div>
    </CardContent>
  </Card>
);

// ============================================================
// Gastos
// ============================================================
const CAT_LABEL: Record<string, string> = {
  combustivel: 'Combustível',
  aluguel: 'Aluguel',
  folha: 'Folha de pagamento',
  nf: 'Nota fiscal',
  manutencao: 'Manutenção',
  outros: 'Outros',
};

function GastosPanel() {
  const [list, setList] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Expense>>({
    categoria: 'outros', descricao: '', valor: 0, data: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setList(await expensesService.list({ from: from || undefined, to: to || undefined, categoria: cat })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, cat]);

  const total = useMemo(() => list.reduce((a, e) => a + Number(e.valor || 0), 0), [list]);
  const totManual = useMemo(() => list.filter(e => e.origem !== 'manutencao').reduce((a, e) => a + Number(e.valor || 0), 0), [list]);
  const totManut  = useMemo(() => list.filter(e => e.origem === 'manutencao').reduce((a, e) => a + Number(e.valor || 0), 0), [list]);

  const submit = async () => {
    if (!form.descricao || form.valor == null) { toast.error('Descrição e valor são obrigatórios'); return; }
    setSaving(true);
    try {
      await expensesService.create(form);
      toast.success('Gasto adicionado');
      setOpen(false);
      setForm({ categoria: 'outros', descricao: '', valor: 0, data: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (e: Expense) => {
    if (e.origem === 'manutencao') { toast.info('Para alterar uma manutenção, vá para o módulo Manutenção.'); return; }
    if (!confirm('Excluir este gasto?')) return;
    try { await expensesService.remove(e.id); toast.success('Removido'); await load(); }
    catch (er: any) { toast.error(er.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPI label="Total no período" value={BRL(total)} icon={TrendingDown} accent="from-rose-500 to-red-600" />
        <KPI label="Gastos manuais / NFs" value={BRL(totManual)} icon={TrendingUp} accent="from-violet-500 to-purple-600" />
        <KPI label="Manutenção de frota" value={BRL(totManut)} icon={Wrench} accent="from-amber-500 to-orange-600" />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(CAT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="ml-auto bg-indigo-600 hover:bg-indigo-700" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo gasto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Carregando…
                  </TableCell></TableRow>
                )}
                {!loading && list.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Nenhum gasto no período.
                  </TableCell></TableRow>
                )}
                {list.map(e => (
                  <TableRow key={`${e.origem || 'm'}-${e.id}`}>
                    <TableCell className="text-xs">{D(e.data)}</TableCell>
                    <TableCell className="text-xs">{CAT_LABEL[e.categoria] || e.categoria}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{e.descricao}</TableCell>
                    <TableCell className="text-xs text-slate-500">{e.fornecedor || '—'}</TableCell>
                    <TableCell className="text-xs">{e.notaFiscal || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-700">{BRL(Number(e.valor))}</TableCell>
                    <TableCell>
                      {e.origem === 'manutencao'
                        ? <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Manutenção</Badge>
                        : <Badge variant="outline">Manual</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {e.origem !== 'manutencao' && (
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo gasto</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAT_LABEL).filter(([k]) => k !== 'manutencao').map(([k, v]) =>
                    <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor}
                onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={form.fornecedor || ''} onChange={e => setForm({ ...form, fornecedor: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Nº Nota fiscal</Label>
              <Input value={form.notaFiscal || ''} onChange={e => setForm({ ...form, notaFiscal: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Anexo (foto, PDF, etc.)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await uploadSignedPdf(file);
                      setForm({ ...form, anexoUrl: url });
                      toast.success('Anexo enviado');
                    } catch (err: any) {
                      toast.error(err.message || 'Falha ao enviar anexo');
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
                {form.anexoUrl && (
                  <>
                    <a
                      href={toAbsoluteUrl(form.anexoUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-600 underline whitespace-nowrap"
                    >
                      ver anexo
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, anexoUrl: '' })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Input value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ErpFinanceiro;
