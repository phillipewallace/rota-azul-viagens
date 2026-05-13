/**
 * Página de gerenciamento de sanitários (banheiros químicos).
 * - Lista mestre com filtro por status e busca por número
 * - Detalhe lateral com cliente atual e histórico completo
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { API_BASE_URL } from '@/services/config';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { Search, MapPin, User, Calendar, Plus, RefreshCcw, History, Wrench, PackageCheck, PackageOpen, ArrowRightLeft, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface Sanitario {
  id: string;
  numero: string;
  modelo?: string;
  status: 'disponivel' | 'em_cliente' | 'manutencao' | 'inativo';
  current_customer_name?: string;
  current_address?: string;
  current_lat?: number;
  current_lng?: number;
  current_truck_id?: string;
  current_truck_name?: string;
  current_truck_plate?: string;
  installed_at?: string;
  notes?: string;
}

interface Truck { id: string; name: string; plate?: string }

const authHeaders = (): HeadersInit => {
  const t = localStorage.getItem('auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

interface Movimentacao {
  id: string;
  operation_type: 'entrega' | 'recolhimento' | 'manutencao' | 'transferencia';
  customer_name?: string;
  address?: string;
  driver_name?: string;
  occurred_at: string;
  notes?: string;
}

const statusBadge = (s: string) => {
  switch (s) {
    case 'em_cliente': return <Badge className="bg-blue-100 text-blue-700">Em cliente</Badge>;
    case 'disponivel': return <Badge className="bg-green-100 text-green-700">Disponível</Badge>;
    case 'manutencao': return <Badge className="bg-orange-100 text-orange-700">Manutenção</Badge>;
    default: return <Badge variant="secondary">Inativo</Badge>;
  }
};

const opIcon = (op: string) => {
  switch (op) {
    case 'entrega': return <PackageOpen className="h-4 w-4 text-blue-600" />;
    case 'recolhimento': return <PackageCheck className="h-4 w-4 text-green-600" />;
    case 'manutencao': return <Wrench className="h-4 w-4 text-orange-600" />;
    default: return <RefreshCcw className="h-4 w-4 text-gray-500" />;
  }
};

export default function Sanitarios() {
  const [list, setList] = useState<Sanitario[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [truckFilter, setTruckFilter] = useState('');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [selected, setSelected] = useState<(Sanitario & { historico: Movimentacao[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [newNum, setNewNum] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocCustomerId, setAllocCustomerId] = useState('');
  const [allocSearch, setAllocSearch] = useState('');
  const [allocNotes, setAllocNotes] = useState('');
  const [allocAddress, setAllocAddress] = useState('');
  const [allocBusy, setAllocBusy] = useState(false);
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaNotes, setBaixaNotes] = useState('');
  const { customers } = useCustomers();
  const filteredCustomers = useMemo(() => {
    const q = allocSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 50);
    return customers.filter(c =>
      (c.customerName || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [customers, allocSearch]);

  const buildFilterParams = () => {
    const p = new URLSearchParams();
    if (statusFilter) p.set('status', statusFilter);
    if (filter) p.set('q', filter);
    if (truckFilter) p.set('truckId', truckFilter);
    return p;
  };

  const load = async (goToPage = page) => {
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/sanitarios`);
      const p = buildFilterParams();
      p.forEach((v, k) => url.searchParams.set(k, v));
      url.searchParams.set('page', String(goToPage));
      url.searchParams.set('pageSize', String(pageSize));
      const r = await fetch(url.toString(), { headers: authHeaders() });
      const data = await r.json();
      // suporta tanto array (legacy) quanto {data,...}
      if (Array.isArray(data)) {
        setList(data); setTotal(data.length); setTotalPages(1);
      } else {
        setList(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      }
    } catch (e) {
      toast.error('Erro ao carregar sanitários');
    } finally { setLoading(false); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const url = new URL(`${API_BASE_URL}/sanitarios/export.csv`);
      buildFilterParams().forEach((v, k) => url.searchParams.set(k, v));
      const r = await fetch(url.toString(), { headers: authHeaders() });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sanitarios-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Exportação concluída');
    } catch {
      toast.error('Falha ao exportar CSV');
    } finally { setExporting(false); }
  };

  const loadTrucks = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/sanitarios/meta/trucks`, { headers: authHeaders() });
      if (r.ok) setTrucks(await r.json());
    } catch { /* silencioso */ }
  };

  const clearFilters = () => {
    setFilter(''); setStatusFilter(''); setTruckFilter(''); setPage(1);
  };

  useEffect(() => { loadTrucks(); }, []);
  useEffect(() => { setPage(1); load(1); /* eslint-disable-next-line */ }, [statusFilter, truckFilter, pageSize]);

  const openDetail = async (numero: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/sanitarios/${encodeURIComponent(numero)}`, { headers: authHeaders() });
      if (!r.ok) throw new Error('não encontrado');
      setSelected(await r.json());
    } catch {
      toast.error('Falha ao abrir detalhes');
    }
  };

  const movimentar = async (payload: any) => {
    const r = await fetch(`${API_BASE_URL}/sanitarios/movimentar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('movimentar falhou');
  };

  const submitAlocacao = async () => {
    if (!selected || !allocCustomerId) return;
    const c = customers.find(x => x.id === allocCustomerId);
    if (!c) { toast.error('Selecione um cliente'); return; }
    const finalAddress = (allocAddress || '').trim() || c.address || '';
    if (!finalAddress) { toast.error('Informe o endereço da obra/local'); return; }
    const usingClientAddress = finalAddress === (c.address || '');
    setAllocBusy(true);
    try {
      await movimentar({
        numeros: [selected.numero],
        operationType: 'entrega',
        customerName: c.customerName,
        address: finalAddress,
        // só envia coords se mantivermos o endereço cadastrado do cliente
        lat: usingClientAddress ? c.lat : undefined,
        lng: usingClientAddress ? c.lng : undefined,
        notes: allocNotes || null,
      });
      toast.success(`Alocado para ${c.customerName}`);
      setAllocOpen(false); setAllocNotes(''); setAllocCustomerId(''); setAllocSearch(''); setAllocAddress('');
      await openDetail(selected.numero);
      load();
    } catch { toast.error('Erro ao alocar'); }
    finally { setAllocBusy(false); }
  };

  const submitBaixa = async () => {
    if (!selected) return;
    setAllocBusy(true);
    try {
      await movimentar({
        numeros: [selected.numero],
        operationType: 'recolhimento',
        customerName: selected.current_customer_name,
        address: selected.current_address,
        notes: baixaNotes || null,
      });
      toast.success('Baixa registrada — sanitário voltou ao galpão');
      setBaixaOpen(false); setBaixaNotes('');
      await openDetail(selected.numero);
      load();
    } catch { toast.error('Erro ao dar baixa'); }
    finally { setAllocBusy(false); }
  };

  const setManutencao = async () => {
    if (!selected) return;
    try {
      await movimentar({ numeros: [selected.numero], operationType: 'manutencao' });
      toast.success('Marcado em manutenção');
      await openDetail(selected.numero); load();
    } catch { toast.error('Erro'); }
  };

  const create = async () => {
    if (!newNum.trim()) return;
    try {
      const r = await fetch(`${API_BASE_URL}/sanitarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ numero: newNum.trim().toUpperCase() }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Sanitário ${newNum} cadastrado`);
      setNewNum('');
      load();
    } catch { toast.error('Erro ao cadastrar'); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <a href="/"><span aria-hidden>←</span> Voltar</a>
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">Gerenciamento de Sanitários</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Localização atual e histórico de cada banheiro químico.
              </p>
            </div>
          </div>
          <Button onClick={() => load()} variant="outline" size="sm" disabled={loading} className="gap-2">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </header>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">


      {/* Cadastro rápido + filtros */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-muted-foreground">Buscar (número, cliente ou endereço)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="ex: 1024, Cliente XPTO, Av. Brasil…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load()}
                />
              </div>
              <Button onClick={() => load()} variant="secondary">Buscar</Button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="block border rounded-md h-10 px-2 bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="em_cliente">Em cliente</option>
              <option value="disponivel">Disponível</option>
              <option value="manutencao">Manutenção</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Caminhão</label>
            <select
              className="block border rounded-md h-10 px-2 bg-background min-w-[160px]"
              value={truckFilter}
              onChange={(e) => setTruckFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.plate ? ` (${t.plate})` : ''}
                </option>
              ))}
            </select>
          </div>

          {(filter || statusFilter || truckFilter) && (
            <Button onClick={clearFilters} variant="ghost" size="sm">Limpar filtros</Button>
          )}

          <Button onClick={exportCsv} variant="outline" size="sm" disabled={exporting} className="gap-2">
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>

          <div className="flex gap-2 items-end ml-auto">
            <div>
              <label className="text-xs text-muted-foreground">Cadastrar novo</label>
              <Input
                placeholder="número"
                value={newNum}
                onChange={(e) => setNewNum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            </div>
            <Button onClick={create} className="gap-1"><Plus className="h-4 w-4" />Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Lista */}
        <Card>
          <CardHeader className="py-3 flex-row items-center justify-between">
            <CardTitle className="text-base">
              {loading ? 'Carregando…' : `${total} sanitário${total === 1 ? '' : 's'}`}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Por página:</span>
              <select
                className="border rounded h-8 px-1 bg-background"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
              >
                {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Número</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Cliente atual</th>
                  <th className="p-2">Endereço</th>
                  <th className="p-2">Caminhão</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 font-mono font-bold">{s.numero}</td>
                    <td className="p-2">{statusBadge(s.status)}</td>
                    <td className="p-2">{s.current_customer_name || '–'}</td>
                    <td className="p-2 truncate max-w-[260px]">{s.current_address || '–'}</td>
                    <td className="p-2 text-xs">
                      {s.current_truck_name
                        ? <>{s.current_truck_name}{s.current_truck_plate ? ` (${s.current_truck_plate})` : ''}</>
                        : '–'}
                    </td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(s.numero)}>
                        <History className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!list.length && !loading && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum sanitário cadastrado.
                  </td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t text-xs">
              <span className="text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1 || loading}
                  onClick={() => { setPage(1); load(1); }}>« Início</Button>
                <Button size="sm" variant="outline" disabled={page <= 1 || loading}
                  onClick={() => { const n = page - 1; setPage(n); load(n); }}>‹ Anterior</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages || loading}
                  onClick={() => { const n = page + 1; setPage(n); load(n); }}>Próxima ›</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages || loading}
                  onClick={() => { setPage(totalPages); load(totalPages); }}>Fim »</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Detalhe */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {selected ? `Sanitário ${selected.numero}` : 'Selecione um sanitário'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected && (
              <p className="text-sm text-muted-foreground">
                Clique em um item da lista para ver localização atual e histórico completo.
              </p>
            )}

            {selected && (
              <div className="space-y-4">
                <div>
                  {statusBadge(selected.status)}
                  {selected.modelo && (
                    <p className="text-xs text-muted-foreground mt-1">Modelo: {selected.modelo}</p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  {selected.status !== 'em_cliente' && (
                    <Button size="sm" onClick={() => setAllocOpen(true)} className="gap-1">
                      <ArrowRightLeft className="h-4 w-4" /> Alocar a cliente
                    </Button>
                  )}
                  {selected.status === 'em_cliente' && (
                    <Button size="sm" variant="default" onClick={() => setBaixaOpen(true)} className="gap-1 bg-green-600 hover:bg-green-700">
                      <LogOut className="h-4 w-4" /> Dar baixa
                    </Button>
                  )}
                  {selected.status !== 'manutencao' && (
                    <Button size="sm" variant="outline" onClick={setManutencao} className="gap-1">
                      <Wrench className="h-4 w-4" /> Manutenção
                    </Button>
                  )}
                </div>

                {selected.status === 'em_cliente' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-blue-700" />
                      <strong>{selected.current_customer_name || '—'}</strong>
                    </div>
                    {selected.current_address && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {selected.current_address}
                      </div>
                    )}
                    {selected.installed_at && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Instalado em {new Date(selected.installed_at).toLocaleString('pt-BR')}
                      </div>
                    )}
                    {selected.current_lat && selected.current_lng && (
                      <a
                        className="text-xs text-blue-600 underline"
                        href={`https://www.google.com/maps?q=${selected.current_lat},${selected.current_lng}`}
                        target="_blank" rel="noreferrer"
                      >
                        Ver no Google Maps
                      </a>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
                    <History className="h-4 w-4" /> Histórico ({selected.historico?.length || 0})
                  </h3>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {selected.historico?.map((m) => (
                      <div key={m.id} className="border rounded-md p-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          {opIcon(m.operation_type)}
                          <span className="font-semibold capitalize">{m.operation_type}</span>
                          <span className="text-muted-foreground ml-auto">
                            {new Date(m.occurred_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {m.customer_name && <div><strong>{m.customer_name}</strong></div>}
                        {m.address && <div className="text-muted-foreground">{m.address}</div>}
                        {m.driver_name && <div className="text-muted-foreground">Motorista: {m.driver_name}</div>}
                        {m.notes && <div className="italic mt-1">{m.notes}</div>}
                      </div>
                    ))}
                    {!selected.historico?.length && (
                      <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Modal alocar a cliente */}
      <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Alocar sanitário {selected?.numero} a um cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Buscar cliente</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Nome ou endereço…" value={allocSearch} onChange={(e) => setAllocSearch(e.target.value)} />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {filteredCustomers.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">Nenhum cliente encontrado. Cadastre na aba Clientes.</div>
              )}
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAllocCustomerId(c.id)}
                  className={`w-full text-left p-2 hover:bg-muted/30 ${allocCustomerId === c.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="text-sm font-medium">{c.customerName || '(sem nome)'}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.address || '—'}</div>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observações (opcional)</label>
              <Textarea rows={2} value={allocNotes} onChange={(e) => setAllocNotes(e.target.value)} placeholder="Ex: instalado próximo ao portão B" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAllocOpen(false)}>Cancelar</Button>
            <Button onClick={submitAlocacao} disabled={!allocCustomerId || allocBusy}>
              {allocBusy ? 'Alocando…' : 'Confirmar alocação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal dar baixa */}
      <Dialog open={baixaOpen} onOpenChange={setBaixaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar baixa do sanitário {selected?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Será registrado o recolhimento de <strong>{selected?.current_customer_name}</strong> e o sanitário ficará disponível no galpão.
              O histórico do cliente será preservado.
            </p>
            <Textarea rows={2} placeholder="Observações da baixa (opcional)" value={baixaNotes} onChange={(e) => setBaixaNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBaixaOpen(false)}>Cancelar</Button>
            <Button onClick={submitBaixa} disabled={allocBusy} className="bg-green-600 hover:bg-green-700">
              {allocBusy ? 'Registrando…' : 'Confirmar baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
