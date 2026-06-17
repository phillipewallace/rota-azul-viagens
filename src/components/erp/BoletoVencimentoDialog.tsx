/**
 * Modal compacto para selecionar a data de vencimento do(s) boleto(s)
 * antes de gerar o PDF do contrato.
 */
import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock, FileText, Eye } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { dataVencimento: string; preview: boolean }) => void;
  defaultDate?: string;
  contractLabel?: string;
}

export function BoletoVencimentoDialog({ open, onClose, onConfirm, defaultDate, contractLabel }: Props) {
  const [date, setDate] = useState('');
  useEffect(() => {
    if (open) {
      const d = defaultDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setDate(d);
    }
  }, [open, defaultDate]);

  const submit = (preview: boolean) => {
    if (!date) return;
    onConfirm({ dataVencimento: date, preview });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" /> Vencimento do boleto
          </DialogTitle>
          <DialogDescription>
            {contractLabel
              ? `Gerar ${contractLabel}. Informe a data que aparecerá na cláusula de pagamento.`
              : 'Informe a data que será preenchida no contrato como vencimento do boleto.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Data de vencimento</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" onClick={() => submit(true)} disabled={!date}>
            <Eye className="h-4 w-4 mr-1" /> Pré-visualizar
          </Button>
          <Button onClick={() => submit(false)} disabled={!date}
                  className="bg-indigo-600 hover:bg-indigo-700">
            <FileText className="h-4 w-4 mr-1" /> Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
