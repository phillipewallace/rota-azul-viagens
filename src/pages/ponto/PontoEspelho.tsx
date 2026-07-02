/**
 * Espelho de Ponto — visão detalhada por funcionário e período.
 * Modelo compatível com espelho oficial (Portaria MTP 671/2021 art. 84).
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileCheck2, Printer, Download, ArrowLeft, ArrowRight, User, Activity, LogIn, Coffee, LogOut, UtensilsCrossed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { computeDay, localDateFromYmd, minutesToHHmm } from './pontoUtils';
import { useEmployees, usePunches, useJornadas, useSettings, useJustifications } from '@/hooks/usePontoData';
import { generateEspelhoIndividualPdf } from './pontoPdf';

const weekdayLabel = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const PontoEspelho: React.FC = () => {
  const { data: EMPLOYEES = [], isLoading: loadingEmps, isError: errEmps, refetch: refetchEmps } = useEmployees();
  const { data: JORNADAS = [], isLoading: loadingJorn } = useJornadas();
  const { data: settings } = useSettings();
  const [exporting, setExporting] = React.useState<'print' | 'pdf' | null>(null);

  const [empId, setEmpId] = useState<string>('');
  React.useEffect(() => {
    if (!empId && EMPLOYEES.length) setEmpId(EMPLOYEES[0].id);
  }, [empId, EMPLOYEES]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Reset do dia selecionado ao trocar funcionário ou mês
  React.useEffect(() => { setSelectedDay(null); }, [empId, month]);

  const [y, mNum] = month.split('-').map(Number);
  const from = `${month}-01T00:00:00`;
  const lastDay = String(new Date(y, mNum, 0).getDate()).padStart(2, '0');
  const to = `${month}-${lastDay}T23:59:59`;
  const { data: PUNCHES = [], isLoading: loadingPunches } = usePunches(
    empId ? { funcionario_id: empId, from, to, limit: 500, include_photo: false } : undefined
  );
  const { data: JUSTIFICATIONS = [], isLoading: loadingJustifications } = useJustifications(
    empId ? { funcionario_id: empId } : undefined,
  );

  const emp = EMPLOYEES.find((e) => e.id === empId);
  const jornada = emp ? JORNADAS.find((j) => j.id === emp.jornadaId) : undefined;

  // Fallback: se não houver jornada, previsto/atraso não são calculáveis, mas
  // ainda mostramos batidas e "trabalhado" (pareamento simples).
  const jornadaSafe = jornada ?? {
    id: '', nome: '—', cargaSemanal: 44,
    entrada: '', saidaAlmoco: '', voltaAlmoco: '', saida: '',
    tolerancia: 0, diasSemana: [1, 2, 3, 4, 5],
  };

  const days = useMemo(() => {
    const daysInMonth = new Date(y, mNum, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
      const pts = PUNCHES.filter((p) => p.employeeId === empId && p.timestamp.startsWith(iso))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const d = localDateFromYmd(iso);
      const isWorkday = jornadaSafe.diasSemana.includes(d.getDay());
      const comp = computeDay(pts, jornadaSafe, iso, JUSTIFICATIONS, empId);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isFuture = d > today;
      const considered = comp.abonado || pts.length > 0 || (isWorkday && !isFuture);
      return { iso, d, isWorkday, isFuture, considered, comp, hasPunches: pts.length > 0 };
    });
  }, [empId, month, jornadaSafe, PUNCHES, JUSTIFICATIONS, y, mNum]);

  const totals = useMemo(() => {
    return days.reduce(
      (acc, x) => {
        if (x.considered) {
          acc.trabalhado += x.comp.trabalhado;
          acc.extras += x.comp.extra;
          acc.atrasos += x.comp.atraso;
          acc.saldo += x.comp.saldo;
        }
        if (x.considered && x.isWorkday) acc.previsto += x.comp.previsto || 0;
        return acc;
      },
      { trabalhado: 0, extras: 0, atrasos: 0, saldo: 0, previsto: 0 },
    );
  }, [days]);

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleExport = async (mode: 'print' | 'pdf') => {
    if (!emp) { toast.error('Selecione um funcionário.'); return; }
    if (loadingPunches || loadingJustifications) { toast.info('Aguarde o carregamento das batidas e justificativas.'); return; }
    setExporting(mode);
    try {
      const empresa = {
        razao_social: (settings as any)?.empresa_razao_social ?? (settings as any)?.razao_social ?? '',
        cnpj: (settings as any)?.empresa_cnpj ?? (settings as any)?.cnpj ?? '',
        endereco: (settings as any)?.empresa_endereco ?? '',
        cei: (settings as any)?.cei ?? '',
      };
      const empPunches = PUNCHES.filter((p) => p.employeeId === emp.id);
      generateEspelhoIndividualPdf({
        empresa,
        employee: emp,
        jornada,
        punches: empPunches,
        justifications: JUSTIFICATIONS,
        month,
        filename: `Espelho_${emp.matricula || emp.nome.replace(/\s+/g, '_')}_${month}.pdf`,
      });
      toast.success(mode === 'print' ? 'PDF gerado — abra e use Imprimir do visualizador.' : 'PDF oficial gerado.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao gerar PDF.');
    } finally {
      setExporting(null);
    }
  };

  if (loadingEmps || loadingJorn) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando espelho…</div>;
  }
  if (errEmps) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm text-rose-600">Falha ao carregar funcionários.</p>
        <Button size="sm" variant="outline" onClick={() => refetchEmps()}>Tentar novamente</Button>
      </div>
    );
  }
  if (EMPLOYEES.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">Nenhum funcionário cadastrado.</div>;
  }
  if (!emp) {
    return <div className="p-8 text-sm text-muted-foreground">Selecione um funcionário.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <FileCheck2 className="h-3.5 w-3.5" /> Ponto Digital
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Espelho de Ponto</h1>
          <p className="text-sm text-muted-foreground mt-1">Modelo conforme Portaria MTP 671/2021 — art. 84.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={exporting !== null || loadingPunches || loadingJustifications}
            onClick={() => handleExport('print')}
          >
            {exporting === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0"
            disabled={exporting !== null || loadingPunches || loadingJustifications}
            onClick={() => handleExport('pdf')}
          >
            {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF Oficial
          </Button>
        </div>
      </header>

      {/* Seletor */}
      <Card className="border-border/60">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <User className="h-4 w-4 text-muted-foreground" />
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMPLOYEES.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} · {e.matricula}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => changeMonth(-1)}><ArrowLeft className="h-4 w-4" /></Button>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => changeMonth(1)}><ArrowRight className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Cabeçalho do espelho */}
      <Card className="border-border/60 bg-gradient-to-br from-emerald-500/[0.03] to-transparent">
        <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Funcionário</p>
            <p className="font-display font-semibold text-sm mt-0.5">{emp.nome}</p>
            <p className="text-xs text-muted-foreground">Mat. {emp.matricula} · {emp.cargo}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CPF · PIS</p>
            <p className="text-sm font-medium mt-0.5 tabular-nums">{emp.cpf}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{emp.pis}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Jornada</p>
            <p className="text-sm font-medium mt-0.5">{jornada?.nome ?? 'Sem jornada'}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {jornada
                ? `${jornada.entrada}–${jornada.saidaAlmoco} · ${jornada.voltaAlmoco}–${jornada.saida}`
                : 'Atribua uma jornada ao funcionário'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Período</p>
            <p className="text-sm font-medium mt-0.5 capitalize">
              {new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-xs text-muted-foreground">Departamento: {emp.departamento}</p>
          </div>
        </CardContent>
      </Card>

      {/* Timeline visual */}
      {(() => {
        const daysWithPunches = days.filter((d) => d.hasPunches);
        const dayIso = selectedDay ?? daysWithPunches[daysWithPunches.length - 1]?.iso ?? days[0]?.iso;
        const day = days.find((d) => d.iso === dayIso);
        if (!day) return null;
        const dayPunches = PUNCHES.filter((p) => p.employeeId === empId && p.timestamp.startsWith(dayIso))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        const startHour = 5;
        const endHour = 23;
        const totalMin = (endHour - startHour) * 60;
        const toPct = (iso: string) => {
          const d = new Date(iso);
          const min = d.getHours() * 60 + d.getMinutes() - startHour * 60;
          return Math.max(0, Math.min(100, (min / totalMin) * 100));
        };
        // Intervalos "presente" e "almoço" para pintar faixas
        const segments: Array<{ from: number; to: number; tone: 'work' | 'break' }> = [];
        if (day.comp.entrada && day.comp.saida) {
          const a = toPct(day.comp.entrada.timestamp);
          const b = toPct(day.comp.saida.timestamp);
          segments.push({ from: a, to: b, tone: 'work' });
        }
        if (day.comp.saidaAlmoco && day.comp.voltaAlmoco) {
          const a = toPct(day.comp.saidaAlmoco.timestamp);
          const b = toPct(day.comp.voltaAlmoco.timestamp);
          segments.push({ from: a, to: b, tone: 'break' });
        }
        const iconOf = (tipo: string) => {
          if (tipo === 'entrada') return LogIn;
          if (tipo === 'saida') return LogOut;
          if (tipo === 'saida-almoco') return UtensilsCrossed;
          if (tipo === 'volta-almoco') return Coffee;
          return Activity;
        };
        const hoursMarks = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
        const daysWithPunchesList = daysWithPunches.slice(-14);
        return (
          <Card className="border-border/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
            <CardContent className="p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold leading-none">Linha do tempo</h3>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {day.d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mr-2">
                    <span className="h-2 w-3 rounded-sm bg-emerald-500/60" /> Trabalho
                    <span className="h-2 w-3 rounded-sm bg-amber-500/60 ml-2" /> Intervalo
                  </div>
                  {daysWithPunchesList.map((dd) => (
                    <button
                      key={dd.iso}
                      onClick={() => setSelectedDay(dd.iso)}
                      className={`h-7 min-w-[36px] px-2 rounded-md text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                        dd.iso === dayIso
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      {dd.d.getDate()}
                    </button>
                  ))}
                </div>
              </div>

              {dayPunches.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
                  Sem batidas registradas neste dia.
                </div>
              ) : (
                <div className="relative pt-6 pb-10">
                  {/* Track */}
                  <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                    {segments.map((s, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 ${s.tone === 'work' ? 'bg-emerald-500/60' : 'bg-amber-500/60'}`}
                        style={{ left: `${s.from}%`, width: `${Math.max(s.to - s.from, 0.5)}%` }}
                      />
                    ))}
                  </div>

                  {/* Hour ticks */}
                  <div className="relative mt-1.5 h-4">
                    {hoursMarks.map((h) => {
                      const pct = ((h - startHour) / (endHour - startHour)) * 100;
                      return (
                        <div key={h} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground tabular-nums" style={{ left: `${pct}%` }}>
                          {String(h).padStart(2, '0')}h
                        </div>
                      );
                    })}
                  </div>

                  {/* Punch markers */}
                  {dayPunches.map((p) => {
                    const pct = toPct(p.timestamp);
                    const Icon = iconOf(p.tipo);
                    const tone = p.tipo.includes('almoco') ? 'amber' : p.tipo === 'saida' ? 'sky' : 'emerald';
                    const ring = tone === 'amber' ? 'ring-amber-500/40 bg-amber-500' : tone === 'sky' ? 'ring-sky-500/40 bg-sky-500' : 'ring-emerald-500/40 bg-emerald-500';
                    return (
                      <div
                        key={p.id}
                        className="absolute -translate-x-1/2 group"
                        style={{ left: `${pct}%`, top: 0 }}
                      >
                        <div className={`h-6 w-6 rounded-full ${ring} ring-4 ring-offset-2 ring-offset-background flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 top-8 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="rounded-md bg-popover border border-border/60 px-2 py-1 shadow-lg text-[10px]">
                            <p className="font-semibold capitalize">{p.tipo.replace('-', ' ')}</p>
                            <p className="text-muted-foreground tabular-nums">
                              {new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resumo do dia */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trabalhado</p>
                  <p className="font-display font-bold tabular-nums text-primary mt-0.5">{minutesToHHmm(day.comp.trabalhado)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Extras</p>
                  <p className="font-display font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">{minutesToHHmm(day.comp.extra)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</p>
                  <p className={`font-display font-bold tabular-nums mt-0.5 ${day.comp.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {day.comp.saldo >= 0 ? '+' : ''}{minutesToHHmm(day.comp.saldo)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Trabalhado', v: totals.trabalhado, tint: 'text-primary' },
          { label: 'Previsto', v: totals.previsto, tint: 'text-foreground' },
          { label: 'Extras (50%)', v: totals.extras, tint: 'text-amber-600 dark:text-amber-400' },
          { label: 'Atrasos', v: totals.atrasos, tint: 'text-rose-600 dark:text-rose-400' },
          { label: 'Saldo', v: totals.saldo, tint: totals.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
        ].map((t) => (
          <Card key={t.label} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
              <p className={`font-display text-xl font-bold tabular-nums mt-1 ${t.tint}`}>
                {t.v > 0 && t.label === 'Saldo' ? '+' : ''}{minutesToHHmm(t.v)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-16">Dia</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Entrada</TableHead>
                  <TableHead className="text-center">S. Almoço</TableHead>
                  <TableHead className="text-center">V. Almoço</TableHead>
                  <TableHead className="text-center">Saída</TableHead>
                  <TableHead className="text-center">Trabalhado</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map(({ iso, d, isWorkday, comp, hasPunches, considered }) => {
                  const weekend = !isWorkday;
                  return (
                    <TableRow key={iso} className={weekend ? 'bg-muted/30 hover:bg-muted/40' : 'hover:bg-muted/30'}>
                      <TableCell className="text-xs text-muted-foreground uppercase tabular-nums">{weekdayLabel[d.getDay()]}</TableCell>
                      <TableCell className="text-sm tabular-nums">{d.toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{fmtTime(comp.entrada?.timestamp)}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{fmtTime(comp.saidaAlmoco?.timestamp)}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{fmtTime(comp.voltaAlmoco?.timestamp)}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{fmtTime(comp.saida?.timestamp)}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums font-medium">
                        {considered ? minutesToHHmm(comp.trabalhado) : '—'}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums font-semibold">
                        {considered ? (
                          <span className={comp.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {comp.saldo >= 0 ? '+' : ''}{minutesToHHmm(comp.saldo)}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {comp.abonado && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{comp.observacao}</Badge>}
                        {!comp.abonado && weekend && !hasPunches && <Badge variant="secondary" className="text-[10px]">DSR</Badge>}
                        {!comp.abonado && isWorkday && !hasPunches && <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20">Falta</Badge>}
                        {!comp.abonado && comp.justification && <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20">{comp.observacao}</Badge>}
                        {hasPunches && comp.incompleto && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">Incompleto</Badge>}
                        {hasPunches && comp.atraso > 0 && !comp.incompleto && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">Atraso {minutesToHHmm(comp.atraso)}</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assinatura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        <div className="text-center">
          <div className="border-t border-border pt-2 mx-8">
            <p className="text-xs text-muted-foreground">Assinatura do funcionário</p>
            <p className="text-sm font-medium mt-1">{emp.nome}</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-border pt-2 mx-8">
            <p className="text-xs text-muted-foreground">Assinatura do responsável</p>
            <p className="text-sm font-medium mt-1">Departamento Pessoal</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PontoEspelho;
