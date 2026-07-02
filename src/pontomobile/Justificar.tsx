import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Plus, CheckCircle2, XCircle, Clock3, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  currentUser,
  listMyJustifications,
  createJustification,
  type Justification,
  type JustTipo,
} from './api';

const TIPO_LABEL: Record<JustTipo, string> = {
  atestado: 'Atestado',
  falta: 'Falta',
  esquecimento: 'Esqueci de bater',
  outro: 'Outro',
};

function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function PontoMobileJustificar() {
  const user = currentUser();
  const funcionarioId = user?.funcionario_id;
  const [items, setItems] = useState<Justification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!funcionarioId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await listMyJustifications(funcionarioId);
      setItems(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [funcionarioId]);

  const grouped = useMemo(() => {
    const pend = items.filter(i => i.status === 'pendente');
    const rest = items.filter(i => i.status !== 'pendente');
    return { pend, rest };
  }, [items]);

  return (
    <div className="pm-safe-top space-y-5 px-5 pb-6">
      <header className="flex items-end justify-between pt-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Solicitações</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Justificativas</h1>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:brightness-105 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ background: 'var(--pm-gradient)' }}
        >
          <Plus className="h-4 w-4" /> Nova
        </button>
      </header>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-2xl bg-card shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState onNew={() => setOpen(true)} />
      ) : (
        <>
          {grouped.pend.length > 0 && (
            <Section title="Aguardando aprovação" items={grouped.pend} />
          )}
          {grouped.rest.length > 0 && (
            <Section title="Histórico" items={grouped.rest} />
          )}
        </>
      )}

      {open && funcionarioId && (
        <NewJustificationSheet
          funcionarioId={funcionarioId}
          onClose={() => setOpen(false)}
          onCreated={() => { setOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-12 text-center shadow-sm">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-primary"
        style={{ background: 'hsl(var(--primary-soft))' }}
      >
        <FileText className="h-8 w-8" />
      </div>
      <p className="text-base font-semibold text-foreground">Nenhuma justificativa</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Envie um atestado, justifique uma falta ou registre um esquecimento de batida.
      </p>
      <button
        onClick={onNew}
        className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:brightness-105 active:scale-[.98]"
        style={{ background: 'var(--pm-gradient)' }}
      >
        <Plus className="h-4 w-4" /> Criar solicitação
      </button>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Justification[] }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <ul className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {items.map((j) => (
          <li key={j.id} className="flex items-start gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
            <StatusIcon status={j.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{TIPO_LABEL[j.tipo]}</p>
                <span className="text-xs text-muted-foreground">•</span>
                <p className="text-xs text-muted-foreground">{fmtDate(j.data)}{j.horario ? ` · ${j.horario}` : ''}</p>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{j.motivo}</p>
              {j.observacao_revisao && (
                <p className="mt-1 text-xs italic text-muted-foreground">Gestor: {j.observacao_revisao}</p>
              )}
            </div>
            <StatusBadge status={j.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusIcon({ status }: { status: Justification['status'] }) {
  const map = {
    pendente: { Icon: Clock3, bg: 'hsl(var(--warning-soft, var(--muted)))', color: 'text-warning' },
    aprovada: { Icon: CheckCircle2, bg: 'hsl(var(--success-soft, var(--muted)))', color: 'text-success' },
    recusada: { Icon: XCircle, bg: 'hsl(var(--destructive) / 0.12)', color: 'text-destructive' },
  } as const;
  const { Icon, bg, color } = map[status];
  return (
    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`} style={{ background: bg }}>
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

function StatusBadge({ status }: { status: Justification['status'] }) {
  const map = {
    pendente: 'bg-muted text-muted-foreground',
    aprovada: 'bg-success/15 text-success',
    recusada: 'bg-destructive/15 text-destructive',
  } as const;
  const label = { pendente: 'Pendente', aprovada: 'Aprovada', recusada: 'Recusada' }[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${map[status]}`}>{label}</span>;
}

function NewJustificationSheet({
  funcionarioId, onClose, onCreated,
}: { funcionarioId: string; onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);
  const [tipo, setTipo] = useState<JustTipo>('atestado');
  const [horario, setHorario] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (motivo.trim().length < 5) { toast.error('Descreva o motivo (mín. 5 caracteres)'); return; }
    setSaving(true);
    try {
      await createJustification({
        funcionario_id: funcionarioId,
        data, tipo,
        motivo: motivo.trim(),
        horario: horario || undefined,
      });
      toast.success('Solicitação enviada');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/40 backdrop-blur-sm duration-200 animate-in fade-in" onClick={onClose}>
      <div
        className="pm-safe-bottom w-full rounded-t-[2rem] bg-background p-6 pt-4 shadow-2xl duration-200 animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Nova justificativa</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TIPO_LABEL) as JustTipo[]).map((t) => (
                <button
                  type="button" key={t}
                  onClick={() => setTipo(t)}
                  className={`h-11 rounded-xl border text-sm font-medium transition-all duration-150 ${
                    tipo === t
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-card text-foreground hover:bg-muted'
                  }`}
                >
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="j-data" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</label>
              <input
                id="j-data" type="date" value={data} max={today}
                onChange={(e) => setData(e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="j-hora" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horário <span className="lowercase text-muted-foreground/70">(opc.)</span></label>
              <input
                id="j-hora" type="time" value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="j-motivo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motivo</label>
            <textarea
              id="j-motivo" rows={4} value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da justificativa..."
              className="w-full resize-none rounded-xl border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            type="submit" disabled={saving}
            className="mt-1 flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:brightness-105 active:scale-[.99] disabled:opacity-60"
            style={{ background: 'var(--pm-gradient)' }}
          >
            {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</> : <><Send className="h-5 w-5" /> Enviar solicitação</>}
          </button>
        </form>
      </div>
    </div>
  );
}
