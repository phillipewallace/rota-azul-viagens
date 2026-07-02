/**
 * Funcionários — gestão bruta (sistema principal).
 * Cadastro, edição, exclusão, jornada, banco de horas.
 * O módulo Ponto Digital lê estes dados em modo espelho.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users, Plus, Search, ArrowLeft, Pencil, Trash2, IdCard,
  BadgeCheck, Clock, TrendingUp, TrendingDown, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { funcionariosService, Funcionario, FuncionarioInput, FuncionarioStatus } from '@/services/funcionarios';
import { pontoService, Jornada } from '@/services/ponto';
import { CARGOS } from '@/lib/cargos';

const STATUS_META: Record<FuncionarioStatus, { label: string; className: string; dot: string }> = {
  ativo:     { label: 'Ativo',      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' },
  ferias:    { label: 'Férias',     className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',                dot: 'bg-sky-500' },
  afastado:  { label: 'Afastado',   className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',        dot: 'bg-amber-500' },
  desligado: { label: 'Desligado',  className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',            dot: 'bg-rose-500' },
};

const INITIAL: FuncionarioInput = {
  nome: '', matricula: '', cpf: '', pis: '', rg: '', email: '', telefone: '',
  cargo: '', admissao: '', status: 'ativo', jornada_id: null,
  observacoes: '', password: '',
};


const fmtMinutes = (m: number) => {
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const mm = String(abs % 60).padStart(2, '0');
  return `${m < 0 ? '-' : ''}${h}h${mm}`;
};

const Funcionarios: React.FC = () => {
  const [rows, setRows] = useState<Funcionario[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cargoFilter, setCargoFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<FuncionarioInput>(INITIAL);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Funcionario | null>(null);


  const load = async () => {
    setLoading(true);
    try {
      const [f, j] = await Promise.all([funcionariosService.list(), pontoService.listJornadas()]);
      setRows(f); setJornadas(j);
    } catch (e: any) {
      toast.error('Falha ao carregar', { description: e.message });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const departamentos = useMemo(
    () => [...new Set(rows.map(r => r.departamento).filter(Boolean) as string[])],
    [rows]
  );

  const filtered = useMemo(() => rows.filter(r => {
    if (cargoFilter !== 'all' && (r.cargo ?? '') !== cargoFilter) return false;
    if (status !== 'all' && r.status !== status) return false;
    if (q && !`${r.nome} ${r.matricula} ${r.cargo ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, cargoFilter, status]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const ativos = rows.filter(r => r.status === 'ativo').length;
    const ferias = rows.filter(r => r.status === 'ferias').length;
    const bhSaldo = rows.reduce((s, r) => s + (r.banco_horas_min || 0), 0);
    return { total, ativos, ferias, bhSaldo };
  }, [rows]);

  const startCreate = () => { setEditing(null); setForm(INITIAL); setShowPw(false); setOpen(true); };
  const startEdit = (f: Funcionario) => {
    setEditing(f);
    setForm({
      nome: f.nome, matricula: f.matricula, cpf: f.cpf ?? '', pis: f.pis ?? '',
      rg: f.rg ?? '', email: f.email ?? '', telefone: f.telefone ?? '',
      cargo: f.cargo ?? '',
      admissao: f.admissao ? f.admissao.slice(0, 10) : '',
      status: f.status, jornada_id: f.jornada_id ?? null,
      observacoes: f.observacoes ?? '',
      password: '',
    });
    setShowPw(false);
    setOpen(true);
  };


  const save = async () => {
    if (!form.nome || !form.matricula) {
      toast.error('Nome e matrícula são obrigatórios'); return;
    }
    if (form.password && !form.cpf) {
      toast.error('Informe o CPF — ele é usado como login no Ponto'); return;
    }
    if (form.password && String(form.password).length < 4) {
      toast.error('Senha deve ter ao menos 4 caracteres'); return;
    }
    setSaving(true);
    try {
      const payload: FuncionarioInput = {
        ...form,
        jornada_id: form.jornada_id || null,
        password: form.password ? form.password : undefined,
      };
      if (editing) await funcionariosService.update(editing.id, payload);
      else await funcionariosService.create(payload);
      toast.success(editing ? 'Funcionário atualizado' : 'Funcionário cadastrado');
      setOpen(false); load();
    } catch (e: any) {
      toast.error('Erro ao salvar', { description: e.message });
    } finally { setSaving(false); }
  };


  const remove = async () => {
    if (!confirmDel) return;
    try {
      await funcionariosService.remove(confirmDel.id);
      toast.success('Funcionário removido');
      setConfirmDel(null); load();
    } catch (e: any) {
      toast.error('Erro ao remover', { description: e.message });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.14em] font-medium">
              <Users className="h-3.5 w-3.5" /> Gestão de pessoas
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-1.5">Funcionários</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Cadastro completo dos colaboradores. Estes dados alimentam o módulo <strong className="text-foreground">Ponto Digital</strong> em tempo real.
            </p>
          </div>
          <Button onClick={startCreate} className="gap-2 h-11 px-5 shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" /> Novo funcionário
          </Button>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total',        v: kpis.total,   Icon: Users,      tone: 'from-primary/15 to-primary/5 text-primary' },
            { label: 'Ativos',       v: kpis.ativos,  Icon: BadgeCheck, tone: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
            { label: 'Em férias',    v: kpis.ferias,  Icon: Clock,      tone: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400' },
            { label: 'Saldo banco h.', v: fmtMinutes(kpis.bhSaldo), Icon: kpis.bhSaldo >= 0 ? TrendingUp : TrendingDown,
              tone: kpis.bhSaldo >= 0 ? 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                                       : 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400' },
          ].map(({ label, v, Icon, tone }) => (
            <Card key={label} className={`border-border/60 bg-gradient-to-br ${tone.split(' ').slice(0,2).join(' ')} overflow-hidden`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">{label}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{v}</p>
                </div>
                <Icon className={`h-8 w-8 ${tone.split(' ').slice(2).join(' ')} opacity-70`} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <Card className="border-border/60">
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nome, matrícula, cargo…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10" />
            </div>
            <Select value={dep} onValueChange={setDep}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos departamentos</SelectItem>
                {departamentos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Lista */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-border/60"><CardContent className="p-5 h-40 animate-pulse bg-muted/30" /></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-2 border-border/60">
            <CardContent className="p-12 text-center space-y-3">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum funcionário encontrado.</p>
              <Button onClick={startCreate} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Cadastrar primeiro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(f => {
              const meta = STATUS_META[f.status];
              return (
                <Card key={f.id} className="border-border/60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
                  <div className={`h-1 ${meta.dot}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0 shadow-sm">
                        {f.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-sm truncate">{f.nome}</h3>
                          <Badge variant="outline" className={`${meta.className} border capitalize text-[10px] shrink-0`}>{meta.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          <IdCard className="h-3 w-3 inline mr-1" />Mat. {f.matricula}{f.cargo ? ` · ${f.cargo}` : ''}
                        </p>
                        {f.departamento && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {f.departamento}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Admissão</p>
                        <p className="font-medium mt-0.5 tabular-nums">
                          {f.admissao ? new Date(f.admissao).toLocaleDateString('pt-BR') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Jornada</p>
                        <p className="font-medium mt-0.5 truncate">{f.jornada_nome ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Banco de horas</p>
                        <p className={`font-bold tabular-nums mt-0.5 ${(f.banco_horas_min ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {(f.banco_horas_min ?? 0) >= 0 ? '+' : ''}{fmtMinutes(f.banco_horas_min ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contato</p>
                        <p className="font-medium mt-0.5 truncate">{f.telefone || f.email || '—'}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5" onClick={() => startEdit(f)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                              onClick={() => setConfirmDel(f)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog cadastro/edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle>
            <DialogDescription>
              Dados usados pelo Ponto Digital. Nome e matrícula são obrigatórios.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" value={form.nome ?? ''} onChange={e => setForm(s => ({ ...s, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="matricula">Matrícula *</Label>
              <Input id="matricula" value={form.matricula ?? ''} onChange={e => setForm(s => ({ ...s, matricula: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={form.cpf ?? ''} onChange={e => setForm(s => ({ ...s, cpf: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pis">PIS/PASEP</Label>
              <Input id="pis" value={form.pis ?? ''} onChange={e => setForm(s => ({ ...s, pis: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg">RG</Label>
              <Input id="rg" value={form.rg ?? ''} onChange={e => setForm(s => ({ ...s, rg: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email ?? ''} onChange={e => setForm(s => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={form.telefone ?? ''} onChange={e => setForm(s => ({ ...s, telefone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" value={form.cargo ?? ''} onChange={e => setForm(s => ({ ...s, cargo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="departamento">Departamento</Label>
              <Input id="departamento" value={form.departamento ?? ''} onChange={e => setForm(s => ({ ...s, departamento: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admissao">Admissão</Label>
              <Input id="admissao" type="date" value={form.admissao ?? ''} onChange={e => setForm(s => ({ ...s, admissao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? 'ativo'} onValueChange={v => setForm(s => ({ ...s, status: v as FuncionarioStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jornada</Label>
              <Select value={form.jornada_id ?? 'none'} onValueChange={v => setForm(s => ({ ...s, jornada_id: v === 'none' ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem jornada</SelectItem>
                  {jornadas.map(j => <SelectItem key={j.id} value={j.id}>{j.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salario">Salário base (R$)</Label>
              <Input id="salario" type="number" step="0.01" value={form.salario_base ?? ''}
                     onChange={e => setForm(s => ({ ...s, salario_base: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="obs">Observações</Label>
              <Textarea id="obs" rows={3} value={form.observacoes ?? ''} onChange={e => setForm(s => ({ ...s, observacoes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={o => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga <strong>{confirmDel?.nome}</strong> e todos os registros de ponto vinculados. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-rose-600 hover:bg-rose-700 text-white">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Funcionarios;
