/**
 * ERP · Contratos — lista, cria/edita contratos (gerados ou externos)
 * com vínculo opcional a cliente + OS, valor mensal, dia de vencimento,
 * renovação automática e PDF assinado anexo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FileSignature, Plus, Search, Upload, FileDown, Power, PowerOff,
  Calendar, Loader2, Trash2, ExternalLink, FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { contractsService, type Contract } from '@/services/contracts';
import { erpService, type ErpCompany, uploadSignedPdf } from '@/services/erp';
import { serviceOrdersService } from '@/services/quotes';
import { API_BASE_URL } from '@/services/config';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { generateContractPdf } from '@/utils/contractPdf';

// Cliente vem do endpoint /customers que retorna camelCase (customerName)
type Customer = { id: string; customerName: string; document?: string };

const BRL = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const D = (s?: string | null) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

const ErpContracts: React.FC = () => {
  const [list, setList] = useState<Contract[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [oses, setOses] = useState<any[]>([]);
  const [filterAtivo, setFilterAtivo] = useState<'all' | 'true' | 'false'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [deleting, setDeleting] = useState<Contract | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterAtivo !== 'all') params.ativo = filterAtivo === 'true';
      setList(await contractsService.list(params));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const loadAux = async () => {
    try {
      const [cs, cu, os] = await Promise.all([
        erpService.listCompanies(),
        fetchCustomers(),
        serviceOrdersService.list().catch(() => []),
      ]);
      setCompanies(cs);
      setCustomers(cu);
      setOses(os);
    } catch (e: any) { toast.error(e.message); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterAtivo]);
  useEffect(() => { loadAux(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(c =>
      (c.numero || '').toLowerCase().includes(s) ||
      (c.customerName || '').toLowerCase().includes(s) ||
      (c.companyRazaoSocial || '').toLowerCase().includes(s) ||
      (c.descricao || '').toLowerCase().includes(s)
    );
  }, [list, search]);

  const onSaved = async () => {
    setOpenForm(false); setEditing(null);
    await load();
  };

  const toggleActive = async (c: Contract) => {
    try {
      await contractsService.update(c.id, { ativo: !c.ativo });
      toast.success(c.ativo ? 'Contrato encerrado' : 'Contrato reativado');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await contractsService.remove(deleting.id);
      toast.success('Contrato removido');
      setDeleting(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const downloadContractPdf = async (c: Contract) => {
    try {
      const full = await contractsService.get(c.id);
      generateContractPdf({
        numero: full.numero,
        tipo: 'os',
        tipoContrato: (full.tipoContrato as any) || 'locacao',
        modalidade: 'mensal',
        dataEmissao: full.dataInicio,
        dataInicio: full.dataInicio,
        dataEntrega: full.dataEvento || full.dataInicio,
        dataFimPrevista: full.dataRecolhimento || full.dataFim || null,
        dataRecolhimento: full.dataRecolhimento || null,
        horaEntrega: full.horaEntrega || null,
        localEvento: full.localEvento || null,
        enderecoEntrega: full.localEvento || (full.customerSnapshot?.address ?? null),
        observacoes: full.observacoes || null,
        total: Number(full.valorTotalEvento ?? full.valorMensal ?? 0),
        frete: Number(full.frete || 0),
        companySnapshot: full.companySnapshot,
        customerSnapshot: full.customerSnapshot,
        companyRazaoSocial: full.companyRazaoSocial,
        companyCnpj: full.companyCnpj,
        customerName: full.customerName,
        items: [],
      });
      toast.success('Contrato gerado');
    } catch (e: any) { toast.error(e.message || 'Erro ao gerar contrato'); }
  };


  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-[1400px] mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">
            <FileSignature className="h-3.5 w-3.5" /> Contratos
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Gestão de Contratos</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Contratos ativos alimentam o módulo Financeiro com a geração mensal de recibos.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenForm(true); }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-1" /> Novo contrato
        </Button>
      </header>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-7 h-9" placeholder="Nº, cliente, empresa, descrição…" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filterAtivo} onValueChange={(v: any) => setFilterAtivo(v)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Encerrados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-slate-500">{filtered.length} contratos</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Venc. Dia</TableHead>
                  <TableHead className="text-right">Valor Mensal</TableHead>
                  <TableHead>Renov.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                  </TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-400">
                    Nenhum contrato encontrado.
                  </TableCell></TableRow>
                )}
                {filtered.map(c => (
                  <TableRow key={c.id} className={!c.ativo ? 'opacity-60' : ''}>
                    <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{c.customerName || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[140px] truncate">{c.companyRazaoSocial || '—'}</TableCell>
                    <TableCell className="text-xs">{D(c.dataInicio)}</TableCell>
                    <TableCell className="text-xs">dia {c.diaVencimento}</TableCell>
                    <TableCell className="text-right font-semibold">{BRL(Number(c.valorMensal))}</TableCell>
                    <TableCell>
                      {c.renovacaoAutomatica
                        ? <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">Auto</Badge>
                        : <Badge variant="outline" className="text-slate-500">Manual</Badge>}
                    </TableCell>
                    <TableCell>
                      {c.ativo
                        ? <Badge className="bg-emerald-600">Ativo</Badge>
                        : <Badge variant="secondary">Encerrado</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{c.osNumero || '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" title="Baixar PDF do contrato"
                        onClick={() => downloadContractPdf(c)}>
                        <FileText className="h-3.5 w-3.5 text-indigo-600" />
                      </Button>
                      {c.pdfUrl && (
                        <Button variant="ghost" size="sm" title="Abrir PDF assinado anexado"
                          onClick={() => window.open(toAbsoluteUrl(c.pdfUrl!), '_blank')}>
                          <FileDown className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setOpenForm(true); }}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(c)}
                        className={c.ativo ? 'text-amber-600' : 'text-emerald-600'}>
                        {c.ativo ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} className="text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ContractFormDialog
        open={openForm}
        editing={editing}
        companies={companies}
        customers={customers}
        oses={oses}
        onClose={() => { setOpenForm(false); setEditing(null); }}
        onSaved={onSaved}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato {deleting?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os recibos vinculados também serão removidos. Esta ação é definitiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ErpContracts;

// =====================
// Form Dialog
// =====================
function ContractFormDialog({
  open, editing, companies, customers, oses, onClose, onSaved,
}: {
  open: boolean; editing: Contract | null;
  companies: ErpCompany[]; customers: Customer[]; oses: any[];
  onClose: () => void; onSaved: () => void;
}) {
  const empty = {
    companyId: '', customerId: '', osId: '',
    tipoContrato: 'locacao' as 'locacao' | 'evento',
    descricao: '', dataInicio: new Date().toISOString().slice(0, 10),
    diaVencimento: 10, valorMensal: 0,
    frete: 0,
    renovacaoAutomatica: true, ativo: true,
    pdfUrl: '', observacoes: '',
    dataEvento: '', dataRecolhimento: '', localEvento: '', horaEntrega: '',
    valorTotalEvento: 0,
  };

  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        companyId: editing.companyId || '',
        customerId: editing.customerId || '',
        osId: editing.osId || '',
        tipoContrato: (editing.tipoContrato as any) || 'locacao',
        descricao: editing.descricao || '',
        dataInicio: (editing.dataInicio || '').slice(0, 10),
        diaVencimento: editing.diaVencimento,
        valorMensal: Number(editing.valorMensal),
        frete: Number(editing.frete || 0),
        renovacaoAutomatica: editing.renovacaoAutomatica,
        ativo: editing.ativo,
        pdfUrl: editing.pdfUrl || '',
        observacoes: editing.observacoes || '',
        dataEvento: (editing.dataEvento || '').slice(0, 10),
        dataRecolhimento: (editing.dataRecolhimento || '').slice(0, 10),
        localEvento: editing.localEvento || '',
        horaEntrega: editing.horaEntrega || '',
        valorTotalEvento: Number(editing.valorTotalEvento || 0),
      });

    } else setForm(empty);
    // eslint-disable-next-line
  }, [editing, open]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadSignedPdf(file);
      setForm((f: any) => ({ ...f, pdfUrl: url }));
      toast.success('PDF anexado');
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.companyId || !form.customerId || !form.dataInicio) {
      toast.error('Empresa, cliente e data de início são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        osId: form.osId || null,
        diaVencimento: Number(form.diaVencimento) || 10,
        valorMensal: Number(form.valorMensal) || 0,
        frete: Number(form.frete) || 0,
      };
      if (editing) await contractsService.update(editing.id, payload);
      else await contractsService.create({ ...payload, origem: 'manual' } as any);

      toast.success(editing ? 'Contrato atualizado' : 'Contrato criado');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar Contrato ${editing.numero}` : 'Novo Contrato'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Empresa Emissora *</Label>
            <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cliente *</Label>
            <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.customerName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de contrato *</Label>
            <Select value={form.tipoContrato} onValueChange={(v) => setForm({ ...form, tipoContrato: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="locacao">Locação mensal (obra/recorrente)</SelectItem>
                <SelectItem value="evento">Evento (curta duração)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">OS vinculada (opcional)</Label>
            <Select value={form.osId || '__none__'} onValueChange={(v) => setForm({ ...form, osId: v === '__none__' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="__none__">Nenhuma</SelectItem>
                {oses.map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.numero} — {o.customerName || ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Início do contrato *</Label>
            <Input type="date" value={form.dataInicio}
              onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} />
          </div>
          {form.tipoContrato === 'locacao' ? (
            <>
              <div>
                <Label className="text-xs">Dia de vencimento do boleto (1-28)</Label>
                <Input type="number" min={1} max={28} value={form.diaVencimento}
                  onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Valor mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.valorMensal}
                  onChange={(e) => setForm({ ...form, valorMensal: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs">Data do evento</Label>
                <Input type="date" value={form.dataEvento}
                  onChange={(e) => setForm({ ...form, dataEvento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Hora de entrega</Label>
                <Input type="time" value={form.horaEntrega}
                  onChange={(e) => setForm({ ...form, horaEntrega: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Data de recolhimento</Label>
                <Input type="date" value={form.dataRecolhimento}
                  onChange={(e) => setForm({ ...form, dataRecolhimento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Valor total do evento (R$)</Label>
                <Input type="number" step="0.01" value={form.valorTotalEvento}
                  onChange={(e) => setForm({ ...form, valorTotalEvento: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Local do evento (endereço de entrega)</Label>
                <Input value={form.localEvento}
                  onChange={(e) => setForm({ ...form, localEvento: e.target.value })}
                  placeholder="Rua, número, bairro, cidade/UF" />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <Label className="text-xs">Descrição / objeto do contrato</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder={form.tipoContrato === 'evento'
                ? 'Ex.: 3 banheiros químicos + 1 PNE para evento corporativo'
                : 'Ex.: Locação mensal de 2 sanitários — Obra Castelo Branco'} />
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3 md:col-span-2">
            <div>
              <div className="text-sm font-medium">Renovação automática mensal</div>
              <div className="text-xs text-slate-500">Se ativo, todo mês gera recibo automaticamente para cobrança.</div>
            </div>
            <Switch checked={form.renovacaoAutomatica}
              onCheckedChange={(v) => setForm({ ...form, renovacaoAutomatica: v })} />
          </div>

          {editing && (
            <div className="flex items-center justify-between border rounded-lg p-3 md:col-span-2">
              <div>
                <div className="text-sm font-medium">Contrato ativo</div>
                <div className="text-xs text-slate-500">Desative para encerrar o ciclo de cobrança.</div>
              </div>
              <Switch checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          )}

          <div className="md:col-span-2">
            <Label className="text-xs">Anexar contrato assinado (PDF — opcional)</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept="application/pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                disabled={uploading} />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.pdfUrl && (
                <Button variant="outline" size="sm" onClick={() => window.open(form.pdfUrl, '_blank')}>
                  <FileDown className="h-3.5 w-3.5 mr-1" /> Ver PDF
                </Button>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {editing ? 'Salvar' : 'Criar contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Fallback simple customers fetch (compatível com endpoint /api/customers)
async function fetchCustomers(): Promise<Customer[]> {
  try {
    const t = localStorage.getItem('auth_token');
    const r = await fetch(`${API_BASE_URL}/customers`, {
      headers: t ? { Authorization: `Bearer ${t}` } : undefined,
    });
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : (data?.customers || []);
    }
  } catch {}
  return [];
}
