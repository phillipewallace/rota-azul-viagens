/**
 * ERP · Financeiro — visão consolidada de receita (OS) + custos (manutenções do sistema principal).
 * Permite filtrar por período, exportar CSV/PDF e baixar a "nota" (PDF) de cada OS via orçamento vinculado.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Wrench, AlertTriangle,
  Download, FileText, Loader2, Calendar, Filter, FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { serviceOrdersService, quotesService } from '@/services/quotes';
import { generateQuotePdf } from '@/utils/quotePdf';
import { downloadCsv, downloadPdf } from '@/utils/exporters';

const BRL = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

interface CompleteResp {
  periodo: { from: string | null; to: string | null };
  os: any[];
  items: any[];
  sanitarios: any[];
  manutencoes: any[];
  breakdowns: {
    porStatus: any[]; porModalidade: any[]; porTipoLocacao: any[]; porEmpresa: any[];
  };
  totais: {
    receitaTotal: number; receitaFechadas: number; receitaAbertas: number;
    receitaEmAtraso: number; custoManutencao: number; resultadoLiquido: number;
    qtdOs: number; qtdManutencoes: number;
  };
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthsAgoISO = (m: number) => {
  const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().slice(0, 10);
};

const ErpFinanceiro: React.FC = () => {
  const [from, setFrom] = useState(monthsAgoISO(3));
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<CompleteResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await serviceOrdersService.financialComplete({ from, to });
      setData(r);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar financeiro', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const kpis = useMemo(() => {
    const t = data?.totais;
    return [
      { label: 'Receita Total', value: BRL(t?.receitaTotal || 0), icon: DollarSign, accent: 'from-indigo-500 to-purple-600' },
      { label: 'Receita Fechada', value: BRL(t?.receitaFechadas || 0), icon: TrendingUp, accent: 'from-emerald-500 to-teal-600' },
      { label: 'Custo Manutenção', value: BRL(t?.custoManutencao || 0), icon: Wrench, accent: 'from-amber-500 to-orange-600', sub: `${t?.qtdManutencoes || 0} ordens` },
      { label: 'Resultado Líquido', value: BRL(t?.resultadoLiquido || 0), icon: TrendingDown, accent: (t?.resultadoLiquido || 0) >= 0 ? 'from-cyan-500 to-blue-600' : 'from-rose-500 to-red-600' },
    ];
  }, [data]);

  // Baixa o PDF (nota) da OS: usa o orçamento vinculado
  const baixarNota = async (os: any) => {
    if (!os.quoteId) {
      toast({ title: 'Sem PDF', description: 'Esta OS não possui orçamento vinculado para gerar nota.', variant: 'destructive' });
      return;
    }
    try {
      setDownloadingId(os.id);
      const quote = await quotesService.get(os.quoteId);
      generateQuotePdf(quote);
    } catch (e: any) {
      toast({ title: 'Erro ao gerar PDF', description: e.message, variant: 'destructive' });
    } finally { setDownloadingId(null); }
  };

  const exportCsvOs = () => {
    if (!data) return;
    downloadCsv(`financeiro-os-${from}_a_${to}`,
      ['Número', 'Cliente', 'Empresa', 'Modalidade', 'Tipo Locação', 'Status', 'Início', 'Fim Previsto', 'Fechamento', 'Em Atraso', 'Valor Total'],
      data.os.map(o => [
        o.numero, o.customerName, o.companyRazaoSocial, o.modalidade, o.tipoLocacao,
        o.status, D(o.dataInicio), D(o.dataFimPrevista), D(o.dataFechamento),
        o.emAtraso ? 'SIM' : 'NÃO', Number(o.valorTotal || 0).toFixed(2).replace('.', ','),
      ]));
  };

  const exportCsvManut = () => {
    if (!data) return;
    downloadCsv(`financeiro-manutencoes-${from}_a_${to}`,
      ['Data', 'Caminhão', 'Placa', 'Tipo', 'Descrição', 'Status', 'Custo'],
      data.manutencoes.map(m => [
        D(m.maintenanceDate), m.truckName, m.truckPlate, m.tipo, m.description,
        m.status, Number(m.cost || 0).toFixed(2).replace('.', ','),
      ]));
  };

  const exportPdfConsolidado = () => {
    if (!data) return;
    const t = data.totais;
    const subtitulo = `Período: ${from || '—'} a ${to || '—'} · Receita ${BRL(t.receitaTotal)} · Manutenções ${BRL(t.custoManutencao)} · Líquido ${BRL(t.resultadoLiquido)}`;
    downloadPdf({
      filename: `financeiro-consolidado-${from}_a_${to}`,
      title: 'Relatório Financeiro Consolidado · ERP Suite',
      subtitle: subtitulo,
      orientation: 'landscape',
      headers: ['Origem', 'Documento', 'Cliente / Caminhão', 'Data', 'Status', 'Valor'],
      rows: [
        ...data.os.map(o => ['Receita OS', o.numero, o.customerName || '—', D(o.dataInicio), o.status, BRL(Number(o.valorTotal || 0))]),
        ...data.manutencoes.map(m => ['Custo Manutenção', '—', `${m.truckName || '—'} (${m.truckPlate || '—'})`, D(m.maintenanceDate), m.status, `- ${BRL(Number(m.cost || 0))}`]),
      ],
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">
            <DollarSign className="h-3.5 w-3.5" /> Financeiro
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Visão Financeira Consolidada</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Receitas das OS + custos de manutenção do sistema principal, com cópia das notas em PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsvOs} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV OS
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsvManut} disabled={!data}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV Manutenções
          </Button>
          <Button size="sm" onClick={exportPdfConsolidado} disabled={!data} className="bg-indigo-600 hover:bg-indigo-700">
            <Download className="h-4 w-4 mr-1" /> PDF Consolidado
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <Card className="border-slate-200">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase mr-2">
            <Filter className="h-3.5 w-3.5" /> Período
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> De</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <Button onClick={load} disabled={loading} size="sm" className="bg-slate-900 hover:bg-slate-800">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Filter className="h-4 w-4 mr-1" />}
            Aplicar
          </Button>
          <div className="ml-auto text-xs text-slate-500">
            {data && `${data.totais.qtdOs} OS · ${data.totais.qtdManutencoes} manutenções`}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${k.accent} p-4 text-white`}>
                  <Icon className="h-5 w-5 opacity-80 mb-2" />
                  <p className="text-xs uppercase tracking-wider opacity-80">{k.label}</p>
                  <p className="text-2xl font-bold mt-1 break-words">{k.value}</p>
                  {k.sub && <p className="text-[11px] opacity-80 mt-0.5">{k.sub}</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Breakdowns */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Receita por Tipo de Locação</h3>
              <div className="space-y-2">
                {data.breakdowns.porTipoLocacao.length === 0 && <p className="text-xs text-slate-400">Sem dados no período.</p>}
                {data.breakdowns.porTipoLocacao.map((b) => (
                  <div key={b.key} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5">
                    <span className="capitalize text-slate-700">{b.key} · <span className="text-xs text-slate-400">{b.count}</span></span>
                    <span className="font-semibold text-slate-900">{BRL(b.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Receita por Status</h3>
              <div className="space-y-2">
                {data.breakdowns.porStatus.map((b) => (
                  <div key={b.key} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5">
                    <span className="capitalize text-slate-700">{b.key} · <span className="text-xs text-slate-400">{b.count}</span></span>
                    <span className="font-semibold text-slate-900">{BRL(b.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* OS + Notas */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" /> Ordens de Serviço · Notas em PDF
            </h3>
            <Badge variant="outline" className="text-xs">{data?.os.length || 0} registros</Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!data || data.os.length === 0) && (
                  <TableRow><TableCell colSpan={9} className="text-center text-slate-400 py-8">Sem OS no período.</TableCell></TableRow>
                )}
                {data?.os.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{o.customerName || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[160px] truncate">{o.companyRazaoSocial || '—'}</TableCell>
                    <TableCell className="text-xs capitalize">{o.tipoLocacao || '—'}</TableCell>
                    <TableCell className="text-xs">{D(o.dataInicio)}</TableCell>
                    <TableCell className="text-xs">{D(o.dataFechamento || o.dataFimPrevista)}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === 'fechada' ? 'default' : o.status === 'aberta' ? 'secondary' : 'outline'}
                        className={o.emAtraso ? 'bg-red-100 text-red-700 border-red-200' : ''}>
                        {o.emAtraso ? <><AlertTriangle className="h-3 w-3 mr-1" />atraso</> : o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{BRL(Number(o.valorTotal || 0))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => baixarNota(o)}
                        disabled={!o.quoteId || downloadingId === o.id}
                        title={o.quoteId ? 'Baixar PDF da nota' : 'Sem orçamento vinculado'}>
                        {downloadingId === o.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manutenções */}
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" /> Manutenções (Sistema Principal)
            </h3>
            <Badge variant="outline" className="text-xs">
              Total: {BRL(data?.totais.custoManutencao || 0)}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Caminhão</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!data || data.manutencoes.length === 0) && (
                  <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">Sem manutenções no período.</TableCell></TableRow>
                )}
                {data?.manutencoes.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{D(m.maintenanceDate)}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{m.truckName || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{m.truckPlate || '—'}</TableCell>
                    <TableCell className="text-xs">{m.tipo || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[280px] truncate">{m.description || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{m.status}</Badge></TableCell>
                    <TableCell className="text-right font-semibold text-amber-700">{BRL(Number(m.cost || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErpFinanceiro;
