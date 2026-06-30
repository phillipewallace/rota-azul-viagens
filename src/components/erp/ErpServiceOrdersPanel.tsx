/**
 * Painel de Ordens de Serviço abertas do ERP, exibido dentro da página
 * de Sanitários para facilitar a entrega/baixa dos sanitários reservados.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { serviceOrdersService, quotesService, ServiceOrder } from '@/services/quotes';
import { generateQuotePdf } from '@/utils/quotePdf';
import { generateContractPdf } from '@/utils/contractPdf';
import { generateServiceOrderPdf } from '@/utils/serviceOrderPdf';
import { BoletoVencimentoDialog } from '@/components/erp/BoletoVencimentoDialog';
import { toast } from 'sonner';
import {
  RefreshCcw, Truck, MapPin, User, CalendarClock, AlertTriangle,
  PackageOpen, CheckCircle2, Loader2, FileText, FileDown, FileSignature, ClipboardList,
} from 'lucide-react';
import SanitarioMultiCombobox from './SanitarioMultiCombobox';
import { formatDateBR } from '@/utils/dateFormat';

import { confirmDialog } from '@/lib/confirm';
const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d?: string | null) => d ? formatDateBR(d) : '—';

interface DeliverState {
  os: ServiceOrder;
  numeros: string[];
  address: string;
  notes: string;
}

interface CloseState {
  os: ServiceOrder;
  descricao: string;
}

export default function ErpServiceOrdersPanel({ onChanged, refreshKey }: { onChanged?: () => void; refreshKey?: number }) {
  const [list, setList] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deliver, setDeliver] = useState<DeliverState | null>(null);
  const [closing, setClosing] = useState<CloseState | null>(null);
  const [busy, setBusy] = useState(false);
  const [contractTarget, setContractTarget] = useState<ServiceOrder | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await serviceOrdersService.list({ status: 'aberta' });
      setList(rows);
    } catch (e: any) { toast.error(e.message || 'Erro ao carregar OS'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (refreshKey !== undefined) load(); }, [refreshKey]);

  // Notificações de entregas próximas (hoje / amanhã)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ups = await serviceOrdersService.upcoming();
        if (cancelled || !ups.length) return;
        for (const u of ups) {
          const when = u.hoje ? 'HOJE' : u.amanha ? 'AMANHÃ' : '';
          toast.warning(
            `Entrega ${when} · OS ${u.numero}${u.customerName ? ` — ${u.customerName}` : ''}`,
            { duration: 8000, description: u.enderecoEntrega || undefined }
          );
        }
      } catch { /* silencioso */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter(o =>
      o.numero.toLowerCase().includes(s) ||
      (o.customerName || '').toLowerCase().includes(s) ||
      (o.companyRazaoSocial || '').toLowerCase().includes(s)
    );
  }, [list, search]);

  const totals = useMemo(() => {
    const t = { count: list.length, atraso: 0, reservados: 0, entregues: 0, valor: 0 };
    for (const o of list) {
      if (o.emAtraso) t.atraso++;
      t.reservados += Math.max(0, (o.sanitariosAlocados || 0) - (o.sanitariosEntregues || 0));
      t.entregues += o.sanitariosEntregues || 0;
      t.valor += Number(o.valorTotal || 0);
    }
    return t;
  }, [list]);

  const openDeliver = (os: ServiceOrder) => {
    setDeliver({
      os,
      numeros: [],
      address: os.enderecoEntrega || os.customerAddress || '',
      notes: '',
    });
  };

  const submitDeliver = async () => {
    if (!deliver) return;
    const nums = deliver.numeros.map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!nums.length) { toast.error('Informe pelo menos um número de sanitário'); return; }
    setBusy(true);
    try {
      const r = await serviceOrdersService.deliver(deliver.os.id, {
        sanitarioNumeros: nums,
        address: deliver.address || undefined,
        notes: deliver.notes || undefined,
      });
      toast.success(`${r.delivered.length} sanitário(s) entregue(s) e vinculado(s) à OS ${deliver.os.numero}`);
      setDeliver(null);
      await load();
      onChanged?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const closeOs = async (os: ServiceOrder) => {
    if ((os.tipoLocacao || '').toLowerCase() === 'evento') {
      setClosing({ os, descricao: '' });
    } else {
      if (!(await confirmDialog({ description: `Fechar a OS ${os.numero}? Os sanitários permanecerão em cliente até a baixa manual em /sanitarios.`, destructive: true }))) return;
      doClose(os);
    }
  };

  const doClose = async (os: ServiceOrder, descricao?: string) => {
    setBusy(true);
    try {
      const r = await serviceOrdersService.close(os.id, descricao ? { descricao } : undefined);
      toast.success(r.recolhidos
        ? `OS ${os.numero} fechada e sanitários recolhidos automaticamente`
        : `OS ${os.numero} fechada`);
      setClosing(null);
      await load();
      onChanged?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const submitClose = async () => {
    if (!closing) return;
    if (!closing.descricao.trim()) { toast.error('Descrição obrigatória para fechar OS de evento'); return; }
    await doClose(closing.os, closing.descricao.trim());
  };

  const downloadQuotePdf = async (os: ServiceOrder) => {
    try {
      const detail = await serviceOrdersService.get(os.id) as any;
      const quoteId = detail.quote_id || detail.quoteId;
      if (!quoteId) { toast.error('OS sem orçamento vinculado'); return; }
      const q = await quotesService.get(quoteId);
      generateQuotePdf(q);
      toast.success('PDF do orçamento gerado');
    } catch (e: any) { toast.error(e.message); }
  };

  const downloadContractPdf = async (os: ServiceOrder, dataVencimento?: string, preview = false) => {
    try {
      const detail = await serviceOrdersService.get(os.id) as any;
      await generateContractPdf({
        numero: detail.numero || os.numero,
        tipo: 'os',
        tipoContrato: (() => {
          const t = (detail.tipo_locacao || os.tipoLocacao || '').toLowerCase();
          if (t === 'evento') return 'evento';
          if (t === 'obra') return 'obra';
          return 'locacao';
        })(),
        modalidade: detail.modalidade || os.modalidade,
        dataEmissao: detail.data_inicio,
        dataInicio: detail.data_inicio,
        dataEntrega: detail.data_entrega,
        dataFimPrevista: detail.data_fim_prevista,
        dataRecolhimento: detail.data_recolhimento || os.dataRecolhimento,
        horaEntrega: detail.hora_entrega || null,
        localEvento: detail.local_evento || null,
        limpezasSemanais: detail.limpezas_semanais,
        enderecoEntrega: detail.endereco_entrega || os.enderecoEntrega,
        observacoes: detail.observacoes,
        frete: detail.frete,
        dataVencimento: dataVencimento || null,
        total: Number(detail.valor_total || os.valorTotal || 0),
        companySnapshot: detail.companySnapshot,
        customerSnapshot: detail.customer_snapshot,
        customerName: os.customerName,
        customerAddress: os.customerAddress,
        items: detail.items || [],
      }, { preview });

      if (!preview) toast.success('Contrato gerado');
    } catch (e: any) { toast.error(e.message); }
  };
  const downloadServiceOrderPdf = async (os: ServiceOrder) => {
    try {
      const detail = await serviceOrdersService.get(os.id) as any;
      generateServiceOrderPdf({
        numero: detail.numero || os.numero,
        modalidade: detail.modalidade || os.modalidade,
        tipoLocacao: detail.tipo_locacao || os.tipoLocacao,
        dataInicio: detail.data_inicio,
        dataEntrega: detail.data_entrega || os.dataEntrega,
        dataRecolhimento: detail.data_recolhimento || os.dataRecolhimento,
        dataFimPrevista: detail.data_fim_prevista || os.dataFimPrevista,
        limpezasSemanais: detail.limpezas_semanais ?? os.limpezasSemanais,
        enderecoEntrega: detail.endereco_entrega || os.enderecoEntrega,
        observacoes: detail.observacoes,
        qtdReservada: detail.qtd_reservada ?? os.qtdReservada,
        customerName: os.customerName,
        customerAddress: os.customerAddress,
        customerSnapshot: detail.customer_snapshot,
        companySnapshot: detail.companySnapshot,
        companyRazaoSocial: os.companyRazaoSocial,
        items: detail.items || [],
        sanitariosNumeros: (detail.sanitarios || []).map((s: any) => s.numero).filter(Boolean),
      });
      toast.success('OS para entrega gerada');
    } catch (e: any) { toast.error(e.message); }
  };


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-[11px] uppercase text-muted-foreground">OS abertas</div>
          <div className="text-2xl font-bold">{totals.count}</div>
        </CardContent></Card>
        <Card className={totals.atraso ? 'border-red-200' : ''}><CardContent className="p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Em atraso</div>
          <div className={`text-2xl font-bold ${totals.atraso ? 'text-red-700' : ''}`}>{totals.atraso}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Reservados</div>
          <div className="text-2xl font-bold text-purple-700">{totals.reservados}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Já entregues</div>
          <div className="text-2xl font-bold text-blue-700">{totals.entregues}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Valor em aberto</div>
          <div className="text-lg font-bold text-emerald-700 tabular-nums">{BRL(totals.valor)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input className="max-w-md" placeholder="Buscar por número, cliente ou empresa…"
                 value={search} onChange={e => setSearch(e.target.value)} />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Vincule aqui os números reais dos sanitários quando forem entregues no cliente.
          </span>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Nenhuma OS aberta no momento.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(os => {
            const reservados = Math.max(0, (os.sanitariosAlocados || 0) - (os.sanitariosEntregues || 0));
            const isEvento = (os.tipoLocacao || '').toLowerCase() === 'evento';
            return (
              <Card key={os.id} className={os.emAtraso ? 'border-red-300' : ''}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold">{os.numero}</span>
                        <Badge variant={os.modalidade === 'diaria' ? 'default' : 'secondary'} className="text-[10px]">
                          {os.modalidade === 'diaria' ? '🗓 Diária' : '📅 Mensal'}
                        </Badge>
                        {isEvento && <Badge className="bg-pink-100 text-pink-700 text-[10px]">🎉 Evento</Badge>}
                        {os.emAtraso && (
                          <Badge className="bg-red-100 text-red-700 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" /> EM ATRASO
                          </Badge>
                        )}
                      </div>
                      <div className="font-semibold mt-0.5 truncate flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {os.customerName || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {os.enderecoEntrega || os.customerAddress || '—'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-primary tabular-nums">{BRL(os.valorTotal)}</div>
                      <div className="text-[10px] text-muted-foreground">{os.companyRazaoSocial || ''}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-purple-50 border border-purple-100 rounded p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Reservados</div>
                      <div className="font-bold text-purple-700">{reservados}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded p-2">
                      <div className="text-[10px] text-muted-foreground uppercase">Entregues</div>
                      <div className="font-bold text-blue-700">{os.sanitariosEntregues || 0}</div>
                    </div>
                    <div className="rounded p-2 border">
                      <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> Entrega
                      </div>
                      <div className="font-semibold">{fmtDate(os.dataEntrega)}</div>
                    </div>
                  </div>

                  {os.modalidade === 'mensal' && os.limpezasSemanais != null && (
                    <div className="text-[11px] text-muted-foreground">
                      🧽 {os.limpezasSemanais} limpeza(s) por semana
                    </div>
                  )}
                  {isEvento && os.dataRecolhimento && (
                    <div className="text-[11px] text-muted-foreground">
                      🎯 Recolhimento previsto: {fmtDate(os.dataRecolhimento)}
                    </div>
                  )}
                  {!isEvento && os.modalidade === 'diaria' && os.dataFimPrevista && (
                    <div className="text-[11px] text-muted-foreground">
                      Recolhimento previsto: {fmtDate(os.dataFimPrevista)}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t flex-wrap">
                    <Button size="sm" className="flex-1 min-w-[140px]" onClick={() => openDeliver(os)}>
                      <Truck className="h-4 w-4 mr-1" /> Entregar / vincular
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => closeOs(os)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Fechar
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="default" className="flex-1 bg-green-700 hover:bg-green-800"
                            onClick={() => downloadServiceOrderPdf(os)}>
                      <ClipboardList className="h-3.5 w-3.5 mr-1" /> Gerar OS (entrega)
                    </Button>
                    <Button size="sm" variant="default" className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => setContractTarget(os)}>
                      <FileSignature className="h-3.5 w-3.5 mr-1" /> Gerar Contrato
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="ghost" className="flex-1 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => downloadQuotePdf(os)}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> PDF Orçamento
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de entrega */}
      <Dialog open={!!deliver} onOpenChange={(o) => !o && setDeliver(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Entregar sanitários · OS {deliver?.os.numero}</DialogTitle>
          </DialogHeader>
          {deliver && (
            <div className="space-y-3">
              <div className="text-sm bg-muted/30 rounded p-2">
                <div><strong>Cliente:</strong> {deliver.os.customerName || '—'}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.max(0, (deliver.os.sanitariosAlocados || 0) - (deliver.os.sanitariosEntregues || 0))} reservado(s) ·
                  {' '}{deliver.os.sanitariosEntregues || 0} já entregue(s)
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Números dos sanitários *</label>
                <SanitarioMultiCombobox
                  value={deliver.numeros}
                  onChange={(v) => setDeliver({ ...deliver, numeros: v })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Selecione na lista de disponíveis (ou digite e tecle Enter para adicionar manualmente).
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Endereço de entrega</label>
                <Textarea rows={2} value={deliver.address}
                          onChange={e => setDeliver({ ...deliver, address: e.target.value })}
                          placeholder="Endereço onde os sanitários ficarão instalados" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Observações</label>
                <Input value={deliver.notes}
                       onChange={e => setDeliver({ ...deliver, notes: e.target.value })}
                       placeholder="Opcional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeliver(null)}>Cancelar</Button>
            <Button onClick={submitDeliver} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PackageOpen className="h-4 w-4 mr-1" />}
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal fechar OS de evento */}
      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar OS de Evento · {closing?.os.numero}</DialogTitle>
            <DialogDescription>
              Ao fechar, todos os sanitários ainda em cliente serão recolhidos automaticamente
              (baixa equivalente à manual em /sanitarios).
            </DialogDescription>
          </DialogHeader>
          {closing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Descrição do recolhimento *</label>
                <Textarea rows={3} value={closing.descricao}
                          onChange={e => setClosing({ ...closing, descricao: e.target.value })}
                          placeholder="Ex.: Equipe recolheu os 5 sanitários após o término do evento. Condições gerais boas." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosing(null)}>Cancelar</Button>
            <Button onClick={submitClose} disabled={busy} className="bg-green-600 hover:bg-green-700">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Fechar e recolher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BoletoVencimentoDialog
        open={!!contractTarget}
        contractLabel={contractTarget ? `contrato da OS ${contractTarget.numero}` : undefined}
        onClose={() => setContractTarget(null)}
        onConfirm={async ({ dataVencimento, preview }) => {
          const os = contractTarget;
          setContractTarget(null);
          if (os) await downloadContractPdf(os, dataVencimento, preview);
        }}
      />
    </div>
  );
}
