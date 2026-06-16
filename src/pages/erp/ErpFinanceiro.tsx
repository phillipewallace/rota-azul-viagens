/**
 * ERP · Financeiro — gira em torno dos contratos ATIVOS.
 * - Lista pendentes do mês (contratos ativos sem recibo gerado).
 * - Permite gerar recibo (marca como pago) e re-gerar PDFs.
 * - Histórico completo de recibos com download/re-emissão.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, FileText, Loader2, Download, RefreshCw, Receipt as ReceiptIcon,
  CalendarDays, CheckCircle2, AlertCircle, Filter,
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
import { toast } from 'sonner';
import { receiptsService, type Receipt, type PendingReceipt } from '@/services/contracts';
import { generateReceiptPdf } from '@/utils/receiptPdf';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

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

  const load = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        receiptsService.pending(competencia),
        receiptsService.list({ competencia }),
      ]);
      setPendentes(p.pendentes);
      setRecibos(r);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [competencia]);

  const totals = useMemo(() => {
    const recebido = recibos.filter(r => r.pago).reduce((a, r) => a + Number(r.valor || 0), 0);
    const pendente = pendentes.reduce((a, p) => a + Number(p.valorMensal || 0), 0);
    return { recebido, pendente, total: recebido + pendente };
  }, [recibos, pendentes]);

  const gerar = async (p: PendingReceipt) => {
    setWorking(p.contractId);
    try {
      const out = await receiptsService.generate({
        contractId: p.contractId, competencia, valor: Number(p.valorMensal),
      });
      toast.success(`Recibo ${out.numero} gerado (pago)`);
      await load();
      // gera PDF imediatamente
      try {
        const list = await receiptsService.list({ competencia, contractId: p.contractId });
        const r = list.find(x => x.id === out.id);
        if (r) await generateReceiptPdf(r);
      } catch {}
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

  const baixar = async (r: Receipt) => {
    try { await generateReceiptPdf(r); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">
            <DollarSign className="h-3.5 w-3.5" /> Financeiro · Cobrança Mensal
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Recibos por Contrato Ativo</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Os contratos ativos geram recibos mensais. Marque como pago ao emitir, re-gere quando precisar.
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI label="Recebido no mês" value={BRL(totals.recebido)} icon={CheckCircle2} accent="from-emerald-500 to-teal-600" />
        <KPI label="Pendente do mês" value={BRL(totals.pendente)} icon={AlertCircle} accent="from-amber-500 to-orange-600" />
        <KPI label="Total previsto" value={BRL(totals.total)} icon={DollarSign} accent="from-indigo-500 to-purple-600" />
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList>
          <TabsTrigger value="pendentes">
            Pendentes <Badge variant="outline" className="ml-2">{pendentes.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="emitidos">
            Recibos emitidos <Badge variant="outline" className="ml-2">{recibos.length}</Badge>
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
                        <TableCell className="text-right">
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
                    {recibos.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">
                        Sem recibos emitidos em {formatComp(competencia)}.
                      </TableCell></TableRow>
                    )}
                    {recibos.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-bold">{r.numero}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">{r.contractNumero}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{r.customerName || '—'}</TableCell>
                        <TableCell className="text-xs">{D(r.dataEmissao)}</TableCell>
                        <TableCell className="text-xs">{D(r.dataVencimento)}</TableCell>
                        <TableCell className="text-right font-semibold">{BRL(Number(r.valor))}</TableCell>
                        <TableCell>
                          {r.pago
                            ? <Badge className="bg-emerald-600">Pago</Badge>
                            : <Badge variant="secondary">Em aberto</Badge>}
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

export default ErpFinanceiro;
