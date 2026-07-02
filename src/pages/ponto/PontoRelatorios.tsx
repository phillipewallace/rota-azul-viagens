/**
 * Relatórios — exportações oficiais Portaria MTP 671/2021.
 * Geração 100% client-side a partir dos hooks já conectados ao backend.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3, FileDown, FileText, Database, Calendar, Users, Clock, Sigma, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEmployees, useJornadas, usePunches, useJustifications, useSettings } from '@/hooks/usePontoData';
import {
  download, downloadCSV, generateAFD, generateEspelhoCSV, generateFolhaCSV,
  generateHorasExtrasCSV, generateAbsenteismoCSV, generateBancoHorasCSV, generateAnaliticoCSV,
} from './reportGenerators';

type ReportId = 'afd' | 'aej' | 'espelho' | 'folha' | 'extras' | 'absenteismo' | 'banco' | 'analitico';

const reports: { id: ReportId; title: string; desc: string; icon: any; tint: string; accent: string; legal: string }[] = [
  { id: 'afd', title: 'AFD — Arquivo Fonte de Dados', desc: 'Extração completa das batidas em formato oficial (Portaria 671/2021 art. 85).', icon: Database, tint: 'from-emerald-500/10', accent: 'bg-emerald-500', legal: 'Portaria MTP 671/2021' },
  { id: 'aej', title: 'AEJ — Arquivo Eletrônico de Jornada', desc: 'Consolidado da jornada com cálculos de saldo, horas extras e compensações.', icon: ShieldCheck, tint: 'from-teal-500/10', accent: 'bg-teal-500', legal: 'Portaria MTP 671/2021' },
  { id: 'espelho', title: 'Espelho de Ponto', desc: 'Espelho oficial por funcionário, pronto para conferência mensal.', icon: FileText, tint: 'from-sky-500/10', accent: 'bg-sky-500', legal: 'CLT art. 74' },
  { id: 'folha', title: 'Folha de Frequência', desc: 'Consolidado por departamento para envio à folha de pagamento.', icon: Calendar, tint: 'from-violet-500/10', accent: 'bg-violet-500', legal: 'eSocial' },
  { id: 'extras', title: 'Horas Extras & Adicionais', desc: 'Relatório de horas extras por dia e funcionário no período.', icon: Sigma, tint: 'from-amber-500/10', accent: 'bg-amber-500', legal: 'CLT art. 59, 73' },
  { id: 'absenteismo', title: 'Absenteísmo & Atrasos', desc: 'Métricas gerenciais de faltas, atrasos e justificativas.', icon: Users, tint: 'from-rose-500/10', accent: 'bg-rose-500', legal: 'Gestão' },
  { id: 'banco', title: 'Extrato de Banco de Horas', desc: 'Saldo consolidado de banco de horas por funcionário.', icon: Clock, tint: 'from-primary/10', accent: 'bg-primary', legal: 'Lei 13.467/2017' },
  { id: 'analitico', title: 'Analítico Gerencial', desc: 'KPIs consolidados: aderência, HE, batidas e pendências.', icon: BarChart3, tint: 'from-indigo-500/10', accent: 'bg-indigo-500', legal: 'BI' },
];

const monthDefaults = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
};

const PontoRelatorios: React.FC = () => {
  const def = monthDefaults();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [busy, setBusy] = useState<ReportId | null>(null);

  const { data: EMPLOYEES = [], isLoading: le } = useEmployees();
  const { data: JORNADAS = [], isLoading: lj } = useJornadas();
  const { data: PUNCHES = [], isLoading: lp } = usePunches({ from, to: `${to}T23:59:59`, limit: 5000 });
  const { data: JUSTIFICATIONS = [] } = useJustifications();
  const { data: settings } = useSettings();

  const loading = le || lj || lp;

  const gerar = async (id: ReportId) => {
    if (loading) { toast.info('Aguarde o carregamento dos dados.'); return; }
    if (from > to) { toast.error('Período inválido: início posterior ao fim.'); return; }
    if (EMPLOYEES.length === 0) { toast.error('Nenhum funcionário cadastrado.'); return; }
    setBusy(id);
    try {
      const suffix = `${from}_a_${to}`;
      switch (id) {
        case 'afd': {
          if (PUNCHES.length === 0) throw new Error('Sem batidas no período — AFD vazio não pode ser gerado.');
          const empresa = {
            razao_social: settings?.empresa_razao_social ?? settings?.razao_social ?? '',
            cnpj: settings?.empresa_cnpj ?? settings?.cnpj ?? '',
            cei: settings?.cei ?? '',
          };
          if (!empresa.cnpj) throw new Error('Selecione uma empresa emissora em Configurações antes de gerar o AFD.');
          const txt = generateAFD({ empresa, punches: PUNCHES, employees: EMPLOYEES });
          download(`AFD_${suffix}.txt`, txt);
          break;
        }
        case 'aej':
        case 'espelho': {
          const rows = generateEspelhoCSV({ employees: EMPLOYEES, punches: PUNCHES, jornadas: JORNADAS, from, to });
          if (rows.length <= 1) throw new Error('Nada a exportar no período selecionado.');
          downloadCSV(`${id === 'aej' ? 'AEJ' : 'Espelho'}_${suffix}.csv`, rows);
          break;
        }
        case 'folha': {
          const rows = generateFolhaCSV({ employees: EMPLOYEES, punches: PUNCHES, jornadas: JORNADAS, from, to });
          downloadCSV(`FolhaFrequencia_${suffix}.csv`, rows);
          break;
        }
        case 'extras': {
          const rows = generateHorasExtrasCSV({ employees: EMPLOYEES, punches: PUNCHES, jornadas: JORNADAS, from, to });
          if (rows.length <= 1) throw new Error('Nenhuma hora extra no período.');
          downloadCSV(`HorasExtras_${suffix}.csv`, rows);
          break;
        }
        case 'absenteismo': {
          const rows = generateAbsenteismoCSV({ employees: EMPLOYEES, justifications: JUSTIFICATIONS, from, to });
          if (rows.length <= 1) throw new Error('Sem justificativas no período.');
          downloadCSV(`Absenteismo_${suffix}.csv`, rows);
          break;
        }
        case 'banco': {
          const rows = generateBancoHorasCSV({ employees: EMPLOYEES });
          downloadCSV(`BancoHoras_${new Date().toISOString().slice(0,10)}.csv`, rows);
          break;
        }
        case 'analitico': {
          const rows = generateAnaliticoCSV({ employees: EMPLOYEES, punches: PUNCHES, jornadas: JORNADAS, justifications: JUSTIFICATIONS, from, to });
          downloadCSV(`Analitico_${suffix}.csv`, rows);
          break;
        }
      }
      toast.success('Relatório gerado com sucesso.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar relatório.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <BarChart3 className="h-3.5 w-3.5" /> Ponto Digital
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Relatórios & Exportações</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Arquivos oficiais para fiscalização, folha de pagamento e gestão. AFD em .txt (layout oficial); demais em .csv (UTF-8, abre no Excel).
        </p>
      </header>

      <Card className="border-border/60">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="date" className="mt-1" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="date" className="mt-1" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {loading ? (<span className="inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando dados…</span>)
              : (<>Período com <b>{PUNCHES.length}</b> batidas · <b>{EMPLOYEES.length}</b> funcionários</>)}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.id} className={`relative overflow-hidden border-border/60 bg-gradient-to-br ${r.tint} to-transparent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`}>
            <div className={`absolute top-0 left-0 right-0 h-1 ${r.accent}`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={`h-11 w-11 rounded-lg ${r.accent} bg-opacity-15 flex items-center justify-center shrink-0`}>
                  <r.icon className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-[10px]">{r.legal}</Badge>
              </div>
              <h3 className="font-display font-semibold text-sm mt-3">{r.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{r.desc}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => gerar(r.id)} disabled={busy === r.id || loading}>
                  {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Gerar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
        <CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm">Sistema homologável para REP-P</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                Registros com NSR sequencial, assinatura SHA-256 e retenção mínima de 5 anos conforme Portaria MTP 671/2021.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PontoRelatorios;
