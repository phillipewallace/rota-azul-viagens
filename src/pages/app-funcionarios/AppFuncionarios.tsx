import React, { useState, useEffect } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  PackageOpen, PackageCheck, Calendar, MapPin, 
  Camera, LogOut, ClipboardList, CheckCircle2,
  Clock, AlertCircle, ChevronRight, User, ArrowLeft, History
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';
import { logger } from '@/lib/logger';

interface OS {
  id: string;
  numero: string;
  customerName: string;
  customerAddress: string;
  status: 'pendente' | 'entregue' | 'recolhimento_solicitado' | 'fechada';
}

const AppFuncionarios = () => {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'agenda' | 'detalhe'>('login');
  const [mode, setMode] = useState<'agenda' | 'historico'>('agenda');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<OS[]>([]);
  const [selectedOs, setSelectedOs] = useState<OS | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('alchemy_func_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setView('agenda');
      } catch (e) {
        localStorage.removeItem('alchemy_func_user');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf || !password) return toast.error('Preencha todos os campos');
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/funcionarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, password })
      });

      if (!res.ok) throw new Error('Credenciais inválidas');

      const data = await res.json();
      setUser(data);
      localStorage.setItem('alchemy_func_user', JSON.stringify(data));
      setView('agenda');
      toast.success(`Bem-vindo, ${data.nome}!`);
      logger.info('Login realizado com sucesso', { id: data.id });
    } catch (e: any) { 
      logger.error('Erro no login', { message: e.message });
      toast.error('Erro ao conectar com o servidor'); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadOS = async (isHistory = false) => {
    if (!user?.token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os?history=${isHistory}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) { 
      logger.error('Erro ao carregar OS', { error: e.message });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alchemy_func_user');
    setUser(null);
    setView('login');
  };

  useEffect(() => {
    if (view === 'agenda' && user?.token) {
      loadOS(mode === 'historico');
    }
  }, [view, user, mode]);

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm border-none bg-slate-800 text-white">
          <CardHeader className="text-center"><CardTitle>ALCHEMY OPERACIONAL</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} className="bg-slate-700 h-12" />
              <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-700 h-12" />
              <Button type="submit" className="w-full h-12" disabled={loading}>ENTRAR</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b px-4 h-16 flex items-center justify-between">
        <span className="font-bold">Minha Agenda</span>
        <Button variant="ghost" size="icon" onClick={handleLogout}><LogOut /></Button>
      </header>

      <div className="flex p-4 gap-2">
        <Button variant={mode === 'agenda' ? 'default' : 'outline'} onClick={() => setMode('agenda')} className="flex-1 gap-2">
           <Calendar className="w-4 h-4" /> Agenda
        </Button>
        <Button variant={mode === 'historico' ? 'default' : 'outline'} onClick={() => setMode('historico')} className="flex-1 gap-2">
           <History className="w-4 h-4" /> Histórico
        </Button>
      </div>

      <main className="p-4 space-y-3">
        {list.map(os => (
          <Card key={os.id} className="p-4 flex items-center gap-4" onClick={() => { setSelectedOs(os); setView('detalhe'); }}>
             <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><PackageOpen /></div>
             <div className="flex-1">
               <p className="font-bold text-sm">OS #{os.numero}</p>
               <p className="text-xs text-muted-foreground">{os.customerName}</p>
             </div>
             <ChevronRight />
          </Card>
        ))}
      </main>
      
      {view === 'detalhe' && selectedOs && (
        <div className="fixed inset-0 bg-white z-50 p-6">
           <Button variant="ghost" onClick={() => setView('agenda')}><ArrowLeft /> Voltar</Button>
           <h2 className="text-xl font-bold mt-4">{selectedOs.customerName}</h2>
           <p className="text-sm text-muted-foreground mt-2">{selectedOs.customerAddress}</p>
        </div>
      )}
    </div>
  );
};

export default AppFuncionarios;