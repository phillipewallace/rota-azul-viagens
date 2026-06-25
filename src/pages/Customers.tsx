/**
 * Aba Clientes — orquestrador. Toda a UI pesada está em componentes
 * dedicados sob src/components/customers/. Esta página apenas:
 *  - busca/lista clientes (useCustomers)
 *  - aplica filtros locais
 *  - decide o fluxo de salvar (com modal de duplicata)
 *  - faz commit imediato em criar/editar/remover (sem botão global)
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Filter, Loader2, Plus, RefreshCcw, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { Customer, useCustomers } from '@/hooks/useCustomers';
import { useCustomerSanCounts } from '@/hooks/useCustomerSanCounts';
import { onlyDigits } from '@/utils/brazilianDocs';
import { findDuplicateByDocument, getDuplicateInfo } from '@/utils/customerHelpers';
import { CustomerCard } from '@/components/customers/CustomerCard';
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog';
import { CustomerHistoryDialog } from '@/components/customers/CustomerHistoryDialog';
import { CustomerDuplicateDialog } from '@/components/customers/CustomerDuplicateDialog';

type FilterMode = 'all' | 'withSan' | 'noCoords' | 'pf' | 'pj';

const Customers: React.FC = () => {
  // ---------- estado de UI ----------
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  // ---------- estado de fluxo ----------
  const [editing, setEditing] = useState<Customer | null>(null);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [saving, setSaving] = useState(false);

  const [historyFor, setHistoryFor] = useState<Customer | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [duplicatePrompt, setDuplicatePrompt] = useState<{ existing: Customer; attempted: Customer } | null>(null);

  // ---------- dados ----------
  const { customers, loading, error, addCustomer, updateCustomer, deleteCustomer, saveCustomers, refetch } = useCustomers({
    pollEnabled: !editing && !historyFor && !confirmDelete && !duplicatePrompt,
  });
  const counts = useCustomerSanCounts(customers.length);
  const sanCount = (c: Customer) => counts[(c.customerName || '').toLowerCase()] || 0;

  const duplicateInfo = useMemo(() => getDuplicateInfo(customers), [customers]);

  // ---------- filtro derivado ----------
  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const sDigits = onlyDigits(search);
    return customers.filter(c => {
      const docDigits = onlyDigits(c.document || '');
      const phoneDigits = onlyDigits(c.contactPhone || '');
      const cepDigits = onlyDigits(c.cep || '');
      const matchSearch = !s ||
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.address || '').toLowerCase().includes(s) ||
        (c.cidade || '').toLowerCase().includes(s) ||
        (c.bairro || '').toLowerCase().includes(s) ||
        (c.email || '').toLowerCase().includes(s) ||
        (c.contactName || '').toLowerCase().includes(s) ||
        (sDigits.length > 0 && (
          docDigits.includes(sDigits) ||
          phoneDigits.includes(sDigits) ||
          cepDigits.includes(sDigits)
        ));
      if (!matchSearch) return false;
      if (onlyDuplicates && !duplicateInfo.dupIds.has(c.id)) return false;
      if (filterMode === 'withSan') return sanCount(c) > 0;
      if (filterMode === 'noCoords') return !c.lat || !c.lng;
      if (filterMode === 'pf') return c.personType === 'PF';
      if (filterMode === 'pj') return (c.personType || 'PJ') === 'PJ';
      return true;
    });
  }, [customers, search, filterMode, counts, onlyDuplicates, duplicateInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- handlers ----------
  const openNew = () => {
    setIsNewDraft(true);
    setEditing({
      id: uuidv4(),
      customerName: '', address: '', cep: '',
      personType: 'PJ', document: '',
    });
  };

  const closeEditor = () => { setEditing(null); setIsNewDraft(false); };

  /**
   * Persiste o cliente (novo ou editado). Se `force`=false e houver
   * duplicata por documento, abre o modal de confirmação em vez de salvar.
   */
  const persistCustomer = async (c: Customer, force = false) => {
    if (!force) {
      const dup = findDuplicateByDocument(c, customers);
      if (dup) {
        setDuplicatePrompt({ existing: dup, attempted: c });
        return;
      }
    }
    setSaving(true);
    try {
      if (isNewDraft) addCustomer(c);
      else {
        // garante que o estado local reflete o draft antes do bulk PUT
        (Object.keys(c) as (keyof Customer)[]).forEach(k => updateCustomer(c.id, k, c[k]));
      }
      // microtick: deixa o setState do hook aplicar antes do PUT
      await new Promise(r => setTimeout(r, 0));
      await saveCustomers();
      toast.success(isNewDraft ? 'Cliente cadastrado!' : 'Cliente atualizado!');
      setDuplicatePrompt(null);
      closeEditor();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setDeleting(true);
    try {
      deleteCustomer(target.id);
      await new Promise(r => setTimeout(r, 0));
      await saveCustomers();
      toast.success(`"${target.customerName || 'Cliente'}" removido.`);
      setConfirmDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover cliente');
      await refetch();
    } finally {
      setDeleting(false);
    }
  };

  // ---------- render ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild title="Voltar ao sistema">
              <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Clientes</h1>
            <Badge variant="secondary">{customers.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCcw className="h-4 w-4 mr-1" />Recarregar
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />Novo cliente
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm px-3 py-2 flex items-center justify-between">
            <span>Falha ao carregar clientes: {error}</span>
            <Button size="sm" variant="outline" onClick={refetch}>Tentar novamente</Button>
          </div>
        )}

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[260px]">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Nome, documento, endereço, telefone…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />Filtro
              </label>
              <select
                className="block border rounded-md h-10 px-2 bg-background"
                value={filterMode}
                onChange={e => setFilterMode(e.target.value as FilterMode)}
              >
                <option value="all">Todos</option>
                <option value="pj">Apenas PJ</option>
                <option value="pf">Apenas PF</option>
                <option value="withSan">Com sanitários alocados</option>
                <option value="noCoords">Sem coordenadas</option>
              </select>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {duplicateInfo.dupIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyDuplicates(v => !v)}
                  className={`text-xs px-2 py-1 rounded-md border transition ${onlyDuplicates ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
                  title="Mostrar apenas duplicados"
                >
                  ⚠️ {duplicateInfo.dupIds.size} duplicado(s)
                </button>
              )}
              <div className="text-xs text-muted-foreground">
                Exibindo <strong>{filtered.length}</strong> de {customers.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum cliente encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(c => (
              <CustomerCard
                key={c.id}
                customer={c}
                sanCount={sanCount(c)}
                isDuplicate={duplicateInfo.dupIds.has(c.id)}
                duplicateReason={duplicateInfo.dupReason.get(c.id)}
                onEdit={() => { setIsNewDraft(false); setEditing(c); }}
                onHistory={setHistoryFor}
                onDelete={setConfirmDelete}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Cada cadastro, edição ou remoção é salvo automaticamente no servidor.
        </p>
      </main>

      <CustomerEditDialog
        open={!!editing}
        initial={editing}
        isNew={isNewDraft}
        saving={saving}
        onClose={closeEditor}
        onSave={c => persistCustomer(c, false)}
      />

      <CustomerHistoryDialog customer={historyFor} onClose={() => setHistoryFor(null)} />

      <CustomerDuplicateDialog
        open={!!duplicatePrompt}
        existing={duplicatePrompt?.existing || null}
        attempted={duplicatePrompt?.attempted || null}
        saving={saving}
        onCancel={() => setDuplicatePrompt(null)}
        onProceed={() => duplicatePrompt && persistCustomer(duplicatePrompt.attempted, true)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a remover <strong>{confirmDelete?.customerName || 'este cliente'}</strong>.
              {confirmDelete && sanCount(confirmDelete) > 0 && (
                <span className="block mt-2 text-amber-700">
                  ⚠ Este cliente possui {sanCount(confirmDelete)} sanitário(s) alocado(s).
                  A remoção não afeta o histórico já registrado.
                </span>
              )}
              <span className="block mt-2">Esta ação é imediata e não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Removendo…</> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Customers;
