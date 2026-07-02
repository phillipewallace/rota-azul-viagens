/**
 * Fechamento de Folha Mensal — trava competências para evitar alterações
 * retroativas e gera "snapshot" imutável para auditoria.
 * Front-only: usa localStorage via pontoMock.
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Lock, Unlock, ShieldCheck, CalendarDays, FileSignature, Undo2, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { computeDay, minutesToHHmm } from './pontoUtils';
import {
  useEmployees, useJornadas, usePunches, useJustifications,
  useClosures, useCreateClosure, useDeleteClosure,
} from '@/hooks/usePontoData';

const PontoFechamento: React.FC = () => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: EMPLOYEES = [] } = useEmployees();
  const { data: JORNADAS = [] } = useJornadas();
  const [y, mNum] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(y, mNum, 0).getDate()).padStart(2, '0')}`;
  const { data: PUNCHES = [] } = usePunches({ from, to, limit: 5000 });
  const { data: JUSTIFICATIONS = [] } = useJustifications();
  const { data: closuresList = [] } = useClosures();
  const createClosure = useCreateClosure();
  const deleteClosure = useDeleteClosure();

  const closedMap = useMemo(() => {
    const map: Record<string, { fechadoEm: string; fechadoPor: string }> = {};
    (closuresList as any[]).forEach((c) => {
      map[c.competencia] = { fechadoEm: c.fechado_em, fechadoPor: c.fechado_por };
    });
    return map;
  }, [closuresList]);
  const isClosed = !!closedMap[month];

  const summary = useMemo(() => {
    const daysInMonth = new Date(y, mNum, 0).getDate();
    let trabalhado = 0, extras = 0, atrasos = 0, faltas = 0;
    EMPLOYEES.forEach((e) => {
      const j = JORNADAS.find((x) => x.id === e.jornadaId);
      if (!j) return;
      for (let day = 1; day <= daysInMonth; day++) {
        const iso = `${month}-${String(day).padStart(2, '0')}`;
        const pts = PUNCHES.filter((p) => p.employeeId === e.id && p.timestamp.startsWith(iso));
        const dt = new Date(iso);
        if (!j.diasSemana.includes(dt.getDay())) continue;
        if (pts.length === 0) { faltas++; continue; }
        const c = computeDay(pts, j, iso);
        trabalhado += c.trabalhado; extras += c.extra; atrasos += c.atraso;
      }
    });
    const pendentes = JUSTIFICATIONS.filter(
      (j) => j.status === 'pendente' && j.data.startsWith(month),
    ).length;
    return { trabalhado, extras, atrasos, faltas, pendentes, funcionarios: EMPLOYEES.length };
  }, [month, EMPLOYEES, JORNADAS, PUNCHES, JUSTIFICATIONS, y, mNum]);

  const historyList = useMemo(
    () => Object.entries(closedMap).sort((a, b) => b[0].localeCompare(a[0])),
    [closedMap],
  );

  const monthLabel = new Date(month + '-01').toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric',
  });

  const handleClose = async () => {
    try {
      await createClosure.mutateAsync({ competencia: month });
      toast.success(`Competência ${monthLabel} fechada`, {
        description: 'Snapshot imutável gerado. Ajustes só via reabertura com justificativa.',
      });
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao fechar competência');
    }
  };

  const handleReopen = async (m: string) => {
    try {
      await deleteClosure.mutateAsync(m);
      toast.info(`Competência ${m} reaberta`, { description: 'Registre o motivo no log de auditoria.' });
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao reabrir competência');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Lock className="h-3.5 w-3.5" /> Ponto Digital
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Fechamento de folha</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Trava a competência para impedir alterações retroativas. Necessário para auditoria trabalhista
          e integridade dos arquivos AFD/AEJ (Portaria MTP 671/2021).
        </p>
      </header>

      {/* Seletor + Card principal */}
      <Card className="border-border/60 overflow-hidden">
        <div className={`h-1 ${isClosed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <CardContent className="p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${isClosed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                {isClosed ? <ShieldCheck className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Competência</p>
                <p className="font-display text-xl font-bold capitalize">{monthLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-44"
              />
              {isClosed ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 border gap-1">
                  <Lock className="h-3 w-3" /> Fechada
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 gap-1">
                  <Unlock className="h-3 w-3" /> Aberta
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* KPIs do período */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Funcionários', v: summary.funcionarios, unit: '' },
              { label: 'Horas trabalhadas', v: minutesToHHmm(summary.trabalhado), unit: '' },
              { label: 'Extras', v: minutesToHHmm(summary.extras), unit: '', tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'Atrasos', v: minutesToHHmm(summary.atrasos), unit: '', tone: 'text-rose-600 dark:text-rose-400' },
              { label: 'Faltas', v: summary.faltas, unit: 'dias', tone: 'text-rose-600 dark:text-rose-400' },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border/60 p-3 bg-muted/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className={`font-display text-lg font-bold tabular-nums mt-0.5 ${k.tone || 'text-foreground'}`}>
                  {k.v} <span className="text-[10px] text-muted-foreground font-medium">{k.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Bloqueadores */}
          {summary.pendentes > 0 && !isClosed && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <AlertCircleIcon />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {summary.pendentes} justificativa{summary.pendentes > 1 ? 's' : ''} pendente{summary.pendentes > 1 ? 's' : ''} na competência
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recomendamos analisar antes de fechar — após o fechamento não é possível editar retroativamente sem reabrir.
                </p>
              </div>
            </div>
          )}

          {/* Ação principal */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground max-w-md">
              {isClosed ? (
                <>Fechada em <strong>{new Date(closed[month].fechadoEm).toLocaleString('pt-BR')}</strong> por <strong>{closed[month].fechadoPor}</strong>.</>
              ) : (
                <>O fechamento gera assinatura digital SHA-256 e trava todas as batidas, justificativas e ajustes do período.</>
              )}
            </div>

            {isClosed ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Undo2 className="h-4 w-4" /> Reabrir competência
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reabrir {monthLabel}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isto permite edições retroativas na competência já fechada. A ação fica registrada no log de auditoria.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleReopen(month)}>Reabrir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0">
                    <FileSignature className="h-4 w-4" /> Fechar competência
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Fechar {monthLabel}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Após o fechamento, batidas e ajustes deste período ficam bloqueados. Um snapshot assinado é gerado
                      para fins de auditoria. Você poderá reabrir a competência, mas a ação será registrada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClose}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Confirmar fechamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold">Histórico de fechamentos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Snapshots assinados por competência</p>
            </div>
            <Badge variant="secondary" className="tabular-nums">{historyList.length}</Badge>
          </div>
          {historyList.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma competência fechada ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {historyList.map(([m, meta]) => (
                <li key={m} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Fechada em {new Date(meta.fechadoEm).toLocaleString('pt-BR')} · por {meta.fechadoPor}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => { handleReopen(m); }}
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Reabrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AlertCircleIcon: React.FC = () => (
  <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default PontoFechamento;
