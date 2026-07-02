/**
 * Extrato + ajuste manual do banco de horas de um funcionário.
 * Lê /api/ponto/bank-adjustments?funcionario_id e cria via POST.
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useBankAdjustments, useCreateBankAdjustment } from '@/hooks/usePontoData';
import { minutesToHHmm, type Employee } from './pontoUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export const BancoHorasAdjustDialog: React.FC<Props> = ({ open, onClose, employee }) => {
  const { data: adjustments = [], isLoading, isError, refetch } = useBankAdjustments(employee?.id);
  const create = useCreateBankAdjustment();
  const [minutos, setMinutos] = useState<string>('');
  const [motivo, setMotivo] = useState('');

  const reset = () => { setMinutos(''); setMotivo(''); };

  const salvar = async () => {
    if (!employee) return;
    const min = Number(minutos);
    if (!Number.isFinite(min) || min === 0) { toast.error('Informe minutos (use negativo para débito).'); return; }
    if (Math.abs(min) > 60 * 24 * 30) { toast.error('Ajuste absurdamente alto — revise o valor.'); return; }
    if (!motivo.trim() || motivo.trim().length < 5) { toast.error('Descreva o motivo (mín. 5 caracteres).'); return; }
    try {
      await create.mutateAsync({ funcionario_id: employee.id, minutos: min, motivo: motivo.trim() });
      toast.success('Ajuste registrado.');
      reset();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao registrar ajuste.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !create.isPending && (onClose(), reset())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Banco de horas · {employee?.nome ?? ''}</DialogTitle>
          <DialogDescription>
            Saldo atual:{' '}
            <span className={`font-bold tabular-nums ${(employee?.bancoHoras ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(employee?.bancoHoras ?? 0) >= 0 ? '+' : ''}{minutesToHHmm(employee?.bancoHoras ?? 0)}
            </span>{' '}
            · Lei 13.467/2017.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo ajuste</p>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="minutos" value={minutos} onChange={(e) => setMinutos(e.target.value)} />
              <div className="col-span-2 flex gap-1">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setMinutos('60')}>+1h</Button>
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setMinutos('-60')}>-1h</Button>
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setMinutos('')}>0</Button>
              </div>
            </div>
            <Textarea placeholder="Motivo do ajuste (obrigatório — fica registrado)" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={280} />
            <div className="flex justify-end">
              <Button onClick={salvar} disabled={create.isPending} size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0 gap-2">
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Registrar
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Extrato</p>
            {isLoading && <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>}
            {isError && (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-rose-600">
                <AlertCircle className="h-5 w-5" /> Falha ao carregar extrato.
                <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
              </div>
            )}
            {!isLoading && !isError && adjustments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum ajuste manual registrado ainda.</p>
            )}
            {!isLoading && !isError && adjustments.length > 0 && (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 max-h-64 overflow-auto">
                {adjustments.map((a: any) => {
                  const pos = Number(a.minutos) >= 0;
                  return (
                    <li key={a.id} className="flex items-center gap-3 p-2.5 text-sm">
                      {pos ? <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" /> : <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{a.motivo}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(a.criado_em || a.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                      <span className={`tabular-nums font-bold text-xs ${pos ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {pos ? '+' : ''}{minutesToHHmm(Number(a.minutos))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); reset(); }}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BancoHorasAdjustDialog;
