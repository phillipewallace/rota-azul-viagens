/**
 * ERP — Ordens de Serviço: lista com flag de atraso (diárias),
 * fechamento devolve sanitários, exportação financeira e histórico de movimentação.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, AlertTriangle, CheckCircle2, RefreshCcw, Trash2, Loader2, Search,
  FileDown, History, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { serviceOrdersService, ServiceOrder } from '@/services/quotes';
import { downloadCsv, downloadPdf } from '@/utils/exporters';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
const DT = (s?: string) => s ? new Date(s).toLocaleString('pt-BR') : '—';

const tipoLabel = (t?: string) =>
  t === 'obra' ? '🏗️ Obra' : t === 'evento' ? '🎉 Evento' :
  t === 'industria' ? '🏭 Indústria' : t === 'outro' ? 'Outro' : '—';

const ServiceOrders: React.FC = () => {
  const [list, setList] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todas' | 'abertas' | 'atrasadas' | 'fechadas'>('todas');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Financeiro modal
  const [finOpen, setFinOpen] = useState(false);
  const [finFrom, setFinFrom] = useState('');
  const [finTo, setFinTo] = useState('');
  const [finData, setFinData] = useState<any>(null);
  const [finLoading, setFinLoading] = useState(false);

  // Histórico modal
  const [histOpen, setHistOpen] = useState(false);
  const [hist, setHist] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histType, setHistType] = useState('');
  const [histSan, setHistSan] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await serviceOrdersService.list();
      setList(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Notificação de atraso ao carregar
  useEffect(() => {
    if (!loading && list.length) {
      const overdue = list.filter(x => x.emAtraso).length;
      if (overdue > 0) {
        toast.warning(`${overdue} diária(s) em atraso para recolhimento`, {
          duration: 6000,
          action: { label: 'Ver', onClick: () => setTab('atrasadas') },
        });
      }
    }
  }, [loading]);

  const filtered = useMemo(() => {
    let l = list;
    if (tab === 'abertas') l = l.filter(x => x.status === 'aberta' && !x.emAtraso);
    if (tab === 'atrasadas') l = l.filter(x => x.emAtraso);
    if (tab === 'fechadas') l = l.filter(x => x.status === 'fechada');
    if (tipoFilter) l = l.filter(x => (x as any).tipoLocacao === tipoFilter);
    if (search) {
      const s = search.toLowerCase();
      l = l.filter(x => x.numero?.toLowerCase().includes(s) || x.customerName?.toLowerCase().includes(s));
    }
    return l;
  }, [list, tab, tipoFilter, search]);

  const counts = useMemo(() => ({
    todas: list.length,
    abertas: list.filter(x => x.status === 'aberta' && !x.emAtraso).length,
    atrasadas: list.filter(x => x.emAtraso).length,
    fechadas: list.filter(x => x.status === 'fechada').length,
  }), [list]);

  const close = async (o: ServiceOrder) => {
    if (!confirm(`Fechar OS ${o.numero} e devolver ${o.sanitariosAlocados || 0} sanitário(s) ao estoque?`)) return;
    try { await serviceOrdersService.close(o.id); toast.success('OS fechada · estoque atualizado'); load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async (o: ServiceOrder) => {
    if (!confirm(`Excluir OS ${o.numero}? Sanitários alocados voltam ao estoque.`)) return;
    try { await serviceOrdersService.remove(o.id); toast.success('Excluída'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const openFinanceiro = async () => {
    setFinOpen(true);
    await loadFin();
  };
  const loadFin = async () => {
    setFinLoading(true);
    try {
      const data = await serviceOrdersService.financial({
        from: finFrom || undefined, to: finTo || undefined,
        tipoLocacao: tipoFilter || undefined,
      });
      setFinData(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setFinLoading(false); }
  };
  const exportFinCsv = () => {
    if (!finData?.rows?.length) return toast.error('Nada a exportar');
    downloadCsv(`financeiro_${new Date().toISOString().slice(0,10)}`, [
      'OS', 'Cliente', 'Empresa', 'Modalidade', 'Tipo', 'Status',
      'Início', 'Fim previsto', 'Fechamento', 'Valor (R$)',
    ], finData.rows.map((r: any) => [
      r.numero, r.customerName || '', r.companyRazaoSocial || '',
      r.modalidade, r.tipoLocacao || '', r.emAtraso ? 'em_atraso' : r.status,
      r.dataInicio || '', r.dataFimPrevista || '', r.dataFechamento || '',
      Number(r.valorTotal || 0).toFixed(2),
    ]));
  };
  const exportFinPdf = () => {
    if (!finData?.rows?.length) return toast.error('Nada a exportar');
    const periodo = `${finFrom || '...'} até ${finTo || 'hoje'}`;
    downloadPdf({
      filename: `financeiro_${new Date().toISOString().slice(0,10)}`,
      title: 'Relatório Financeiro — Ordens de Serviço',
      subtitle: `Período: ${periodo} · Total: ${BRL(finData.totals.total)} (Fechadas: ${BRL(finData.totals.fechadas)} · Abertas: ${BRL(finData.totals.abertas)})`,
      orientation: 'landscape',
      headers: ['OS', 'Cliente', 'Modalidade', 'Tipo', 'Status', 'Início', 'Fim', 'Valor'],
      rows: finData.rows.map((r: any) => [
        r.numero, r.customerName || '—', r.modalidade, r.tipoLocacao || '—',
        r.emAtraso ? 'EM ATRASO' : r.status,
        r.dataInicio ? new Date(r.dataInicio).toLocaleDateString('pt-BR') : '',
        r.dataFimPrevista ? new Date(r.dataFimPrevista).toLocaleDateString('pt-BR') : '',
        BRL(Number(r.valorTotal || 0)),
      ]),
    });
  };

  const openHistorico = async () => {
    setHistOpen(true);
    await loadHist();
  };
  const loadHist = async () => {
    setHistLoading(true);
    try {
      const data = await serviceOrdersService.movements({
        type: histType || undefined,
        sanitarioNumero: histSan || undefined,
        limit: 500,
      });
      setHist(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setHistLoading(false); }
  };
  const exportHistCsv = () => {
    if (!hist.length) return toast.error('Nada a exportar');
    downloadCsv(`historico_movimentacao_${new Date().toISOString().slice(0,10)}`, [
      'Quando', 'Sanitário', 'Operação', 'Cliente', 'Endereço', 'Motorista', 'Notas',
    ], hist.map(m => [
      new Date(m.occurredAt).toLocaleString('pt-BR'),
      m.sanitarioNumero, m.operationType, m.customerName || '',
      m.address || '', m.driverName || '', m.notes || '',
    ]));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
            </Button>
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Ordens de Serviço</h1>
            <Badge variant="secondary">{list.length}</Badge>
            {counts.atrasadas > 0 && (
              <Badge className="bg-red-600 text-white gap-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" /> {counts.atrasadas} em atraso
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openHistorico}>
              <History className="h-4 w-4 mr-1" />Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={openFinanceiro}>
              <FileDown className="h-4 w-4 mr-1" />Financeiro
            </Button>
            <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" />Recarregar</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por número ou cliente…"
                     value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="border rounded-md h-9 px-2 bg-background text-sm"
                    value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
              <option value="">Todos tipos</option>
              <option value="obra">🏗️ Obra</option>
              <option value="evento">🎉 Evento</option>
              <option value="industria">🏭 Indústria</option>
              <option value="outro">Outro</option>
            </select>
            <div className="flex gap-1 flex-wrap">
              {(['todas', 'abertas', 'atrasadas', 'fechadas'] as const).map(t => (
                <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'}
                        onClick={() => setTab(t)}
                        className={tab !== t && t === 'atrasadas' && counts.atrasadas > 0 ? 'border-red-300 text-red-700' : ''}>
                  {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma OS</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(o => (
              <Card key={o.id} className={`hover:shadow-md transition-shadow ${o.emAtraso ? 'border-red-300 bg-red-50/40' : ''}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm">{o.numero}</div>
                      <div className="text-sm font-semibold truncate">{o.customerName || '—'}</div>
                    </div>
                    {o.emAtraso ? (
                      <Badge className="bg-red-600 text-white gap-1"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>
                    ) : (
                      <Badge className={o.status === 'fechada' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'}>
                        {o.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{o.modalidade === 'diaria' ? '🗓 Diária' : '📅 Mensal'} · {BRL(o.valorTotal)}</div>
                    <div>Tipo: {tipoLabel((o as any).tipoLocacao)}</div>
                    <div>Início: {D(o.dataInicio)} · Fim previsto: {D(o.dataFimPrevista)}</div>
                    <div>Sanitários alocados: <strong>{o.sanitariosAlocados || 0}</strong></div>
                  </div>
                  <div className="flex gap-1 pt-2 border-t">
                    {o.status === 'aberta' && (
                      <Button size="sm" variant="outline" className="flex-1 text-green-700 hover:bg-green-50" onClick={() => close(o)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Fechar e devolver
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(o)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Financeiro */}
      <Dialog open={finOpen} onOpenChange={setFinOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório Financeiro · Ordens de Serviço</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">De</label>
              <Input type="date" value={finFrom} onChange={e => setFinFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Até</label>
              <Input type="date" value={finTo} onChange={e => setFinTo(e.target.value)} className="h-9" />
            </div>
            <Button size="sm" onClick={loadFin} disabled={finLoading}>
              {finLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={exportFinCsv}>
              <FileDown className="h-4 w-4 mr-1" />CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportFinPdf}>
              <FileDown className="h-4 w-4 mr-1" />PDF
            </Button>
          </div>
          {finData && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Card><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Total geral</div>
                <div className="text-xl font-bold text-primary">{BRL(finData.totals.total)}</div>
                <div className="text-[10px] text-muted-foreground">{finData.totals.count} OS</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Fechadas (realizado)</div>
                <div className="text-xl font-bold text-green-700">{BRL(finData.totals.fechadas)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Abertas (previsto)</div>
                <div className="text-xl font-bold text-blue-700">{BRL(finData.totals.abertas)}</div>
              </CardContent></Card>
            </div>
          )}
          <div className="border rounded overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">OS</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Modal.</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Início</th>
                  <th className="text-right p-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(finData?.rows || []).map((r: any) => (
                  <tr key={r.id} className={r.emAtraso ? 'bg-red-50' : 'border-t'}>
                    <td className="p-2 font-mono">{r.numero}</td>
                    <td className="p-2">{r.customerName || '—'}</td>
                    <td className="p-2">{r.modalidade}</td>
                    <td className="p-2">{r.tipoLocacao || '—'}</td>
                    <td className="p-2">{r.emAtraso ? 'EM ATRASO' : r.status}</td>
                    <td className="p-2">{D(r.dataInicio)}</td>
                    <td className="p-2 text-right tabular-nums">{BRL(Number(r.valorTotal || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico de movimentação */}
      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentação · Sanitários</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Sanitário (nº)</label>
              <Input value={histSan} onChange={e => setHistSan(e.target.value)} className="h-9 w-32" placeholder="Ex.: 042" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Operação</label>
              <select className="border rounded-md h-9 px-2 bg-background text-sm"
                      value={histType} onChange={e => setHistType(e.target.value)}>
                <option value="">Todas</option>
                <option value="entrega">Entrega</option>
                <option value="recolhimento">Recolhimento</option>
                <option value="manutencao">Manutenção</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <Button size="sm" onClick={loadHist} disabled={histLoading}>
              {histLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={exportHistCsv}>
              <FileDown className="h-4 w-4 mr-1" />CSV
            </Button>
          </div>
          <div className="border rounded overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Quando</th>
                  <th className="text-left p-2">Sanitário</th>
                  <th className="text-left p-2">Operação</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Endereço</th>
                  <th className="text-left p-2">Motorista</th>
                </tr>
              </thead>
              <tbody>
                {hist.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">{DT(m.occurredAt)}</td>
                    <td className="p-2 font-mono">{m.sanitarioNumero}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">{m.operationType}</Badge>
                    </td>
                    <td className="p-2">{m.customerName || '—'}</td>
                    <td className="p-2 max-w-[240px] truncate" title={m.address}>{m.address || '—'}</td>
                    <td className="p-2">{m.driverName || '—'}</td>
                  </tr>
                ))}
                {!hist.length && !histLoading && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma movimentação encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceOrders;
