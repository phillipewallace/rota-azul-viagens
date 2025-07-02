
import React, { useState } from 'react';
import { Save, Globe, Bell, Shield, Database, MapPin, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';

const Settings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    companyName: 'Rota Azul Viagens',
    email: 'contato@rotaazul.com.br',
    phone: '(31) 99999-9999',
    address: 'Rua das Empresas, 123 - Belo Horizonte, MG',
    notifications: {
      email: true,
      sms: false,
      push: true,
      maintenance: true,
      routes: true
    },
    map: {
      provider: 'google',
      apiKey: '',
      defaultZoom: 12,
      showTraffic: true
    },
    system: {
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      autoBackup: true,
      backupFrequency: 'daily'
    }
  });

  const handleSave = () => {
    // Aqui você implementaria a lógica de salvamento
    toast({
      title: "Configurações salvas com sucesso!",
      description: "Todas as alterações foram aplicadas.",
    });
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Configurações" 
        subtitle="Gerencie as configurações do sistema"
        showBackButton={true}
      >
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Salvar Alterações
        </Button>
      </PageHeader>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Informações da Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Informações da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(e) => updateSetting('companyName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => updateSetting('email', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={settings.phone}
                  onChange={(e) => updateSetting('phone', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => updateSetting('address', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações por E-mail</Label>
                <p className="text-sm text-gray-600">Receber notificações importantes por e-mail</p>
              </div>
              <Switch
                checked={settings.notifications.email}
                onCheckedChange={(checked) => updateSetting('notifications.email', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações SMS</Label>
                <p className="text-sm text-gray-600">Receber alertas urgentes por SMS</p>
              </div>
              <Switch
                checked={settings.notifications.sms}
                onCheckedChange={(checked) => updateSetting('notifications.sms', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações Push</Label>
                <p className="text-sm text-gray-600">Receber notificações no navegador</p>
              </div>
              <Switch
                checked={settings.notifications.push}
                onCheckedChange={(checked) => updateSetting('notifications.push', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas de Manutenção</Label>
                <p className="text-sm text-gray-600">Notificar sobre manutenções pendentes</p>
              </div>
              <Switch
                checked={settings.notifications.maintenance}
                onCheckedChange={(checked) => updateSetting('notifications.maintenance', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas de Rotas</Label>
                <p className="text-sm text-gray-600">Notificar sobre status das rotas</p>
              </div>
              <Switch
                checked={settings.notifications.routes}
                onCheckedChange={(checked) => updateSetting('notifications.routes', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configurações do Mapa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Configurações do Mapa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mapProvider">Provedor do Mapa</Label>
              <Select value={settings.map.provider} onValueChange={(value) => updateSetting('map.provider', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Maps</SelectItem>
                  <SelectItem value="mapbox">Mapbox</SelectItem>
                  <SelectItem value="openstreet">OpenStreetMap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="apiKey">Chave da API</Label>
              <Input
                id="apiKey"
                type="password"
                value={settings.map.apiKey}
                onChange={(e) => updateSetting('map.apiKey', e.target.value)}
                placeholder="Insira a chave da API do mapa"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="defaultZoom">Zoom Padrão</Label>
                <Select value={settings.map.defaultZoom.toString()} onValueChange={(value) => updateSetting('map.defaultZoom', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 - Cidade</SelectItem>
                    <SelectItem value="12">12 - Bairro</SelectItem>
                    <SelectItem value="14">14 - Rua</SelectItem>
                    <SelectItem value="16">16 - Detalhado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Mostrar Trânsito</Label>
                <p className="text-sm text-gray-600">Exibir informações de trânsito no mapa</p>
              </div>
              <Switch
                checked={settings.map.showTraffic}
                onCheckedChange={(checked) => updateSetting('map.showTraffic', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configurações do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="language">Idioma</Label>
                <Select value={settings.system.language} onValueChange={(value) => updateSetting('system.language', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="es-ES">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="timezone">Fuso Horário</Label>
                <Select value={settings.system.timezone} onValueChange={(value) => updateSetting('system.timezone', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                    <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                    <SelectItem value="America/Rio_Branco">Rio Branco (GMT-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Backup Automático</Label>
                <p className="text-sm text-gray-600">Fazer backup automático dos dados</p>
              </div>
              <Switch
                checked={settings.system.autoBackup}
                onCheckedChange={(checked) => updateSetting('system.autoBackup', checked)}
              />
            </div>
            {settings.system.autoBackup && (
              <div>
                <Label htmlFor="backupFrequency">Frequência do Backup</Label>
                <Select value={settings.system.backupFrequency} onValueChange={(value) => updateSetting('system.backupFrequency', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">A cada hora</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensalmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
