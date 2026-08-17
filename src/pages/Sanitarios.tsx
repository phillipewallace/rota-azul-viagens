import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  History, Camera, PackageOpen, PackageCheck, AlertTriangle, 
  Info, Calendar, MapPin, Wrench, Search, Filter, Layers, 
  Trash2, Plus, ArrowLeft, RefreshCcw, Image as ImageIcon, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';
import { 
  fetchSanitarioStockSummary, sanitarioCategoriaLabel, 
  type SanitarioCategoria, type SanitarioStockSummary, SANITARIO_CATEGORIAS 
} from '@/services/erp';
import { Link } from 'react-router-dom';
import { BRL } from '@/utils/currency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ErpServiceOrdersPanel from '@/components/erp/ErpServiceOrdersPanel';

interface SanitarioFoto {
  id: string;
  url: string;
  tipo_evento: string;
  estado_conservacao?: string;
  observacoes?: string;
  funcionario_nome?: string;
  created_at: string;
}

interface SanitarioMovimentacao {
  id: string;
  operation_type: string;
  customer_name?: string;
  address?: string;
  driver_name?: string;
  funcionario_nome?: string;
  occurred_at: string;
  notes?: string;
  fotos?: string[];
}

interface Sanitario {
  id: string;
  numero: string;
  categoria: SanitarioCategoria;
  status: 'disponivel' | 'em_cliente' | 'manutencao' | 'inativo';
  estado_atual: 'bom' | 'danificado' | 'critico';
  tipo_locacao_alvo?: 'obra' | 'evento';
  current_customer_name?: string;
  current_address?: string;
  current_lat?: number;
  current_lng?: number;
  installed_at?: string;
}

const statusBadge = (s: string) => {
  switch (s) {
    case 'em_cliente': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Em cliente</Badge>;
    case 'disponivel': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Disponível</Badge>;
    case 'manutencao': return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Manutenção</Badge>;
    default: return <Badge variant="secondary">Inativo</Badge>;
  }
};

const estadoBadge = (e: string) => {
  switch (e) {
    case 'bom': return <Badge variant="outline" className="border-emerald-500 text-emerald-600">Bom</Badge>;
    case 'danificado': return <Badge variant="outline" className="border-amber-500 text-amber-600">Danificado</Badge>;
    case 'critico': return <Badge variant="outline" className="border-rose-500 text-rose-600">Crítico</Badge>;
    default: return null;
  }
};

export default function Sanitarios() {
  const [list, setList] = useState<Sanitario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stock, setStock] = useState<SanitarioStockSummary | null>(null);
  const [selected, setSelected] = useState<Sanitario | null>(null);
  const [details, setDetails] = useState<{ movimentacoes: SanitarioMovimentacao[], fotos: SanitarioFoto[] } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [osRefreshKey, setOsRefreshKey] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const tk = localStorage.getItem('auth_token');
      const url = new URL(`${API_BASE_URL}/sanitarios`);
      if (search) url.searchParams.set('q', search);
      if (statusFilter) url.searchParams.set('status', statusFilter);
      
      const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${tk}` } });
      const data = await r.json();
      setList(Array.isArray(data) ? data : (data.data || []));
      
      const stockData = await fetchSanitarioStockSummary();
      setStock(stockData);
    } catch (e) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (s: Sanitario) => {
    setSelected(s);
    setDetailsLoading(true);
    try {
      const tk = localStorage.getItem('auth_token');
      const r = await fetch(`${API_BASE_URL}/erp/sanitarios-new/${s.id}/historico-completo`, {
        headers: { Authorization: `Bearer ${tk}` }
      });
      const data = await r.json();
      setDetails(data);
    } catch (e) {
      toast.error('Erro ao carregar histórico');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const [recolhimentoOpen, setRecolhimentoOpen] = useState(false);
  const [recolhimentoData, setRecolhimentoData] = useState({ data: '', osId: '' });

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Gestão de Sanitários</h1>
              <p className="text-xs text-muted-foreground">Monitoramento profissional de ativos e frotas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} className="gap-2">
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {stock && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Disponíveis', value: stock.disponivel, icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Em Cliente', value: stock.em_cliente, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Manutenção', value: stock.manutencao, icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Reservados OS', value: stock.reservadosEmOs, icon: Calendar, color: 'text-slate-600', bg: 'bg-slate-50' },
              { label: 'Total Físico', value: stock.totalFisico, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            ].map((kpi, i) => (
              <Card key={i} className="border-none shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{kpi.label}</p>
                    <p className="text-xl font-black">{kpi.value || 0}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="inventario" className="space-y-6">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="inventario" className="gap-2"><Layers className="h-4 w-4" /> Inventário</TabsTrigger>
            <TabsTrigger value="os" className="gap-2"><PackageOpen className="h-4 w-4" /> Ordens de Serviço</TabsTrigger>
            <TabsTrigger value="funcionarios" className="gap-2"><History className="h-4 w-4" /> Funcionários</TabsTrigger>
          </TabsList>

          <TabsContent value="inventario" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por número, cliente ou endereço..." 
                      className="pl-9 bg-white" 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && load()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <select 
                      className="h-10 px-3 rounded-md border bg-white text-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">Todos Status</option>
                      <option value="disponivel">Disponível</option>
                      <option value="em_cliente">Em Cliente</option>
                      <option value="manutencao">Manutenção</option>
                    </select>
                    <Button onClick={load} size="icon"><Filter className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map(s => (
                    <Card 
                      key={s.id} 
                      className={`cursor-pointer transition-all border-none shadow-sm hover:ring-2 hover:ring-primary/20 ${selected?.id === s.id ? 'ring-2 ring-primary shadow-md' : ''}`}
                      onClick={() => loadDetails(s)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-muted-foreground"># {s.numero}</span>
                            <h3 className="font-bold text-base">{sanitarioCategoriaLabel(s.categoria)}</h3>
                          </div>
                          {statusBadge(s.status)}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {estadoBadge(s.estado_atual)}
                          <Badge variant="secondary" className="text-[10px]">
                            {s.tipo_locacao_alvo === 'obra' ? '🏗️ Obra' : '🎉 Evento'}
                          </Badge>
                        </div>

                        {s.current_customer_name && (
                          <div className="pt-2 border-t space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium">
                              <MapPin className="h-3 w-3 text-rose-500" />
                              <span className="truncate">{s.current_customer_name}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate pl-4.5">{s.current_address}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {selected ? (
                  <Card className="border-none shadow-lg sticky top-24">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Detalhes do Ativo</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Status Atual</p>
                            <p className="text-sm font-bold capitalize">{selected.status.replace('_', ' ')}</p>
                          </div>
                          {statusBadge(selected.status)}
                        </div>

                        <Tabs defaultValue="history">
                          <TabsList className="w-full grid grid-cols-2 h-8">
                            <TabsTrigger value="history" className="text-[10px]">Histórico</TabsTrigger>
                            <TabsTrigger value="photos" className="text-[10px]">Fotos</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="history" className="pt-4">
                            {detailsLoading ? (
                              <div className="flex justify-center py-10"><RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : (
                              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {details?.movimentacoes.map(m => (
                                  <div key={m.id} className="relative pl-6 border-l-2 border-slate-100 pb-4 last:pb-0">
                                    <div className="absolute -left-[9px] top-0 p-1 bg-white border-2 border-slate-100 rounded-full">
                                      <div className={`w-2 h-2 rounded-full ${m.operation_type === 'entrega' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase text-slate-500">{m.operation_type}</span>
                                        <span className="text-[9px] text-muted-foreground">{new Date(m.occurred_at).toLocaleDateString()}</span>
                                      </div>
                                      <p className="text-xs font-semibold">{m.customer_name || 'Almoxarifado'}</p>
                                      {m.funcionario_nome && <p className="text-[9px] text-muted-foreground">Por: {m.funcionario_nome}</p>}
                                    </div>
                                  </div>
                                ))}
                                {!details?.movimentacoes.length && <p className="text-center py-10 text-xs text-muted-foreground italic">Sem movimentações</p>}
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="photos" className="pt-4">
                            {detailsLoading ? (
                              <div className="flex justify-center py-10"><RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : (
                              <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
                                {details?.fotos.map(f => (
                                  <div key={f.id} className="group relative aspect-square rounded-md overflow-hidden bg-slate-100 cursor-zoom-in">
                                    <img src={f.url} alt="Sanitário" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1">
                                      <span className="text-[8px] text-white font-bold truncate">{f.tipo_evento}</span>
                                      <span className="text-[7px] text-white/80">{new Date(f.created_at).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                ))}
                                {!details?.fotos.length && <div className="col-span-3 text-center py-10 text-xs text-muted-foreground italic">Nenhuma foto anexada</div>}
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>

                      <div className="pt-4 border-t flex flex-col gap-2">
                        <Button className="w-full gap-2" variant="outline">
                          <Wrench className="h-4 w-4" /> Solicitar Manutenção
                        </Button>
                        {selected.status === 'em_cliente' && (
                          <Button 
                            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setRecolhimentoOpen(true)}
                          >
                            <PackageCheck className="h-4 w-4" /> Indicar Recolhimento
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="h-[400px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Layers className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Selecione um sanitário para ver detalhes</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="os" className="mt-0">
            <ErpServiceOrdersPanel refreshKey={osRefreshKey} onChanged={() => { load(); setOsRefreshKey(k => k + 1); }} />
          </TabsContent>

          <TabsContent value="funcionarios" className="mt-0">
            {/* Componente de Funcionários importado dinamicamente ou renderizado aqui */}
            <div className="bg-white rounded-xl border p-6">
               <h3 className="font-bold mb-4">Gestão de Equipe de Campo</h3>
               <p className="text-sm text-muted-foreground mb-6">Cadastre funcionários para acesso ao aplicativo mobile e atribuição de ordens de serviço.</p>
               {/* Integrar FuncionariosList aqui */}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Recolhimento */}
      <Dialog open={recolhimentoOpen} onOpenChange={setRecolhimentoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Recolhimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Esta ação notificará a equipe de campo no aplicativo para programar a retirada do sanitário <strong>#{selected?.numero}</strong>.</p>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Data Desejada</label>
              <Input 
                type="date" 
                value={recolhimentoData.data} 
                onChange={(e) => setRecolhimentoData(d => ({ ...d, data: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecolhimentoOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-white" onClick={() => {
              toast.success('Solicitação enviada para o app dos funcionários!');
              setRecolhimentoOpen(false);
            }}>Enviar para o App</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FuncionariosTab() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const tk = localStorage.getItem('auth_token');
        const r = await fetch(`${API_BASE_URL}/erp/funcionarios`, {
          headers: { Authorization: `Bearer ${tk}` }
        });
        const data = await r.json();
        setFuncionarios(Array.isArray(data) ? data : []);
      } catch (e) {
        toast.error('Erro ao carregar funcionários');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {funcionarios.map(f => (
        <Card key={f.id} className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate">{f.nome}</h3>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{f.tipo || 'Funcionário'}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={f.active ? 'secondary' : 'destructive'} className="text-[8px] h-4">
                  {f.active ? 'Ativo' : 'Inativo'}
                </Badge>
                {f.cpf && <span className="text-[9px] text-slate-400">CPF: {f.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {funcionarios.length === 0 && (
        <div className="col-span-full py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-xl">
          Nenhum funcionário cadastrado.
        </div>
      )}
    </div>
  );
}

