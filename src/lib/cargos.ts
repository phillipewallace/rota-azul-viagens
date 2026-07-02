/** Lista fechada de cargos disponíveis no cadastro de funcionários. */
export const CARGOS = [
  'Motorista',
  'Ajudante',
  'Operacional',
  'Manutenção',
  'Administrativo',
  'Financeiro',
  'Vendedor',
  'Gerente',
  'Outro',
] as const;

export type Cargo = typeof CARGOS[number];

export const isMotorista = (cargo?: string | null) =>
  (cargo || '').trim().toLowerCase() === 'motorista';
