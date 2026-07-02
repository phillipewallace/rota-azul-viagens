/**
 * Banco de Horas — Lei 13.467/2017 (Reforma Trabalhista). Compensação em até 6 meses
 * por acordo individual escrito, ou 1 ano por acordo/convenção coletiva.
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Timer, TrendingUp, TrendingDown, Search, AlertTriangle, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { minutesToHHmm, type Employee } from './pontoUtils';
import { useEmployees } from '@/hooks/usePontoData';
import { BancoHorasAdjustDialog } from './BancoHorasAdjustDialog';

const PontoBancoHoras: React.FC = () => {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'todos' | 'credito' | 'debito'>('todos');
  const { data: EMPLOYEES = [], isLoading, isError, refetch } = useEmployees();
  const [adjustEmp, setAdjustEmp] = useState<Employee | null>(null);

  const rows = useMemo(() => {
    return EMPLOYEES.filter((e) => {
      if (e.status === 'desligado') return false;
      if (tab === 'credito' && e.bancoHoras <= 0) return false;
      if (tab === 'debito' && e.bancoHoras >= 0) return false;
      if (q && !e.nome.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }).sort((a, b) => Math.abs(b.bancoHoras) - Math.abs(a.bancoHoras));
  }, [q, tab, EMPLOYEES]);

  const totals = useMemo(() => {
    const credito = EMPLOYEES.filter((e) => e.bancoHoras > 0).reduce((a, b) => a + b.bancoHoras, 0);
    const debito = EMPLOYEES.filter((e) => e.bancoHoras < 0).reduce((a, b) => a + b.bancoHoras, 0);
    return { credito, debito, liquido: credito + debito };
  }, [EMPLOYEES]);

  const maxAbs = Math.max(...EMPLOYEES.map((e) => Math.abs(e.bancoHoras)), 1);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Timer className="h-3.5 w-3.5" /> Ponto Digital
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Banco de Horas</h1>
        <p className="text-sm text-muted-foreground mt-1">Compensação conforme Lei 13.467/2017 · CLT art. 59, §5º.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total em crédito</p>
              <p className="font-display text-3xl font-bold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                +{minutesToHHmm(totals.credito)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Horas a compensar aos funcionários</p>
            </div>
            <TrendingUp className="h-10 w-10 text-emerald-500/30" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-rose-500/10 to-transparent">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total em débito</p>
              <p className="font-display text-3xl font-bold tabular-nums mt-1 text-rose-600 dark:text-rose-400">
                {minutesToHHmm(totals.debito)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Horas devidas pela equipe</p>
            </div>
            <TrendingDown className="h-10 w-10 text-rose-500/30" />
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo líquido</p>
              <p className={`font-display text-3xl font-bold tabular-nums mt-1 ${totals.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totals.liquido >= 0 ? '+' : ''}{minutesToHHmm(totals.liquido)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Balanço geral da operação</p>
            </div>
            <Timer className="h-10 w-10 text-primary/30" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar funcionário" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="inline-flex bg-muted rounded-lg p-1">
            {(['todos', 'credito', 'debito'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                }`}
              >
                {t === 'credito' ? 'Crédito' : t === 'debito' ? 'Débito' : 'Todos'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> Regras de compensação
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Funcionário</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Saldo atual</TableHead>
                <TableHead>Distribuição</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground"><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Carregando funcionários…</TableCell></TableRow>
              )}
              {!isLoading && isError && (
                <TableRow><TableCell colSpan={5} className="text-center py-10">
                  <p className="text-sm text-rose-600 mb-2">Falha ao carregar funcionários.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
                </TableCell></TableRow>
              )}
              {!isLoading && !isError && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">Nenhum funcionário encontrado com esse filtro.</TableCell></TableRow>
              )}
              {!isLoading && !isError && rows.map((e) => {
                const pct = Math.round((Math.abs(e.bancoHoras) / maxAbs) * 100);
                const positive = e.bancoHoras >= 0;
                return (
                  <TableRow key={e.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {e.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{e.nome}</p>
                          <p className="text-[11px] text-muted-foreground">Mat. {e.matricula} · {e.cargo}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.departamento}</TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center gap-1 font-bold tabular-nums text-sm ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        {positive ? '+' : ''}{minutesToHHmm(e.bancoHoras)}
                      </div>
                    </TableCell>
                    <TableCell className="w-[240px]">
                      <Progress value={pct} className={`h-2 ${positive ? '[&>*]:bg-emerald-500' : '[&>*]:bg-rose-500'}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setAdjustEmp(e)}>Ajustar / Extrato</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BancoHorasAdjustDialog open={!!adjustEmp} employee={adjustEmp} onClose={() => setAdjustEmp(null)} />
    </div>
  );
};


export default PontoBancoHoras;
