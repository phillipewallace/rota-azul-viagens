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
import {
  AlertTriangle, ArrowLeft, Filter, Loader2, Plus, RefreshCcw, Search, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'pj',       label: 'Pessoa Jurídica' },
  { value: 'pf',       label: 'Pessoa Física' },
  { value: 'withSan',  label: 'Com sanitários' },
  { value: 'noCoords', label: 'Sem coordenadas' },
];

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
      let nextList: Customer[];
      if (isNewDraft) {
        nextList = [...customers, c];
        addCustomer(c);
      } else {
        nextList = customers.map(x => x.id === c.id ? { ...x, ...c } : x);
        (Object.keys(c) as (keyof Customer)[]).forEach(k => updateCustomer(c.id, k, c[k]));
      }
      await saveCustomers(nextList);
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
      const nextList = customers.filter(x => x.id !== target.id);
      deleteCustomer(target.id);
      await saveCustomers(nextList);
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
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <span className="text-sm">Carregando clientes…</span>
        </div>
      </div>
    );
  }

  const hasActiveFilters = !!search || filterMode !== 'all' || onlyDuplicates;

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              title="Voltar"
              aria-label="Voltar ao início"
            >
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="h-9 w-9 rounded-lg bg-primary/5 text-primary flex items-center justify-center ring-1 ring-primary/10 shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-semibold tracking-tight leading-none">Clientes</h1>
              <p className="text-[11px] text-muted-foreground mt-1 leading-none">
                {customers.length} {customers.length === 1 ? 'cadastro' : 'cadastros'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="hidden sm:inline-flex h-9 gap-1.5 text-xs font-medium"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Recarregar
            </Button>
            <Button
              size="sm"
              onClick={openNew}
              className="h-9 gap-1.5 text-xs font-medium shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Novo cliente
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="truncate">Falha ao carregar clientes: {error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={refetch} className="shrink-0">
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Toolbar */}
        <Card className="border-border/70 shadow-[var(--shadow-sm)]">
          <div className="p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-9 h-10 bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Buscar por nome, documento, endereço, telefone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Buscar clientes"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <select
                  className="h-10 pl-8 pr-8 rounded-md border border-border/80 bg-background text-sm appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                  value={filterMode}
                  onChange={e => setFilterMode(e.target.value as FilterMode)}
                  aria-label="Filtrar"
                >
                  {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {duplicateInfo.dupIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyDuplicates(v => !v)}
                  className={[
                    'inline-flex items-center gap-1.5 h-10 px-3 rounded-md border text-xs font-medium transition-colors',
                    onlyDuplicates
                      ? 'bg-warning text-warning-foreground border-warning'
                      : 'bg-warning-soft text-warning-foreground border-warning/30 hover:bg-warning/20',
                  ].join(' ')}
                  title="Mostrar apenas duplicados"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {duplicateInfo.dupIds.size} duplicado{duplicateInfo.dupIds.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="px-4 pb-3 -mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Exibindo <strong className="text-foreground tabular-nums">{filtered.length}</strong> de{' '}
                <span className="tabular-nums">{customers.length}</span>
              </span>
              <button
                type="button"
                onClick={() => { setSearch(''); setFilterMode('all'); setOnlyDuplicates(false); }}
                className="text-primary hover:underline font-medium"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </Card>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-background/60">
            <div className="px-6 py-16 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {hasActiveFilters ? 'Nenhum cliente corresponde aos filtros' : 'Nenhum cliente cadastrado ainda'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters
                  ? 'Tente ajustar a busca ou os filtros acima.'
                  : 'Clique em "Novo cliente" para começar.'}
              </p>
              {!hasActiveFilters && (
                <Button size="sm" onClick={openNew} className="mt-5 gap-1.5">
                  <Plus className="h-4 w-4" />Cadastrar primeiro cliente
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

        <p className="text-[11px] text-muted-foreground text-center pt-2">
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
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Você está prestes a remover <strong className="text-foreground">{confirmDelete?.customerName || 'este cliente'}</strong>.
                </p>
                {confirmDelete && sanCount(confirmDelete) > 0 && (
                  <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft text-warning-foreground px-3 py-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Este cliente possui <strong>{sanCount(confirmDelete)}</strong> sanitário(s) alocado(s).
                      A remoção não afeta o histórico já registrado.
                    </span>
                  </p>
                )}
                <p className="text-muted-foreground">Esta ação é imediata e não pode ser desfeita.</p>
              </div>
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
