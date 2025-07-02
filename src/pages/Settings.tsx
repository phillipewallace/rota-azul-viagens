
import React, { useState } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Database, Map, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from 'sonner';

const Settings = () => {
  const [settings, setSettings] = useState({
    // Configurações gerais
    companyName: 'Rota Azul Viagens',
    companyEmail: 'contato@rotaazul.com.br',
    companyPhone: '(11) 99999-9999',
    
    // Configurações de notificação
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    
    // Configurações de segurança
    twoFactorAuth: false,
    sessionTimeout: 30,
    
    // Configurações do sistema
    autoBackup: true,
    maintenanceMode: false,
    debugMode: false,
    
    // Configurações do mapa
    mapProvider: 'google',
    defaultZoom: 15,
    showTraffic: true,
    
    // Configurações mobile
    mobileAccess: true,
    gpsTracking: true,
    offlineMode: false
  });

  const handleSave = () => {
    // Aqui você salvaria as configurações na API
    toast.success('Configurações salvas com sucesso!');
  };

  const handleReset = () => {
    if (window.confirm('Tem certeza que deseja restaurar as configurações padrão?')) {
      setSettings({
        companyName: 'Rota Azul Viagens',
        companyEmail: 'contato@rotaazul.com.br',
        companyPhone: '(11) 99999-9999',
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        twoFactorAuth: false,
        sessionTimeout: 30,
        autoBackup: true,
        maintenanceMode: false,
        debugMode: false,
        mapProvider: 'google',
        defaultZoom: 15,
        showTraffic: true,
        mobileAccess: true,
        gpsTracking: true,
        offlineMode: false
      });
      toast.success('Configurações restauradas para o padrão');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-600 mt-2">Gerencie as configurações do sistema</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              Restaurar Padrão
            </Button>
            <Button onClick={handleSave}>
              Salvar Alterações
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Configurações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
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
                    onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="companyEmail">E-mail</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={settings.companyEmail}
                    onChange={(e) => setSettings({...settings, companyEmail: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="companyPhone">Telefone</Label>
                  <Input
                    id="companyPhone"
                    value={settings.companyPhone}
                    onChange={(e) => setSettings({...settings, companyPhone: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Notificação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
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
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificações por SMS</Label>
                  <p className="text-sm text-gray-600">Receber alertas urgentes por SMS</p>
                </div>
                <Switch
                  checked={settings.smsNotifications}
                  onCheckedChange={(checked) => setSettings({...settings, smsNotifications: checked})}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificações Push</Label>
                  <p className="text-sm text-gray-600">Receber notificações no navegador</p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={(checked) => setSettings({...settings, pushNotifications: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Autenticação de Dois Fatores</Label>
                  <p className="text-sm text-gray-600">Adicionar uma camada extra de segurança</p>
                </div>
                <Switch
                  checked={settings.twoFactorAuth}
                  onCheckedChange={(checked) => setSettings({...settings, twoFactorAuth: checked})}
                />
              </div>
              <Separator />
              <div>
                <Label htmlFor="sessionTimeout">Timeout da Sessão (minutos)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value)})}
                  className="mt-1 max-w-32"
                />
                <p className="text-sm text-gray-600 mt-1">Tempo antes de deslogar automaticamente</p>
              </div>
            </CardContent>
          </Card>

          {/* Configurações do Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Backup Automático</Label>
                  <p className="text-sm text-gray-600">Fazer backup dos dados automaticamente</p>
                </div>
                <Switch
                  checked={settings.autoBackup}
                  onCheckedChange={(checked) => setSettings({...settings, autoBackup: checked})}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo de Manutenção</Label>
                  <p className="text-sm text-gray-600">Desabilitar acesso temporariamente</p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => setSettings({...settings, maintenanceMode: checked})}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo Debug</Label>
                  <p className="text-sm text-gray-600">Exibir informações técnicas detalhadas</p>
                </div>
                <Switch
                  checked={settings.debugMode}
                  onCheckedChange={(checked) => setSettings({...settings, debugMode: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações do Mapa */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Mapa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="defaultZoom">Zoom Padrão</Label>
                <Input
                  id="defaultZoom"
                  type="number"
                  min="1"
                  max="20"
                  value={settings.defaultZoom}
                  onChange={(e) => setSettings({...settings, defaultZoom: parseInt(e.target.value)})}
                  className="mt-1 max-w-32"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Exibir Tráfego</Label>
                  <p className="text-sm text-gray-600">Mostrar informações de tráfego no mapa</p>
                </div>
                <Switch
                  checked={settings.showTraffic}
                  onCheckedChange={(checked) => setSettings({...settings, showTraffic: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações Mobile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Mobile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Acesso Mobile</Label>
                  <p className="text-sm text-gray-600">Permitir acesso via aplicativo mobile</p>
                </div>
                <Switch
                  checked={settings.mobileAccess}
                  onCheckedChange={(checked) => setSettings({...settings, mobileAccess: checked})}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rastreamento GPS</Label>
                  <p className="text-sm text-gray-600">Permitir rastreamento de localização em tempo real</p>
                </div>
                <Switch
                  checked={settings.gpsTracking}
                  onCheckedChange={(checked) => setSettings({...settings, gpsTracking: checked})}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Modo Offline</Label>
                  <p className="text-sm text-gray-600">Permitir uso básico sem conexão à internet</p>
                </div>
                <Switch
                  checked={settings.offlineMode}
                  onCheckedChange={(checked) => setSettings({...settings, offlineMode: checked})}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 mt-8 pb-8">
          <Button variant="outline" onClick={handleReset}>
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave}>
            Salvar Alterações
          </Button>
        </div>
      </div>
      
      {/* Espaço para navegação mobile */}
      <div className="h-20 md:hidden" />
    </div>
  );
};

export default Settings;
