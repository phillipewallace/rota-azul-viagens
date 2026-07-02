/**
 * Configurações do módulo Ponto — jornadas, políticas, integração REP-P.
 * Persistência real via API (settings + jornadas CRUD).
 */
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2, Clock, ShieldCheck, Bell, MapPin, KeyRound, Plus, Loader2, Building2, AlertCircle } from 'lucide-react';
import { useJornadas, useSettings, useUpdateSettings } from '@/hooks/usePontoData';
import { useQuery } from '@tanstack/react-query';
import { erpService } from '@/services/erp';
import { toast } from 'sonner';
import { JornadaDialog } from './JornadaDialog';
import type { Jornada } from './pontoUtils';
import { Link } from 'react-router-dom';

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

const Row: React.FC<{ label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, desc, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="min-w-0">
      <p className="text-sm font-medium">{label}</p>
      {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const PontoConfiguracoes: React.FC = () => {
  const { data: JORNADAS = [] } = useJornadas();
  const { data: settings } = useSettings();
  const updateMut = useUpdateSettings();
  const { data: companies = [], isLoading: loadingCompanies, isError: errCompanies } = useQuery({
    queryKey: ['erp', 'companies'],
    queryFn: () => erpService.listCompanies(),
    staleTime: 60_000,
  });
  const [jornadaOpen, setJornadaOpen] = useState(false);
  const [jornadaEdit, setJornadaEdit] = useState<Jornada | null>(null);

  const [form, setForm] = useState({
    empresa_emissora_id: '' as string | null | '',
    fuso_horario: 'America/Sao_Paulo',
    usar_geoloc: true, exigir_foto: true, banco_horas_ativo: true,
    limite_credito_min: 2400, limite_debito_min: -1200,
  });

  useEffect(() => {
    if (settings) setForm((f) => ({
      ...f,
      empresa_emissora_id: settings.empresa_emissora_id ?? '',
      fuso_horario: settings.fuso_horario ?? 'America/Sao_Paulo',
      usar_geoloc: settings.usar_geoloc,
      exigir_foto: settings.exigir_foto,
      banco_horas_ativo: settings.banco_horas_ativo,
      limite_credito_min: settings.limite_credito_min,
      limite_debito_min: settings.limite_debito_min,
    }));
  }, [settings]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const selectedCompany = companies.find((c) => c.id === form.empresa_emissora_id);

  const salvar = async () => {
    try {
      await updateMut.mutateAsync({
        ...form,
        empresa_emissora_id: form.empresa_emissora_id || null,
      } as any);
      toast.success('Configurações salvas com sucesso.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar configurações.');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
          <Settings2 className="h-3.5 w-3.5" /> Ponto Digital
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mt-1">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Políticas de jornada, compliance e segurança do sistema de ponto.</p>
      </header>

      <Section icon={ShieldCheck} title="Empresa (REP-P)" desc="Dados exigidos no cabeçalho do AFD e relatórios oficiais (Portaria MTP 671/2021).">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Razão Social</Label><Input className="mt-1" value={form.razao_social ?? ''} onChange={(e) => set('razao_social', e.target.value)} /></div>
          <div><Label className="text-xs">CNPJ</Label><Input className="mt-1" value={form.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} /></div>
          <div><Label className="text-xs">CEI/CAEPF (opcional)</Label><Input className="mt-1" value={form.cei ?? ''} onChange={(e) => set('cei', e.target.value)} /></div>
          <div><Label className="text-xs">Fuso horário</Label><Input className="mt-1" value={form.fuso_horario} onChange={(e) => set('fuso_horario', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Endereço da sede</Label><Input className="mt-1" value={form.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} /></div>
        </div>
      </Section>

      <Section icon={Clock} title="Jornadas de trabalho" desc="Modelos aplicados a cada funcionário. Tolerância máxima de 10 minutos por dia (CLT art. 58 §1º).">
        <div className="space-y-3">
          {JORNADAS.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma jornada cadastrada ainda.</p>
          )}
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
              <Button variant="outline" size="sm" onClick={() => { setJornadaEdit(j); setJornadaOpen(true); }}>Editar</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full gap-2 border-dashed" onClick={() => { setJornadaEdit(null); setJornadaOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova jornada
          </Button>
        </div>
      </Section>

      <Section icon={MapPin} title="Registro & captura" desc="Regras para o app mobile e para o registro no portal web.">
        <div className="divide-y divide-border/60">
          <Row label="Exigir foto do funcionário na batida" desc="Recomendado para prevenir fraudes." checked={form.exigir_foto} onChange={(v) => set('exigir_foto', v)} />
          <Row label="Exigir geolocalização (GPS)" desc="Bloqueia batidas sem localização válida." checked={form.usar_geoloc} onChange={(v) => set('usar_geoloc', v)} />
        </div>
      </Section>

      <Section icon={Clock} title="Banco de horas" desc="Compensação conforme Lei 13.467/2017. Limites em minutos.">
        <div className="divide-y divide-border/60">
          <Row label="Banco de horas ativo" checked={form.banco_horas_ativo} onChange={(v) => set('banco_horas_ativo', v)} />
          <div className="grid sm:grid-cols-2 gap-3 pt-4">
            <div><Label className="text-xs">Limite de crédito (min)</Label><Input type="number" className="mt-1" value={form.limite_credito_min} onChange={(e) => set('limite_credito_min', Number(e.target.value))} /></div>
            <div><Label className="text-xs">Limite de débito (min)</Label><Input type="number" className="mt-1" value={form.limite_debito_min} onChange={(e) => set('limite_debito_min', Number(e.target.value))} /></div>
          </div>
        </div>
      </Section>

      <Section icon={Bell} title="Compliance" desc="Recursos exigidos pela Portaria MTP 671/2021.">
        <div className="divide-y divide-border/60">
          <div className="py-3 flex items-center justify-between"><span className="text-sm">Assinatura SHA-256 nos registros</span><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">Ativo</Badge></div>
          <div className="py-3 flex items-center justify-between"><span className="text-sm">NSR sequencial global</span><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">Ativo</Badge></div>
          <div className="py-3 flex items-center justify-between"><span className="text-sm">Registros imutáveis (ajuste gera novo registro)</span><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">Ativo</Badge></div>
        </div>
      </Section>

      <Section icon={KeyRound} title="Segurança & acesso" desc="Autenticação de gestores e integrações.">
        <div className="divide-y divide-border/60">
          <div className="py-3 flex items-center justify-between"><span className="text-sm">Autenticação obrigatória (JWT)</span><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">Ativo</Badge></div>
          <div className="py-3 flex items-center justify-between"><span className="text-sm">Log de auditoria de acessos</span><Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0">Ativo</Badge></div>
        </div>
      </Section>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => settings && setForm((f) => ({ ...f, ...settings }))}>Cancelar</Button>
        <Button disabled={updateMut.isPending} onClick={salvar} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-0 gap-2">
          {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      </div>

      <JornadaDialog open={jornadaOpen} onClose={() => setJornadaOpen(false)} jornada={jornadaEdit} />
    </div>
  );
};

export default PontoConfiguracoes;
