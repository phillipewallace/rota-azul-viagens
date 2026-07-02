/**
 * PontoFuncionarios — espelho somente-leitura do cadastro do sistema principal.
 * A gestão bruta acontece em /funcionarios (main). Aqui apenas visualiza-se
 * quem está no ponto, jornadas e saldos.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, Mail, Phone, Briefcase, ExternalLink, Lock } from 'lucide-react';
import { funcionariosService, Funcionario, FuncionarioStatus } from '@/services/funcionarios';

const statusColor: Record<FuncionarioStatus, string> = {
  ativo:     'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  ferias:    'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  afastado:  'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  desligado: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};

const fmtMinutes = (m: number) => {
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const mm = String(abs % 60).padStart(2, '0');
  return `${m < 0 ? '-' : ''}${h}h${mm}`;
};

const PontoFuncionarios: React.FC = () => {
  const [rows, setRows] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [dep, setDep] = useState('all');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    funcionariosService.list()
      .then(setRows)
      .catch(e => toast.error('Falha ao carregar', { description: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const departamentos = useMemo(
    () => [...new Set(rows.map(r => r.departamento).filter(Boolean) as string[])],
    [rows]
  );

  const filtered = useMemo(() => rows.filter(e => {
    if (dep !== 'all' && e.departamento !== dep) return false;
    if (status !== 'all' && e.status !== status) return false;
    if (q && !`${e.nome} ${e.matricula} ${e.cargo ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, dep, status]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <Users className="h-3.5 w-3.5" /> Ponto Digital
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Funcionários</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
            <Lock className="h-3.5 w-3.5" />
            Somente-leitura. Cadastro bruto é feito no
            <Link to="/funcionarios" className="text-primary hover:underline inline-flex items-center gap-0.5">
              sistema principal <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/funcionarios">Gerenciar no principal <ExternalLink className="h-3.5 w-3.5" /></Link>
        </Button>
      </header>

      <Card className="border-border/60">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nome, matrícula ou cargo" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={dep} onValueChange={setDep}>
            <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos departamentos</SelectItem>
              {departamentos.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="ferias">Em férias</SelectItem>
              <SelectItem value="afastado">Afastados</SelectItem>
              <SelectItem value="desligado">Desligados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/60"><CardContent className="p-5 h-40 animate-pulse bg-muted/30" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((e) => (
            <Card key={e.id} className="border-border/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {e.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{e.nome}</h3>
                    <p className="text-xs text-muted-foreground truncate">Mat. {e.matricula}{e.cargo ? ` · ${e.cargo}` : ''}</p>
                    <Badge variant="outline" className={`${statusColor[e.status]} border capitalize mt-2 text-[10px]`}>{e.status}</Badge>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Departamento</p>
                    <p className="font-medium mt-0.5 flex items-center gap-1"><Briefcase className="h-3 w-3" /> {e.departamento ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Admissão</p>
                    <p className="font-medium mt-0.5 tabular-nums">{e.admissao ? new Date(e.admissao).toLocaleDateString('pt-BR') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Jornada</p>
                    <p className="font-medium mt-0.5 truncate">{e.jornada_nome ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Banco de horas</p>
                    <p className={`font-bold tabular-nums mt-0.5 ${(e.banco_horas_min ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {(e.banco_horas_min ?? 0) >= 0 ? '+' : ''}{fmtMinutes(e.banco_horas_min ?? 0)}
                    </p>
                  </div>
                </div>

                {(e.email || e.telefone) && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                    {e.email && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate"><Mail className="h-3 w-3" /> {e.email}</p>}
                    {e.telefone && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Phone className="h-3 w-3" /> {e.telefone}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PontoFuncionarios;
