import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Building2, User, MapPin, Calendar, Package, ClipboardList, 
  AlertTriangle, Loader2, FileSignature, ImageIcon, Camera, X, CheckCircle2, Plus 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BRL, D, tipoLabel, describeFormaPagamento } from '@/lib/utils';
import { toast } from 'sonner';

// Re-incorporating the corrected ServiceOrders modal logic from line 816 to 1047
const ServiceOrders = ({ detailOpen, setDetailOpen, detailLoading, detailOs, detailData }: any) => {
  return (
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            OS <span className="font-mono">{detailOs?.numero}</span>
            {detailOs && (detailOs.emAtraso
              ? <Badge className="bg-red-600 text-white gap-1 ml-2"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>
              : <Badge className={`ml-2 ${detailOs.status === 'fechada' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'}`}>{detailOs.status}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {detailLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando detalhes…
          </div>
        )}

        {!detailLoading && detailOs && detailData && (() => {
          const o = detailOs as any;
          const det = detailData as any;
          return (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div><strong>Empresa:</strong> {o.companyRazaoSocial || det.companySnapshot?.razao_social || '—'}</div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <strong>Cliente:</strong> {o.customerName || '—'}
                    {det.customer_snapshot?.contact_phone && <> · {det.customer_snapshot.contact_phone}</>}
                    {det.customer_snapshot?.contact_name && <> · {det.customer_snapshot.contact_name}</>}
                  </div>
                </div>
                <div className="flex items-start gap-2 md:col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div><strong>Endereço:</strong> {det.endereco_entrega || o.customerAddress || '—'}</div>
                </div>
                <div className="flex items-start gap-2 md:col-span-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <strong>Entrega:</strong> {D(det.data_entrega || o.dataEntrega)}
                    {(det.data_recolhimento || o.dataRecolhimento) && <> · <strong>Recolhimento:</strong> {D(det.data_recolhimento || o.dataRecolhimento)}</>}
                    {det.data_fechamento && <> · <strong>Fechada em:</strong> {D(det.data_fechamento)}</>}
                  </div>
                </div>
                <div>
                  <strong>Modalidade:</strong> {o.modalidade === 'diaria' ? '🗓 Diária' : '📅 Mensal'}
                </div>
                <div>
                  <strong>Tipo:</strong> {tipoLabel((o as any).tipoLocacao)}
                </div>
              </div>

              {det.observacoes && (
                <div className="bg-muted/30 rounded p-2 text-xs">
                  <strong>Observações:</strong> {det.observacoes}
                </div>
              )}

              {Array.isArray(det.items) && det.items.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 mt-4">
                    <Package className="h-3 w-3" /> Itens no Orçamento
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {det.items.filter((i: any) => i.isSanitario).length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[9px] font-bold text-slate-400/70 uppercase tracking-tighter ml-1">Sanitários</div>
                        <div className="space-y-2">
                          {det.items.filter((i: any) => i.isSanitario).map((item: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center font-black text-primary text-xs">
                                  {item.quantidade}x
                                </div>
                                <span className="font-bold text-[11px] text-slate-700">{item.produto}</span>
                              </div>
                              <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase">Sanitário</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {det.items.filter((i: any) => !i.isSanitario).length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[9px] font-bold text-slate-400/70 uppercase tracking-tighter ml-1">Outros Serviços</div>
                        <div className="space-y-2">
                          {det.items.filter((i: any) => !i.isSanitario).map((item: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center font-black text-amber-600 text-xs">
                                  {item.quantidade}x
                                </div>
                                <span className="font-bold text-[11px] text-slate-700">{item.produto}</span>
                              </div>
                              <Badge className="bg-amber-100 text-amber-600 border-none text-[8px] font-black uppercase">Serviço</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {Array.isArray(det.sanitarios) && det.sanitarios.length > 0 && (
                <div className="border-t pt-2 mt-2">
                  <div className="font-semibold mt-1 mb-1 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Sanitários vinculados ({det.sanitarios.filter((s: any) => s.numero).length})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {det.sanitarios.filter((s: any) => s.numero).map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
                        <div className="w-10 h-10 rounded border bg-white overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                          {s.ultimaFotoUrl || s.fotoFinalizacaoUrl ? (
                            <img src={s.ultimaFotoUrl || s.fotoFinalizacaoUrl} alt="Foto" className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(s.ultimaFotoUrl || s.fotoFinalizacaoUrl, '_blank')} />
                          ) : (
                            <Package className="h-4 w-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold truncate">#{s.numero}</div>
                          <div className="text-[9px] text-muted-foreground uppercase truncate">{s.categoria || 'Comum'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Frete: {BRL(Number(det.frete || 0))}</span>
                <span className="text-base"><strong>Total: {BRL(Number(det.valor_total || o.valorTotal || 0))}</strong></span>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
};

export default ServiceOrders;
