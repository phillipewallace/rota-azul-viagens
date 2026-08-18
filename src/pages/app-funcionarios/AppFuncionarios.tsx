import React, { useState, useEffect } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  PackageOpen, PackageCheck, Calendar, MapPin, 
  Camera, LogOut, ClipboardList, CheckCircle2,
  Clock, AlertCircle, ChevronRight, User, ArrowLeft, History,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';
import { logger } from '@/lib/logger';

interface OS {
  id: string;
  numero: string;
  customerName: string;
  customerAddress: string;
  status: 'aberta' | 'despachada' | 'entregue' | 'recolhimento_solicitado' | 'fechada';
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
  const [uploading, setUploading] = useState(false);

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
      setList([]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alchemy_func_user');
    setUser(null);
    setView('login');
    setCpf('');
    setPassword('');
  };

  const handleAction = async (type: 'entrega' | 'recolhimento', osId: string, extraData: any) => {
    setUploading(true);
    try {
      const endpoint = type === 'entrega' ? 'entregar' : 'recolher';
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os/${osId}/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          ...extraData,
          funcionario_id: user.id,
          funcionario_nome: user.nome
        })
      });

      if (!res.ok) throw new Error(`Erro ao registrar ${type}`);
      toast.success(`${type === 'entrega' ? 'Entrega' : 'Recolhimento'} registrado!`);
      setView('agenda');
      loadOS(mode === 'historico');
    } catch (e: any) {
      logger.error(`Erro na ação ${type}`, { error: e.message });
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (view === 'agenda' && user?.token) {
      loadOS(mode === 'historico');
    }
  }, [view, user, mode]);

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <PageMeta title="Login | Alchemy Operacional" noindex />
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
              <Input 
                placeholder="CPF" 
                className="bg-slate-700 border-none text-white h-12"
                value={cpf}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
              />
              <Input 
                type="password" 
                placeholder="Senha" 
                className="bg-slate-700 border-none text-white h-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
      <PageMeta title="Minha Agenda | Alchemy Operacional" noindex />
      <header className="bg-white border-b sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-sm">Minha Agenda</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5 text-slate-400" />
        </Button>
      </header>

      <div className="flex bg-white p-2 sticky top-16 z-10 border-b">
        <Button 
          variant={mode === 'agenda' ? 'default' : 'ghost'} 
          className="flex-1 gap-2"
          onClick={() => setMode('agenda')}
        >
          <Calendar className="w-4 h-4" /> Agenda
        </Button>
        <Button 
          variant={mode === 'historico' ? 'default' : 'ghost'} 
          className="flex-1 gap-2"
          onClick={() => setMode('historico')}
        >
          <History className="w-4 h-4" /> Histórico
        </Button>
      </div>

      <main className="p-4 space-y-3">
        {list.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhuma ordem de serviço encontrada.</p>
          </div>
        )}
        {list.map(os => (
          <Card key={os.id} className="border-none shadow-sm overflow-hidden active:scale-[0.98] transition-all">
            <CardContent className="p-0">
              <button 
                className="w-full text-left p-4 flex items-center gap-4"
                onClick={() => { setSelectedOs(os); setView('detalhe'); }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  os.status === 'entregue' ? 'bg-emerald-100 text-emerald-600' : 
                  os.status === 'recolhimento_solicitado' ? 'bg-amber-100 text-amber-600' :
                  os.status === 'fechada' ? 'bg-slate-100 text-slate-400' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {os.status === 'recolhimento_solicitado' ? <PackageOpen className="h-6 w-6" /> : 
                   os.status === 'entregue' ? <PackageCheck className="h-6 w-6" /> : 
                   os.status === 'fechada' ? <CheckCircle2 className="h-6 w-6" /> :
                   <PackageOpen className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">OS #{os.numero}</span>
                    <Badge variant="outline" className={`text-[9px] uppercase ${os.status === 'recolhimento_solicitado' ? 'border-amber-500 text-amber-600' : ''}`}>
                      {os.status.replace('_', ' ')}
                    </Badge>
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
      </main>

      {view === 'detalhe' && selectedOs && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-right duration-300">
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

            {selectedOs.status !== 'fechada' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-500">Ação Necessária</h3>
                
                {selectedOs.status === 'recolhimento_solicitado' ? (
                  <div className="space-y-4">
                    <p className="text-xs text-amber-600 font-bold bg-amber-50 p-3 rounded-lg border border-amber-200 flex gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Tire no mínimo 3 fotos do estado do sanitário (Galeria ou Câmera).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        className="h-16 flex-col gap-1"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <ImageIcon className="h-5 w-5" /> Galeria
                      </Button>
                      <Button 
                        className="h-16 flex-col gap-1 bg-amber-600 hover:bg-amber-700"
                        onClick={() => document.getElementById('camera-upload')?.click()}
                      >
                        <Camera className="h-5 w-5" /> Câmera
                      </Button>
                    </div>
                    
                    <input 
                      id="file-upload" 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={() => handleAction('recolhimento', selectedOs.id, { fotos: ['https://placehold.co/600x400?text=Recolhimento'] })}
                    />
                    <input 
                      id="camera-upload" 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      multiple 
                      className="hidden" 
                      onChange={() => handleAction('recolhimento', selectedOs.id, { fotos: ['https://placehold.co/600x400?text=Recolhimento'] })}
                    />
                  </div>
                ) : selectedOs.status === 'entregue' ? (
                  <div className="p-8 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 mb-3 opacity-50" />
                    <p className="font-bold text-lg">Sanitário Entregue</p>
                    <p className="text-xs mt-2 opacity-70">Aguardando solicitação de recolhimento pelo ERP.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Número do Sanitário</label>
                      <Input id="san-numero" className="h-14 text-lg font-bold" placeholder="Ex: S-001" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                       <Button 
                          variant="outline" 
                          className="h-16 flex-col gap-1"
                          onClick={() => document.getElementById('file-upload-del')?.click()}
                       >
                          <ImageIcon className="h-5 w-5" /> Galeria
                       </Button>
                       <Button 
                          className="h-16 flex-col gap-1"
                          onClick={() => document.getElementById('camera-upload-del')?.click()}
                       >
                          <Camera className="h-5 w-5" /> Câmera
                       </Button>
                    </div>

                    <input 
                      id="file-upload-del" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const num = (document.getElementById('san-numero') as HTMLInputElement)?.value;
                        if (!num) return toast.error('Informe o número do sanitário primeiro');
                        handleAction('entrega', selectedOs.id, { sanitario_numero: num, fotos: ['https://placehold.co/600x400?text=Entrega'] });
                      }}
                    />
                    <input 
                      id="camera-upload-del" 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => {
                        const num = (document.getElementById('san-numero') as HTMLInputElement)?.value;
                        if (!num) return toast.error('Informe o número do sanitário primeiro');
                        handleAction('entrega', selectedOs.id, { sanitario_numero: num, fotos: ['https://placehold.co/600x400?text=Entrega'] });
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}

      {uploading && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-slate-800 text-sm">Registrando operação...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppFuncionarios;