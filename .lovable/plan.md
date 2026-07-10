## Objetivo

Simplificar a geração de recibos no Financeiro (sem escolher datas manualmente), adicionar visualização completa do contrato e melhorar o recibo unificado para mostrar o período de cada item.

---

## 1. Cálculo automático da competência (30 dias)

Regra nova (substitui o modal de datas):
- `periodoInicio` = data do contrato (`dataInicio`) deslocada para o mês/ano da competência selecionada no Financeiro (topo da tela).
  - Ex.: contrato começou em `14/01/2025`, competência selecionada `2026-02` → início = `14/02/2026`.
  - Se o "dia" do contrato não existir no mês (ex.: 31 em fev.), usa o último dia válido do mês.
- `periodoFim` = `periodoInicio + 30 dias`.
- Isso vale para: geração individual (botão "Gerar recibo") e unificada.

Helper novo em `src/pages/erp/ErpFinanceiro.tsx`:
```ts
computeCompetenciaPeriodo(dataInicioContrato, competenciaYYYYMM) → { inicio, fim }
```

## 2. Remover o modal de datas (manter só "sem validade")

Arquivo: `src/pages/erp/ErpFinanceiro.tsx`

- Substituir `GerarReciboPopover` por um popover minimalista contendo APENAS:
  - Preview do período calculado ("Competência: 14/02/2026 - 16/03/2026 · 30 dias").
  - Checkbox "Recibo sem validade jurídica".
  - Botões Cancelar / Gerar.
- `onConfirm(semValidade)` — o componente pai calcula `inicio`/`fim` automaticamente e chama `gerarPeriodo(p, inicio, fim, { semValidade })`.
- Aplicar a mesma lógica ao "Recibo unificado" (o diálogo `UnifOpen` também deixa de pedir datas — apenas confirma e opcionalmente permite sem validade).

## 3. Recibo unificado — período por item + identificador

Arquivo: `src/utils/receiptPdf.ts` (função `generateUnifiedReceiptPdf`).

- Estender `UnifiedReceiptItem` com campos opcionais:
  - `periodoInicio?: string | null`
  - `periodoFim?: string | null`
  - `numeroRecibo?: string | null` (o número/identificador do recibo individual gerado para aquele contrato)
- Na tabela de itens do PDF unificado:
  - Nova coluna "Recibo" (número do recibo individual).
  - Nova coluna "Período" (`DD/MM/YYYY - DD/MM/YYYY`).
  - Layout: `# | Recibo | Contrato · Descrição | Período | Valor`.
- No `gerarUnificado` (ErpFinanceiro): após persistir cada recibo, mapear o retorno (`numero`/`numeroDisplay`) e o par `periodoInicio`/`periodoFim` calculado, passando para os items.
- Ao rebaixar (`baixar` de um recibo do grupo), reidratar os mesmos campos a partir do `snapshot` / registros.

## 4. Ver contrato (somente leitura) no Financeiro

Novo componente: `src/components/erp/ContractViewDialog.tsx`
- Recebe `contractId` e chama `contractsService.get(id)`.
- Mostra em seções (labels + valores, com `formatDateBR` / `BRL`):
  - Cabeçalho: número, tipo (locação/obra/evento), status (ativo/encerrado), origem.
  - Empresa emissora (razão social, CNPJ, logo).
  - Cliente (nome, documento, endereço).
  - Datas: início, fim, evento, recolhimento, hora entrega.
  - Local: endereço da obra / local do evento, CNO.
  - Financeiro: valor mensal, frete, valor total do evento, dia de vencimento, renovação automática.
  - Responsável: nome, telefone, e-mail.
  - Observações + descrição.
  - Link para PDF assinado (se `pdfUrl`).
- Somente leitura — botão único "Fechar". Sem edição.

Integração em `src/pages/erp/ErpFinanceiro.tsx`:
- Adicionar botão-ícone "olho" (`Eye`) em cada linha nas abas:
  - **Pendentes** (usa `p.contractId`)
  - **Pagos**, **Emitidos**, **Sem validade** (usa `r.contractId`)
- Ao clicar, abre o `ContractViewDialog` para aquele contrato.

## 5. Ajustes de suporte

- `src/services/contracts.ts`: nada muda (já tem `contractsService.get`).
- Backend/BD: **nenhuma migração nova** — todos os campos já existem (`periodo_inicio`, `periodo_fim`, `sem_validade`, contrato completo em `erp_contracts`).

---

## Arquivos afetados

- `src/pages/erp/ErpFinanceiro.tsx` — remover modal de datas, cálculo automático, botão "Ver contrato", passar período/numero por item no unificado.
- `src/utils/receiptPdf.ts` — colunas Recibo + Período na tabela do unificado.
- `src/components/erp/ContractViewDialog.tsx` — **novo**, visualização read-only.

## Fora de escopo

- Não alterar o Popover de gerar recibo na aba "Sem validade" da lógica de emissão avulsa fora do fluxo pendente.
- Não mexer em edição de contratos (`ErpContracts.tsx`) — apenas visualização.
- Nenhuma alteração no backend ou banco.
