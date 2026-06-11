import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, Save } from 'lucide-react';
import { erpService, type ErpCompany } from '@/services/erp';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MAX = 3;
const empty: Partial<ErpCompany> = {
  razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '',
  endereco: '', cidade: '', estado: '', cep: '', telefone: '', email: '',
  ativo: true,
};

function formatCnpj(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export default function CompaniesSettings() {
  const [list, setList] = useState<ErpCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<ErpCompany>>(empty);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ErpCompany | null>(null);

  const load = async () => {
    setLoading(true);
    try { setList(await erpService.listCompanies()); }
    catch (e: any) { toast.error(e.message || 'Erro ao carregar empresas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.razaoSocial || !form.cnpj) {
      toast.error('Razão Social e CNPJ são obrigatórios');
      return;
    }
    setCreating(true);
    try {
      await erpService.createCompany(form);
      toast.success('Empresa cadastrada');
      setForm(empty);
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao cadastrar'); }
    finally { setCreating(false); }
  };

  const update = async (c: ErpCompany, patch: Partial<ErpCompany>) => {
    setSavingId(c.id);
    try {
      await erpService.updateCompany(c.id, { ...c, ...patch });
      toast.success('Atualizado');
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar'); }
    finally { setSavingId(null); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await erpService.deleteCompany(deleteTarget.id);
      toast.success('Empresa removida');
      setDeleteTarget(null);
      await load();
    } catch (e: any) { toast.error(e.message || 'Erro ao remover'); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Empresas Emissoras (CNPJs)
          </CardTitle>
          <Badge variant="outline">{list.length}/{MAX}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre até {MAX} CNPJs. Serão usados na emissão de Orçamentos e Ordens de Serviço.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <>
            {list.map((c) => (
              <CompanyRow
                key={c.id}
                company={c}
                saving={savingId === c.id}
                onSave={(patch) => update(c, patch)}
                onDelete={() => setDeleteTarget(c)}
              />
            ))}

            {list.length < MAX && (
              <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plus className="h-4 w-4" /> Nova empresa
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Razão Social *" value={form.razaoSocial || ''}
                    onChange={(v) => setForm({ ...form, razaoSocial: v })} />
                  <Field label="Nome Fantasia" value={form.nomeFantasia || ''}
                    onChange={(v) => setForm({ ...form, nomeFantasia: v })} />
                  <Field label="CNPJ *" value={formatCnpj(form.cnpj || '')}
                    onChange={(v) => setForm({ ...form, cnpj: v })} />
                  <Field label="Inscrição Estadual" value={form.inscricaoEstadual || ''}
                    onChange={(v) => setForm({ ...form, inscricaoEstadual: v })} />
                  <Field label="Endereço" value={form.endereco || ''}
                    onChange={(v) => setForm({ ...form, endereco: v })} className="md:col-span-2" />
                  <Field label="Cidade" value={form.cidade || ''}
                    onChange={(v) => setForm({ ...form, cidade: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="UF" value={form.estado || ''}
                      onChange={(v) => setForm({ ...form, estado: v.toUpperCase().slice(0, 2) })} />
                    <Field label="CEP" value={form.cep || ''}
                      onChange={(v) => setForm({ ...form, cep: v })} />
                  </div>
                  <Field label="Telefone" value={form.telefone || ''}
                    onChange={(v) => setForm({ ...form, telefone: v })} />
                  <Field label="E-mail" value={form.email || ''}
                    onChange={(v) => setForm({ ...form, email: v })} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={create} disabled={creating}>
                    <Plus className="h-4 w-4 mr-1" /> {creating ? 'Salvando…' : 'Adicionar Empresa'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover empresa?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.razaoSocial} ({deleteTarget?.cnpj}). Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, className }:
  { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CompanyRow({ company, saving, onSave, onDelete }: {
  company: ErpCompany; saving: boolean;
  onSave: (patch: Partial<ErpCompany>) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState<ErpCompany>(company);
  useEffect(() => setLocal(company), [company]);
  const dirty = JSON.stringify(local) !== JSON.stringify(company);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{company.razaoSocial}</div>
          <div className="text-xs text-muted-foreground">{formatCnpj(company.cnpj)}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs">Ativo</Label>
            <Switch checked={local.ativo}
              onCheckedChange={(v) => setLocal({ ...local, ativo: v })} />
          </div>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Razão Social" value={local.razaoSocial}
          onChange={(v) => setLocal({ ...local, razaoSocial: v })} />
        <Field label="Nome Fantasia" value={local.nomeFantasia || ''}
          onChange={(v) => setLocal({ ...local, nomeFantasia: v })} />
        <Field label="CNPJ" value={formatCnpj(local.cnpj)}
          onChange={(v) => setLocal({ ...local, cnpj: v })} />
        <Field label="Inscrição Estadual" value={local.inscricaoEstadual || ''}
          onChange={(v) => setLocal({ ...local, inscricaoEstadual: v })} />
        <Field label="Endereço" value={local.endereco || ''}
          onChange={(v) => setLocal({ ...local, endereco: v })} className="md:col-span-2" />
        <Field label="Cidade" value={local.cidade || ''}
          onChange={(v) => setLocal({ ...local, cidade: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="UF" value={local.estado || ''}
            onChange={(v) => setLocal({ ...local, estado: v.toUpperCase().slice(0, 2) })} />
          <Field label="CEP" value={local.cep || ''}
            onChange={(v) => setLocal({ ...local, cep: v })} />
        </div>
        <Field label="Telefone" value={local.telefone || ''}
          onChange={(v) => setLocal({ ...local, telefone: v })} />
        <Field label="E-mail" value={local.email || ''}
          onChange={(v) => setLocal({ ...local, email: v })} />
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(local)}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  );
}
