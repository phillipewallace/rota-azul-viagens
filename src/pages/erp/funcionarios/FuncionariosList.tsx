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
}

const FuncionariosList = () => {
    const [list, setList] = useState<Funcionario[]>([]);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    
    const load = async () => {
        try {
            const token = localStorage.getItem('rota-azul-token');
            const res = await fetch(`${API_BASE_URL}/erp/funcionarios`, {
                headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            const data = await res.json();
            setList(data);
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cadastrar Novo Funcionário</DialogTitle>
                    </DialogHeader>
                    {/* Formulário aqui */}
                    <p className="text-sm text-muted-foreground">O CPF será o login padrão e a senha inicial.</p>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FuncionariosList;
