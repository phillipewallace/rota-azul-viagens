/**
 * Aba Clientes — gerenciamento completo:
 * - Cards com busca, filtros (com/sem sanitários, com/sem coordenadas)
 * - Edição inline em modal
 * - Histórico do cliente (sanitários atualmente alocados + movimentações)
 * - Persistência via /api/customers
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Search, MapPin, Phone, Save, Loader2, Users,
  Building2, History, PackageOpen, PackageCheck, Wrench, RefreshCcw, Filter, Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { geocodingService } from '@/services/geocoding';
import { API_BASE_URL } from '@/services/config';

interface HistoryItem {
  id: string;
  sanitario_numero: string;
  operation_type: 'entrega' | 'recolhimento' | 'manutencao' | 'transferencia';
  address?: string;
  driver_name?: string;
  occurred_at: string;
  notes?: string;
}
interface CurrentSan { id: string; numero: string; status: string; current_address?: string; installed_at?: string }

const opIcon = (op: string) => {
  switch (op) {
    case 'entrega': return <PackageOpen className="h-3.5 w-3.5 text-blue-600" />;
    case 'recolhimento': return <PackageCheck className="h-3.5 w-3.5 text-green-600" />;
    case 'manutencao': return <Wrench className="h-3.5 w-3.5 text-orange-600" />;
    default: return <RefreshCcw className="h-3.5 w-3.5 text-gray-500" />;
  }
};

const Customers: React.FC = () => {
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer, saveCustomers, refetch } = useCustomers();
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'withSan' | 'noCoords'>('all');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [historyData, setHistoryData] = useState<{ current: CurrentSan[]; history: HistoryItem[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Pré-busca contagem de sanitários atuais por cliente
  useEffect(() => {
    if (!customers.length) return;
    let canceled = false;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const r = await fetch(`${API_BASE_URL}/sanitarios?status=em_cliente&pageSize=200&page=1`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) return;
        const data = await r.json();
        const list = Array.isArray(data) ? data : (data.data || []);
        const map: Record<string, number> = {};
        for (const s of list) {
          const k = (s.current_customer_name || '').toLowerCase();
          if (k) map[k] = (map[k] || 0) + 1;
        }
        if (!canceled) setCounts(map);
      } catch { /* silencioso */ }
    })();
    return () => { canceled = true };
  }, [customers]);

  const sanCount = (c: Customer) => counts[(c.customerName || '').toLowerCase()] || 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (q) {
        const hay = `${c.customerName || ''} ${c.address || ''} ${c.cep || ''} ${c.contactName || ''} ${c.contactPhone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterMode === 'withSan' && sanCount(c) === 0) return false;
      if (filterMode === 'noCoords' && c.lat && c.lng) return false;
      return true;
    });
  }, [customers, search, filterMode, counts]);

  const handleAddNew = () => {
    const c: Customer = {
      id: uuidv4(), customerName: '', address: '', cep: '',
      restroomsQty: undefined, cleaningsQty: undefined,
      contactName: '', contactPhone: '', notes: '',
      lat: undefined, lng: undefined,
    };
    addCustomer(c);
    setEditing(c);
  };

  const handleEditField = (field: keyof Customer, value: any) => {
    if (!editing) return;
    updateCustomer(editing.id, field, value);
    setEditing({ ...editing, [field]: value });
  };

  const handleSearchByCep = async () => {
    if (!editing?.cep || editing.cep.replace(/\D/g, '').length < 8) return;
    setSearchingAddress(true);
    try {
      const r = await geocodingService.getAddressByCep(editing.cep);
      if (r) {
        handleEditField('address', r.address);
        if (r.lat && r.lng) { handleEditField('lat', r.lat); handleEditField('lng', r.lng); }
        toast.success('Endereço encontrado pelo CEP');
      } else toast.error('CEP não encontrado');
    } catch { toast.error('Erro ao buscar CEP'); }
    finally { setSearchingAddress(false); }
  };

  const handleGeocode = async () => {
    if (!editing?.address || editing.address.length < 5) return;
    setSearchingAddress(true);
    try {
      const r = await geocodingService.getCoordinatesFromAddress(editing.address);
      if (r) {
        handleEditField('lat', r.lat);
        handleEditField('lng', r.lng);
        toast.success('Coordenadas atualizadas');
      } else toast.error('Endereço não encontrado');
    } catch { toast.error('Erro ao buscar coordenadas'); }
    finally { setSearchingAddress(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCustomers();
      toast.success('Clientes salvos!');
      setEditing(null);
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = (c: Customer) => {
    if (!confirm(`Remover "${c.customerName || 'sem nome'}"? A remoção só é definitiva após salvar.`)) return;
    deleteCustomer(c.id);
    toast.success('Cliente removido (clique em Salvar para confirmar)');
  };

  const openHistory = async (c: Customer) => {
    setHistoryFor(c);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const r = await fetch(`${API_BASE_URL}/customers/${c.id}/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error();
      setHistoryData(await r.json());
    } catch { toast.error('Erro ao carregar histórico'); }
    finally { setHistoryLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Clientes</h1>
            <Badge variant="secondary">{customers.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetch} className="gap-1">
              <RefreshCcw className="h-4 w-4" /> Recarregar
            </Button>
            <Button size="sm" variant="outline" onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-1" /> Novo cliente
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[260px]">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Nome, endereço, CEP, telefone…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" />Filtro</label>
              <select
                className="block border rounded-md h-10 px-2 bg-background"
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as any)}
              >
                <option value="all">Todos</option>
                <option value="withSan">Com sanitários alocados</option>
                <option value="noCoords">Sem coordenadas</option>
              </select>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              Exibindo <strong>{filtered.length}</strong> de {customers.length}
            </div>
          </CardContent>
        </Card>

        {/* Grid de cards */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum cliente encontrado</p>
              <p className="text-sm">Ajuste os filtros ou adicione um novo cliente.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((c) => {
              const n = sanCount(c);
              return (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          {c.customerName || <span className="italic text-muted-foreground">Sem nome</span>}
                        </div>
                        {c.address && (
                          <div className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{c.address}</span>
                          </div>
                        )}
                      </div>
                      {n > 0 && (
                        <Badge className="bg-blue-100 text-blue-700 shrink-0">{n} sanit.</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.cep && <span>CEP {c.cep}</span>}
                      {c.contactPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.contactPhone}</span>}
                      {c.lat && c.lng && <span className="text-green-700">📍 geocodificado</span>}
                      {(!c.lat || !c.lng) && <span className="text-orange-600">⚠ sem coordenadas</span>}
                    </div>

                    <div className="flex gap-1 pt-2 border-t">
                      <Button size="sm" variant="ghost" className="flex-1 gap-1" onClick={() => setEditing(c)}>
                        <Edit3 className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 gap-1" onClick={() => openHistory(c)}>
                        <History className="h-3.5 w-3.5" /> Histórico
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Lembre-se de clicar em <strong>Salvar</strong> para persistir as alterações.
        </p>
      </div>

      {/* Modal de edição */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.customerName ? `Editar ${editing.customerName}` : 'Novo cliente'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Nome do cliente *</label>
                <Input value={editing.customerName || ''} onChange={(e) => handleEditField('customerName', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">CEP</label>
                <div className="flex gap-1">
                  <Input value={editing.cep || ''} onChange={(e) => handleEditField('cep', e.target.value)} maxLength={9} />
                  <Button size="sm" variant="outline" onClick={handleSearchByCep} disabled={searchingAddress}>
                    {searchingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Telefone</label>
                <Input value={editing.contactPhone || ''} onChange={(e) => handleEditField('contactPhone', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Endereço</label>
                <div className="flex gap-1">
                  <Input value={editing.address || ''} onChange={(e) => handleEditField('address', e.target.value)} />
                  <Button size="sm" variant="outline" onClick={handleGeocode} disabled={searchingAddress} title="Buscar coordenadas">
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
                {editing.lat && editing.lng && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Lat {Number(editing.lat).toFixed(5)} · Lng {Number(editing.lng).toFixed(5)}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Responsável no local</label>
                <Input value={editing.contactName || ''} onChange={(e) => handleEditField('contactName', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Banh.</label>
                  <Input type="number" min={0} value={editing.restroomsQty ?? ''} onChange={(e) => handleEditField('restroomsQty', e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Limp.</label>
                  <Input type="number" min={0} value={editing.cleaningsQty ?? ''} onChange={(e) => handleEditField('cleaningsQty', e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Observações</label>
                <Textarea rows={3} value={editing.notes || ''} onChange={(e) => handleEditField('notes', e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Fechar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? 'Salvando…' : 'Salvar tudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de histórico */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && (setHistoryFor(null), setHistoryData(null))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {historyFor?.customerName}</DialogTitle>
          </DialogHeader>
          {historyLoading && <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />}
          {historyData && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h3 className="text-sm font-semibold mb-2">Sanitários alocados agora ({historyData.current.length})</h3>
                {historyData.current.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum sanitário no momento.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {historyData.current.map((s) => (
                      <div key={s.id} className="border rounded-md p-2 text-xs bg-blue-50/40">
                        <div className="font-mono font-bold">{s.numero}</div>
                        {s.installed_at && (
                          <div className="text-muted-foreground">desde {new Date(s.installed_at).toLocaleDateString('pt-BR')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Movimentações ({historyData.history.length})</h3>
                {historyData.history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem registros para este cliente.</p>
                ) : (
                  <div className="space-y-1.5">
                    {historyData.history.map((h) => (
                      <div key={h.id} className="border rounded-md p-2 text-xs flex items-start gap-2">
                        {opIcon(h.operation_type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold capitalize">{h.operation_type}</span>
                            <span className="font-mono text-muted-foreground">#{h.sanitario_numero}</span>
                            <span className="ml-auto text-muted-foreground">{new Date(h.occurred_at).toLocaleString('pt-BR')}</span>
                          </div>
                          {h.driver_name && <div className="text-muted-foreground">Motorista: {h.driver_name}</div>}
                          {h.notes && <div className="italic">{h.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setHistoryFor(null); setHistoryData(null); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
