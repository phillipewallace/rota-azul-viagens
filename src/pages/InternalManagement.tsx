import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Pencil, Package, Boxes, Users, History,
  AlertTriangle, CalendarClock, FileSignature, ArrowDownToLine, ArrowUpFromLine,
  Settings2, Loader2, Upload, Building2, Car,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  erpService, uploadSignedPdf,
  ErpCategory, ErpItem, ErpEmployee, ErpMovement, ErpDashboard,
} from '@/services/erp';
import { useAuth } from '@/hooks/useAuth';
import VehiclesView from '@/components/erp/VehiclesView';

const movementLabel: Record<string, string> = {
  in: 'Entrada', out: 'Retirada', adjust: 'Ajuste', discard: 'Descarte',
};
const movementColor: Record<string, string> = {
  in: 'bg-green-100 text-green-700',
  out: 'bg-blue-100 text-blue-700',
  adjust: 'bg-amber-100 text-amber-700',
  discard: 'bg-red-100 text-red-700',
};

const InternalManagement: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ErpCategory[]>([]);
  const [items, setItems] = useState<ErpItem[]>([]);
  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [movements, setMovements] = useState<ErpMovement[]>([]);
  const [dashboard, setDashboard] = useState<ErpDashboard | null>(null);

  // Modals
  const [categoryModal, setCategoryModal] = useState<ErpCategory | null>(null);
  const [itemModal, setItemModal] = useState<ErpItem | null>(null);
  const [employeeModal, setEmployeeModal] = useState<ErpEmployee | null>(null);
  const [movementModal, setMovementModal] = useState<{ item: ErpItem; type: 'in' | 'out' | 'adjust' | 'discard' } | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, i, e, m, d] = await Promise.all([
        erpService.listCategories(),
        erpService.listItems(),
        erpService.listEmployees(),
        erpService.listMovements(),
        erpService.dashboard(),
      ]);
      setCategories(c); setItems(i); setEmployees(e); setMovements(m); setDashboard(d);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar ERP');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Acesso restrito</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              A Gestão Interna está disponível somente para administradores.
            </p>
            <Button asChild><Link to="/">Voltar</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <Building2 className="h-6 w-6 text-blue-600" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">Gestão Interna · ERP</h1>
            <p className="text-xs text-muted-foreground">Estoque, EPIs, Produtos Químicos e mais</p>
          </div>
          {dashboard && dashboard.alertCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {dashboard.alertCount} alerta(s)
            </Badge>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-1 h-auto">
            <TabsTrigger value="dashboard"><Boxes className="h-4 w-4 mr-2" />Painel</TabsTrigger>
            <TabsTrigger value="items"><Package className="h-4 w-4 mr-2" />Itens</TabsTrigger>
            <TabsTrigger value="vehicles"><Car className="h-4 w-4 mr-2" />Frota</TabsTrigger>
            <TabsTrigger value="categories"><Settings2 className="h-4 w-4 mr-2" />Categorias</TabsTrigger>
            <TabsTrigger value="employees"><Users className="h-4 w-4 mr-2" />Funcionários</TabsTrigger>
            <TabsTrigger value="movements"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
          </TabsList>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          )}

          {!loading && (
            <>
              <TabsContent value="dashboard" className="mt-6">
                <DashboardView dashboard={dashboard} />
              </TabsContent>

              <TabsContent value="items" className="mt-6">
                <ItemsView
                  items={items}
                  categories={categories}
                  onEdit={(it) => setItemModal(it)}
                  onCreate={() => setItemModal({
                    id: '', categoryId: categories[0]?.id || '', categoryName: '',
                    name: '', unit: 'un', currentQty: 0, minQty: 0,
                    expiryAlertDays: 30, active: true,
                    tracksExpiry: false, requiresSignedTerm: false,
                  } as ErpItem)}
                  onMovement={(item, type) => setMovementModal({ item, type })}
                  onDelete={async (id) => {
                    if (!confirm('Excluir este item?')) return;
                    await erpService.deleteItem(id);
                    toast.success('Item excluído'); loadAll();
                  }}
                />
              </TabsContent>

              <TabsContent value="vehicles" className="mt-6">
                <VehiclesView />
              </TabsContent>

              <TabsContent value="categories" className="mt-6">
                <CategoriesView
                  categories={categories}
                  onEdit={(c) => setCategoryModal(c)}
                  onCreate={() => setCategoryModal({
                    id: '', name: '', icon: 'package',
                    tracksExpiry: false, requiresSignedTerm: false,
                  } as ErpCategory)}
                  onDelete={async (id) => {
                    if (!confirm('Excluir esta categoria?')) return;
                    try {
                      await erpService.deleteCategory(id);
                      toast.success('Categoria excluída'); loadAll();
                    } catch (e: any) { toast.error(e.message); }
                  }}
                />
              </TabsContent>

              <TabsContent value="employees" className="mt-6">
                <EmployeesView
                  employees={employees}
                  onEdit={(e) => setEmployeeModal(e)}
                  onCreate={() => setEmployeeModal({
                    id: '', name: '', active: true,
                  } as ErpEmployee)}
                  onDelete={async (id) => {
                    if (!confirm('Excluir funcionário?')) return;
                    await erpService.deleteEmployee(id);
                    toast.success('Funcionário excluído'); loadAll();
                  }}
                />
              </TabsContent>

              <TabsContent value="movements" className="mt-6">
                <MovementsView movements={movements} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      {/* Modais */}
      {categoryModal && (
        <CategoryModal
          category={categoryModal}
          onClose={() => setCategoryModal(null)}
          onSaved={() => { setCategoryModal(null); loadAll(); }}
        />
      )}
      {itemModal && (
        <ItemModal
          item={itemModal}
          categories={categories}
          onClose={() => setItemModal(null)}
          onSaved={() => { setItemModal(null); loadAll(); }}
        />
      )}
      {employeeModal && (
        <EmployeeModal
          employee={employeeModal}
          onClose={() => setEmployeeModal(null)}
          onSaved={() => { setEmployeeModal(null); loadAll(); }}
        />
      )}
      {movementModal && (
        <MovementModal
          item={movementModal.item}
          type={movementModal.type}
          employees={employees}
          onClose={() => setMovementModal(null)}
          onSaved={() => { setMovementModal(null); loadAll(); }}
        />
      )}
    </div>
  );
};

/* ============ Dashboard ============ */
const DashboardView: React.FC<{ dashboard: ErpDashboard | null }> = ({ dashboard }) => {
  if (!dashboard) return null;
  const { totals, lowStock, expiring } = dashboard;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Itens ativos</p>
          <p className="text-3xl font-bold">{totals.totalItems}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Categorias</p>
          <p className="text-3xl font-bold">{totals.totalCategories}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Funcionários</p>
          <p className="text-3xl font-bold">{totals.totalEmployees}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Estoque baixo ({lowStock.length})
        </CardTitle></CardHeader>
        <CardContent>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item abaixo do mínimo.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Categoria</TableHead>
                <TableHead className="text-right">Atual</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lowStock.map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.name}</TableCell>
                    <TableCell>{it.categoryName}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {Number(it.currentQty)} {it.unit}
                    </TableCell>
                    <TableCell className="text-right">{Number(it.minQty)} {it.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-5 w-5 text-orange-500" />
          Validade próxima ({expiring.length})
        </CardTitle></CardHeader>
        <CardContent>
          {expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item próximo da validade.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Categoria</TableHead>
                <TableHead>Validade</TableHead><TableHead className="text-right">Dias</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {expiring.map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.name}</TableCell>
                    <TableCell>{it.categoryName}</TableCell>
                    <TableCell>{new Date(it.expiryDate).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={it.daysLeft < 0 ? 'destructive' : 'secondary'}>
                        {it.daysLeft < 0 ? `Vencido há ${-it.daysLeft}d` : `${it.daysLeft}d`}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ============ Itens ============ */
const ItemsView: React.FC<{
  items: ErpItem[]; categories: ErpCategory[];
  onEdit: (i: ErpItem) => void; onCreate: () => void;
  onMovement: (i: ErpItem, t: 'in' | 'out' | 'adjust' | 'discard') => void;
  onDelete: (id: string) => void;
}> = ({ items, categories, onEdit, onCreate, onMovement, onDelete }) => {
  const [filter, setFilter] = useState<string>('all');
  const filtered = useMemo(
    () => items.filter(i => filter === 'all' || i.categoryId === filter),
    [items, filter]
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={onCreate} disabled={categories.length === 0}>
          <Plus className="h-4 w-4 mr-2" /> Novo item
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhum item cadastrado.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Mín.</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(i => {
                const low = i.minQty > 0 && Number(i.currentQty) <= Number(i.minQty);
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.name}</div>
                      {i.sku && <div className="text-xs text-muted-foreground">SKU: {i.sku}</div>}
                    </TableCell>
                    <TableCell>{i.categoryName}</TableCell>
                    <TableCell className={`text-right font-medium ${low ? 'text-red-600' : ''}`}>
                      {Number(i.currentQty)} {i.unit}
                    </TableCell>
                    <TableCell className="text-right">{Number(i.minQty)} {i.unit}</TableCell>
                    <TableCell>
                      {i.expiryDate ? new Date(i.expiryDate).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="text-green-600"
                          onClick={() => onMovement(i, 'in')}>
                          <ArrowDownToLine className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-blue-600"
                          onClick={() => onMovement(i, 'out')}>
                          <ArrowUpFromLine className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onEdit(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600"
                          onClick={() => onDelete(i.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
};

/* ============ Categorias ============ */
const CategoriesView: React.FC<{
  categories: ErpCategory[];
  onEdit: (c: ErpCategory) => void; onCreate: () => void;
  onDelete: (id: string) => void;
}> = ({ categories, onEdit, onCreate, onDelete }) => (
  <div className="space-y-4">
    <div className="flex justify-end">
      <Button onClick={onCreate}><Plus className="h-4 w-4 mr-2" /> Nova categoria</Button>
    </div>
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Nome</TableHead><TableHead>Validade</TableHead>
          <TableHead>Termo</TableHead><TableHead className="text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {categories.map(c => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
              </TableCell>
              <TableCell>{c.tracksExpiry ? <Badge variant="secondary">Rastreia</Badge> : '-'}</TableCell>
              <TableCell>{c.requiresSignedTerm ? <Badge variant="secondary">Requer</Badge> : '-'}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDelete(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  </div>
);

/* ============ Funcionários ============ */
const EmployeesView: React.FC<{
  employees: ErpEmployee[];
  onEdit: (e: ErpEmployee) => void; onCreate: () => void;
  onDelete: (id: string) => void;
}> = ({ employees, onEdit, onCreate, onDelete }) => (
  <div className="space-y-4">
    <div className="flex justify-end">
      <Button onClick={onCreate}><Plus className="h-4 w-4 mr-2" /> Novo funcionário</Button>
    </div>
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Nome</TableHead><TableHead>Cargo</TableHead>
          <TableHead>CPF</TableHead><TableHead>Telefone</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {employees.map(e => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.name}</TableCell>
              <TableCell>{e.role || '-'}</TableCell>
              <TableCell>{e.cpf || '-'}</TableCell>
              <TableCell>{e.phone || '-'}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => onEdit(e)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDelete(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  </div>
);

/* ============ Movimentações ============ */
const MovementsView: React.FC<{ movements: ErpMovement[] }> = ({ movements }) => (
  <Card><CardContent className="p-0">
    <Table>
      <TableHeader><TableRow>
        <TableHead>Data</TableHead><TableHead>Item</TableHead>
        <TableHead>Tipo</TableHead><TableHead className="text-right">Qtd</TableHead>
        <TableHead>Funcionário</TableHead><TableHead>Por</TableHead>
        <TableHead>PDF</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {movements.length === 0 ? (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
            Nenhuma movimentação registrada.
          </TableCell></TableRow>
        ) : movements.map(m => (
          <TableRow key={m.id}>
            <TableCell className="text-xs">{new Date(m.createdAt).toLocaleString('pt-BR')}</TableCell>
            <TableCell>{m.itemName}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded text-xs font-medium ${movementColor[m.type]}`}>
                {movementLabel[m.type]}
              </span>
            </TableCell>
            <TableCell className="text-right">{Number(m.qty)} {m.unit}</TableCell>
            <TableCell>{m.employeeName || '-'}</TableCell>
            <TableCell className="text-xs">{m.performedBy || '-'}</TableCell>
            <TableCell>
              {m.signedPdfUrl ? (
                <a href={m.signedPdfUrl} target="_blank" rel="noreferrer"
                   className="text-blue-600 underline text-xs flex items-center gap-1">
                  <FileSignature className="h-3 w-3" /> Termo
                </a>
              ) : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent></Card>
);

/* ============ Modais ============ */
const CategoryModal: React.FC<{ category: ErpCategory; onClose: () => void; onSaved: () => void }> =
({ category, onClose, onSaved }) => {
  const [form, setForm] = useState(category);
  const [saving, setSaving] = useState(false);
  const isNew = !category.id;
  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    setSaving(true);
    try {
      if (isNew) await erpService.createCategory(form);
      else await erpService.updateCategory(category.id, form);
      toast.success('Categoria salva'); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isNew ? 'Nova' : 'Editar'} categoria</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea value={form.description || ''}
            onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex items-center justify-between">
            <Label>Itens dessa categoria têm validade</Label>
            <Switch checked={form.tracksExpiry}
              onCheckedChange={v => setForm({ ...form, tracksExpiry: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Exige termo assinado na retirada</Label>
            <Switch checked={form.requiresSignedTerm}
              onCheckedChange={v => setForm({ ...form, requiresSignedTerm: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ItemModal: React.FC<{
  item: ErpItem; categories: ErpCategory[];
  onClose: () => void; onSaved: () => void;
}> = ({ item, categories, onClose, onSaved }) => {
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;
  const cat = categories.find(c => c.id === form.categoryId);
  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    if (!form.categoryId) return toast.error('Selecione categoria');
    setSaving(true);
    try {
      if (isNew) {
        await erpService.createItem({
          ...form,
          currentQty: Number(form.currentQty) || 0,
          minQty: Number(form.minQty) || 0,
        });
      } else {
        await erpService.updateItem(item.id, {
          ...form,
          minQty: Number(form.minQty) || 0,
        });
      }
      toast.success('Item salvo'); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isNew ? 'Novo' : 'Editar'} item</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>Nome *</Label><Input value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Categoria *</Label>
            <Select value={form.categoryId}
              onValueChange={v => setForm({ ...form, categoryId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>SKU</Label><Input value={form.sku || ''}
            onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
          <div><Label>Unidade</Label><Input value={form.unit}
            onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="un, cx, L, kg, par" /></div>
          {isNew && (
            <div><Label>Quantidade inicial</Label><Input type="number" min="0" value={form.currentQty}
              onChange={e => setForm({ ...form, currentQty: parseFloat(e.target.value) || 0 })} /></div>
          )}
          <div><Label>Mínimo (alerta)</Label><Input type="number" min="0" value={form.minQty}
            onChange={e => setForm({ ...form, minQty: parseFloat(e.target.value) || 0 })} /></div>
          {(cat?.tracksExpiry) && (
            <>
              <div><Label>Validade</Label><Input type="date"
                value={form.expiryDate ? form.expiryDate.substring(0, 10) : ''}
                onChange={e => setForm({ ...form, expiryDate: e.target.value })} /></div>
              <div><Label>Alertar com (dias)</Label><Input type="number" min="1" value={form.expiryAlertDays}
                onChange={e => setForm({ ...form, expiryAlertDays: parseInt(e.target.value) || 30 })} /></div>
            </>
          )}
          <div className="md:col-span-2"><Label>Observações</Label>
            <Textarea value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EmployeeModal: React.FC<{ employee: ErpEmployee; onClose: () => void; onSaved: () => void }> =
({ employee, onClose, onSaved }) => {
  const [form, setForm] = useState(employee);
  const [saving, setSaving] = useState(false);
  const isNew = !employee.id;
  const save = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório');
    setSaving(true);
    try {
      if (isNew) await erpService.createEmployee(form);
      else await erpService.updateEmployee(employee.id, form);
      toast.success('Funcionário salvo'); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isNew ? 'Novo' : 'Editar'} funcionário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Cargo</Label><Input value={form.role || ''}
            onChange={e => setForm({ ...form, role: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>CPF</Label><Input value={form.cpf || ''}
              onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone || ''}
              onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MovementModal: React.FC<{
  item: ErpItem; type: 'in' | 'out' | 'adjust' | 'discard';
  employees: ErpEmployee[]; onClose: () => void; onSaved: () => void;
}> = ({ item, type, employees, onClose, onSaved }) => {
  const [qty, setQty] = useState<string>('1');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const requireEmployee = type === 'out';
  const requireTerm = type === 'out' && item.requiresSignedTerm;

  const handlePdf = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadSignedPdf(file);
      setPdfUrl(url);
      toast.success('PDF anexado');
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const save = async () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return toast.error('Quantidade inválida');
    if (requireEmployee && !employeeId) return toast.error('Selecione o funcionário');
    if (requireTerm && !pdfUrl) return toast.error('Anexe o termo assinado (PDF)');
    setSaving(true);
    try {
      await erpService.createMovement({
        itemId: item.id, type, qty: q,
        employeeId: employeeId || undefined,
        notes: notes || undefined,
        signedPdfUrl: pdfUrl || undefined,
      });
      toast.success('Movimentação registrada'); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const titleMap = {
    in: 'Entrada de estoque', out: 'Retirada',
    adjust: 'Ajuste de estoque', discard: 'Descarte',
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titleMap[type]} — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Estoque atual: <strong>{Number(item.currentQty)} {item.unit}</strong>
          </p>
          <div>
            <Label>{type === 'adjust' ? 'Novo total' : 'Quantidade'} ({item.unit})</Label>
            <Input type="number" min="0" step="0.01" value={qty}
              onChange={e => setQty(e.target.value)} autoFocus />
          </div>
          {requireEmployee && (
            <div>
              <Label>Funcionário {requireEmployee && '*'}</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.active).map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}{e.role ? ` — ${e.role}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employees.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Cadastre funcionários na aba Funcionários.
                </p>
              )}
            </div>
          )}
          {requireTerm && (
            <div>
              <Label>Termo assinado (PDF) *</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="application/pdf"
                  onChange={e => handlePdf(e.target.files?.[0] || null)} />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noreferrer"
                   className="text-xs text-blue-600 underline mt-1 inline-block">
                  PDF anexado ✓
                </a>
              )}
            </div>
          )}
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InternalManagement;
