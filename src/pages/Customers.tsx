/**
 * Aba Clientes — cadastro completo:
 * - Pessoa Física (CPF) ou Jurídica (CNPJ) com validação
 * - Endereço completo (CEP, número, complemento, bairro, cidade, UF)
 * - Contato (responsável, telefone, e-mail)
 * - Histórico de sanitários
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Search, MapPin, Phone, Save, Loader2, Users,
  Building2, History, PackageOpen, PackageCheck, Wrench, RefreshCcw, Filter, Edit3, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { geocodingService } from '@/services/geocoding';
import { API_BASE_URL } from '@/services/config';
import {
  maskDocument, maskCep, maskPhone, isValidDocument, onlyDigits, UF_LIST,
} from '@/utils/brazilianDocs';

interface HistoryItem { id: string; sanitario_numero: string; operation_type: string;
  address?: string; driver_name?: string; occurred_at: string; notes?: string }
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
  const [filterMode, setFilterMode] = useState<'all' | 'withSan' | 'noCoords' | 'pf' | 'pj'>('all');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);
  const [historyData, setHistoryData] = useState<{ current: CurrentSan[]; history: HistoryItem[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

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
      } catch {}
    })();
    return () => { canceled = true };
  }, [customers]);

  const sanCount = (c: Customer) => counts[(c.customerName || '').toLowerCase()] || 0;

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return customers.filter(c => {
      const matchSearch = !s ||
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.address || '').toLowerCase().includes(s) ||
        (c.cep || '').includes(s) ||
        (c.document || '').includes(s) ||
        (c.contactPhone || '').includes(s);
      if (!matchSearch) return false;
      if (filterMode === 'withSan') return sanCount(c) > 0;
      if (filterMode === 'noCoords') return !c.lat || !c.lng;
      if (filterMode === 'pf') return c.personType === 'PF';
      if (filterMode === 'pj') return (c.personType || 'PJ') === 'PJ';
      return true;
    });
  }, [customers, search, filterMode, counts]);

  const handleAddNew = () => {
    const c: Customer = {
      id: uuidv4(),
      customerName: '', address: '', cep: '',
      personType: 'PJ', document: '',
    };
    addCustomer(c);
    setEditing(c);
  };

  const setField = (field: keyof Customer, value: any) => {
    if (!editing) return;
    updateCustomer(editing.id, field, value);
    setEditing({ ...editing, [field]: value });
  };

  const handleSearchByCep = async () => {
    if (!editing?.cep || onlyDigits(editing.cep).length < 8) return;
    setSearchingAddress(true);
    try {
      const r = await geocodingService.getAddressByCep(editing.cep);
      if (r) {
        setField('address', r.address);
        // ViaCEP-style enrichment se disponível
        const cep = onlyDigits(editing.cep);
        try {
          const vc = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then(x => x.json());
          if (vc && !vc.erro) {
            setField('bairro', vc.bairro || '');
            setField('cidade', vc.localidade || '');
            setField('estado', vc.uf || '');
          }
        } catch {}
        if (r.lat && r.lng) { setField('lat', r.lat); setField('lng', r.lng); }
        toast.success('Endereço encontrado');
      } else toast.error('CEP não encontrado');
    } catch { toast.error('Erro ao buscar CEP'); }
    finally { setSearchingAddress(false); }
  };

  const handleLookupCnpj = async () => {
    if (!editing) return;
    const cnpj = onlyDigits(editing.document || '');
    if (cnpj.length !== 14) {
      toast.error('Digite um CNPJ válido (14 dígitos)');
      return;
    }
    setLookingUpCnpj(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!r.ok) throw new Error('CNPJ não encontrado');
      const d = await r.json();
      const formatCep = (c: any) => c
        ? String(c).replace(/\D/g, '').replace(/^(\d{5})(\d{3}).*/, '$1-$2')
        : '';
      const updates: Partial<Customer> = {
        customerName: d.razao_social || editing.customerName,
        contactName: d.nome_fantasia || editing.contactName,
        cep: d.cep ? formatCep(d.cep) : editing.cep,
        address: d.logradouro || editing.address,
        numero: d.numero ? String(d.numero) : editing.numero,
        complemento: d.complemento || editing.complemento,
        bairro: d.bairro || editing.bairro,
        cidade: d.municipio || editing.cidade,
        estado: d.uf || editing.estado,
        contactPhone: d.ddd_telefone_1 || editing.contactPhone,
        email: d.email || editing.email,
      };
      // Batch: atualiza o estado local de uma vez (evita race do closure)
      // e propaga cada campo ao hook pai.
      const merged = { ...editing, ...updates } as Customer;
      setEditing(merged);
      Object.entries(updates).forEach(([k, v]) => {
        if (v !== undefined && v !== '') updateCustomer(editing.id, k as keyof Customer, v);
      });
      // Tenta geocodificar automaticamente
      try {
        const full = [merged.address, merged.numero, merged.bairro, merged.cidade, merged.estado]
          .filter(Boolean).join(', ');
        if (full.length > 5) {
          const g = await geocodingService.getCoordinatesFromAddress(full);
          if (g) {
            setEditing(prev => prev ? { ...prev, lat: g.lat, lng: g.lng } : prev);
            updateCustomer(editing.id, 'lat', g.lat);
            updateCustomer(editing.id, 'lng', g.lng);
          }
        }
      } catch {}
      toast.success('Dados do CNPJ preenchidos automaticamente');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao consultar CNPJ');
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const handleGeocode = async () => {
    if (!editing?.address || editing.address.length < 5) return;
    setSearchingAddress(true);
    try {
      const r = await geocodingService.getCoordinatesFromAddress(editing.address);
      if (r) { setField('lat', r.lat); setField('lng', r.lng); toast.success('Coordenadas atualizadas'); }
      else toast.error('Endereço não encontrado');
    } catch { toast.error('Erro'); }
    finally { setSearchingAddress(false); }
  };

  const validateDoc = (c: Customer | null): string | null => {
    if (!c?.document) return null;
    const type = (c.personType || 'PJ') as 'PF' | 'PJ';
    return isValidDocument(c.document, type) ? null
      : `${type === 'PF' ? 'CPF' : 'CNPJ'} inválido`;
  };

  const handleSave = async () => {
    if (editing) {
      const err = validateDoc(editing);
      if (err) { toast.error(err); return; }
    }
    setSaving(true);
    try { await saveCustomers(); toast.success('Clientes salvos!'); setEditing(null); }
    catch (e: any) { toast.error(e?.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleDelete = (c: Customer) => {
    if (!confirm(`Remover "${c.customerName || 'sem nome'}"?`)) return;
    deleteCustomer(c.id);
    toast.success('Cliente removido (clique em Salvar para confirmar)');
  };

  const openHistory = async (c: Customer) => {
    setHistoryFor(c); setHistoryData(null); setHistoryLoading(true);
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
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }

  const docError = editing ? validateDoc(editing) : null;
  const personType = (editing?.personType || 'PJ') as 'PF' | 'PJ';

  return (
    <div className="min-h-screen bg-background">
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
            <Button variant="outline" size="sm" onClick={refetch}><RefreshCcw className="h-4 w-4 mr-1" />Recarregar</Button>
            <Button size="sm" variant="outline" onClick={handleAddNew}><Plus className="h-4 w-4 mr-1" />Novo cliente</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Salvar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <Card><CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Nome, documento, endereço, telefone…"
                     value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" />Filtro</label>
            <select className="block border rounded-md h-10 px-2 bg-background"
                    value={filterMode} onChange={e => setFilterMode(e.target.value as any)}>
              <option value="all">Todos</option>
              <option value="pj">Apenas PJ</option>
              <option value="pf">Apenas PF</option>
              <option value="withSan">Com sanitários alocados</option>
              <option value="noCoords">Sem coordenadas</option>
            </select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Exibindo <strong>{filtered.length}</strong> de {customers.length}
          </div>
        </CardContent></Card>

        {filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum cliente encontrado</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(c => {
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
                        {c.document && (
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {(c.personType || 'PJ')} · {maskDocument(c.document, (c.personType || 'PJ') as 'PF' | 'PJ')}
                          </div>
                        )}
                        {c.address && (
                          <div className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{c.address}{c.cidade ? `, ${c.cidade}/${c.estado || ''}` : ''}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant={c.personType === 'PF' ? 'outline' : 'secondary'} className="text-[10px]">
                          {c.personType || 'PJ'}
                        </Badge>
                        {n > 0 && <Badge className="bg-blue-100 text-blue-700">{n} sanit.</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.contactPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.contactPhone}</span>}
                      {c.email && <span>📧 {c.email}</span>}
                    </div>
                    <div className="flex gap-1 pt-2 border-t">
                      <Button size="sm" variant="ghost" className="flex-1 gap-1" onClick={() => setEditing(c)}>
                        <Edit3 className="h-3.5 w-3.5" />Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 gap-1" onClick={() => openHistory(c)}>
                        <History className="h-3.5 w-3.5" />Histórico
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

      {/* Modal de edição com tabs */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.customerName || 'Novo cliente'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <Tabs defaultValue="dados">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="contato">Contato</TabsTrigger>
                <TabsTrigger value="obs">Observações</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 pt-3">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo de pessoa</label>
                  <div className="flex gap-1 mt-1">
                    <Button type="button" size="sm" variant={personType === 'PJ' ? 'default' : 'outline'}
                            onClick={() => setField('personType', 'PJ')}>Pessoa Jurídica (CNPJ)</Button>
                    <Button type="button" size="sm" variant={personType === 'PF' ? 'default' : 'outline'}
                            onClick={() => setField('personType', 'PF')}>Pessoa Física (CPF)</Button>
                  </div>
                </div>

                {personType === 'PJ' && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      CNPJ — digite e clique em buscar para preencher automaticamente
                    </label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        className="font-mono"
                        value={maskDocument(editing.document || '', personType)}
                        onChange={e => setField('document', onlyDigits(e.target.value))}
                        placeholder="00.000.000/0000-00"
                      />
                      <Button
                        type="button"
                        onClick={handleLookupCnpj}
                        disabled={lookingUpCnpj || onlyDigits(editing.document || '').length !== 14}
                        className="gap-1 shrink-0"
                      >
                        {lookingUpCnpj
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Download className="h-4 w-4" />}
                        Buscar dados
                      </Button>
                    </div>
                    {docError && <div className="text-[11px] text-red-600 mt-1">{docError}</div>}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">
                      {personType === 'PJ' ? 'Razão social' : 'Nome completo'} *
                    </label>
                    <Input value={editing.customerName || ''} onChange={e => setField('customerName', e.target.value)} />
                  </div>

                  {personType === 'PJ' ? (
                    <>
                      <div className="md:col-span-2">
                        <label className="text-xs text-muted-foreground">Nome fantasia</label>
                        <Input value={editing.contactName || ''} onChange={e => setField('contactName', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Inscrição estadual</label>
                        <Input value={editing.ie || ''} onChange={e => setField('ie', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Inscrição municipal</label>
                        <Input value={editing.im || ''} onChange={e => setField('im', e.target.value)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground">CPF</label>
                        <Input
                          className="font-mono"
                          value={maskDocument(editing.document || '', personType)}
                          onChange={e => setField('document', onlyDigits(e.target.value))}
                          placeholder="000.000.000-00"
                        />
                        {docError && <div className="text-[11px] text-red-600 mt-1">{docError}</div>}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">RG</label>
                        <Input value={editing.ie || ''} onChange={e => setField('ie', e.target.value)} />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Tipo de cliente</label>
                    <select className="w-full border rounded-md h-10 px-2 bg-background"
                            value={editing.tipoCliente || ''} onChange={e => setField('tipoCliente', e.target.value)}>
                      <option value="">—</option>
                      <option value="eventos">Eventos</option>
                      <option value="obra">Obra / Construção</option>
                      <option value="industria">Indústria</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="endereco" className="space-y-3 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">CEP</label>
                    <div className="flex gap-1">
                      <Input value={maskCep(editing.cep || '')}
                             onChange={e => setField('cep', e.target.value)}
                             maxLength={9} placeholder="00000-000" />
                      <Button size="sm" variant="outline" onClick={handleSearchByCep} disabled={searchingAddress}>
                        {searchingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Logradouro</label>
                    <div className="flex gap-1">
                      <Input value={editing.address || ''} onChange={e => setField('address', e.target.value)} />
                      <Button size="sm" variant="outline" onClick={handleGeocode} disabled={searchingAddress}
                              title="Buscar coordenadas"><MapPin className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Número</label>
                    <Input value={editing.numero || ''} onChange={e => setField('numero', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Complemento</label>
                    <Input value={editing.complemento || ''} onChange={e => setField('complemento', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Bairro</label>
                    <Input value={editing.bairro || ''} onChange={e => setField('bairro', e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Cidade</label>
                    <Input value={editing.cidade || ''} onChange={e => setField('cidade', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">UF</label>
                    <select className="w-full border rounded-md h-10 px-2 bg-background"
                            value={editing.estado || ''} onChange={e => setField('estado', e.target.value)}>
                      <option value="">—</option>
                      {UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                {editing.lat && editing.lng && (
                  <div className="text-[10px] text-muted-foreground">
                    📍 Lat {Number(editing.lat).toFixed(5)} · Lng {Number(editing.lng).toFixed(5)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contato" className="space-y-3 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Responsável no local</label>
                    <Input value={editing.responsavelNome || editing.contactName || ''}
                           onChange={e => setField('responsavelNome', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">CPF do responsável</label>
                    <Input value={maskDocument(editing.responsavelCpf || '', 'PF')}
                           onChange={e => setField('responsavelCpf', onlyDigits(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefone</label>
                    <Input value={maskPhone(editing.contactPhone || '')}
                           onChange={e => setField('contactPhone', e.target.value)}
                           placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">E-mail</label>
                    <Input type="email" value={editing.email || ''} onChange={e => setField('email', e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="obs" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Banheiros (planejados)</label>
                    <Input type="number" min={0} value={editing.restroomsQty ?? ''}
                           onChange={e => setField('restroomsQty', e.target.value ? parseInt(e.target.value) : undefined)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Limpezas (planejadas)</label>
                    <Input type="number" min={0} value={editing.cleaningsQty ?? ''}
                           onChange={e => setField('cleaningsQty', e.target.value ? parseInt(e.target.value) : undefined)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Observações</label>
                  <Textarea rows={4} value={editing.notes || ''} onChange={e => setField('notes', e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Fechar</Button>
            <Button onClick={handleSave} disabled={saving || !!docError}
                    className="bg-green-600 hover:bg-green-700">
              {saving ? 'Salvando…' : 'Salvar tudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={o => !o && (setHistoryFor(null), setHistoryData(null))}>
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
                    {historyData.current.map(s => (
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
                  <p className="text-xs text-muted-foreground">Sem registros.</p>
                ) : (
                  <div className="space-y-1.5">
                    {historyData.history.map(h => (
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
