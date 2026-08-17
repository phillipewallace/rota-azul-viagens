import React, { lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Users, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FuncionariosList = lazy(() => import('./FuncionariosList'));

const FuncionariosPage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Funcionários</h1>
          <p className="text-sm text-muted-foreground">Controle de acessos, CPF e equipe de campo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Equipe</p>
              <p className="text-2xl font-black">-</p>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList>
          <TabsTrigger value="lista" className="gap-2"><Users className="h-4 w-4" /> Todos Funcionários</TabsTrigger>
          <TabsTrigger value="novo" className="gap-2"><UserPlus className="h-4 w-4" /> Admissão</TabsTrigger>
        </TabsList>
        <TabsContent value="lista">
          <Suspense fallback={<div className="p-10 text-center text-muted-foreground">Carregando listagem...</div>}>
            <FuncionariosList />
          </Suspense>
        </TabsContent>
        <TabsContent value="novo">
          <Card className="p-10 text-center border-dashed">
            <p className="text-muted-foreground">Formulário de admissão em desenvolvimento.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FuncionariosPage;
