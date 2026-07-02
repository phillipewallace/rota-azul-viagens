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
import { FileCheck2, Printer, Download, ArrowLeft, ArrowRight, User } from 'lucide-react';
import {
  EMPLOYEES, PUNCHES, JORNADAS, computeDay, minutesToHHmm,
} from './pontoMock';

const weekdayLabel = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const PontoEspelho: React.FC = () => {
  const [empId, setEmpId] = useState(EMPLOYEES[0].id);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const emp = EMPLOYEES.find((e) => e.id === empId)!;
  const jornada = JORNADAS.find((j) => j.id === emp.jornadaId)!;

  const days = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
      const pts = PUNCHES.filter((p) => p.employeeId === empId && p.timestamp.startsWith(iso))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const d = new Date(iso);
      const isWorkday = jornada.diasSemana.includes(d.getDay());
      const comp = computeDay(pts, jornada, iso);
      return { iso, d, isWorkday, comp, hasPunches: pts.length > 0 };
    });
  }, [empId, month, jornada]);

  const totals = useMemo(() => {
    return days.reduce(
      (acc, x) => {
        if (x.hasPunches) {
          acc.trabalhado += x.comp.trabalhado;
          acc.extras += x.comp.extra;
          acc.atrasos += x.comp.atraso;
          acc.saldo += x.comp.saldo;
        }
        if (x.isWorkday) acc.previsto += x.comp.previsto || 0;
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
          <Button variant="outline" size="sm" className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
          <Button size="sm" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0">
            <Download className="h-4 w-4" /> PDF Oficial
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
            <p className="text-sm font-medium mt-0.5">{jornada.nome}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {jornada.entrada}–{jornada.saidaAlmoco} · {jornada.voltaAlmoco}–{jornada.saida}
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
                {days.map(({ iso, d, isWorkday, comp, hasPunches }) => {
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
                        {hasPunches ? minutesToHHmm(comp.trabalhado) : '—'}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums font-semibold">
                        {hasPunches ? (
                          <span className={comp.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {comp.saldo >= 0 ? '+' : ''}{minutesToHHmm(comp.saldo)}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {weekend && !hasPunches && <Badge variant="secondary" className="text-[10px]">DSR</Badge>}
                        {isWorkday && !hasPunches && <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20">Falta</Badge>}
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
