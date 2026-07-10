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
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '@/services/config';
import {
  fetchSanitarioStockSummary, updateSanitarioCategoriaTotalFisico, updateSanitarioCategoria,
  SANITARIO_CATEGORIAS, sanitarioCategoriaLabel, type SanitarioCategoria, type SanitarioStockSummary,
} from '@/services/erp';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { usePolling } from '@/hooks/usePolling';
import { Search, MapPin, User, Calendar, Plus, RefreshCcw, History, Wrench, PackageCheck, PackageOpen, ArrowRightLeft, LogOut, Trash2, FileText, Boxes, Send, Pencil, Check, ArrowLeft, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/ui/searchable-select';
import ErpServiceOrdersPanel from '@/components/erp/ErpServiceOrdersPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Sanitario {
  id: string;
  numero: string;
  modelo?: string;
  categoria?: SanitarioCategoria;
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
    case 'em_cliente': return <Badge className="bg-info/15 text-info border-info/30">Em cliente</Badge>;
    case 'disponivel': return <Badge className="bg-success/15 text-success border-success/30">Disponível</Badge>;
    case 'manutencao': return <Badge className="bg-warning/15 text-warning border-warning/30">Manutenção</Badge>;
    default: return <Badge variant="secondary">Inativo</Badge>;
  }
};

const opIcon = (op: string) => {
  switch (op) {
    case 'entrega': return <PackageOpen className="h-4 w-4 text-info" />;
    case 'recolhimento': return <PackageCheck className="h-4 w-4 text-success" />;
    case 'manutencao': return <Wrench className="h-4 w-4 text-warning" />;
    default: return <RefreshCcw className="h-4 w-4 text-muted-foreground" />;
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stock, setStock] = useState<SanitarioStockSummary | null>(null);
  const [osRefreshKey, setOsRefreshKey] = useState(0);
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

  const loadStock = async () => {
    try { setStock(await fetchSanitarioStockSummary()); } catch { /* silencioso */ }
  };

  useEffect(() => { loadTrucks(); loadStock(); }, []);
  useEffect(() => { setPage(1); load(1); loadStock(); /* eslint-disable-next-line */ }, [statusFilter, truckFilter, pageSize]);
  // Sincronização multi-usuário: refaz lista e estoque a cada 15s
  usePolling(() => { load(); loadStock(); }, 15000);

  // ----- Despachar (informar número livre) -----
  const [despOpen, setDespOpen] = useState(false);
  const [despCustomerId, setDespCustomerId] = useState('');
  const [despSearch, setDespSearch] = useState('');
  const [despAddress, setDespAddress] = useState('');
  const [despNumerosText, setDespNumerosText] = useState('');
  const [despNotes, setDespNotes] = useState('');
  const [despBusy, setDespBusy] = useState(false);
  const despFilteredCustomers = useMemo(() => {
    const q = despSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 50);
    return customers.filter(c =>
      (c.customerName || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [customers, despSearch]);
  const submitDespacho = async () => {
    const c = customers.find(x => x.id === despCustomerId);
    if (!c) { toast.error('Selecione um cliente'); return; }
    const finalAddress = (despAddress || '').trim() || c.address || '';
    if (!finalAddress) { toast.error('Informe o endereço da obra/local'); return; }
    const numeros = Array.from(new Set(
      despNumerosText.split(/[\s,;\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    ));
    if (!numeros.length) { toast.error('Informe pelo menos um número de sanitário'); return; }
    setDespBusy(true);
    try {
      const usingClientAddress = finalAddress === (c.address || '');
      await fetch(`${API_BASE_URL}/sanitarios/movimentar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          numeros,
          operationType: 'entrega',
          customerName: c.customerName,
          address: finalAddress,
          lat: usingClientAddress ? c.lat : undefined,
          lng: usingClientAddress ? c.lng : undefined,
          notes: despNotes || null,
          categoria: despCategoria,
        }),
      }).then(r => { if (!r.ok) throw new Error(); });
      toast.success(`Despacho registrado (${numeros.length}) para ${c.customerName}`);
      setDespOpen(false);
      setDespCustomerId(''); setDespSearch(''); setDespAddress(''); setDespNumerosText(''); setDespNotes('');
      load(); loadStock();
    } catch { toast.error('Erro ao registrar despacho'); }
    finally { setDespBusy(false); }
  };

  // ----- Total físico por categoria (inline) -----
  const [editingCat, setEditingCat] = useState<SanitarioCategoria | null>(null);
  const [catDraft, setCatDraft] = useState('');
  const startEditCat = (cat: SanitarioCategoria, current: number) => {
    setEditingCat(cat);
    setCatDraft(String(current ?? 0));
  };
  const saveCatTotal = async () => {
    if (!editingCat) return;
    const v = Math.max(0, parseInt(catDraft, 10) || 0);
    try {
      await updateSanitarioCategoriaTotalFisico(editingCat, v);
      toast.success('Total físico atualizado');
      setEditingCat(null);
      loadStock();
    } catch { toast.error('Falha ao salvar total físico'); }
  };

  // ----- Inline edit de categoria de um sanitário existente -----
  const [editingCatRow, setEditingCatRow] = useState<string | null>(null);
  const changeRowCategoria = async (numero: string, cat: SanitarioCategoria) => {
    try {
      await updateSanitarioCategoria(numero, cat);
      setEditingCatRow(null);
      toast.success(`Sanitário ${numero} marcado como ${sanitarioCategoriaLabel(cat)}`);
      load(); loadStock();
    } catch { toast.error('Falha ao atualizar categoria'); }
  };

  // ----- Categoria selecionada no formulário de cadastro/despacho -----
  const [newCategoria, setNewCategoria] = useState<SanitarioCategoria>('comum');
  const [despCategoria, setDespCategoria] = useState<SanitarioCategoria>('comum');


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
        body: JSON.stringify({ numero: newNum.trim().toUpperCase(), categoria: newCategoria }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Sanitário ${newNum} cadastrado (${sanitarioCategoriaLabel(newCategoria)})`);
      setNewNum('');
      load(); loadStock();
    } catch { toast.error('Erro ao cadastrar'); }
  };

  const remove = async () => {
    if (!selected) return;
    setDeleteBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/sanitarios/${encodeURIComponent(selected.numero)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error();
      toast.success(`Sanitário ${selected.numero} excluído`);
      setSelected(null);
      setDeleteOpen(false);
      load();
    } catch { toast.error('Erro ao excluir sanitário'); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild title="Voltar ao sistema" aria-label="Voltar ao sistema" className="-ml-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
              <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight leading-tight truncate">Gerenciamento de Sanitários</h1>
              <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
                Estoque por categoria, localização atual e histórico de cada banheiro químico.
              </p>
            </div>
          </div>
          <Button onClick={() => { load(); loadStock(); loadTrucks(); setOsRefreshKey(k => k + 1); }} variant="outline" size="sm" disabled={loading} className="gap-2 transition-all duration-200">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </header>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">

      <Tabs defaultValue="estoque" className="space-y-4">
        <TabsList className="grid w-full md:w-auto grid-cols-2 md:inline-grid">
          <TabsTrigger value="estoque" className="gap-1.5">
            <Boxes className="h-4 w-4" /> Estoque e movimentação
          </TabsTrigger>
          <TabsTrigger value="os" className="gap-1.5">
            <FileText className="h-4 w-4" /> Ordens de Serviço
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estoque" className="space-y-4 mt-0">

      {/* Resumo de estoque ERP — KPIs */}
      {stock && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Total físico</div>
              <div className="text-2xl font-bold text-warning">{stock.totalFisico ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">
                {Math.max(0, (stock.totalFisico ?? 0) - stock.total)} sem numeração
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/30">
            <CardContent className="p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Disponíveis</div>
              <div className="text-2xl font-bold text-success">{stock.disponivel}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Em cliente</div>
              <div className="text-2xl font-bold text-info">{stock.em_cliente}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[11px] uppercase text-muted-foreground flex items-center justify-between">
                <span>Em OS</span>
                {!!stock.atrasados && (
                  <span className="text-[10px] text-destructive font-bold">{stock.atrasados} atrasada(s)</span>
                )}
              </div>
              <div className="text-2xl font-bold text-primary">{stock.em_os}</div>
              {!!stock.reservadosEmOs && (
                <div className="text-[10px] text-muted-foreground">{stock.reservadosEmOs} reservado(s)</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Manutenção</div>
              <div className="text-2xl font-bold text-warning">{stock.manutencao}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Total numerado</div>
              <div className="text-2xl font-bold">{stock.total}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Painel por categoria */}
      {stock?.porCategoria && (
        <Card className="mb-4 overflow-hidden">
          <CardHeader className="py-3 bg-gradient-to-r from-slate-50 to-white border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              Estoque por categoria
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Clique no lápis para informar quantos você tem fisicamente de cada tipo.
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {SANITARIO_CATEGORIAS.map(cat => {
                const c = stock.porCategoria?.[cat.value];
                if (!c) return null;
                const isEditing = editingCat === cat.value;
                return (
                  <div key={cat.value}
                       className={`rounded-lg border p-3 flex flex-col gap-2 ${cat.color.replace('text-', 'border-').split(' ').find(x => x.startsWith('border-')) || 'border-border'} bg-card`}>
                    <div className="flex items-center justify-between gap-1">
                      <Badge className={`${cat.color} text-[11px] font-semibold border`}>
                        {cat.label}
                      </Badge>
                      {!isEditing && (
                        <button onClick={() => startEditCat(cat.value, c.totalFisico)} className="text-muted-foreground hover:text-indigo-600" title="Editar total físico">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus type="number" min={0} value={catDraft}
                          onChange={(e) => setCatDraft(e.target.value)}
                          className="h-8 text-base"
                          onKeyDown={(e) => { if (e.key === 'Enter') saveCatTotal(); if (e.key === 'Escape') setEditingCat(null); }}
                        />
                        <Button size="icon" className="h-8 w-8 shrink-0" aria-label="Salvar total" onClick={saveCatTotal}><Check className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl font-bold leading-none">{c.totalFisico}</div>
                        <div className="text-[10px] uppercase text-muted-foreground mt-1">total físico</div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1 text-[11px] pt-2 border-t">
                      <div>
                        <div className="text-muted-foreground">Livres</div>
                        <div className="font-bold text-success">{c.livres}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Em cliente</div>
                        <div className="font-bold text-info">{c.em_cliente}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Numerados</div>
                        <div className="font-semibold">{c.numerados}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">S/ número</div>
                        <div className="font-semibold text-warning">{c.semNumeracao}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}




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
            <SearchableSelect
              value={statusFilter || '__all__'}
              triggerClassName="w-[160px]"
              options={[
                { value: '__all__', label: 'Todos' },
                { value: 'em_cliente', label: 'Em cliente' },
                { value: 'disponivel', label: 'Disponível' },
                { value: 'manutencao', label: 'Manutenção' },
                { value: 'inativo', label: 'Inativo' },
              ]}
              onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Caminhão</label>
            <SearchableSelect
              value={truckFilter || '__all__'}
              triggerClassName="min-w-[180px]"
              searchPlaceholder="Buscar caminhão..."
              options={[
                { value: '__all__', label: 'Todos' },
                ...trucks.map((t) => ({
                  value: t.id,
                  label: t.name || '(sem nome)',
                  hint: t.plate || undefined,
                })),
              ]}
              onValueChange={(v) => setTruckFilter(v === '__all__' ? '' : v)}
            />
          </div>

          {(filter || statusFilter || truckFilter) && (
            <Button onClick={clearFilters} variant="ghost" size="sm">Limpar filtros</Button>
          )}

          <Button onClick={exportCsv} variant="outline" size="sm" disabled={exporting} className="gap-2">
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>

          <Button onClick={() => setDespOpen(true)} size="sm" className="gap-1 bg-info text-info-foreground hover:bg-info/90">
            <Send className="h-4 w-4" /> Despachar (informar nº)
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
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <select
                className="block border rounded-md h-10 px-2 bg-background"
                value={newCategoria}
                onChange={(e) => setNewCategoria(e.target.value as SanitarioCategoria)}
              >
                {SANITARIO_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
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
                  <th className="p-2">Categoria</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Cliente atual</th>
                  <th className="p-2">Endereço</th>
                  <th className="p-2">Caminhão</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const catMeta = SANITARIO_CATEGORIAS.find(c => c.value === (s.categoria || 'comum'));
                  return (
                  <tr key={s.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 font-mono font-bold">{s.numero}</td>
                    <td className="p-2">
                      {editingCatRow === s.numero ? (
                        <select
                          autoFocus
                          className="border rounded h-8 px-1 bg-background text-xs"
                          defaultValue={s.categoria || 'comum'}
                          onBlur={() => setEditingCatRow(null)}
                          onChange={(e) => changeRowCategoria(s.numero, e.target.value as SanitarioCategoria)}
                        >
                          {SANITARIO_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingCatRow(s.numero)}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${catMeta?.color || ''} hover:ring-2 hover:ring-indigo-200`}
                          title="Clique para alterar categoria"
                        >
                          {catMeta?.label || 'Comum'} <Pencil className="h-3 w-3 opacity-60" />
                        </button>
                      )}
                    </td>
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
                  );
                })}
                {!list.length && !loading && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
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
                    <Button size="sm" variant="default" onClick={() => setBaixaOpen(true)} className="gap-1 bg-success text-success-foreground hover:bg-success/90">
                      <LogOut className="h-4 w-4" /> Dar baixa
                    </Button>
                  )}
                  {selected.status !== 'manutencao' && (
                    <Button size="sm" variant="outline" onClick={setManutencao} className="gap-1">
                      <Wrench className="h-4 w-4" /> Manutenção
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteOpen(true)}
                    className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>

                {selected.status === 'em_cliente' && (
                  <div className="bg-info/10 border border-info/30 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-info" />
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
                        className="text-xs text-info underline"
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
        </TabsContent>

        <TabsContent value="os" className="mt-0">
          <ErpServiceOrdersPanel refreshKey={osRefreshKey} onChanged={() => { load(); loadStock(); }} />
        </TabsContent>
      </Tabs>
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
                  onClick={() => {
                    setAllocCustomerId(c.id);
                    // pré-preenche o endereço com o cadastrado, mas é editável
                    if (!allocAddress.trim()) setAllocAddress(c.address || '');
                  }}
                  className={`w-full text-left p-2 hover:bg-muted/30 ${allocCustomerId === c.id ? 'bg-info/10' : ''}`}
                >
                  <div className="text-sm font-medium">{c.customerName || '(sem nome)'}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.address || '—'}</div>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Endereço da obra/local <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={2}
                value={allocAddress}
                onChange={(e) => setAllocAddress(e.target.value)}
                placeholder="Endereço onde o sanitário ficará (ex: Obra Rua X, 100 — Bairro)"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Pode ser diferente do endereço cadastrado da empresa. Esse endereço será exibido no sanitário e poderá ser puxado depois ao montar a rota.
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observações (opcional)</label>
              <Textarea rows={2} value={allocNotes} onChange={(e) => setAllocNotes(e.target.value)} placeholder="Ex: instalado próximo ao portão B" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAllocOpen(false)}>Cancelar</Button>
            <Button onClick={submitAlocacao} disabled={!allocCustomerId || !allocAddress.trim() || allocBusy}>
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
            <Button onClick={submitBaixa} disabled={allocBusy} className="bg-success text-success-foreground hover:bg-success/90">
              {allocBusy ? 'Registrando…' : 'Confirmar baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog excluir */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sanitário {selected?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O sanitário e todo o seu histórico serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Despachar (informar nº livre — auto-cadastra se não existir) */}
      <Dialog open={despOpen} onOpenChange={setDespOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Despachar sanitário(s) — informar numeração</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Informe os números que estão saindo. Se algum número ainda não estiver cadastrado
              no estoque, ele será criado automaticamente e já entrará para o histórico do cliente.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Buscar cliente</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Nome ou endereço…" value={despSearch} onChange={(e) => setDespSearch(e.target.value)} />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
              {despFilteredCustomers.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">Nenhum cliente encontrado. Cadastre em Clientes.</div>
              )}
              {despFilteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setDespCustomerId(c.id);
                    if (!despAddress.trim()) setDespAddress(c.address || '');
                  }}
                  className={`w-full text-left p-2 hover:bg-muted/30 ${despCustomerId === c.id ? 'bg-info/10' : ''}`}
                >
                  <div className="text-sm font-medium">{c.customerName || '(sem nome)'}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.address || '—'}</div>
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Endereço da obra/local <span className="text-destructive">*</span></label>
              <Textarea rows={2} value={despAddress} onChange={(e) => setDespAddress(e.target.value)} placeholder="Endereço onde o(s) sanitário(s) ficará(ão)" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Números dos sanitários <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={2}
                value={despNumerosText}
                onChange={(e) => setDespNumerosText(e.target.value)}
                placeholder="Ex: 0123, 0456, 1024 (separe por vírgula, espaço ou quebra de linha)"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Números não cadastrados serão criados automaticamente no estoque.
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Categoria <span className="text-destructive">*</span>
              </label>
              <select
                className="block w-full border rounded-md h-10 px-2 bg-background"
                value={despCategoria}
                onChange={(e) => setDespCategoria(e.target.value as SanitarioCategoria)}
              >
                {SANITARIO_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Se algum número for novo, ele será cadastrado nesta categoria. Para números já existentes, a categoria também será atualizada — útil para catalogar conforme você descobre na rua.
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observações (opcional)</label>
              <Textarea rows={2} value={despNotes} onChange={(e) => setDespNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDespOpen(false)}>Cancelar</Button>
            <Button onClick={submitDespacho} disabled={despBusy || !despCustomerId || !despAddress.trim() || !despNumerosText.trim()} className="bg-info text-info-foreground hover:bg-info/90">
              {despBusy ? 'Registrando…' : 'Confirmar despacho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
