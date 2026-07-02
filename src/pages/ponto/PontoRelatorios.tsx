/**
 * Relatórios — exportações oficiais Portaria MTP 671/2021.
 * AFD (art. 85): Arquivo Fonte de Dados. AEJ (art. 86): Arquivo Eletrônico de Jornada.
 * Também espelho de ponto, folha de frequência e resumos analíticos.
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FileDown, FileText, Database, Calendar, Users, Clock, Sigma, ShieldCheck } from 'lucide-react';

const reports = [
  {
    id: 'afd',
    title: 'AFD — Arquivo Fonte de Dados',
    desc: 'Extração completa das batidas em formato oficial (Portaria 671/2021 art. 85). Layout .txt exigido pela fiscalização.',
    icon: Database,
    tint: 'from-emerald-500/10',
    accent: 'bg-emerald-500',
    legal: 'Portaria MTP 671/2021',
  },
  {
    id: 'aej',
    title: 'AEJ — Arquivo Eletrônico de Jornada',
    desc: 'Consolidado da jornada com cálculos de saldo, horas extras e compensações. Assinado digitalmente.',
    icon: ShieldCheck,
    tint: 'from-teal-500/10',
    accent: 'bg-teal-500',
    legal: 'Portaria MTP 671/2021',
  },
  {
    id: 'espelho',
    title: 'Espelho de Ponto (PDF)',
    desc: 'Espelho oficial por funcionário, pronto para assinatura mensal.',
    icon: FileText,
    tint: 'from-sky-500/10',
    accent: 'bg-sky-500',
    legal: 'CLT art. 74',
  },
  {
    id: 'folha',
    title: 'Folha de Frequência',
    desc: 'Consolidado por departamento para envio ao setor de folha de pagamento.',
    icon: Calendar,
    tint: 'from-violet-500/10',
    accent: 'bg-violet-500',
    legal: 'eSocial',
  },
  {
    id: 'extras',
    title: 'Horas Extras & Adicionais',
    desc: 'Relatório de HE 50%, 100%, noturnas e adicional de insalubridade.',
    icon: Sigma,
    tint: 'from-amber-500/10',
    accent: 'bg-amber-500',
    legal: 'CLT art. 59, 73',
  },
  {
    id: 'absenteismo',
    title: 'Absenteísmo & Atrasos',
    desc: 'Métricas gerenciais de faltas, atrasos, saídas antecipadas por período.',
    icon: Users,
    tint: 'from-rose-500/10',
    accent: 'bg-rose-500',
    legal: 'Gestão',
  },
  {
    id: 'banco',
    title: 'Extrato de Banco de Horas',
    desc: 'Movimentação individual com créditos, débitos e compensações no período.',
    icon: Clock,
    tint: 'from-primary/10',
    accent: 'bg-primary',
    legal: 'Lei 13.467/2017',
  },
  {
    id: 'analitico',
    title: 'Analítico Gerencial',
    desc: 'Dashboard consolidado com KPIs de produtividade, custo com HE e desvios.',
    icon: BarChart3,
    tint: 'from-indigo-500/10',
    accent: 'bg-indigo-500',
    legal: 'BI',
  },
];

const PontoRelatorios: React.FC = () => (
  <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
    <header>
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
        <BarChart3 className="h-3.5 w-3.5" /> Ponto Digital
      </div>
      <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Relatórios & Exportações</h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
        Arquivos oficiais para fiscalização do trabalho, folha de pagamento e gestão. Todos os relatórios podem ser gerados em PDF, CSV ou TXT (layout oficial).
      </p>
    </header>

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
              <Button size="sm" variant="outline" className="flex-1 gap-1.5"><FileDown className="h-3.5 w-3.5" /> Gerar</Button>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0"><FileText className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Compliance strip */}
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
      <CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-display font-semibold text-sm">Sistema homologável para REP-P</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Registros com NSR sequencial, assinatura SHA-256, backup redundante e retenção mínima de 5 anos conforme exigido pela Portaria MTP 671/2021.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">Ver documentação técnica</Button>
      </CardContent>
    </Card>
  </div>
);

export default PontoRelatorios;
