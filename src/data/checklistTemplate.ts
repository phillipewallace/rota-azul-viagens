// Checklist completo de inspeção de caminhão.
// Usado tanto no formulário público quanto na visualização administrativa.

export type ChecklistStatus = 'ok' | 'attention' | 'critical' | 'na';
export type VehicleType = 'carroceria' | 'tanque';

export interface ChecklistItemDef {
  key: string;
  label: string;
}

export interface ChecklistCategoryDef {
  category: string;
  items: ChecklistItemDef[];
  /** Se definido, a categoria só aparece para o tipo de veículo correspondente. */
  vehicleType?: VehicleType;
}

export const CHECKLIST_TEMPLATE: ChecklistCategoryDef[] = [
  {
    category: 'Externo / Lataria',
    items: [
      { key: 'parachoque_dianteiro', label: 'Para-choque dianteiro' },
      { key: 'parachoque_traseiro', label: 'Para-choque traseiro' },
      { key: 'retrovisor_esq', label: 'Retrovisor esquerdo' },
      { key: 'retrovisor_dir', label: 'Retrovisor direito' },
      { key: 'placas_visiveis', label: 'Placas legíveis' },
      { key: 'adesivos', label: 'Adesivos / identificação visual' },
      { key: 'vazamentos_visiveis', label: 'Sem vazamentos visíveis no chão' },
      { key: 'lataria_geral', label: 'Lataria sem amassados/avarias' },
    ],
  },
  {
    category: 'Iluminação',
    items: [
      { key: 'farol_baixo', label: 'Farol baixo' },
      { key: 'farol_alto', label: 'Farol alto' },
      { key: 'farol_neblina', label: 'Farol de neblina' },
      { key: 'lanternas_traseiras', label: 'Lanternas traseiras' },
      { key: 'luz_freio', label: 'Luz de freio' },
      { key: 'luz_re', label: 'Luz de ré' },
      { key: 'setas', label: 'Setas dianteiras e traseiras' },
      { key: 'pisca_alerta', label: 'Pisca-alerta' },
      { key: 'luz_placa', label: 'Luz da placa' },
      { key: 'luz_interna', label: 'Luz interna da cabine' },
    ],
  },
  {
    category: 'Pneus e Rodas',
    items: [
      { key: 'pneu_diant_esq', label: 'Pneu dianteiro esquerdo' },
      { key: 'pneu_diant_dir', label: 'Pneu dianteiro direito' },
      { key: 'pneu_tras_esq', label: 'Pneu traseiro esquerdo' },
      { key: 'pneu_tras_dir', label: 'Pneu traseiro direito' },
      { key: 'calibragem', label: 'Calibragem correta' },
      { key: 'sulcos', label: 'Sulcos dentro do limite legal' },
      { key: 'parafusos_roda', label: 'Parafusos das rodas' },
    ],
  },
  {
    category: 'Motor / Compartimento',
    items: [
      { key: 'oleo_motor', label: 'Nível de óleo do motor' },
      { key: 'agua_radiador', label: 'Água do radiador' },
      { key: 'fluido_freio', label: 'Fluido de freio' },
      { key: 'arla', label: 'Nível de Arla 32' },
      { key: 'correias', label: 'Correias e mangueiras' },
      { key: 'vazamento_motor', label: 'Sem vazamento no motor' },
      { key: 'tacografo', label: 'Tacógrafo aferido' },
    ],
  },
  {
    category: 'Cabine Interna',
    items: [
      { key: 'cintos', label: 'Cintos de segurança' },
      { key: 'bancos', label: 'Bancos / regulagem' },
      { key: 'painel_instrumentos', label: 'Painel de instrumentos' },
      { key: 'ar_condicionado', label: 'Ar-condicionado' },
      { key: 'buzina', label: 'Buzina' },
      { key: 'limpadores', label: 'Limpadores de para-brisa' },
      { key: 'palhetas', label: 'Palhetas em bom estado' },
      { key: 'esguicho_agua', label: 'Esguicho de água' },
      { key: 'espelhos_internos', label: 'Espelhos internos' },
    ],
  },
  {
    category: 'Freios e Suspensão',
    items: [
      { key: 'freio_servico', label: 'Freio de serviço' },
      { key: 'freio_estacionamento', label: 'Freio de estacionamento' },
      { key: 'abs', label: 'Sistema ABS' },
      { key: 'ruidos_freio', label: 'Sem ruídos no freio' },
      { key: 'suspensao', label: 'Suspensão' },
      { key: 'amortecedores', label: 'Amortecedores' },
    ],
  },
  {
    category: 'Carroceria (3/4 embutida)',
    vehicleType: 'carroceria',
    items: [
      { key: 'travas_carroceria', label: 'Travas da carroceria' },
      { key: 'ganchos', label: 'Ganchos / correntes' },
      { key: 'plataforma', label: 'Plataforma / assoalho' },
      { key: 'estrutura_carroceria', label: 'Estrutura / fixação da carroceria embutida' },
      { key: 'portas_carroceria', label: 'Portas e fechaduras da carroceria' },
    ],
  },
  {
    category: 'Tanque / Equipamentos Sanitários',
    vehicleType: 'tanque',
    items: [
      { key: 'tanque_dejeto', label: 'Tanque de dejetos' },
      { key: 'tanque_agua_limpa', label: 'Tanque de água limpa' },
      { key: 'mangueiras', label: 'Mangueiras' },
      { key: 'bomba', label: 'Bomba sucção' },
      { key: 'valvulas', label: 'Válvulas de descarga' },
      { key: 'vazamento_sanitario', label: 'Sem vazamentos no sistema' },
    ],
  },
  {
    category: 'Limpeza',
    items: [
      { key: 'limpeza_cabine', label: 'Cabine limpa' },
      { key: 'limpeza_externa', label: 'Veículo limpo externamente' },
      { key: 'limpeza_compartimento', label: 'Compartimento de carga limpo' },
    ],
  },
];

/** Retorna as categorias aplicáveis ao tipo de veículo selecionado. */
export function getChecklistFor(vehicleType: VehicleType | null): ChecklistCategoryDef[] {
  return CHECKLIST_TEMPLATE.filter(c => !c.vehicleType || c.vehicleType === vehicleType);
}

export const STATUS_LABEL: Record<ChecklistStatus, string> = {
  ok: 'OK',
  attention: 'Atenção',
  critical: 'Crítico',
  na: 'N/A',
};

export const STATUS_COLOR: Record<ChecklistStatus, string> = {
  ok: 'bg-emerald-500',
  attention: 'bg-amber-500',
  critical: 'bg-red-600',
  na: 'bg-gray-400',
};
