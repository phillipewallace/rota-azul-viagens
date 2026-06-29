/**
 * ERP · Financeiro — Pendentes / Recibos / Gastos.
 * Recibos: filtros por período/cliente/empresa/status + marcar pago sem gerar PDF.
 * Gastos: lista despesas manuais + manutenção, com totalizadores.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  DollarSign, Loader2, Download, RefreshCw, Receipt as ReceiptIcon,
  CalendarDays, CheckCircle2, AlertCircle, Filter, Plus, Trash2, Wrench,
  TrendingDown, TrendingUp, Search, AlertTriangle, Pencil,
} from 'lucide-react';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  receiptsService, type Receipt, type PendingReceipt,
  receiptsExtraService, expensesService, type Expense,
} from '@/services/contracts';
import { erpService, type ErpCompany } from '@/services/erp';
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
// hoje em YYYY-MM-DD, sem timezone trap
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
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((da - db) / 86400000);
};

type DateBase = 'emissao' | 'vencimento';
type QuickFilter = 'none' | 'vencidos' | 'em7';

const ErpFinanceiro: React.FC = () => {
  const [competencia, setCompetencia] = useState(compAtual());
  const [pendentes, setPendentes] = useState<PendingReceipt[]>([]);
  const [recibos, setRecibos] = useState<Receipt[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  // filtros recibos
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'aberto'>('all');
  const [filterCompanyId, setFilterCompanyId] = useState<string>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [dateBase, setDateBase] = useState<DateBase>('emissao');
  const [quick, setQuick] = useState<QuickFilter>('none');
  const [search, setSearch] = useState('');

  // seleção em lote
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // confirm toggle
  const [confirmToggle, setConfirmToggle] = useState<Receipt | null>(null);

  // gastos do mês (para resultado líquido)
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

  // empresas (filtro) — carrega 1x
  useEffect(() => {
    erpService.listCompanies().then(setCompanies).catch(() => { /* opcional */ });
  }, []);

  // gastos do mês da competência selecionada (para "Resultado")
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
      if (filterStatus === 'pago' && !r.pago) return false;
      if (filterStatus === 'aberto' && r.pago) return false;
      if (filterCompanyId !== 'all') {
        const target = companies.find(c => c.id === filterCompanyId)?.razaoSocial?.toLowerCase() || '';
        if (!(r.companyRazaoSocial || '').toLowerCase().includes(target)) return false;
      }
      const dataRef = (dateBase === 'vencimento' ? r.dataVencimento : r.dataEmissao) || '';
      if (filterFrom && dataRef < filterFrom) return false;
      if (filterTo   && dataRef > filterTo)   return false;
      if (quick === 'vencidos') {
        if (r.pago) return false;
        if (!r.dataVencimento || r.dataVencimento >= today) return false;
      }
      if (quick === 'em7') {
        if (r.pago) return false;
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
    const recebido = recibosFiltrados.filter(r => r.pago).reduce((a, r) => a + Number(r.valor || 0), 0);
    const aberto   = recibosFiltrados.filter(r => !r.pago).reduce((a, r) => a + Number(r.valor || 0), 0);
    const pendente = pendentes.reduce((a, p) => a + Number(p.valorMensal || 0), 0);
    const previsto = recebido + aberto + pendente;
    const inadimp  = previsto > 0 ? (aberto + pendente) / previsto * 100 : 0;
    const cobrados = recibosFiltrados.length;
    const ticket   = cobrados > 0 ? (recebido + aberto) / cobrados : 0;
    return {
      recebido, aberto, pendente, total: previsto, inadimp, ticket,
      resultado: recebido - gastosMes,
    };
  }, [recibosFiltrados, pendentes, gastosMes]);

  // ===== ações =====
  const generateOne = async (
    contractId: string, valor: number, opts?: { semPdf?: boolean; silent?: boolean }
  ) => {
    const out = await receiptsService.generate({
      contractId, competencia, valor, pago: true,
    });
    if (!opts?.semPdf) {
      try {
        const list = await receiptsService.list({ competencia, contractId });
        const r = list.find(x => x.id === out.id);
        if (r) await generateReceiptPdf(r);
      } catch { /* PDF é best-effort */ }
    }
    if (!opts?.silent) toast.success(`Recibo ${out.numero} gerado`);
    return out;
  };

  const gerar = async (p: PendingReceipt, opts?: { semPdf?: boolean }) => {
    setWorking(p.contractId);
    try {
      await generateOne(p.contractId, Number(p.valorMensal), opts);
      await load();
    } catch (e: any) { toast.error(e.message); }
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

  const confirmAndToggle = async () => {
    const r = confirmToggle;
    if (!r) return;
    setWorking(r.id);
    try {
      await receiptsExtraService.togglePaid(r.id, !r.pago);
      toast.success(r.pago ? 'Marcado em aberto' : 'Marcado como pago');
      setConfirmToggle(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(null); }
  };

  const baixar = async (r: Receipt) => {
    try { await generateReceiptPdf(r); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggleSel = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
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
        <KPI
          label="Inadimplência"
          value={`${totals.inadimp.toFixed(1)}%`}
          sub={`${BRL(totals.aberto + totals.pendente)} a receber`}
          icon={AlertTriangle}
          accent="from-rose-500 to-orange-500"
        />
        <KPI
          label="Ticket médio"
          value={BRL(totals.ticket)}
          sub={`${recibosFiltrados.length} recibos no filtro`}
          icon={ReceiptIcon}
          accent="from-sky-500 to-indigo-600"
        />
        <KPI
          label="Resultado do mês"
          value={BRL(totals.resultado)}
          sub={`recebido − ${BRL(gastosMes)} de gastos`}
          icon={totals.resultado >= 0 ? TrendingUp : TrendingDown}
          accent={totals.resultado >= 0 ? 'from-emerald-500 to-green-600' : 'from-rose-500 to-red-600'}
        />
      </div>

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
                <Button
                  size="sm"
                  disabled={selected.size === 0 || working === '__batch__'}
                  onClick={gerarLote}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
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
                        <Checkbox
                          aria-label="Selecionar todos"
                          checked={pendentes.length > 0 && selected.size === pendentes.length}
                          onCheckedChange={toggleSelAll}
                        />
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
                          <Checkbox
                            aria-label={`Selecionar ${p.contractNumero}`}
                            checked={selected.has(p.contractId)}
                            onCheckedChange={() => toggleSel(p.contractId)}
                          />
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
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="h-9 pl-7"
                      placeholder="nº recibo, contrato, cliente, empresa…"
                    />
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
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>
                      ))}
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
                      <SelectItem value="aberto">Em aberto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <QuickChip active={quick === 'none'} onClick={() => setQuick('none')}>Todos</QuickChip>
                <QuickChip active={quick === 'vencidos'} onClick={() => setQuick('vencidos')} tone="rose">
                  Vencidos
                </QuickChip>
                <QuickChip active={quick === 'em7'} onClick={() => setQuick('em7')} tone="amber">
                  Vence em 7 dias
                </QuickChip>
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
                      const atrasoDias = !r.pago && venc && venc < today ? diffDays(today, venc) : 0;
                      return (
                        <TableRow key={r.id}>
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
                          <TableCell className="text-right font-semibold">{BRL(Number(r.valor))}</TableCell>
                          <TableCell>
                            <button
                              onClick={() => setConfirmToggle(r)}
                              aria-label={r.pago ? 'Marcar como em aberto' : 'Marcar como pago'}
                              title="Alternar status"
                              className="cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition"
                            >
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
                              disabled={working === r.id} title="Re-gerar recibo" aria-label="Re-gerar recibo">
                              {working === r.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
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

      <AlertDialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.pago ? 'Marcar como em aberto?' : 'Marcar como pago?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Recibo <strong>{confirmToggle?.numero}</strong> — {BRL(Number(confirmToggle?.valor || 0))}.
              {confirmToggle?.pago
                ? ' Esta ação reverte a baixa.'
                : ' Esta ação confirma o pagamento.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndToggle}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

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

const emptyForm = (): Partial<Expense> => ({
  categoria: 'outros', descricao: '', valor: 0,
  data: new Date().toISOString().slice(0, 10),
});

function GastosPanel() {
  const [list, setList] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [origem, setOrigem] = useState<'all' | 'manual' | 'manutencao'>('all');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await expensesService.list({
        from: from || undefined,
        to: to || undefined,
        categoria: cat,
        origem,
      }));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [from, to, cat, origem]);

  useEffect(() => { load(); }, [load]);

  const total      = useMemo(() => list.reduce((a, e) => a + Number(e.valor || 0), 0), [list]);
  const totManual  = useMemo(() => list.filter(e => e.origem !== 'manutencao').reduce((a, e) => a + Number(e.valor || 0), 0), [list]);
  const totManut   = useMemo(() => list.filter(e => e.origem === 'manutencao').reduce((a, e) => a + Number(e.valor || 0), 0), [list]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  };
  const openEdit = (e: Expense) => {
    if (e.origem === 'manutencao') {
      toast.info('Para alterar uma manutenção, vá para o módulo Manutenção.');
      return;
    }
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
      if (editingId) {
        await expensesService.update(editingId, form);
        toast.success('Gasto atualizado');
      } else {
        await expensesService.create(form);
        toast.success('Gasto adicionado');
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm());
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
          <Button className="ml-auto bg-indigo-600 hover:bg-indigo-700" onClick={openNew}>
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
                      aria-label="Remover anexo"
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
              {editingId ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ErpFinanceiro;
