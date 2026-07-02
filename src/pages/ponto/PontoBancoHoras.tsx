/**
 * Banco de Horas — Lei 13.467/2017 (Reforma Trabalhista). Compensação em até 6 meses
 * por acordo individual escrito, ou 1 ano por acordo/convenção coletiva.
 *
 * Saldo exibido = saldo persistido (ajustes manuais) + saldo do mês corrente
 * calculado a partir das batidas × jornada de cada funcionário.
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Timer, TrendingUp, TrendingDown, Search, AlertTriangle, ArrowUpRight, ArrowDownRight, Loader2, ChevronDown, ChevronRight, CheckCircle2, MinusCircle } from 'lucide-react';
import { minutesToHHmm, computeDay, type Employee, type Punch, type Jornada } from './pontoUtils';
import { useEmployees, useJornadas, usePunches } from '@/hooks/usePontoData';
import { BancoHorasAdjustDialog } from './BancoHorasAdjustDialog';

type DayDetail = {
  iso: string;
  label: string;
  considerado: boolean;
  motivo: string;
  trabalhado: number;
  previsto: number;
  saldo: number;
  batidas: number;
};

const buildDetail = (employeeId: string, jornada: Jornada | undefined, punches: Punch[], year: number, monthIdx: number): DayDetail[] => {
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const pts = punches.filter((p) => p.employeeId === employeeId);
  const byDay = new Map<string, Punch[]>();
  pts.forEach((p) => {
    const k = p.timestamp.slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(p);
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows: DayDetail[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIdx, d);
    const iso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayPts = (byDay.get(iso) || []).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const dow = dt.getDay();
    const isWorkDay = jornada?.diasSemana.includes(dow) ?? false;
    const future = dt > today;
    let considerado = false;
    let motivo = '';
    let trabalhado = 0, previsto = 0, saldo = 0;
    if (!jornada) motivo = 'Sem jornada atribuída';
    else if (future) motivo = 'Dia futuro';
    else if (!isWorkDay) motivo = 'Fora da jornada (folga)';
    else if (dayPts.length < 2) motivo = dayPts.length === 0 ? 'Sem batidas' : 'Batidas insuficientes (< 2)';
    else {
      const c = computeDay(dayPts, jornada, iso);
      trabalhado = c.trabalhado; previsto = c.previsto; saldo = c.saldo;
      considerado = true;
      motivo = saldo > 0 ? `+${minutesToHHmm(saldo)} de crédito` : saldo < 0 ? `${minutesToHHmm(saldo)} de débito` : 'Neutro';
    }
    const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dow];
    rows.push({ iso, label: `${String(d).padStart(2, '0')}/${String(monthIdx + 1).padStart(2, '0')} · ${wd}`, considerado, motivo, trabalhado, previsto, saldo, batidas: dayPts.length });
  }
  return rows;
};

const PontoBancoHoras: React.FC = () => {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'todos' | 'credito' | 'debito'>('todos');
  const { data: EMPLOYEES = [], isLoading, isError, refetch } = useEmployees();
  const { data: JORNADAS = [] } = useJornadas();
  const [adjustEmp, setAdjustEmp] = useState<Employee | null>(null);

  // Mês corrente — busca batidas de todos para compor saldo dinâmico
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const [y, mNum] = month.split('-').map(Number);
  const lastDay = String(new Date(y, mNum, 0).getDate()).padStart(2, '0');
  const { data: PUNCHES = [] } = usePunches({
    from: `${month}-01T00:00:00`,
    to: `${month}-${lastDay}T23:59:59`,
    limit: 5000,
    include_photo: false,
  });

  // Saldo dinâmico por funcionário: persistido + soma dos saldos diários do mês
  const bancoByEmp = useMemo(() => {
    const map = new Map<string, number>();
    EMPLOYEES.forEach((e) => {
      const jornada = JORNADAS.find((j) => j.id === e.jornadaId);
      let mes = 0;
      if (jornada) {
        const pts = PUNCHES.filter((p) => p.employeeId === e.id);
        const byDay = new Map<string, typeof pts>();
        pts.forEach((p) => {
          const k = p.timestamp.slice(0, 10);
          if (!byDay.has(k)) byDay.set(k, [] as any);
          (byDay.get(k) as any).push(p);
        });
        byDay.forEach((dayPts, iso) => {
          const dow = new Date(iso).getDay();
          if (!jornada.diasSemana.includes(dow)) return;
          const comp = computeDay(dayPts.sort((a, b) => a.timestamp.localeCompare(b.timestamp)), jornada, iso);
          if (dayPts.length >= 2) mes += comp.saldo;
        });
      }
      map.set(e.id, (e.bancoHoras || 0) + mes);
    });
    return map;
  }, [EMPLOYEES, JORNADAS, PUNCHES]);

  const enrichedRows = useMemo(() => {
    return EMPLOYEES.filter((e) => {
      if (e.status === 'desligado') return false;
      const saldo = bancoByEmp.get(e.id) || 0;
      if (tab === 'credito' && saldo <= 0) return false;
      if (tab === 'debito' && saldo >= 0) return false;
      if (q && !e.nome.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }).map((e) => ({ ...e, bancoHoras: bancoByEmp.get(e.id) || 0 }))
      .sort((a, b) => Math.abs(b.bancoHoras) - Math.abs(a.bancoHoras));
  }, [q, tab, EMPLOYEES, bancoByEmp]);

  const rows = enrichedRows;

  const totals = useMemo(() => {
    let credito = 0, debito = 0;
    EMPLOYEES.forEach((e) => {
      const s = bancoByEmp.get(e.id) || 0;
      if (s > 0) credito += s;
      else if (s < 0) debito += s;
    });
    return { credito, debito, liquido: credito + debito };
  }, [EMPLOYEES, bancoByEmp]);

  const maxAbs = Math.max(...Array.from(bancoByEmp.values()).map((v) => Math.abs(v)), 1);

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
