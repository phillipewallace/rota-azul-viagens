/**
 * Sininho de notificações do módulo Ponto — agrega justificativas pendentes,
 * batidas faltando hoje, aniversariantes da semana e férias vencendo.
 * Front-only: computa em cima do mock. Popover shadcn com contraste em ambos os modos.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Scale, UserX, Cake, Plane, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  JUSTIFICATIONS,
  EMPLOYEES,
  employeesMissingPunchToday,
  aniversariantesProximos,
  feriasVencendo,
} from '@/pages/ponto/pontoMock';

type NotifKind = 'justificativa' | 'ausencia' | 'aniversario' | 'ferias';
interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  detail: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string; // classes de cor
}

const useNotifications = (): Notif[] =>
  useMemo(() => {
    const out: Notif[] = [];

    JUSTIFICATIONS.filter((j) => j.status === 'pendente').forEach((j) => {
      const emp = EMPLOYEES.find((e) => e.id === j.employeeId);
      out.push({
        id: `just-${j.id}`,
        kind: 'justificativa',
        title: `${emp?.nome ?? 'Funcionário'} enviou justificativa`,
        detail: `${j.tipo.replace('-', ' ')} · aguardando análise`,
        href: '/ponto/justificativas',
        icon: Scale,
        tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      });
    });

    employeesMissingPunchToday().slice(0, 5).forEach((e) => {
      out.push({
        id: `abs-${e.id}`,
        kind: 'ausencia',
        title: `${e.nome} sem batida hoje`,
        detail: `${e.cargo} · ${e.departamento}`,
        href: '/ponto/registros',
        icon: UserX,
        tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      });
    });

    aniversariantesProximos(7).forEach(({ e, date }) => {
      out.push({
        id: `bday-${e.id}`,
        kind: 'aniversario',
        title: `${e.nome} faz aniversário`,
        detail: date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }),
        href: '/ponto/funcionarios',
        icon: Cake,
        tone: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      });
    });

    feriasVencendo(30).forEach(({ e, diasRest }) => {
      out.push({
        id: `vac-${e.id}`,
        kind: 'ferias',
        title: `Férias de ${e.nome} vencendo`,
        detail: diasRest <= 0 ? 'Vencidas — risco de multa (CLT 134)' : `Em ${diasRest} dia${diasRest === 1 ? '' : 's'}`,
        href: '/ponto/funcionarios',
        icon: Plane,
        tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      });
    });

    return out;
  }, []);

export const NotificationsBell: React.FC<{ align?: 'start' | 'center' | 'end' }> = ({ align = 'end' }) => {
  const items = useNotifications();
  const count = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${count} notificações`}
          className="relative h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={2.1} />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-4 text-center tabular-nums ring-2 ring-white dark:ring-slate-900">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[360px] p-0 overflow-hidden border-border/70 shadow-lg"
        sideOffset={8}
      >
        <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-500/10">
          <div>
            <p className="font-display text-sm font-semibold">Notificações</p>
            <p className="text-[11px] text-muted-foreground">{count} pendência{count === 1 ? '' : 's'} · Ponto Digital</p>
          </div>
          <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <Separator />
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Tudo em dia 🎉
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.href}
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:bg-muted/60"
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${n.tone}`}>
                      <n.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 capitalize">{n.detail}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
