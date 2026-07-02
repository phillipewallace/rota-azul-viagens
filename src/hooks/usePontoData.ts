/**
 * React Query hooks para o módulo Ponto Digital.
 * Todos os dados vêm do backend (nenhum mock).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pontoService } from '@/services/ponto';
import { funcionariosService } from '@/services/funcionarios';
import {
  toEmployee, toJornada, toPunch, toJustification,
  type Employee, type Jornada, type Punch, type Justification,
} from '@/pages/ponto/pontoUtils';

const K = {
  emps: ['ponto', 'employees'] as const,
  jorns: ['ponto', 'jornadas'] as const,
  punches: (p?: any) => ['ponto', 'punches', p ?? {}] as const,
  justs: (p?: any) => ['ponto', 'justifications', p ?? {}] as const,
  closures: ['ponto', 'closures'] as const,
  settings: ['ponto', 'settings'] as const,
  dashboard: ['ponto', 'dashboard'] as const,
  bank: (id?: string) => ['ponto', 'bank', id ?? 'all'] as const,
};

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: K.emps,
    queryFn: async () => {
      const list = await funcionariosService.list();
      return list.map(toEmployee);
    },
    staleTime: 60_000,
  });
}

export function useJornadas() {
  return useQuery<Jornada[]>({
    queryKey: K.jorns,
    queryFn: async () => {
      const list = await pontoService.listJornadas();
      return list.map(toJornada);
    },
    staleTime: 5 * 60_000,
  });
}

export function usePunches(params?: { funcionario_id?: string; from?: string; to?: string; limit?: number; include_photo?: boolean }) {
  return useQuery<Punch[]>({
    queryKey: K.punches(params),
    queryFn: async () => (await pontoService.listPunches(params)).map(toPunch),
    staleTime: 30_000,
  });
}

export function useJustifications(params?: { status?: string; funcionario_id?: string }) {
  return useQuery<Justification[]>({
    queryKey: K.justs(params),
    queryFn: async () => (await pontoService.listJustifications(params)).map(toJustification),
    staleTime: 30_000,
  });
}

export function useClosures() {
  return useQuery({
    queryKey: K.closures,
    queryFn: () => pontoService.listClosures(),
    staleTime: 60_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: K.settings,
    queryFn: () => pontoService.getSettings(),
    staleTime: 5 * 60_000,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: K.dashboard,
    queryFn: () => pontoService.dashboard(),
    staleTime: 30_000,
  });
}

export function useBankAdjustments(funcionarioId?: string) {
  return useQuery({
    queryKey: K.bank(funcionarioId),
    queryFn: () => pontoService.listBankAdjustments(funcionarioId),
    staleTime: 60_000,
  });
}

// ---------- Mutations ----------
export function useCreatePunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof pontoService.createPunch>[0]) => pontoService.createPunch(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto', 'punches'] });
      qc.invalidateQueries({ queryKey: K.dashboard });
    },
  });
}

export function useAdjustPunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }: { id: string; timestamp?: string; motivo: string }) =>
      pontoService.adjustPunch(id, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ponto', 'punches'] }),
  });
}

export function useCreateJustification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof pontoService.createJustification>[0]) =>
      pontoService.createJustification(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto', 'justifications'] });
      qc.invalidateQueries({ queryKey: K.dashboard });
    },
  });
}

export function useReviewJustification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }: { id: string; status: 'aprovada' | 'recusada'; observacao?: string }) =>
      pontoService.reviewJustification(id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto', 'justifications'] });
      qc.invalidateQueries({ queryKey: ['ponto', 'punches'] });
      qc.invalidateQueries({ queryKey: K.dashboard });
    },
  });
}

export function useBatchReviewJustifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { ids: string[]; status: 'aprovada' | 'recusada'; observacao?: string }) =>
      pontoService.batchReview(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto', 'justifications'] });
      qc.invalidateQueries({ queryKey: ['ponto', 'punches'] });
      qc.invalidateQueries({ queryKey: K.dashboard });
    },
  });
}

export function useCreateClosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { competencia: string; observacoes?: string }) => pontoService.createClosure(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.closures }),
  });
}

export function useDeleteClosure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comp: string) => pontoService.deleteClosure(comp),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.closures }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof pontoService.updateSettings>[0]) => pontoService.updateSettings(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.settings }),
  });
}

export function useCreateJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: any) => pontoService.createJornada(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.jorns }),
  });
}
export function useUpdateJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...b }: any) => pontoService.updateJornada(id, b),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.jorns }),
  });
}
export function useDeleteJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pontoService.deleteJornada(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.jorns }),
  });
}

export function useCreateBankAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { funcionario_id: string; minutos: number; motivo: string }) =>
      pontoService.createBankAdjustment(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto', 'bank'] });
      qc.invalidateQueries({ queryKey: K.emps });
    },
  });
}
