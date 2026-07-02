/**
 * Modal para criar / editar / remover jornada de trabalho.
 * Ligado a POST/PUT/DELETE /api/ponto/jornadas.
 */
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateJornada, useUpdateJornada, useDeleteJornada } from '@/hooks/usePontoData';
import type { Jornada } from './pontoUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  jornada?: Jornada | null;
}

const DIAS = [
  { v: 0, l: 'D' }, { v: 1, l: 'S' }, { v: 2, l: 'T' }, { v: 3, l: 'Q' },
  { v: 4, l: 'Q' }, { v: 5, l: 'S' }, { v: 6, l: 'S' },
];

const isHHMM = (s: string) => /^\d{2}:\d{2}$/.test(s);

export const JornadaDialog: React.FC<Props> = ({ open, onClose, jornada }) => {
  const create = useCreateJornada();
  const update = useUpdateJornada();
  const del = useDeleteJornada();
  const editing = !!jornada?.id;

  const [f, setF] = useState({
    nome: '', carga_semanal: 44, entrada: '08:00', saida_almoco: '12:00',
    volta_almoco: '13:00', saida: '17:00', tolerancia_min: 10,
    dias_semana: [1, 2, 3, 4, 5] as number[],
  });

  useEffect(() => {
    if (jornada) {
      setF({
        nome: jornada.nome, carga_semanal: jornada.cargaSemanal,
        entrada: jornada.entrada, saida_almoco: jornada.saidaAlmoco || '',
        volta_almoco: jornada.voltaAlmoco || '', saida: jornada.saida,
        tolerancia_min: jornada.tolerancia, dias_semana: jornada.diasSemana,
      });
    } else {
      setF({ nome: '', carga_semanal: 44, entrada: '08:00', saida_almoco: '12:00', volta_almoco: '13:00', saida: '17:00', tolerancia_min: 10, dias_semana: [1,2,3,4,5] });
    }
  }, [jornada, open]);

  const busy = create.isPending || update.isPending || del.isPending;

  const validate = (): string | null => {
    if (!f.nome.trim()) return 'Informe o nome da jornada.';
    if (!isHHMM(f.entrada) || !isHHMM(f.saida)) return 'Horários de entrada e saída devem estar em HH:MM.';
    if (f.saida_almoco && !isHHMM(f.saida_almoco)) return 'Saída para almoço em HH:MM.';
    if (f.volta_almoco && !isHHMM(f.volta_almoco)) return 'Volta do almoço em HH:MM.';
    if (f.tolerancia_min < 0 || f.tolerancia_min > 10) return 'Tolerância deve ser entre 0 e 10 min (CLT art. 58 §1º).';
    if (f.carga_semanal <= 0 || f.carga_semanal > 60) return 'Carga semanal inválida.';
    if (!f.dias_semana.length) return 'Selecione ao menos um dia da semana.';
    return null;
  };

  const salvar = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    try {
      const payload = {
        ...f,
        nome: f.nome.trim(),
        saida_almoco: f.saida_almoco || null,
        volta_almoco: f.volta_almoco || null,
      };
      if (editing) {
        await update.mutateAsync({ id: jornada!.id, ...payload });
        toast.success('Jornada atualizada.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Jornada criada.');
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar jornada.');
    }
  };

  const remover = async () => {
    if (!editing) return;
    if (!confirm(`Remover a jornada "${jornada!.nome}"? Funcionários vinculados perderão o modelo.`)) return;
    try {
      await del.mutateAsync(jornada!.id);
      toast.success('Jornada removida.');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao remover. Verifique se há funcionários vinculados.');
    }
  };

  const toggleDia = (v: number) =>
    setF((s) => ({ ...s, dias_semana: s.dias_semana.includes(v) ? s.dias_semana.filter((x) => x !== v) : [...s.dias_semana, v].sort() }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar jornada' : 'Nova jornada'}</DialogTitle>
          <DialogDescription>Modelo aplicado aos funcionários. Tolerância máxima de 10 min/dia (CLT).</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input className="mt-1" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Comercial 44h" maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Carga semanal (h)</Label>
              <Input type="number" min={1} max={60} className="mt-1" value={f.carga_semanal} onChange={(e) => setF({ ...f, carga_semanal: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Tolerância (min)</Label>
              <Input type="number" min={0} max={10} className="mt-1" value={f.tolerancia_min} onChange={(e) => setF({ ...f, tolerancia_min: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Entrada</Label><Input type="time" className="mt-1" value={f.entrada} onChange={(e) => setF({ ...f, entrada: e.target.value })} /></div>
            <div><Label className="text-xs">Saída</Label><Input type="time" className="mt-1" value={f.saida} onChange={(e) => setF({ ...f, saida: e.target.value })} /></div>
            <div><Label className="text-xs">Saída almoço</Label><Input type="time" className="mt-1" value={f.saida_almoco} onChange={(e) => setF({ ...f, saida_almoco: e.target.value })} /></div>
            <div><Label className="text-xs">Volta almoço</Label><Input type="time" className="mt-1" value={f.volta_almoco} onChange={(e) => setF({ ...f, volta_almoco: e.target.value })} /></div>
          </div>
          <div>
            <Label className="text-xs">Dias da semana</Label>
            <div className="flex gap-1.5 mt-1.5">
              {DIAS.map((d) => (
                <button key={d.v} type="button" onClick={() => toggleDia(d.v)}
                  className={`h-9 w-9 rounded-md text-xs font-medium border transition-colors ${
                    f.dias_semana.includes(d.v)
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-background text-muted-foreground border-border hover:border-emerald-500/40'
                  }`}>{d.l}</button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editing ? (
            <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 gap-1.5" onClick={remover} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button onClick={salvar} disabled={busy} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0 gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JornadaDialog;
