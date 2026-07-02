/**
 * Registros — tabela completa de batidas com filtros, origem, NSR, geo e foto facial.
 */
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Clock, Search, Download, MapPin, Smartphone, Monitor, Hand, Filter, ShieldCheck, Camera, ImageOff } from 'lucide-react';
import { PunchType, PunchOrigin, Punch } from './pontoUtils';
import { useEmployees, usePunches, useCreatePunch } from '@/hooks/usePontoData';
import { downloadCSV } from './reportGenerators';
import { toast } from 'sonner';

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
  const [preview, setPreview] = useState<Punch | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<{ funcionario_id: string; tipo: PunchType; timestamp: string; motivo: string }>({
    funcionario_id: '', tipo: 'entrada', timestamp: '', motivo: '',
  });

  const { data: EMPLOYEES = [] } = useEmployees();
  const { data: PUNCHES = [] } = usePunches({ limit: 1000 });
  const createPunch = useCreatePunch();

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
  }, [PUNCHES, EMPLOYEES, q, emp, tipo, origem, date]);

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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!rows.length}
            onClick={() => {
              try {
                const header = ['NSR','Funcionario','Matricula','Tipo','Data','Hora','Origem','Latitude','Longitude','Endereco','Hash'];
                const body = rows.map((p) => {
                  const e = EMPLOYEES.find((x) => x.id === p.employeeId);
                  const d = new Date(p.timestamp);
                  return [
                    p.nsr,
                    e?.nome ?? '',
                    e?.matricula ?? '',
                    tipoLabel[p.tipo],
                    d.toLocaleDateString('pt-BR'),
                    d.toLocaleTimeString('pt-BR'),
                    p.origem,
                    p.latitude ?? '',
                    p.longitude ?? '',
                    p.endereco ?? '',
                    p.hash,
                  ];
                });
                downloadCSV(`registros-ponto-${new Date().toISOString().slice(0,10)}.csv`, [header, ...body]);
                toast.success(`${rows.length} registro(s) exportado(s)`);
              } catch (err: any) {
                toast.error('Falha ao exportar CSV', { description: err?.message });
              }
            }}
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0"
            onClick={() => {
              const now = new Date();
              const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              setManual({ funcionario_id: '', tipo: 'entrada', timestamp: local, motivo: '' });
              setManualOpen(true);
            }}
          >
            <Hand className="h-4 w-4" /> Batida Manual
          </Button>
        </div>
      </header>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Hand className="h-4 w-4 text-emerald-600" /> Batida manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Funcionário *</Label>
              <Select value={manual.funcionario_id} onValueChange={(v) => setManual((s) => ({ ...s, funcionario_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYEES.filter((e) => e.status === 'ativo').map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome} — Mat. {e.matricula}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo *</Label>
                <Select value={manual.tipo} onValueChange={(v) => setManual((s) => ({ ...s, tipo: v as PunchType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data e hora *</Label>
                <Input type="datetime-local" value={manual.timestamp} onChange={(e) => setManual((s) => ({ ...s, timestamp: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Motivo / justificativa *</Label>
              <Input placeholder="Ex.: esquecimento de bater ao entrar" value={manual.motivo} onChange={(e) => setManual((s) => ({ ...s, motivo: e.target.value }))} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Batidas manuais ficam marcadas como <b>origem: manual</b> e preservam NSR sequencial (Portaria 671/2021).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button
              disabled={createPunch.isPending || !manual.funcionario_id || !manual.timestamp || !manual.motivo.trim()}
              onClick={async () => {
                try {
                  await createPunch.mutateAsync({
                    funcionario_id: manual.funcionario_id,
                    tipo: manual.tipo,
                    origem: 'manual',
                    timestamp: new Date(manual.timestamp).toISOString(),
                    endereco: `Manual — ${manual.motivo.trim()}`,
                  });
                  toast.success('Batida manual registrada');
                  setManualOpen(false);
                } catch (err: any) {
                  toast.error('Falha ao registrar batida', { description: err?.message });
                }
              }}
            >
              {createPunch.isPending ? 'Salvando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <TableHead className="w-16">Foto</TableHead>
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
                  const e = EMPLOYEES.find((x) => x.id === p.employeeId);
                  if (!e) return null;
                  const OrigIcon = originIcon[p.origem as PunchOrigin];
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                        #{String(p.nsr).padStart(6, '0')}
                      </TableCell>
                      <TableCell>
                        {p.fotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreview(p)}
                            className="group relative h-10 w-10 rounded-full overflow-hidden ring-1 ring-border hover:ring-2 hover:ring-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all duration-200"
                            aria-label={`Ver foto da batida ${p.nsr}`}
                          >
                            <img
                              src={p.fotoUrl}
                              alt={`Foto de ${e.nome} no momento da batida`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <Camera className="h-3.5 w-3.5 text-emerald-600" />
                            </span>
                          </button>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground/60" title="Sem foto (batida manual)">
                            <ImageOff className="h-4 w-4" />
                          </div>
                        )}
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

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-emerald-600" />
              Captura facial da batida
            </DialogTitle>
          </DialogHeader>
          {preview && (() => {
            const emp = EMPLOYEES.find((x) => x.id === preview.employeeId);
            if (!emp) return null;
            return (
              <div className="space-y-4">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                  <img
                    src={preview.fotoUrl}
                    alt={`Foto de ${emp.nome} — NSR ${preview.nsr}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 rounded-md bg-background/85 backdrop-blur px-2 py-1 font-mono text-[10px] tabular-nums text-foreground/80 ring-1 ring-border">
                    NSR #{String(preview.nsr).padStart(6, '0')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Funcionário</p>
                    <p className="font-medium text-sm mt-0.5">{emp.nome}</p>
                    <p className="text-muted-foreground">Mat. {emp.matricula}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Registrada em</p>
                    <p className="font-medium text-sm mt-0.5 tabular-nums">
                      {new Date(preview.timestamp).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-muted-foreground capitalize">via {preview.origem}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
                  <span>
                    Imagem armazenada de forma criptografada · LGPD art. 11 · retida pelo período legal de 5 anos.
                  </span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PontoRegistros;
