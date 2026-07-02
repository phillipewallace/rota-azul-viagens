/**
 * Configurações do módulo Ponto — jornadas, políticas, integração REP-P.
 * Somente UI (front-only). Toggle-based, sem persistência.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings2, Clock, ShieldCheck, Bell, MapPin, KeyRound, Plus } from 'lucide-react';
import { JORNADAS } from './pontoMock';

const Section: React.FC<{ icon: React.ElementType; title: string; desc: string; children: React.ReactNode }> = ({ icon: Icon, title, desc, children }) => (
  <Card className="border-border/60">
    <CardContent className="p-5 md:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/15 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">{desc}</p>
        </div>
      </div>
      <Separator className="mb-5" />
      {children}
    </CardContent>
  </Card>
);

const Toggle: React.FC<{ label: string; desc?: string; defaultChecked?: boolean }> = ({ label, desc, defaultChecked }) => {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
};

const PontoConfiguracoes: React.FC = () => (
  <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
    <header>
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
        <Settings2 className="h-3.5 w-3.5" /> Ponto Digital
      </div>
      <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Configurações</h1>
      <p className="text-sm text-muted-foreground mt-1">Políticas de jornada, compliance e segurança do sistema de ponto.</p>
    </header>

    <Section icon={Clock} title="Jornadas de trabalho" desc="Modelos aplicados a cada funcionário. Tolerância máxima de 10 minutos por dia (CLT art. 58 §1º).">
      <div className="space-y-3">
        {JORNADAS.map((j) => (
          <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border/60 hover:border-emerald-500/40 transition-colors">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{j.nome}</p>
                <Badge variant="outline" className="text-[10px]">{j.cargaSemanal}h/sem</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {j.entrada} → {j.saidaAlmoco} · {j.voltaAlmoco} → {j.saida} · tolerância {j.tolerancia}min
              </p>
            </div>
            <Button variant="outline" size="sm">Editar</Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-2 border-dashed">
          <Plus className="h-4 w-4" /> Nova jornada
        </Button>
      </div>
    </Section>

    <Section icon={ShieldCheck} title="Compliance & REP-P" desc="Configurações exigidas pela Portaria MTP 671/2021 para sistemas de registro eletrônico de ponto.">
      <div className="divide-y divide-border/60">
        <Toggle label="Assinatura digital SHA-256 nos registros" desc="Cada batida é assinada e imutável. Recomendado." defaultChecked />
        <Toggle label="NSR sequencial global" desc="Número Sequencial de Registro único e crescente." defaultChecked />
        <Toggle label="Bloquear edição de registros originais" desc="Ajustes geram novo registro auditável em vez de alterar o original." defaultChecked />
        <Toggle label="Retenção mínima de 5 anos" desc="Backup automático em nuvem com replicação geográfica." defaultChecked />
        <Toggle label="Exportação automática AFD mensal" desc="Envia o AFD assinado para o e-mail do gestor no dia 1º." />
      </div>
    </Section>

    <Section icon={MapPin} title="Registro por geolocalização" desc="Restringe onde funcionários podem bater ponto pelo app mobile.">
      <div className="divide-y divide-border/60">
        <Toggle label="Exigir GPS ao registrar" desc="Bloqueia batidas sem localização válida." defaultChecked />
        <Toggle label="Cercar por raio geográfico (geofence)" desc="Aceita apenas batidas dentro do perímetro autorizado." />
        <Toggle label="Detectar GPS mock/spoofed" desc="Recusa registros de aplicativos falsificadores de localização." defaultChecked />
        <div className="grid sm:grid-cols-2 gap-3 pt-4">
          <div><Label className="text-xs">Endereço da sede</Label><Input placeholder="Alameda Santos, 1000 — SP" defaultValue="Alameda Santos, 1000 — SP" className="mt-1" /></div>
          <div><Label className="text-xs">Raio permitido (m)</Label><Input type="number" defaultValue={150} className="mt-1" /></div>
        </div>
      </div>
    </Section>

    <Section icon={Bell} title="Notificações" desc="Alertas para gestores e funcionários.">
      <div className="divide-y divide-border/60">
        <Toggle label="Alertar gestor sobre atrasos > 15min" defaultChecked />
        <Toggle label="Aviso de justificativa pendente há mais de 48h" defaultChecked />
        <Toggle label="Resumo semanal de banco de horas" defaultChecked />
        <Toggle label="Aviso de horas extras próximas do limite mensal (Lei 13.467/17)" defaultChecked />
      </div>
    </Section>

    <Section icon={KeyRound} title="Segurança & acesso" desc="Autenticação de gestores e integrações.">
      <div className="divide-y divide-border/60">
        <Toggle label="MFA obrigatório para gestores" defaultChecked />
        <Toggle label="Log de auditoria de acessos" defaultChecked />
      </div>
    </Section>

    <div className="flex justify-end gap-3 pt-2">
      <Button variant="outline">Cancelar</Button>
      <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0">Salvar alterações</Button>
    </div>
  </div>
);

export default PontoConfiguracoes;
