import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Search, Plus, UserCircle, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/config';

interface Funcionario {
    id: string;
    nome: string;
    cpf: string;
    telefone?: string;
    email?: string;
    tipo: string;
    active: boolean;
    created_at?: string;
}

const FuncionariosList = () => {
    const [list, setList] = useState<Funcionario[]>([]);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    
    const load = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/erp/funcionarios`, {
                headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            const data = Array.isArray(await res.json()) ? await res.json() : [];
            setList(data);
            // Atualiza o contador no card pai se o elemento existir
            const statsEl = document.querySelector('#stats-total-funcionarios p.text-2xl');
            if (statsEl) statsEl.textContent = String(data.length);
        } catch (e) { toast.error('Erro ao carregar'); }
    };

    useEffect(() => { load(); }, []);

    const filtered = list.filter(f => 
        f.nome.toLowerCase().includes(search.toLowerCase()) || 
        f.cpf.includes(search)
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Buscar funcionário..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Button onClick={() => setOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Novo Funcionário
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(f => (
                    <Card key={f.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                                    <div>
                                        <CardTitle className="text-sm font-semibold">{f.nome}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{f.tipo.toUpperCase()}</p>
                                    </div>
                                </div>
                                <Badge variant={f.active ? 'default' : 'secondary'} className="text-[10px]">
                                    {f.active ? 'Ativo' : 'Inativo'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 text-xs space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold w-12">CPF:</span> {f.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '..-')}
                            </div>
                            {f.telefone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground" /> {f.telefone}
                                </div>
                            )}
                            {f.email && (
                                <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" /> {f.email}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cadastrar Novo Funcionário</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const payload = Object.fromEntries(formData);
                        try {
                            const token = localStorage.getItem('token');
                            const res = await fetch(`${API_BASE_URL}/erp/funcionarios`, {
                                method: 'POST',
                                headers: { 
                                    'Content-Type': 'application/json',
                                    Authorization: token ? `Bearer ${token}` : '' 
                                },
                                body: JSON.stringify(payload)
                            });
                            if (!res.ok) throw new Error();
                            toast.success('Funcionário cadastrado!');
                            setOpen(false);
                            load();
                        } catch { toast.error('Erro ao cadastrar'); }
                    }} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome Completo</label>
                            <Input name="nome" required placeholder="Ex: João Silva" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">CPF</label>
                                <Input name="cpf" required placeholder="000.000.000-00" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipo</label>
                                <select name="tipo" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required>
                                    <option value="motorista">Motorista</option>
                                    <option value="ajudante">Ajudante</option>
                                    <option value="operador">Operador</option>
                                    <option value="administrativo">Administrativo</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Telefone</label>
                                <Input name="telefone" placeholder="(00) 00000-0000" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">E-mail</label>
                                <Input name="email" type="email" placeholder="email@exemplo.com" />
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground bg-muted p-2 rounded">
                            O CPF será usado como login. A senha inicial será o próprio CPF (apenas números).
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit">Cadastrar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FuncionariosList;
