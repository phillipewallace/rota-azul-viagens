/**
 * Registros — tabela completa de batidas com filtros, origem, NSR e geo.
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Search, Download, MapPin, Smartphone, Monitor, Hand, Filter, ShieldCheck } from 'lucide-react';
import { EMPLOYEES, PUNCHES, PunchType, PunchOrigin } from './pontoMock';

const tipoLabel: Record<PunchType, string> = {
  'entrada': 'Entrada',
  'saida-almoco': 'Saída Almoço',
  'volta-almoco': 'Volta Almoço',
  'saida': 'Saída',
};

const tipoColor: Record<PunchType, string> = {
  'entrada': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  'saida-almoco': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  'volta-almoco': 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  'saida': 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};

const originIcon = { web: Monitor, mobile: Smartphone, manual: Hand, importado: Download };

const PontoRegistros: React.FC = () => {
  const [q, setQ] = useState('');
  const [emp, setEmp] = useState<string>('all');
  const [tipo, setTipo] = useState<string>('all');
  const [origem, setOrigem] = useState<string>('all');
  const [date, setDate] = useState<string>('');

  const rows = useMemo(() => {
    return [...PUNCHES]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .filter((p) => {
        if (emp !== 'all' && p.employeeId !== emp) return false;
        if (tipo !== 'all' && p.tipo !== tipo) return false;
        if (origem !== 'all' && p.origem !== origem) return false;
        if (date && !p.timestamp.startsWith(date)) return false;
        if (q) {
          const e = EMPLOYEES.find((x) => x.id === p.employeeId);
          const hay = `${e?.nome} ${e?.matricula} ${p.nsr}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      });
  }, [q, emp, tipo, origem, date]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <Clock className="h-3.5 w-3.5" /> Ponto Digital
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Registros de Ponto</h1>
          <p className="text-sm text-muted-foreground mt-1">Todas as batidas com NSR sequencial, geolocalização e assinatura SHA-256.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Exportar CSV</Button>
          <Button size="sm" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0">
            <Hand className="h-4 w-4" /> Batida Manual
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nome, matrícula ou NSR" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={emp} onValueChange={setEmp}>
              <SelectTrigger><SelectValue placeholder="Funcionário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos funcionários</SelectItem>
                {EMPLOYEES.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(tipoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="importado">Importado</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-24">NSR</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-right">Assinatura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 100).map((p) => {
                  const e = EMPLOYEES.find((x) => x.id === p.employeeId)!;
                  const OrigIcon = originIcon[p.origem as PunchOrigin];
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        #{String(p.nsr).padStart(6, '0')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {e.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[180px]">{e.nome}</p>
                            <p className="text-[11px] text-muted-foreground">Mat. {e.matricula}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${tipoColor[p.tipo]} border`}>{tipoLabel[p.tipo]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        <div>{new Date(p.timestamp).toLocaleDateString('pt-BR')}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                          <OrigIcon className="h-3.5 w-3.5" /> {p.origem}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span className="truncate">{p.endereco}</span>
                        </div>
                        {p.latitude && (
                          <p className="text-[10px] tabular-nums text-muted-foreground/70 ml-5">
                            {p.latitude.toFixed(4)}, {p.longitude!.toFixed(4)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {p.hash}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {rows.length > 100 && (
            <div className="p-3 text-center text-xs text-muted-foreground border-t border-border/60">
              Mostrando 100 de {rows.length} registros
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PontoRegistros;
