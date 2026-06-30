/**
 * ERP · Financeiro — Pendentes / Recibos / Gastos / Recorrências.
 * - Recibos: forma de pagamento, baixa parcial, cancelamento auditável, atalhos.
 * - Gastos: categorias dinâmicas + recorrências mensais materializáveis.
 * - Visão gerencial: KPIs + gráfico 12 meses (receita × gasto × resultado).
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  DollarSign, Loader2, Download, RefreshCw, Receipt as ReceiptIcon,
  CalendarDays, CheckCircle2, AlertCircle, Filter, Plus, Trash2, Wrench,
  TrendingDown, TrendingUp, Search, AlertTriangle, Pencil, MoreVertical,
  XCircle, Repeat, Tag, PlayCircle, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  receiptsService, type Receipt, type PendingReceipt, type FormaPagamento, type ReceiptsSummaryPoint,
  receiptsExtraService,
  expensesService, type Expense,
  expenseCategoriesService, type ExpenseCategory,
  recurringExpensesService, type RecurringExpense,
} from '@/services/contracts';
import { erpService, type ErpCompany } from '@/services/erp';
import { uploadSignedPdf } from '@/services/erp';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { generateReceiptPdf } from '@/utils/receiptPdf';
import { formatDateBR } from '@/utils/dateFormat';

import { confirmDialog } from '@/lib/confirm';
// ========================= helpers =========================
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
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};
const diffDays = (a: string, b: string) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
};

const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', boleto: 'Boleto',
  cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro',
};

type DateBase = 'emissao' | 'vencimento';
type QuickFilter = 'none' | 'vencidos' | 'em7';

// ========================= main =========================
const ErpFinanceiro: React.FC = () => {
  const [competencia, setCompetencia] = useState(compAtual());
  const [pendentes, setPendentes] = useState<PendingReceipt[]>([]);
  const [recibos, setRecibos] = useState<Receipt[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [summary, setSummary] = useState<ReceiptsSummaryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  // filtros
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'aberto' | 'parcial' | 'cancelado'>('all');
  const [filterCompanyId, setFilterCompanyId] = useState<string>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [dateBase, setDateBase] = useState<DateBase>('emissao');
  const [quick, setQuick] = useState<QuickFilter>('none');
  const [search, setSearch] = useState('');

  // seleção lote
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // diálogos
  const [payDialog, setPayDialog] = useState<Receipt | null>(null);
  const [cancelDialog, setCancelDialog] = useState<Receipt | null>(null);
  const [reabrirDialog, setReabrirDialog] = useState<Receipt | null>(null);

  // gastos do mês para resultado
  const [gastosMes, setGastosMes] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        receiptsService.pending(competencia),
        receiptsService.list(filterFrom || filterTo || quick !== 'none' ? {} : { competencia }),
      ]);
      setPendentes(p.pendentes);
      setRecibos(r);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [competencia, filterFrom, filterTo, quick]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    erpService.listCompanies().then(setCompanies).catch(() => {});
    receiptsService.summary(12).then(r => setSummary(r.series)).catch(() => {});
  }, []);

  useEffect(() => {
    const [y, m] = competencia.split('-').map(Number);
    if (!y || !m) return;
    const ult = new Date(y, m, 0).getDate();
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to   = `${y}-${String(m).padStart(2, '0')}-${String(ult).padStart(2, '0')}`;
    expensesService.list({ from, to, origem: 'all' })
      .then(list => setGastosMes(list.reduce((a, e) => a + Number(e.valor || 0), 0)))
      .catch(() => setGastosMes(0));
  }, [competencia, recibos]);

  const today = todayISO();

  const recibosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const venceAte = quick === 'em7' ? addDaysISO(today, 7) : null;
    return recibos.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterCompanyId !== 'all') {
        const target = companies.find(c => c.id === filterCompanyId)?.razaoSocial?.toLowerCase() || '';
        if (!(r.companyRazaoSocial || '').toLowerCase().includes(target)) return false;
      }
      const dataRef = (dateBase === 'vencimento' ? r.dataVencimento : r.dataEmissao) || '';
      if (filterFrom && dataRef < filterFrom) return false;
      if (filterTo   && dataRef > filterTo)   return false;
      if (quick === 'vencidos') {
        if (r.status !== 'aberto' && r.status !== 'parcial') return false;
        if (!r.dataVencimento || r.dataVencimento >= today) return false;
      }
      if (quick === 'em7') {
        if (r.status !== 'aberto' && r.status !== 'parcial') return false;
        if (!r.dataVencimento) return false;
        if (r.dataVencimento < today || r.dataVencimento > venceAte!) return false;
      }
      if (term) {
        const hay = `${r.numero} ${r.contractNumero || ''} ${r.customerName || ''} ${r.companyRazaoSocial || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [recibos, filterStatus, filterCompanyId, filterFrom, filterTo, quick, search, dateBase, companies, today]);

  const totals = useMemo(() => {
    const recebido = recibosFiltrados
      .filter(r => r.status === 'pago' || r.status === 'parcial')
      .reduce((a, r) => a + Number(r.valorPago ?? (r.status === 'pago' ? r.valor : 0) ?? 0), 0);
    const aberto = recibosFiltrados
      .filter(r => r.status === 'aberto' || r.status === 'parcial')
      .reduce((a, r) => a + Math.max(0, Number(r.valor || 0) - Number(r.valorPago || 0)), 0);
    const pendente = pendentes.reduce((a, p) => a + Number(p.valorMensal || 0), 0);
    const previsto = recebido + aberto + pendente;
    const inadimp  = previsto > 0 ? (aberto + pendente) / previsto * 100 : 0;
    const ativos   = recibosFiltrados.filter(r => r.status !== 'cancelado');
    const ticket   = ativos.length > 0
      ? ativos.reduce((a, r) => a + Number(r.valor || 0), 0) / ativos.length : 0;
    return {
      recebido, aberto, pendente, total: previsto, inadimp, ticket,
      resultado: recebido - gastosMes,
    };
  }, [recibosFiltrados, pendentes, gastosMes]);

  // ===== ações =====
  const generateOne = async (
    contractId: string, valor: number, opts?: { semPdf?: boolean; silent?: boolean }
  ) => {
    const out = await receiptsService.generate({ contractId, competencia, valor, pago: true });
    if (!opts?.semPdf) {
      try {
        const list = await receiptsService.list({ competencia, contractId });
        const r = list.find(x => x.id === out.id);
        if (r) await generateReceiptPdf(r);
      } catch { /* PDF best-effort */ }
    }
    if (!opts?.silent) toast.success(`Recibo ${out.numero} gerado`);
    return out;
  };

  const gerar = async (p: PendingReceipt, opts?: { semPdf?: boolean }) => {
    setWorking(p.contractId);
    try { await generateOne(p.contractId, Number(p.valorMensal), opts); await load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const gerarLote = async () => {
    if (selected.size === 0) return;
    const alvos = pendentes.filter(p => selected.has(p.contractId));
    setWorking('__batch__');
    let ok = 0, fail = 0;
    for (const p of alvos) {
      try { await generateOne(p.contractId, Number(p.valorMensal), { semPdf: true, silent: true }); ok++; }
      catch { fail++; }
    }
    setSelected(new Set());
    setWorking(null);
    await load();
    if (fail === 0) toast.success(`${ok} recibo(s) gerados como pagos`);
    else toast.warning(`${ok} ok, ${fail} falharam`);
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

  const baixar = async (r: Receipt) => {
    try { await generateReceiptPdf(r); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleReabrir = async () => {
    if (!reabrirDialog) return;
    setWorking(reabrirDialog.id);
    try {
      await receiptsExtraService.togglePaid(reabrirDialog.id, false, { valorPago: 0 });
      toast.success('Recibo reaberto');
      setReabrirDialog(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const toggleSel = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleSelAll = () => {
    if (selected.size === pendentes.length) setSelected(new Set());
    else setSelected(new Set(pendentes.map(p => p.contractId)));
  };

  const clearFilters = () => {
    setFilterStatus('all'); setFilterCompanyId('all'); setSearch('');
    setFilterFrom(''); setFilterTo(''); setQuick('none'); setDateBase('emissao');
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
          <Button onClick={load} variant="outline" size="sm" disabled={loading} aria-label="Recarregar">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI label="Recebido" value={BRL(totals.recebido)} icon={CheckCircle2} accent="from-emerald-500 to-teal-600" />
        <KPI label="Em aberto" value={BRL(totals.aberto)} icon={AlertCircle} accent="from-amber-500 to-orange-600" />
        <KPI label="Pendente do mês" value={BRL(totals.pendente)} icon={AlertCircle} accent="from-rose-500 to-red-600" />
        <KPI label="Total previsto" value={BRL(totals.total)} icon={DollarSign} accent="from-indigo-500 to-purple-600" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <KPI label="Inadimplência" value={`${totals.inadimp.toFixed(1)}%`}
          sub={`${BRL(totals.aberto + totals.pendente)} a receber`} icon={AlertTriangle}
          accent="from-rose-500 to-orange-500" />
        <KPI label="Ticket médio" value={BRL(totals.ticket)}
          sub={`${recibosFiltrados.length} recibos no filtro`} icon={ReceiptIcon}
          accent="from-sky-500 to-indigo-600" />
        <KPI label="Resultado do mês" value={BRL(totals.resultado)}
          sub={`recebido − ${BRL(gastosMes)} de gastos`}
          icon={totals.resultado >= 0 ? TrendingUp : TrendingDown}
          accent={totals.resultado >= 0 ? 'from-emerald-500 to-green-600' : 'from-rose-500 to-red-600'} />
      </div>

      <ChartCard series={summary} />

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes <Badge variant="outline" className="ml-2">{pendentes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="emitidos">
            Recibos <Badge variant="outline" className="ml-2">{recibosFiltrados.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 border-b">
              <div className="text-xs text-slate-500">
                {selected.size > 0
                  ? <span className="font-medium text-slate-700">{selected.size} selecionado(s)</span>
                  : 'Selecione contratos para gerar recibos em lote (marca como pagos, sem PDF).'}
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
                )}
                <Button size="sm" disabled={selected.size === 0 || working === '__batch__'} onClick={gerarLote}
                  className="bg-emerald-600 hover:bg-emerald-700">
                  {working === '__batch__'
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  Gerar selecionados
                </Button>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox aria-label="Selecionar todos"
                          checked={pendentes.length > 0 && selected.size === pendentes.length}
                          onCheckedChange={toggleSelAll} />
                      </TableHead>
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
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        Nenhuma cobrança pendente para {formatComp(competencia)}.
                      </TableCell></TableRow>
                    )}
                    {pendentes.map(p => (
                      <TableRow key={p.contractId} data-state={selected.has(p.contractId) ? 'selected' : undefined}>
                        <TableCell>
                          <Checkbox aria-label={`Selecionar ${p.contractNumero}`}
                            checked={selected.has(p.contractId)}
                            onCheckedChange={() => toggleSel(p.contractId)} />
                        </TableCell>
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
            <CardContent className="p-4 space-y-3 border-b">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Buscar</Label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input value={search} onChange={e => setSearch(e.target.value)}
                      className="h-9 pl-7" placeholder="nº recibo, contrato, cliente, empresa…" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Base</Label>
                  <Select value={dateBase} onValueChange={(v: any) => setDateBase(v)}>
                    <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emissao">Emissão</SelectItem>
                      <SelectItem value="vencimento">Vencimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-9 w-[150px]" />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-9 w-[150px]" />
                </div>
                <div>
                  <Label className="text-xs">Empresa</Label>
                  <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
                    <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                    <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pago">Pagos</SelectItem>
                      <SelectItem value="parcial">Parciais</SelectItem>
                      <SelectItem value="aberto">Em aberto</SelectItem>
                      <SelectItem value="cancelado">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <QuickChip active={quick === 'none'} onClick={() => setQuick('none')}>Todos</QuickChip>
                <QuickChip active={quick === 'vencidos'} onClick={() => setQuick('vencidos')} tone="rose">Vencidos</QuickChip>
                <QuickChip active={quick === 'em7'} onClick={() => setQuick('em7')} tone="amber">Vence em 7 dias</QuickChip>
              </div>
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
                    {recibosFiltrados.map(r => {
                      const venc = r.dataVencimento || '';
                      const atrasoDias = (r.status === 'aberto' || r.status === 'parcial') && venc && venc < today
                        ? diffDays(today, venc) : 0;
                      return (
                        <TableRow key={r.id} className={r.status === 'cancelado' ? 'opacity-60' : undefined}>
                          <TableCell className="font-mono text-xs font-bold">{r.numero}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">{r.contractNumero}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{r.customerName || '—'}</TableCell>
                          <TableCell className="text-xs">{D(r.dataEmissao)}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span>{D(r.dataVencimento)}</span>
                              {atrasoDias > 0 && (
                                <Badge variant="outline" className="text-rose-700 border-rose-200 bg-rose-50 w-fit">
                                  Atrasado {atrasoDias}d
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <div className="flex flex-col items-end gap-0.5">
                              <span>{BRL(Number(r.valor))}</span>
                              {r.status === 'parcial' && (
                                <span className="text-[10px] font-normal text-amber-700">
                                  pago {BRL(Number(r.valorPago || 0))}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge r={r} />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button size="sm" variant="outline" onClick={() => baixar(r)} aria-label="Baixar PDF">
                              <Download className="h-3.5 w-3.5 mr-1" /> PDF
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" aria-label="Mais ações" disabled={working === r.id}>
                                  {working === r.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <MoreVertical className="h-3.5 w-3.5" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {r.status !== 'cancelado' && r.status !== 'pago' && (
                                  <DropdownMenuItem onClick={() => setPayDialog(r)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                    Registrar pagamento
                                  </DropdownMenuItem>
                                )}
                                {(r.status === 'pago' || r.status === 'parcial') && (
                                  <DropdownMenuItem onClick={() => setReabrirDialog(r)}>
                                    <RefreshCw className="h-3.5 w-3.5 mr-2 text-slate-600" />
                                    Reabrir (marcar em aberto)
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => regerar(r)} disabled={r.status === 'cancelado'}>
                                  <RefreshCw className="h-3.5 w-3.5 mr-2 text-slate-600" />
                                  Re-gerar PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {r.status !== 'cancelado' && (
                                  <DropdownMenuItem
                                    onClick={() => setCancelDialog(r)}
                                    className="text-rose-600 focus:text-rose-700"
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-2" />
                                    Cancelar recibo
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      <PayDialog
        receipt={payDialog}
        onClose={() => setPayDialog(null)}
        onSaved={async () => { setPayDialog(null); await load(); }}
      />
      <CancelDialog
        receipt={cancelDialog}
        onClose={() => setCancelDialog(null)}
        onCanceled={async () => { setCancelDialog(null); await load(); }}
      />
      <Dialog open={!!reabrirDialog} onOpenChange={(o) => !o && setReabrirDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir recibo?</DialogTitle>
            <DialogDescription>
              Recibo <strong>{reabrirDialog?.numero}</strong> ({BRL(Number(reabrirDialog?.valor || 0))})
              voltará para o status <strong>Em aberto</strong> e o pagamento registrado será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirDialog(null)}>Cancelar</Button>
            <Button onClick={handleReabrir} disabled={working === reabrirDialog?.id}>
              {working === reabrirDialog?.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ========================= status badge =========================
const StatusBadge: React.FC<{ r: Receipt }> = ({ r }) => {
  if (r.status === 'cancelado') return <Badge variant="outline" className="text-slate-500 border-slate-300">Cancelado</Badge>;
  if (r.status === 'pago')      return <Badge className="bg-emerald-600 hover:bg-emerald-700">Pago</Badge>;
  if (r.status === 'parcial')   return <Badge className="bg-amber-500 hover:bg-amber-600">Parcial</Badge>;
  return <Badge variant="secondary">Em aberto</Badge>;
};

// ========================= KPI / chip =========================
const KPI = ({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: any; accent: string;
}) => (
  <Card className="border-0 shadow-md overflow-hidden">
    <CardContent className="p-0">
      <div className={`bg-gradient-to-br ${accent} p-4 text-white transition-transform duration-200 hover:scale-[1.01]`}>
        <Icon className="h-5 w-5 opacity-80 mb-2" />
        <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
        <p className="text-2xl font-bold mt-1 break-words leading-tight">{value}</p>
        {sub && <p className="text-[11px] opacity-80 mt-1">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

const QuickChip: React.FC<{
  active?: boolean; tone?: 'rose' | 'amber'; onClick?: () => void; children: React.ReactNode;
}> = ({ active, tone, onClick, children }) => {
  const base = 'inline-flex items-center px-3 h-7 rounded-full text-xs font-medium border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  let cls = 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
  if (active && tone === 'rose')  cls = 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700';
  else if (active && tone === 'amber') cls = 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600';
  else if (active) cls = 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700';
  return <button type="button" onClick={onClick} className={`${base} ${cls}`}>{children}</button>;
};

// ========================= 12-month chart =========================
const ChartCard: React.FC<{ series: ReceiptsSummaryPoint[] }> = ({ series }) => {
  const data = useMemo(() => series.map(s => ({ ...s, label: formatComp(s.competencia) })), [series]);
  if (!data.length) return null;
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-700">Receita × Gasto × Resultado (12 meses)</h2>
          </div>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                formatter={(v: any) => BRL(Number(v))}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="recebido" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gasto"    name="Gasto"    fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// ========================= PayDialog =========================
const PayDialog: React.FC<{
  receipt: Receipt | null; onClose: () => void; onSaved: () => void;
}> = ({ receipt, onClose, onSaved }) => {
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [data, setData]   = useState(todayISO());
  const [valor, setValor] = useState<number>(0);
  const [parcial, setParcial] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!receipt) return;
    setForma((receipt.formaPagamento as FormaPagamento) || 'pix');
    setData(receipt.dataPagamento || todayISO());
    setValor(Number(receipt.valor || 0));
    setParcial(receipt.status === 'parcial');
  }, [receipt]);

  if (!receipt) return null;
  const total = Number(receipt.valor || 0);
  const valorFinal = parcial ? Math.min(valor, total) : total;

  const submit = async () => {
    setSaving(true);
    try {
      await receiptsExtraService.togglePaid(receipt.id, true, {
        formaPagamento: forma,
        dataPagamento: data,
        valorPago: valorFinal,
      });
      toast.success(valorFinal >= total ? 'Pagamento registrado' : 'Baixa parcial registrada');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Recibo <strong>{receipt.numero}</strong> — total {BRL(total)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={forma} onValueChange={(v: any) => setForma(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMA_LABEL) as FormaPagamento[]).map(k =>
                    <SelectItem key={k} value={k}>{FORMA_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data do pagamento</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={parcial} onCheckedChange={(c) => setParcial(!!c)} />
            <span>Baixa parcial</span>
          </label>
          {parcial && (
            <div>
              <Label className="text-xs">Valor pago (R$)</Label>
              <Input type="number" step="0.01" min={0} max={total} value={valor}
                onChange={e => setValor(Number(e.target.value))} />
              <p className="text-[11px] text-slate-500 mt-1">
                Saldo em aberto: <strong>{BRL(Math.max(0, total - valorFinal))}</strong>
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || valorFinal <= 0}
            className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ========================= CancelDialog =========================
const CancelDialog: React.FC<{
  receipt: Receipt | null; onClose: () => void; onCanceled: () => void;
}> = ({ receipt, onClose, onCanceled }) => {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setMotivo(''); }, [receipt]);
  if (!receipt) return null;
  const submit = async () => {
    if (!motivo.trim()) { toast.error('Informe o motivo do cancelamento'); return; }
    setSaving(true);
    try {
      await receiptsService.cancel(receipt.id, motivo.trim());
      toast.success('Recibo cancelado');
      onCanceled();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-rose-600 flex items-center gap-2">
            <XCircle className="h-5 w-5" /> Cancelar recibo
          </DialogTitle>
          <DialogDescription>
            Recibo <strong>{receipt.numero}</strong> será marcado como <strong>cancelado</strong>.
            O histórico e a numeração são preservados.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">Motivo *</Label>
          <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
            placeholder="Ex.: erro de emissão, duplicado, cliente cancelou contrato…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button onClick={submit} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
            Cancelar recibo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// Gastos
// ============================================================
const emptyForm = (): Partial<Expense> => ({
  categoria: 'outros', descricao: '', valor: 0,
  data: new Date().toISOString().slice(0, 10),
});

function GastosPanel() {
  const [list, setList] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [origem, setOrigem] = useState<'all' | 'manual' | 'manutencao'>('all');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);

  const catLabel = useCallback((key: string) => {
    if (key === 'manutencao') return 'Manutenção';
    return categories.find(c => c.key === key)?.label || key;
  }, [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await expensesService.list({
        from: from || undefined, to: to || undefined, categoria: cat, origem,
      }));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [from, to, cat, origem]);

  const loadCats = useCallback(async () => {
    try { setCategories(await expenseCategoriesService.list()); } catch {}
  }, []);
  const loadRec = useCallback(async () => {
    try { setRecurring(await recurringExpensesService.list()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCats(); loadRec(); }, [loadCats, loadRec]);

  const total      = useMemo(() => list.reduce((a, e) => a + Number(e.valor || 0), 0), [list]);
  const totManual  = useMemo(() => list.filter(e => e.origem !== 'manutencao').reduce((a, e) => a + Number(e.valor || 0), 0), [list]);
  const totManut   = useMemo(() => list.filter(e => e.origem === 'manutencao').reduce((a, e) => a + Number(e.valor || 0), 0), [list]);

  const activeCats = useMemo(() => categories.filter(c => c.ativo), [categories]);

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (e: Expense) => {
    if (e.origem === 'manutencao') { toast.info('Para alterar uma manutenção, vá para o módulo Manutenção.'); return; }
    setEditingId(e.id);
    setForm({
      categoria: e.categoria, descricao: e.descricao, valor: Number(e.valor),
      data: e.data?.slice(0, 10), fornecedor: e.fornecedor || '',
      notaFiscal: e.notaFiscal || '', anexoUrl: e.anexoUrl || '',
      observacoes: e.observacoes || '',
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.descricao || form.valor == null) { toast.error('Descrição e valor são obrigatórios'); return; }
    setSaving(true);
    try {
      if (editingId) { await expensesService.update(editingId, form); toast.success('Gasto atualizado'); }
      else { await expensesService.create(form); toast.success('Gasto adicionado'); }
      setOpen(false); setEditingId(null); setForm(emptyForm());
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (e: Expense) => {
    if (e.origem === 'manutencao') { toast.info('Para alterar uma manutenção, vá para o módulo Manutenção.'); return; }
    if (!(await confirmDialog({ description: 'Excluir este gasto?', destructive: true }))) return;
    try { await expensesService.remove(e.id); toast.success('Removido'); await load(); }
    catch (er: any) { toast.error(er.message); }
  };

  const runRecurring = async () => {
    try {
      const r = await recurringExpensesService.run();
      toast.success(`${r.geradas} gasto(s) gerado(s) para ${formatComp(r.competencia)}`);
      await load(); await loadRec();
    } catch (e: any) { toast.error(e.message); }
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
                {activeCats.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                <SelectItem value="manutencao">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={origem} onValueChange={(v: any) => setOrigem(v)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="manual">Manuais</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCatsOpen(true)}>
              <Tag className="h-4 w-4 mr-1" /> Categorias
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRecOpen(true)}>
              <Repeat className="h-4 w-4 mr-1" /> Recorrências
              {recurring.filter(r => r.ativo).length > 0 && (
                <Badge variant="secondary" className="ml-2">{recurring.filter(r => r.ativo).length}</Badge>
              )}
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo gasto
            </Button>
          </div>
        </CardContent>
      </Card>

      {recurring.filter(r => r.ativo).length > 0 && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-indigo-600" />
              <span><strong>{recurring.filter(r => r.ativo).length}</strong> recorrência(s) ativa(s) —
                total mensal {BRL(recurring.filter(r => r.ativo).reduce((a, r) => a + Number(r.valor || 0), 0))}</span>
            </div>
            <Button size="sm" onClick={runRecurring} className="bg-indigo-600 hover:bg-indigo-700">
              <PlayCircle className="h-4 w-4 mr-1" /> Gerar deste mês
            </Button>
          </CardContent>
        </Card>
      )}

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
                    <TableCell className="text-xs">{catLabel(e.categoria)}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{e.descricao}</TableCell>
                    <TableCell className="text-xs text-slate-500">{e.fornecedor || '—'}</TableCell>
                    <TableCell className="text-xs">{e.notaFiscal || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-700">{BRL(Number(e.valor))}</TableCell>
                    <TableCell>
                      {e.origem === 'manutencao'
                        ? <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Manutenção</Badge>
                        : <Badge variant="outline">Manual</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {e.origem !== 'manutencao' && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(e)} aria-label="Editar gasto">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(e)} aria-label="Excluir gasto">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm()); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar gasto' : 'Novo gasto'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeCats.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
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
                <Input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await uploadSignedPdf(file);
                      setForm({ ...form, anexoUrl: url });
                      toast.success('Anexo enviado');
                    } catch (err: any) { toast.error(err.message || 'Falha ao enviar anexo'); }
                    finally { e.target.value = ''; }
                  }} />
                {form.anexoUrl && (
                  <>
                    <a href={toAbsoluteUrl(form.anexoUrl)} target="_blank" rel="noreferrer"
                      className="text-xs text-indigo-600 underline whitespace-nowrap">ver anexo</a>
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setForm({ ...form, anexoUrl: '' })} aria-label="Remover anexo">
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
              {editingId ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoriesDialog
        open={catsOpen} onClose={() => setCatsOpen(false)}
        categories={categories} onChanged={loadCats}
      />
      <RecurringDialog
        open={recOpen} onClose={() => setRecOpen(false)}
        list={recurring} categories={activeCats}
        onChanged={async () => { await loadRec(); await load(); }}
      />
    </div>
  );
}

// ========================= CategoriesDialog =========================
const CategoriesDialog: React.FC<{
  open: boolean; onClose: () => void;
  categories: ExpenseCategory[]; onChanged: () => Promise<void>;
}> = ({ open, onClose, categories, onChanged }) => {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try { await expenseCategoriesService.create({ label: label.trim() }); setLabel(''); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  const toggle = async (c: ExpenseCategory) => {
    try { await expenseCategoriesService.update(c.id, { ativo: !c.ativo }); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async (c: ExpenseCategory) => {
    if (!(await confirmDialog({ description: `Excluir categoria "${c.label}"?`, destructive: true }))) return;
    try {
      const r = await expenseCategoriesService.remove(c.id);
      toast.success(r.inactivated ? 'Categoria padrão — desativada' : 'Excluída');
      await onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> Categorias de gastos</DialogTitle>
          <DialogDescription>Personalize as categorias usadas nos lançamentos.</DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Nova categoria</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Ex.: Marketing" onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
          <Button onClick={add} disabled={saving || !label.trim()} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="border rounded-md divide-y max-h-[280px] overflow-y-auto">
          {categories.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-6">Nenhuma categoria.</div>
          )}
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Checkbox checked={c.ativo} onCheckedChange={() => toggle(c)} aria-label={`Ativar ${c.label}`} />
                <span className={c.ativo ? '' : 'line-through text-slate-400'}>{c.label}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{c.key}</Badge>
              </div>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)} aria-label="Excluir">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ========================= RecurringDialog =========================
const emptyRec = (): Partial<RecurringExpense> => ({
  categoria: 'outros', descricao: '', valor: 0, diaMes: 1, ativo: true,
});

const RecurringDialog: React.FC<{
  open: boolean; onClose: () => void;
  list: RecurringExpense[]; categories: ExpenseCategory[];
  onChanged: () => Promise<void>;
}> = ({ open, onClose, list, categories, onChanged }) => {
  const [editing, setEditing] = useState<Partial<RecurringExpense> | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const startNew = () => setEditing(emptyRec());
  const startEdit = (r: RecurringExpense) => setEditing({ ...r });

  const save = async () => {
    if (!editing) return;
    if (!editing.descricao || editing.valor == null) {
      toast.error('Descrição e valor são obrigatórios'); return;
    }
    setSaving(true);
    try {
      if (editing.id) await recurringExpensesService.update(editing.id, editing);
      else await recurringExpensesService.create(editing);
      toast.success('Salvo');
      setEditing(null); await onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (r: RecurringExpense) => {
    if (!(await confirmDialog({ description: `Excluir recorrência "${r.descricao}"?`, destructive: true }))) return;
    try { await recurringExpensesService.remove(r.id); toast.success('Removida'); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (r: RecurringExpense) => {
    try { await recurringExpensesService.update(r.id, { ativo: !r.ativo }); await onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const out = await recurringExpensesService.run();
      toast.success(`${out.geradas} gasto(s) gerado(s) para ${formatComp(out.competencia)}`);
      await onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="h-4 w-4" /> Gastos recorrentes</DialogTitle>
          <DialogDescription>
            Cadastre despesas mensais fixas (aluguel, folha, internet) e gere o lote a cada mês com um clique.
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <>
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" onClick={runNow} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
                Gerar deste mês
              </Button>
              <Button size="sm" onClick={startNew} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-1" /> Nova recorrência
              </Button>
            </div>
            <div className="border rounded-md divide-y max-h-[340px] overflow-y-auto">
              {list.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-6">Nenhuma recorrência cadastrada.</div>
              )}
              {list.map(r => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={r.ativo} onCheckedChange={() => toggle(r)} aria-label={`Ativar ${r.descricao}`} />
                      <span className={`text-sm font-medium truncate ${r.ativo ? '' : 'text-slate-400 line-through'}`}>
                        {r.descricao}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 ml-6">
                      {BRL(Number(r.valor))} · dia {r.diaMes}
                      {r.lastGeneratedCompetencia && ` · último: ${formatComp(r.lastGeneratedCompetencia)}`}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(r)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(r)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </>
        )}

        {editing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input value={editing.descricao || ''} onChange={e => setEditing({ ...editing, descricao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor mensal (R$) *</Label>
              <Input type="number" step="0.01" value={editing.valor ?? 0}
                onChange={e => setEditing({ ...editing, valor: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Dia do mês</Label>
              <Input type="number" min={1} max={31} value={editing.diaMes ?? 1}
                onChange={e => setEditing({ ...editing, diaMes: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={editing.categoria || 'outros'} onValueChange={(v) => setEditing({ ...editing, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input value={editing.fornecedor || ''} onChange={e => setEditing({ ...editing, fornecedor: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Input value={editing.observacoes || ''} onChange={e => setEditing({ ...editing, observacoes: e.target.value })} />
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox checked={editing.ativo ?? true} onCheckedChange={(c) => setEditing({ ...editing, ativo: !!c })} />
              <span>Ativa</span>
            </label>
          </div>
        )}

        <DialogFooter>
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(null)}>Voltar</Button>
              <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ErpFinanceiro;
