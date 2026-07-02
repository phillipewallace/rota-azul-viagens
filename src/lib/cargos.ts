/** Lista fechada de cargos disponíveis no cadastro de funcionários. */
export const CARGOS = [
  'Financeiro',
  'Comercial',
  'Faxineiro',
  'Gerente',
  'Motorista',
  'Ajudante',
] as const;

export type Cargo = typeof CARGOS[number];

export const isMotorista = (cargo?: string | null) =>
  (cargo || '').trim().toLowerCase() === 'motorista';
