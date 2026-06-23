/**
 * Observação fixa de locação — exibida em TODO orçamento e em TODA OS
 * (PDF e tela). Não é editável pelo usuário; é sempre anexada às observações
 * livres digitadas no documento.
 */
export const OBSERVACAO_FIXA_LOCACAO = [
  'Caso a LOCATÁRIA opte pela devolução antecipada dos sanitários antes do término do período mensal contratado, não haverá cobrança proporcional, sendo devido o valor integral referente ao mês completo da locação.',
  '',
  'Em caso de extravio, furto, roubo, perda ou qualquer outro evento que impossibilite a devolução dos bens locados, a LOCATÁRIA compromete-se a pagar à CONTRATADA o valor de mercado dos bens faltantes, permanecendo vigente a cobrança da locação até a efetiva quitação do referido valor.',
  '',
  'A LOCATÁRIA compromete-se a utilizar os bens locados exclusivamente para os fins previstos, zelando por sua conservação, funcionamento e guarda até a devolução.',
  '',
  'Devolução dos sanitários',
  'Gentileza solicitar a devolução com antecedência mínima de 2 (dois) dias.',
].join('\n');

/** Junta observações livres do usuário com o bloco fixo, sem duplicar. */
export function mergeObservacoes(livre?: string | null): string {
  const free = (livre || '').trim();
  if (free.includes('Gentileza solicitar a devolução')) return free; // já contém o bloco
  return [free, OBSERVACAO_FIXA_LOCACAO].filter(Boolean).join('\n\n');
}

/* ---------- Forma de pagamento ---------- */

export type FormaPagamento = 'cartao' | 'pix' | 'boleto';

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  cartao: 'Cartão',
  pix: 'PIX',
  boleto: 'Boleto bancário',
};

/** Boleto vence sempre 28 dias após a entrega. Fallback: hoje + 28. */
export function calcVencimentoBoleto(dataEntrega?: string | null): string {
  const base = dataEntrega && /^\d{4}-\d{2}-\d{2}/.test(dataEntrega)
    ? new Date(`${dataEntrega.slice(0, 10)}T12:00:00`)
    : new Date();
  base.setDate(base.getDate() + 28);
  return base.toISOString().slice(0, 10);
}

/** Texto pronto descrevendo a forma de pagamento (usado nos PDFs). */
export function describeFormaPagamento(
  forma?: FormaPagamento | string | null,
  dataEntrega?: string | null,
): string {
  if (!forma) return '';
  const f = String(forma).toLowerCase() as FormaPagamento;
  if (f === 'boleto') {
    const venc = calcVencimentoBoleto(dataEntrega);
    const [y, m, d] = venc.split('-');
    return `Boleto bancário — vencimento em ${d}/${m}/${y} (28 dias após a entrega).`;
  }
  if (f === 'pix') return 'PIX — pagamento à vista no ato da contratação/entrega.';
  if (f === 'cartao') return 'Cartão — pagamento processado no ato da contratação/entrega.';
  return String(forma);
}
