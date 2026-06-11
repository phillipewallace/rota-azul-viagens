/**
 * ERP — Ordens de Serviço: lista com flag de atraso (diárias),
 * fechamento devolve sanitários ao estoque.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, AlertTriangle, CheckCircle2, RefreshCcw, Trash2, Loader2, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { serviceOrdersService, ServiceOrder } from '@/services/quotes';

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

const ServiceOrders: React.FC = () => {
  const [list, setList] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todas' | 'abertas' | 'atrasadas' | 'fechadas'>('todas');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await serviceOrdersService.list();
      setList(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let l = list;
    if (tab === 'abertas') l = l.filter(x => x.status === 'aberta' && !x.emAtraso);
    if (tab === 'atrasadas') l = l.filter(x => x.emAtraso);
    if (tab === 'fechadas') l = l.filter(x => x.status === 'fechada');
    if (search) {
      const s = search.toLowerCase();
      l = l.filter(x => x.numero?.toLowerCase().includes(s) || x.customerName?.toLowerCase().includes(s));
    }
    return l;
  }, [list, tab, search]);

  const counts = useMemo(() => ({
    todas: list.length,
    abertas: list.filter(x => x.status === 'aberta' && !x.emAtraso).length,
    atrasadas: list.filter(x => x.emAtraso).length,
    fechadas: list.filter(x => x.status === 'fechada').length,
  }), [list]);

  const close = async (o: ServiceOrder) => {
    if (!confirm(`Fechar OS ${o.numero} e devolver ${o.sanitariosAlocados || 0} sanitário(s) ao estoque?`)) return;
    try {
      await serviceOrdersService.close(o.id);
      toast.success('OS fechada · estoque atualizado');
      load();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (o: ServiceOrder) => {
    if (!confirm(`Excluir OS ${o.numero}? Sanitários alocados voltam ao estoque.`)) return;
    try { await serviceOrdersService.remove(o.id); toast.success('Excluída'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
            </Button>
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Ordens de Serviço</h1>
            <Badge variant="secondary">{list.length}</Badge>
            {counts.atrasadas > 0 && (
              <Badge className="bg-red-600 text-white gap-1">
                <AlertTriangle className="h-3 w-3" /> {counts.atrasadas} em atraso
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" />Recarregar</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por número ou cliente…"
                     value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['todas', 'abertas', 'atrasadas', 'fechadas'] as const).map(t => (
                <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'}
                        onClick={() => setTab(t)}
                        className={tab !== t && t === 'atrasadas' && counts.atrasadas > 0 ? 'border-red-300 text-red-700' : ''}>
                  {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhuma OS</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(o => (
              <Card key={o.id} className={`hover:shadow-md transition-shadow ${o.emAtraso ? 'border-red-300 bg-red-50/40' : ''}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm">{o.numero}</div>
                      <div className="text-sm font-semibold truncate">{o.customerName || '—'}</div>
                    </div>
                    {o.emAtraso ? (
                      <Badge className="bg-red-600 text-white gap-1"><AlertTriangle className="h-3 w-3" />Atrasada</Badge>
                    ) : (
                      <Badge className={o.status === 'fechada' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'}>
                        {o.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{o.modalidade === 'diaria' ? '🗓 Diária' : '📅 Mensal'} · {BRL(o.valorTotal)}</div>
                    <div>Início: {D(o.dataInicio)} · Fim previsto: {D(o.dataFimPrevista)}</div>
                    <div>Sanitários alocados: <strong>{o.sanitariosAlocados || 0}</strong></div>
                  </div>
                  <div className="flex gap-1 pt-2 border-t">
                    {o.status === 'aberta' && (
                      <Button size="sm" variant="outline" className="flex-1 text-green-700 hover:bg-green-50" onClick={() => close(o)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Fechar e devolver
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(o)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceOrders;
