/**
 * Página de gerenciamento de sanitários (banheiros químicos).
 * - Lista mestre com filtro por status e busca por número
 * - Detalhe lateral com cliente atual e histórico completo
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/services/config';
import { Search, MapPin, User, Calendar, Plus, RefreshCcw, History, Wrench, PackageCheck, PackageOpen } from 'lucide-react';
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

  const load = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/sanitarios`);
      if (statusFilter) url.searchParams.set('status', statusFilter);
      if (filter) url.searchParams.set('q', filter);
      if (truckFilter) url.searchParams.set('truckId', truckFilter);
      const r = await fetch(url.toString(), { headers: authHeaders() });
      const data = await r.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Erro ao carregar sanitários');
    } finally { setLoading(false); }
  };

  const loadTrucks = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/sanitarios/meta/trucks`, { headers: authHeaders() });
      if (r.ok) setTrucks(await r.json());
    } catch { /* silencioso */ }
  };

  const clearFilters = () => {
    setFilter(''); setStatusFilter(''); setTruckFilter('');
  };

  useEffect(() => { loadTrucks(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter, truckFilter]);

  const openDetail = async (numero: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/sanitarios/${encodeURIComponent(numero)}`, { headers: authHeaders() });
      if (!r.ok) throw new Error('não encontrado');
      setSelected(await r.json());
    } catch {
      toast.error('Falha ao abrir detalhes');
    }
  };

  const create = async () => {
    if (!newNum.trim()) return;
    try {
      const r = await fetch(`${API_BASE_URL}/sanitarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: newNum.trim() }),
      });
      if (!r.ok) throw new Error();
      toast.success(`Sanitário ${newNum} cadastrado`);
      setNewNum('');
      load();
    } catch { toast.error('Erro ao cadastrar'); }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Sanitários</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a localização atual e o histórico completo de cada banheiro químico.
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      {/* Cadastro rápido + filtros */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar por número</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="ex: 1024"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load()}
                />
              </div>
              <Button onClick={load} variant="secondary">Buscar</Button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="block border rounded-md h-10 px-2"
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

          <div className="flex gap-2 items-end">
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
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {loading ? 'Carregando…' : `${list.length} sanitários`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Número</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Cliente atual</th>
                  <th className="p-2">Endereço</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 font-mono font-bold">{s.numero}</td>
                    <td className="p-2">{statusBadge(s.status)}</td>
                    <td className="p-2">{s.current_customer_name || '–'}</td>
                    <td className="p-2 truncate max-w-[280px]">{s.current_address || '–'}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(s.numero)}>
                        <History className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!list.length && !loading && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Nenhum sanitário cadastrado.
                  </td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
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
  );
}
