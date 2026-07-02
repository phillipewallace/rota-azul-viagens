import { useQuery } from '@tanstack/react-query';
import { cargosService, type Cargo } from '@/services/cargos';
import { CARGOS as FALLBACK } from '@/lib/cargos';

/**
 * Lista de cargos gerenciada em Configurações.
 * Faz fallback para a lista estática se a chamada falhar,
 * garantindo que o cadastro de funcionários nunca fique vazio.
 */
export function useCargos() {
  const query = useQuery<Cargo[]>({
    queryKey: ['cargos'],
    queryFn: () => cargosService.list(),
    staleTime: 60_000,
  });

  const nomes = query.data && query.data.length
    ? query.data.map(c => c.nome)
    : [...FALLBACK];

  return { ...query, nomes };
}
