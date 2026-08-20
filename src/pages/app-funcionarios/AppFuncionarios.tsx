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
  Image as ImageIcon, Plus, Info, Check, X, Phone, MessageSquare, Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';
import { logger } from '@/lib/logger';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface OS {
  id: string;
  numero: string;
  customerName: string;
  customerAddress: string;
  status: 'aberta' | 'despachada' | 'entregue' | 'recolhimento_solicitado' | 'fechada';
}

const AppFuncionarios = () => {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'agenda' | 'detalhe' | 'perfil'>('login');
  const [mode, setMode] = useState<'agenda' | 'historico' | 'checklist'>('agenda');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<OS[]>([]);
  const [selectedOs, setSelectedOs] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [osSanitarios, setOsSanitarios] = useState<any[]>([]);
  const [addingSanitario, setAddingSanitario] = useState(false);
  const [genericServiceDialog, setGenericServiceDialog] = useState(false);
  const [genericForm, setGenericForm] = useState({
    observacoes: '',
    fotos: [] as string[]
  });
  const [newSanForm, setNewSanForm] = useState({ 
    numero: '', 
    categoria: 'comum', 
    estado_atual: 'bom' 
  });

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

  useEffect(() => {
    if (user) {
      loadOS(mode === 'historico');
    }
  }, [user, mode, selectedDate]);

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

  const handleLogout = () => {
    localStorage.removeItem('alchemy_func_user');
    setUser(null);
    setView('login');
    setCpf('');
    setPassword('');
  };

  const loadOS = async (isHistory = false) => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os?history=${isHistory}&date=${selectedDate}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) { 
      logger.error('Erro ao carregar OS', { error: e.message });
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOsSanitarios = async (osId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os/${osId}/sanitarios`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) setOsSanitarios(await res.json());
    } catch (e) {}
  };

  const handleAction = async (type: 'entrega' | 'recolhimento', osId: string, extraData: any) => {
    setUploading(true);
    try {
      const endpoint = type === 'entrega' ? 'entregar-item' : 'recolher-item';
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os/${osId}/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          ...extraData,
          funcionario_id: user.funcionario_id || user.id,
          funcionario_nome: user.nome
        })
      });

      if (!res.ok) throw new Error(`Erro ao registrar ${type}`);
      toast.success(`${type === 'entrega' ? 'Entrega' : 'Recolhimento'} registrado!`);
      
      await loadOsSanitarios(osId);
      await loadOS(mode === 'historico');
      
      if (extraData.is_last_item) {
        setView('agenda');
        setSelectedOs(null);
      }
    } catch (e: any) {
      logger.error(`Erro na ação ${type}`, { error: e.message });
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAssumirOS = async (osId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os/${osId}/assumir`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      if (!res.ok) throw new Error('Erro ao assumir OS');
      toast.success('Você assumiu esta OS!');
      await loadOS();
      // Atualiza o selectedOs com os dados novos vindos do loadOS (incluindo items)
      const freshList = await fetch(`${API_BASE_URL}/app-funcionarios/os?history=false&date=${selectedDate}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      }).then(r => r.json());
      const fresh = freshList.find((o: any) => o.id === osId);
      if (fresh) {
        setSelectedOs(fresh);
        setView('detalhe');
        loadOsSanitarios(osId);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDesvincularOS = async (osId: string) => {
    if (!confirm('Deseja realmente soltar esta OS e devolvê-la para a fila global?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/app-funcionarios/os/${osId}/desvincular`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao desvincular OS');
      }
      toast.success('OS devolvida para a fila global');
      setView('agenda');
      setSelectedOs(null);
      await loadOS();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
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
        <Card className="w-full max-w-sm border-none shadow-2xl bg-slate-800 text-white rounded-[2.5rem] p-4">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-black italic tracking-tighter">ALCHEMY <span className="text-primary">OPS</span></CardTitle>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Portal do Funcionário</p>
            <p className="text-xs text-slate-400">Acesse com seu CPF e senha</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">CPF</label>
                <Input 
                  placeholder="000.000.000-00" 
                  className="bg-slate-700/50 border-none text-white h-14 rounded-2xl focus:ring-2 focus:ring-primary"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Senha</label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="bg-slate-700/50 border-none text-white h-14 rounded-2xl focus:ring-2 focus:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-14 font-black text-lg rounded-2xl shadow-xl shadow-primary/20 mt-4" disabled={loading}>
                {loading ? 'ACESSANDO...' : 'ENTRAR NO APP'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <PageMeta title="Minha Agenda | Alchemy Operacional" noindex />
      <header className="bg-white border-b sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tighter">Alchemy<span className="text-primary">Ops</span></span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => loadOS(mode === 'historico')}>
            <Clock className="h-5 w-5 text-slate-400" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5 text-slate-400" />
          </Button>
        </div>
      </header>

      {/* Seletor de Datas Semanal */}
      <div className="bg-white border-b px-2 py-4 flex gap-3 overflow-x-auto no-scrollbar scroll-smooth">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const iso = d.toISOString().split('T')[0];
          const isSelected = selectedDate === iso;
          const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          return (
            <button
              key={iso}
              onClick={() => setSelectedDate(iso)}
              className={`flex flex-col items-center justify-center min-w-[3.5rem] h-20 rounded-2xl transition-all duration-300 ${
                isSelected 
                ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105' 
                : 'bg-slate-50 text-slate-400'
              }`}
            >
              <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                {labels[d.getDay()]}
              </span>
              <span className="text-xl font-black">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <main className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            {mode === 'agenda' ? 'Ordens do Dia' : 'Histórico Recente'}
          </h3>
          <Badge className="bg-slate-100 text-slate-500 border-none font-bold">{list.length} OS</Badge>
        </div>
        {list.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhuma ordem de serviço encontrada.</p>
          </div>
        )}
        {list.map(os => (
          <Card key={os.id} className="border-none shadow-sm overflow-hidden active:scale-[0.97] transition-all bg-white rounded-2xl">
            <CardContent className="p-0">
              <button 
                className="w-full text-left p-5 flex items-center gap-4"
                onClick={() => { setSelectedOs(os); setView('detalhe'); loadOsSanitarios(os.id); setGenericForm({ observacoes: '', fotos: [] }); }}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                  os.status === 'entregue' ? 'bg-emerald-50 text-emerald-600' : 
                  os.status === 'recolhimento_solicitado' ? 'bg-amber-50 text-amber-600' :
                  os.status === 'fechada' ? 'bg-slate-50 text-slate-400' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  {os.status === 'recolhimento_solicitado' ? <PackageOpen className="h-7 w-7" /> : 
                   os.status === 'entregue' ? <PackageCheck className="h-7 w-7" /> : 
                   os.status === 'fechada' ? <CheckCircle2 className="h-7 w-7" /> :
                   <PackageOpen className="h-7 w-7" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge className={`px-2.5 py-0.5 text-[9px] font-black uppercase rounded-full ${
                      os.status === 'aberta' ? 'bg-blue-500 shadow-lg shadow-blue-200' :
                      os.status === 'despachada' ? 'bg-amber-500 shadow-lg shadow-amber-200' :
                      os.status === 'entregue' ? 'bg-emerald-500 shadow-lg shadow-emerald-200' :
                      'bg-slate-400'
                    }`}>
                      {os.status === 'aberta' ? 'Disponível' : os.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-[10px] font-black text-slate-400 tracking-tighter">OS #{os.numero}</span>
                  </div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight truncate mb-1">{os.customerName}</h4>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    {os.customerAddress}
                  </p>
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100">
                   <ChevronRight className="w-6 h-6 text-slate-300" />
                </div>
              </button>
            </CardContent>
          </Card>
        ))}
      </main>

      {view === 'detalhe' && selectedOs && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-right duration-300">
          <header className="px-4 h-16 border-b flex items-center gap-4 bg-white sticky top-0 z-10">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setView('agenda')}><ArrowLeft className="h-5 w-5" /></Button>
            <span className="font-bold text-lg">Detalhes da OS</span>
          </header>
          <main className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4 relative">
              {selectedOs.status === 'despachada' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute top-6 right-6 text-red-500 hover:text-red-700 hover:bg-red-50 font-bold text-[10px] uppercase tracking-tighter gap-1"
                  onClick={() => handleDesvincularOS(selectedOs.id)}
                >
                  <X className="h-3 w-3" /> SOLTAR OS
                </Button>
              )}
              
              <div className="flex flex-wrap gap-2 mb-1">
                <Badge className="bg-primary text-white font-black tracking-widest px-3 py-1 rounded-full text-[10px]">OS #{selectedOs.numero}</Badge>
                {selectedOs.tipoLocacao && (
                  <Badge variant="outline" className="border-primary/30 text-primary font-black uppercase tracking-widest px-3 py-1 rounded-full text-[10px]">
                    {selectedOs.tipoLocacao === 'obra' ? '🏗️ OBRA' : selectedOs.tipoLocacao === 'evento' ? '🎉 EVENTO' : selectedOs.tipoLocacao.toUpperCase()}
                  </Badge>
                )}
                <Badge className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${
                  selectedOs.status === 'aberta' ? 'bg-blue-500 text-white' :
                  selectedOs.status === 'despachada' ? 'bg-amber-500 text-white' :
                  selectedOs.status === 'entregue' ? 'bg-emerald-500 text-white' :
                  'bg-slate-400 text-white'
                }`}>
                  {selectedOs.status === 'aberta' ? 'Disponível' : selectedOs.status.replace('_', ' ')}
                </Badge>
              </div>

              <h2 className="text-3xl font-black text-slate-800 leading-tight">{selectedOs.customerName}</h2>
              {selectedOs.responsavelNome && (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest -mt-2 mb-2">
                  Resp: {selectedOs.responsavelNome}
                </p>
              )}
              
              <div className="flex items-start gap-3 text-slate-500 bg-slate-50 p-4 rounded-3xl">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <span className="text-sm font-medium leading-relaxed block">{selectedOs.customerAddress}</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="rounded-xl h-10 gap-2 font-bold text-[10px] uppercase border-slate-200"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOs.customerAddress)}`, '_blank')}
                    >
                      <Navigation className="h-3.5 w-3.5 text-primary" /> Rota
                    </Button>
                    {selectedOs.customerPhone && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-xl h-10 gap-2 font-bold text-[10px] uppercase border-slate-200"
                          onClick={() => window.open(`tel:${selectedOs.customerPhone}`, '_self')}
                        >
                          <Phone className="h-3.5 w-3.5 text-primary" /> Ligar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-xl h-10 gap-2 font-bold text-[10px] uppercase border-slate-200"
                          onClick={() => window.open(`https://wa.me/55${selectedOs.customerPhone.replace(/\D/g, '')}`, '_blank')}
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-primary" /> WhatsApp
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo de Itens Pedidos - Agrupado por Tipo */}
            {selectedOs.items && selectedOs.items.length > 0 && (
              <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Locação / Serviços</h3>
                  <Badge variant="outline" className="border-white/10 text-white/40 text-[9px] font-black tracking-widest">PEDIDO ORIGINAL</Badge>
                </div>
                <div className="space-y-4">
                  {Object.values(selectedOs.items.reduce((acc: any, it: any) => {
                    const key = `${it.produto}-${it.isSanitario ? 'S' : 'G'}`;
                    if (!acc[key]) acc[key] = { ...it, quantidade: 0 };
                    acc[key].quantidade += Number(it.quantidade) || 0;
                    return acc;
                  }, {})).map((it: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 shadow-inner">
                          <span className="text-primary font-black text-lg">{it.quantidade}</span>
                        </div>
                        <div className="space-y-1">
                          <p className="font-black text-sm leading-tight tracking-tight uppercase">{it.produto}</p>
                          <div className="flex gap-1.5">
                            {it.isSanitario && <span className="text-[8px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-[0.1em]">Ativo</span>}
                            {!it.isSanitario && it.isGenericService && <span className="text-[8px] font-black bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-[0.1em]">Serviço</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedOs.status !== 'fechada' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Sanitários Vinculados</h3>
                  <Badge variant="outline">{osSanitarios.length} un</Badge>
                </div>

                <div className="space-y-3">
                  {osSanitarios.map(s => (
                    <div key={s.id} className="p-5 bg-white border border-slate-100 shadow-sm rounded-3xl flex justify-between items-center transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-200">
                           {s.ultimaFotoUrl ? (
                             <img src={s.ultimaFotoUrl} alt="Sanitário" className="w-full h-full object-cover" />
                           ) : (
                             <PackageOpen className="w-7 h-7 text-slate-400" />
                           )}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-lg leading-none mb-1">#{s.numero}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.categoria}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.devolvido_em ? (
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold px-3 py-1 rounded-full">Recolhido</Badge>
                        ) : selectedOs.status === 'recolhimento_solicitado' ? (
                          <div className="flex flex-col gap-2">
                             <Select defaultValue="bom" onValueChange={(v) => s.temp_estado = v}>
                               <SelectTrigger className="h-10 text-[10px] w-full rounded-xl bg-white">
                                 <SelectValue placeholder="Estado" />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="bom">Bom</SelectItem>
                                 <SelectItem value="regular">Regular</SelectItem>
                                 <SelectItem value="ruim">Ruim</SelectItem>
                               </SelectContent>
                             </Select>
                             <Button 
                              size="sm" 
                              className="bg-amber-600 text-white gap-2 text-xs h-10 rounded-xl font-bold shadow-md shadow-amber-200"
                              onClick={() => handleAction('recolhimento', selectedOs.id, { 
                                sanitario_id: s.id,
                                estado_atual: s.temp_estado || 'bom',
                                fotos: ['https://placehold.co/600x400?text=Recolher-'+s.numero],
                                is_last_item: osSanitarios.filter(x => !x.devolvido_em).length === 1
                              })}
                            >
                              <PackageCheck className="h-4 w-4" /> Recolher
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="secondary">Entregue</Badge>
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedOs.status === 'aberta' && (
                    <Button 
                      className="w-full h-16 bg-primary text-white gap-3 font-black text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      onClick={() => handleAssumirOS(selectedOs.id)}
                    >
                      <CheckCircle2 className="h-6 w-6" /> ASSUMIR ESTA OS
                    </Button>
                  )}

                  {selectedOs.status === 'despachada' && (
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="w-full h-20 border-2 border-dashed gap-3 text-primary border-primary/20 bg-primary/5 rounded-[2rem] hover:bg-primary/10 transition-colors"
                        onClick={() => setAddingSanitario(true)}
                      >
                        <Plus className="h-6 w-6" /> 
                        <div className="text-left">
                           <p className="font-black text-base leading-none">Vincular Sanitário</p>
                           <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Registrar Entrega</p>
                        </div>
                      </Button>

                      {osSanitarios.length === 0 && (
                        <Button 
                          variant="secondary"
                          className="w-full h-24 border-2 border-dashed gap-3 bg-slate-50 hover:bg-slate-100 border-slate-200 rounded-[2rem] transition-colors"
                          onClick={() => setGenericServiceDialog(true)}
                        >
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                               <CheckCircle2 className="h-6 w-6 text-primary" />
                            </div>
                            <span className="font-black text-slate-700">REGISTRAR SERVIÇO CONCLUÍDO</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">(Limpeza, Manutenção, etc)</span>
                          </div>
                        </Button>
                      )}
                    </div>
                  )}

                  {osSanitarios.length > 0 && selectedOs.status === 'despachada' && (
                    <Button 
                      className="w-full h-16 bg-primary text-white mt-8 font-black text-lg shadow-xl shadow-primary/20 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                      onClick={() => handleAction('entrega', selectedOs.id, { is_last_item: true })}
                    >
                      FINALIZAR OPERAÇÃO TOTAL
                    </Button>
                  )}
                </div>

                <div className="p-5 bg-blue-50/50 border border-blue-100 text-blue-700 rounded-[2rem] flex gap-3 text-xs leading-relaxed font-medium">
                    <Info className="h-5 w-5 shrink-0 text-blue-500" />
                    <p>Para locações múltiplas, registre cada sanitário individualmente. Novos ativos serão cadastrados automaticamente se não encontrados.</p>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      <Dialog open={addingSanitario} onOpenChange={setAddingSanitario}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOs ? 'Vincular Entrega' : 'Cadastrar no Estoque'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">Número / Série</label>
              <Input 
                value={newSanForm.numero} 
                className="h-12 font-bold uppercase" 
                placeholder="Ex: S-001" 
                onChange={e => setNewSanForm(p => ({ ...p, numero: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">Categoria (Obrigatório)</label>
              <Select value={newSanForm.categoria} onValueChange={v => setNewSanForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comum">Comum</SelectItem>
                  <SelectItem value="pne">PNE</SelectItem>
                  <SelectItem value="pia">Pia</SelectItem>
                  <SelectItem value="luxo">Luxo</SelectItem>
                  <SelectItem value="banho">Banho</SelectItem>
                  <SelectItem value="rede_esgoto">Rede Esgoto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">Estado de Conservação</label>
              <Select value={newSanForm.estado_atual} onValueChange={v => setNewSanForm(p => ({ ...p, estado_atual: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bom">Bom</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="ruim">Ruim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedOs ? (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" className="h-12 gap-1 text-xs" 
                  disabled={!newSanForm.numero || !newSanForm.categoria}
                  onClick={() => handleAction('entrega', selectedOs.id, { 
                    sanitario_numero: newSanForm.numero, 
                    categoria: newSanForm.categoria,
                    estado_atual: newSanForm.estado_atual,
                    fotos: ['https://placehold.co/600x400?text=Galeria'],
                    is_last_item: false
                  }).then(() => { setAddingSanitario(false); setNewSanForm({ numero: '', categoria: 'comum', estado_atual: 'bom' }); })}>
                   <ImageIcon className="h-4 w-4" /> Galeria
                </Button>
                <Button className="h-12 gap-1 text-xs bg-slate-800" 
                  disabled={!newSanForm.numero || !newSanForm.categoria}
                  onClick={() => handleAction('entrega', selectedOs.id, { 
                    sanitario_numero: newSanForm.numero, 
                    categoria: newSanForm.categoria,
                    estado_atual: newSanForm.estado_atual,
                    fotos: ['https://placehold.co/600x400?text=Camera'],
                    is_last_item: false
                  }).then(() => { setAddingSanitario(false); setNewSanForm({ numero: '', categoria: 'comum', estado_atual: 'bom' }); })}>
                   <Camera className="h-4 w-4" /> Câmera
                </Button>
              </div>
            ) : (
              <Button 
                className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20"
                disabled={!newSanForm.numero || !newSanForm.categoria || uploading}
                onClick={async () => {
                  setUploading(true);
                  try {
                    const res = await fetch(`${API_BASE_URL}/app-funcionarios/estoque-manual`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user?.token}`
                      },
                      body: JSON.stringify(newSanForm)
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      throw new Error(err.error || 'Erro ao cadastrar');
                    }
                    toast.success('Sanitário cadastrado no estoque!');
                    setAddingSanitario(false);
                    setNewSanForm({ numero: '', categoria: 'comum', estado_atual: 'bom' });
                  } catch (e: any) {
                    toast.error(e.message);
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                CADASTRAR NO ESTOQUE
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={genericServiceDialog} onOpenChange={setGenericServiceDialog}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">Relato do Serviço</label>
              <Textarea 
                placeholder="Descreva o que foi realizado..."
                className="min-h-[100px] bg-slate-50"
                value={genericForm.observacoes}
                onChange={e => setGenericForm(p => ({ ...p, observacoes: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
               <Button 
                variant="outline" 
                className="h-12 gap-1 text-xs" 
                disabled={!genericForm.observacoes}
                onClick={() => handleAction('entrega', selectedOs.id, { 
                  is_generic_service: true,
                  observacoes: genericForm.observacoes,
                  fotos: ['https://placehold.co/600x400?text=Servico-Galeria'],
                }).then(() => setGenericServiceDialog(false))}
               >
                  <ImageIcon className="h-4 w-4" /> Galeria
               </Button>
               <Button 
                className="h-12 gap-1 text-xs bg-slate-800" 
                disabled={!genericForm.observacoes}
                onClick={() => handleAction('entrega', selectedOs.id, { 
                  is_generic_service: true,
                  observacoes: genericForm.observacoes,
                  fotos: ['https://placehold.co/600x400?text=Servico-Camera'],
                }).then(() => setGenericServiceDialog(false))}
               >
                  <Camera className="h-4 w-4" /> Câmera
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation PWA Style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3 flex items-center justify-between z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-[2.5rem]">
        <button 
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${mode === 'agenda' ? 'text-primary' : 'text-slate-400'}`}
          onClick={() => { setMode('agenda'); setView('agenda'); }}
        >
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">Agenda</span>
        </button>
        <button 
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${mode === 'historico' ? 'text-primary' : 'text-slate-400'}`}
          onClick={() => { setMode('historico'); setView('agenda'); }}
        >
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold">Histórico</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1 p-2 text-slate-400"
          onClick={() => {
            setSelectedOs(null);
            setAddingSanitario(true);
          }}
        >
          <Plus className="w-6 h-6" />
          <span className="text-[10px] font-bold">Estoque</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1 p-2 text-slate-400"
          onClick={() => window.location.href = '/checklist'}
        >
          <ClipboardList className="w-6 h-6" />
          <span className="text-[10px] font-bold">Checklist</span>
        </button>
        <button 
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${view === 'perfil' ? 'text-primary' : 'text-slate-400'}`}
          onClick={() => setView('perfil')}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </nav>

      {view === 'perfil' && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom duration-300">
           <header className="px-4 h-16 border-b flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setView('agenda')}><ArrowLeft className="h-5 w-5" /></Button>
            <span className="font-bold text-lg">Meu Perfil</span>
          </header>
          <main className="p-6 flex-1 flex flex-col items-center text-center">
            <div className="w-28 h-28 bg-slate-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-2xl relative">
               <User className="w-14 h-14 text-slate-300" />
               <div className="absolute bottom-1 right-1 w-7 h-7 bg-emerald-500 border-4 border-white rounded-full" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">{user?.nome || 'Funcionário'}</h2>
            <p className="text-slate-500 font-medium mb-8">CPF: {user?.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") || 'N/A'}</p>
            
            <div className="w-full space-y-3">
               <Card className="border-none bg-slate-50 shadow-none rounded-[2rem]">
                  <CardContent className="p-5 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                           <PackageCheck className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Status da Fila</p>
                           <p className="font-black text-slate-800">Operando</p>
                        </div>
                     </div>
                     <Badge className="bg-emerald-500 text-white font-black px-3 py-1 rounded-full">ATIVO</Badge>
                  </CardContent>
               </Card>
            </div>

            <Button variant="destructive" className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-xl shadow-red-200 mt-auto" onClick={handleLogout}>
               SAIR DA CONTA
            </Button>
          </main>
        </div>
      )}

      {uploading && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[2.5rem] flex flex-col items-center gap-6 border-none shadow-2xl">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-black text-slate-800 text-lg tracking-tight">REGISTRANDO...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppFuncionarios;
