import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  PackageOpen, PackageCheck, Calendar, MapPin, 
  Camera, LogOut, ClipboardList, CheckCircle2,
  Clock, AlertCircle, ChevronRight, User, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';

interface OS {
  id: string;
  numero: string;
  customerName: string;
  customerAddress: string;
  status: string;
  data_entrega?: string;
}

const AppFuncionarios = () => {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'agenda' | 'detalhe'>('login');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<OS[]>([]);
  const [selectedOs, setSelectedOs] = useState<OS | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/funcionarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, password })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Falha no login');
      }
      const data = await res.json();
      setUser(data);
      setView('agenda');
      loadOS();
    } catch (e: any) { 
      toast.error(e.message || 'CPF ou senha inválidos'); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadOS = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os`);
      const data = await res.json();
      setList(data);
    } catch (e) { toast.error('Erro ao carregar agenda'); }
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm border-none shadow-2xl bg-slate-800 text-white">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black italic tracking-tighter">ALCHEMY OPERACIONAL</CardTitle>
            <p className="text-xs text-slate-400">Acesse com seu CPF e senha</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">CPF</label>
                <Input 
                  placeholder="000.000.000-00" 
                  className="bg-slate-700 border-none text-white h-12"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-500">Senha</label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="bg-slate-700 border-none text-white h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-12 font-bold text-base" disabled={loading}>
                {loading ? 'Entrando...' : 'ENTRAR NO APP'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-sm">Minha Agenda</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setView('login')}>
          <LogOut className="h-5 w-5 text-slate-400" />
        </Button>
      </header>

      <main className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-blue-600 text-white border-none">
            <CardContent className="p-3 flex items-center gap-3">
              <Clock className="h-5 w-5 opacity-50" />
              <div>
                <p className="text-[10px] font-bold opacity-70 uppercase">Hoje</p>
                <p className="text-xl font-black">{list.filter(o => o.status !== 'fechada').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 text-white border-none">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 opacity-50 text-rose-400" />
              <div>
                <p className="text-[10px] font-bold opacity-70 uppercase">Atraso</p>
                <p className="text-xl font-black">0</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest pl-1">Programação</h2>
          {list.map(os => (
            <Card key={os.id} className="border-none shadow-sm overflow-hidden active:scale-95 transition-transform">
              <CardContent className="p-0">
                <button 
                  className="w-full text-left p-4 flex items-center gap-4"
                  onClick={() => { setSelectedOs(os); setView('detalhe'); }}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${os.status === 'entregue' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                    {os.status === 'entregue' ? <PackageCheck className="h-6 w-6" /> : <PackageOpen className="h-6 w-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">OS #{os.numero}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">{os.status}</Badge>
                    </div>
                    <h3 className="font-bold text-sm truncate">{os.customerName}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{os.customerAddress}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 h-16 flex items-center justify-between z-20">
        <button className="flex flex-col items-center gap-1 text-primary">
          <Calendar className="h-6 w-6" />
          <span className="text-[9px] font-bold">Agenda</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <Camera className="h-6 w-6" />
          <span className="text-[9px] font-bold">Estoque</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <User className="h-6 w-6" />
          <span className="text-[9px] font-bold">Perfil</span>
        </button>
      </nav>

      {view === 'detalhe' && selectedOs && (
        <div className="fixed inset-0 bg-white z-30 flex flex-col">
          <header className="px-4 h-16 border-b flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setView('agenda')}><ArrowLeft className="h-5 w-5" /></Button>
            <span className="font-bold">Detalhes da OS</span>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-1">
              <Badge className="bg-blue-600 mb-2">OS #{selectedOs.numero}</Badge>
              <h2 className="text-2xl font-black">{selectedOs.customerName}</h2>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                <span className="text-sm">{selectedOs.customerAddress}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase text-slate-500">Ação Necessária</h3>
              {selectedOs.status === 'entregue' ? (
                 <Button className="w-full h-16 text-lg font-bold gap-3 bg-emerald-600 hover:bg-emerald-700">
                    <PackageCheck className="h-6 w-6" /> REGISTRAR RECOLHIMENTO
                 </Button>
              ) : (
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Número do Sanitário</label>
                      <Input className="h-12 text-lg font-bold" placeholder="Digite o número..." />
                    </div>
                    <Button className="w-full h-16 text-lg font-bold gap-3">
                      <Camera className="h-6 w-6" /> TIRAR FOTO E ENTREGAR
                    </Button>
                 </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default AppFuncionarios;
