/**
 * Justificativas — CLT art. 473 + abonos e ajustes com aprovação em fluxo.
 * Suporte a seleção múltipla + aprovação/recusa em lote (front-only).
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Scale, CheckCircle2, XCircle, Clock, Plus, Paperclip, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { EMPLOYEES, JUSTIFICATIONS, JustificationStatus, JustificationType } from './pontoMock';

const statusColor: Record<JustificationStatus, string> = {
  pendente: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  aprovada: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  recusada: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};

const tipoLabel: Record<JustificationType, string> = {
  falta: 'Falta',
  atraso: 'Atraso',
  'saida-antecipada': 'Saída antecipada',
  esquecimento: 'Esquecimento',
  atestado: 'Atestado médico',
  folga: 'Folga',
  ferias: 'Férias',
  licenca: 'Licença',
};

const PontoJustificativas: React.FC = () => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [tipo, setTipo] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    return JUSTIFICATIONS.filter((j) => {
      if (status !== 'all' && j.status !== status) return false;
      if (tipo !== 'all' && j.tipo !== tipo) return false;
      if (q) {
        const e = EMPLOYEES.find((x) => x.id === j.employeeId);
        return `${e?.nome} ${j.motivo}`.toLowerCase().includes(q.toLowerCase());
      }
      return true;
    }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [q, status, tipo]);

  const counts = useMemo(() => ({
    pendentes: JUSTIFICATIONS.filter((j) => j.status === 'pendente').length,
    aprovadas: JUSTIFICATIONS.filter((j) => j.status === 'aprovada').length,
    recusadas: JUSTIFICATIONS.filter((j) => j.status === 'recusada').length,
  }), []);

  const pendentesVisiveis = rows.filter((j) => j.status === 'pendente');
  const allChecked = pendentesVisiveis.length > 0 && pendentesVisiveis.every((j) => selected.has(j.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) pendentesVisiveis.forEach((j) => next.delete(j.id));
    else pendentesVisiveis.forEach((j) => next.add(j.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const batchApprove = () => {
    toast.success(`${selected.size} justificativa${selected.size > 1 ? 's' : ''} aprovada${selected.size > 1 ? 's' : ''}`, {
      description: 'Registros atualizados no log de auditoria.',
    });
    setSelected(new Set());
  };
  const batchReject = () => {
    toast.info(`${selected.size} justificativa${selected.size > 1 ? 's' : ''} recusada${selected.size > 1 ? 's' : ''}`);
    setSelected(new Set());
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <Scale className="h-3.5 w-3.5" /> Ponto Digital
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Justificativas & Abonos</h1>
          <p className="text-sm text-muted-foreground mt-1">Ajustes conforme CLT art. 473 (ausências legais) e política interna.</p>
        </div>
        <Button size="sm" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0">
          <Plus className="h-4 w-4" /> Nova justificativa
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendentes', v: counts.pendentes, icon: Clock, tint: 'from-amber-500/10', accent: 'bg-amber-500' },
          { label: 'Aprovadas', v: counts.aprovadas, icon: CheckCircle2, tint: 'from-emerald-500/10', accent: 'bg-emerald-500' },
          { label: 'Recusadas', v: counts.recusadas, icon: XCircle, tint: 'from-rose-500/10', accent: 'bg-rose-500' },
        ].map((k) => (
          <Card key={k.label} className={`relative overflow-hidden bg-gradient-to-br ${k.tint} to-transparent border-border/60`}>
            <div className={`absolute top-0 left-0 right-0 h-1 ${k.accent}`} />
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="font-display text-2xl font-bold tabular-nums mt-1">{k.v}</p>
              </div>
              <k.icon className="h-8 w-8 text-muted-foreground/40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou motivo" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="aprovada">Aprovadas</SelectItem>
              <SelectItem value="recusada">Recusadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(tipoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar pendentes visíveis"
                      disabled={pendentesVisiveis.length === 0}
                    />
                  </TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((j) => {
                  const emp = EMPLOYEES.find((e) => e.id === j.employeeId)!;
                  return (
                    <TableRow key={j.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {emp.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                    <TableRow key={j.id} data-state={selected.has(j.id) ? 'selected' : undefined} className="hover:bg-muted/40 data-[state=selected]:bg-emerald-500/5">
                      <TableCell>
                        {j.status === 'pendente' ? (
                          <Checkbox
                            checked={selected.has(j.id)}
                            onCheckedChange={() => toggleOne(j.id)}
                            aria-label={`Selecionar justificativa de ${emp.nome}`}
                          />
                        ) : (
                          <span className="block h-4 w-4" aria-hidden />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {emp.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{emp.nome}</p>
                            <p className="text-[11px] text-muted-foreground">{emp.cargo}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{tipoLabel[j.tipo]}</Badge></TableCell>
                      <TableCell className="text-sm tabular-nums">{new Date(j.data).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="text-sm line-clamp-2">{j.motivo}</p>
                        {j.anexoUrl && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary mt-1">
                            <Paperclip className="h-3 w-3" /> Anexo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusColor[j.status]} border capitalize`}>{j.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {j.status === 'pendente' ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10">
                              <CheckCircle2 className="h-4 w-4" /> Aprovar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10">
                              <XCircle className="h-4 w-4" /> Recusar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            por {j.revisadoPor} · {j.revisadoEm && new Date(j.revisadoEm).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PontoJustificativas;
