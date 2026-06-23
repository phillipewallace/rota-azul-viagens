/**
 * Modal de geração do contrato (PDF).
 *
 * Forma de pagamento agora é padronizada (cartão/PIX/boleto). O usuário não
 * digita mais a data de vencimento: para BOLETO ela é SEMPRE 28 dias após a
 * data de entrega (regra fixa do negócio). Para PIX/cartão não há vencimento.
 */
import { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarClock, FileText, Eye } from 'lucide-react';
import { calcVencimentoBoleto, describeFormaPagamento, FORMA_PAGAMENTO_LABEL, type FormaPagamento } from '@/utils/fixedObservations';
import { formatDateBR } from '@/utils/dateFormat';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { dataVencimento: string; preview: boolean }) => void;
  contractLabel?: string;
  formaPagamento?: FormaPagamento | string | null;
  dataEntrega?: string | null;
}

export function BoletoVencimentoDialog({
  open, onClose, onConfirm, contractLabel, formaPagamento, dataEntrega,
}: Props) {
  const forma = (formaPagamento || 'boleto') as FormaPagamento;
  const isBoleto = forma === 'boleto';

  const vencimento = useMemo(() => calcVencimentoBoleto(dataEntrega), [dataEntrega]);

  const submit = (preview: boolean) => {
    // Para pix/cartao não há vencimento — passamos string vazia.
    onConfirm({ dataVencimento: isBoleto ? vencimento : '', preview });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" /> Geração do contrato
          </DialogTitle>
          <DialogDescription>
            {contractLabel ? `Gerar ${contractLabel}.` : 'Confirme a forma de pagamento antes de gerar o contrato.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Forma de pagamento</div>
            <div className="font-semibold">{FORMA_PAGAMENTO_LABEL[forma] || String(forma)}</div>
          </div>

          {isBoleto ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <div className="text-xs text-blue-900/70">Vencimento do boleto (regra fixa)</div>
              <div className="font-semibold text-blue-900">{formatDateBR(vencimento)}</div>
              <div className="text-[11px] text-blue-900/80 mt-1">
                Sempre 28 dias após a data de entrega
                {dataEntrega ? <> ({formatDateBR(dataEntrega)}).</> : <> — entrega ainda não preenchida; usando hoje como referência.</>}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 text-xs">
              {describeFormaPagamento(forma, dataEntrega)}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" onClick={() => submit(true)}>
            <Eye className="h-4 w-4 mr-1" /> Pré-visualizar
          </Button>
          <Button onClick={() => submit(false)} className="bg-indigo-600 hover:bg-indigo-700">
            <FileText className="h-4 w-4 mr-1" /> Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
