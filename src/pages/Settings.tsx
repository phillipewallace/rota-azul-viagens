
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Bell, Shield, Database } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const Settings = () => {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Configurações" 
        subtitle="Configurações do sistema e preferências"
      />

      <div className="max-w-4xl mx-auto p-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="api">API & Backend</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Configurações Gerais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company">Nome da Empresa</Label>
                    <Input id="company" defaultValue="Rota Azul Viagens" />
                  </div>
                  <div>
                    <Label htmlFor="timezone">Fuso Horário</Label>
                    <Input id="timezone" defaultValue="America/Sao_Paulo" />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="address">Endereço da Empresa</Label>
                  <Input id="address" defaultValue="São Paulo, SP" />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="dark-mode" />
                  <Label htmlFor="dark-mode">Modo Escuro</Label>
                </div>

                <Button>Salvar Configurações</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Alertas de Manutenção</Label>
                      <p className="text-sm text-gray-500">Receber notificações sobre manutenções pendentes</p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Atualizações de Rota</Label>
                      <p className="text-sm text-gray-500">Notificações sobre mudanças nas rotas</p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Relatórios Automáticos</Label>
                      <p className="text-sm text-gray-500">Receber relatórios semanais por email</p>
                    </div>
                    <Switch />
                  </div>
                </div>

                <Button>Salvar Preferências</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="current-password">Senha Atual</Label>
                  <Input id="current-password" type="password" />
                </div>
                
                <div>
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input id="new-password" type="password" />
                </div>
                
                <div>
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input id="confirm-password" type="password" />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="two-factor" />
                  <Label htmlFor="two-factor">Autenticação de Dois Fatores</Label>
                </div>

                <Button>Atualizar Senha</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  API & Backend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="api-url">URL da API Backend</Label>
                  <Input 
                    id="api-url" 
                    placeholder="https://sua-api.com/api" 
                    defaultValue="http://localhost:3001/api"
                  />
                </div>
                
                <div>
                  <Label htmlFor="api-key">Chave da API</Label>
                  <Input 
                    id="api-key" 
                    type="password" 
                    placeholder="Sua chave de API"
                  />
                </div>

                <div>
                  <Label htmlFor="database-url">URL do Banco de Dados</Label>
                  <Input 
                    id="database-url" 
                    placeholder="postgresql://localhost:5432/roteirizador01"
                  />
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-800">Configuração de Backend</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Configure aqui as URLs e chaves para conectar com seu backend personalizado.
                    Certifique-se de que sua API está rodando e acessível.
                  </p>
                </div>

                <Button>Testar Conexão</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
