import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Briefcase, Plus, Trash2, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { cargosService, type Cargo } from '@/services/cargos';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MAX_LEN = 40;
const VALID = /^[\p{L}\p{N}\s\-\/]+$/u;

export default function CargosSettings() {
  const qc = useQueryClient();
  const [novo, setNovo] = useState('');
  const [toDelete, setToDelete] = useState<Cargo | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Cargo[]>({
    queryKey: ['cargos'],
    queryFn: () => cargosService.list(),
  });

  const createMut = useMutation({
    mutationFn: (nome: string) => cargosService.create(nome),
    onSuccess: () => {
      toast.success('Cargo adicionado');
      setNovo('');
      qc.invalidateQueries({ queryKey: ['cargos'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao adicionar cargo'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => cargosService.remove(id),
    onSuccess: () => {
      toast.success('Cargo removido');
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['cargos'] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover cargo'),
  });

  const handleCreate = () => {
    const nome = novo.trim();
    if (!nome) return toast.error('Digite o nome do cargo');
    if (nome.length > MAX_LEN) return toast.error(`Máximo ${MAX_LEN} caracteres`);
    if (!VALID.test(nome)) return toast.error('Use apenas letras, números, espaço, - ou /');
    const dup = (data || []).some(c => c.nome.toLowerCase() === nome.toLowerCase());
    if (dup) return toast.error('Este cargo já existe');
    createMut.mutate(nome);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Cargos
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Gerencie os cargos disponíveis no cadastro de funcionários.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Novo cargo (ex.: Supervisor)"
            value={novo}
            maxLength={MAX_LEN}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
            disabled={createMut.isPending}
          />
          <Button onClick={handleCreate} disabled={createMut.isPending || !novo.trim()}>
            {createMut.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Plus className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Adicionar</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando cargos...
          </div>
        ) : isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <div className="flex items-center gap-2 text-destructive font-medium mb-2">
              <AlertCircle className="h-4 w-4" />
              Falha ao carregar cargos
            </div>
            <p className="text-muted-foreground mb-3">{(error as any)?.message || 'Erro desconhecido'}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
            <Inbox className="h-6 w-6" />
            Nenhum cargo cadastrado. Adicione o primeiro acima.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.map(c => (
              <Badge
                key={c.id}
                variant="secondary"
                className="pl-3 pr-1 py-1 text-sm gap-1 flex items-center"
              >
                {c.nome}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setToDelete(c)}
                  disabled={deleteMut.isPending}
                  aria-label={`Remover ${c.nome}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Badge>
            ))}
            {isFetching && (
              <span className="text-xs text-muted-foreground self-center flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> atualizando…
              </span>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cargo?</AlertDialogTitle>
            <AlertDialogDescription>
              O cargo <strong>{toDelete?.nome}</strong> será removido. Funcionários já cadastrados
              com este cargo continuam intactos — mas ele não aparecerá mais na seleção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
              disabled={deleteMut.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMut.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Removendo…</>
                : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
