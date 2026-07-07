
# Refatoração da aba Financeiro

## O que muda

Hoje as abas são: **Pendentes · Recibos · Clientes · Gastos**.
Passa a ser: **Pendentes · Pagos do mês · Recibos · Clientes · Gastos**.

- **Pendentes** — mantém exatamente como está (contratos ativos sem recibo na competência).
- **Pagos do mês** (nova) — mostra os contratos que **já foram quitados na competência selecionada** e o **próximo vencimento** de cada um.
- **Recibos** — segue como está: arquivo histórico completo, filtros, PDF, cancelar, reabrir. Todo recibo gerado continua indo pra cá.
- **Clientes / Gastos** — sem mudança.

## Como a recorrência "volta pra pendentes" no dia 01

Já funciona sozinho, sem cron nem job novo:

- O endpoint `/erp/receipts/pending?competencia=YYYY-MM` retorna todo contrato ativo que **não tem recibo naquela competência**.
- Ao virar o mês, o seletor de competência do topo passa pra o novo `YYYY-MM` (já é o comportamento do `compAtual()`), então todos os contratos ativos reaparecem automaticamente como pendentes no dia 01, independente de terem sido pagos no mês anterior.
- Não precisa criar rotina nova no backend nem migração.

## Aba "Pagos do mês" — o que aparece

Fonte de dados: `recibos` já carregados pra competência selecionada, filtrando `status ∈ {pago, parcial}`, um por contrato (mais recente).

Colunas da tabela:

- **Contrato** (número + descrição curta)
- **Cliente** (nome + documento)
- **Valor pago / Valor do recibo** (com badge "parcial" quando `valorPago < valor`)
- **Forma de pagamento** (badge com `FORMA_LABEL`)
- **Pago em** (`dataPagamento` ou emissão)
- **Próximo vencimento** — calculado no cliente a partir de `diaVencimento` do contrato: dia X do **próximo mês** em relação à competência (com clamp pro último dia do mês, ex.: fev). Badge de dias restantes: verde (>7d), âmbar (≤7d), vermelho (vencido — só ocorre se estiver olhando competência antiga).
- **Ações**: abrir PDF do recibo, ver recibo (mesmo diálogo já existente), cancelar/reabrir (reaproveita `cancelDialog` / `reabrirDialog`).

Cabeçalho da aba: mini-KPIs consistentes com o resto — **Contratos pagos · Total recebido no mês · Ticket médio · Próximos a vencer (7 dias)**.

Estado vazio: ilustração leve com texto "Nenhum contrato quitado nesta competência ainda" e CTA "Ir para Pendentes".

## Design system e estados

- Zero cor chumbada. Só tokens semânticos: `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary/10`, `text-primary`, `bg-emerald-500/10 text-emerald-600` **apenas via variantes já usadas na página** (`Badge` reaproveitando o padrão dos recibos pagos existentes).
- Hierarquia: título da aba `text-lg font-semibold`, KPI value `text-2xl font-semibold tracking-tight`, label `text-xs uppercase tracking-wide text-muted-foreground`.
- Estados: hover em linha (`hover:bg-muted/40`), focus-visible com `ring-2 ring-ring/50`, active `active:scale-[0.98]` nos botões, `disabled:opacity-50 disabled:pointer-events-none`, skeleton loading (mesmo padrão das outras tabelas), transições `duration-200 ease-out`.
- Mobile-first: em <640px, vira lista de cards com `contrato · cliente` no topo, valor à direita, `próximo vencimento` como linha inferior com badge — igual ao padrão já usado em Pendentes/Recibos.
- Acessibilidade: `aria-label` nos ícones, contraste AA garantido pelos tokens.

## Fora de escopo

- Nada de backend, migração ou schema.
- Não altero a aba Pendentes, nem Recibos, nem lógica de geração/cancelamento.
- Sem novos pacotes.

## Arquivos afetados

- `src/pages/erp/ErpFinanceiro.tsx` — adicionar `TabsTrigger "pagos"`, novo `TabsContent` com a tabela/cards + KPIs + helper `proximoVencimento(competencia, diaVencimento)`. Ampliar o tipo do `activeTab`.

## Passo a passo de implementação (após aprovação)

1. Adicionar `'pagos'` ao union do `activeTab` e novo `TabsTrigger` entre Pendentes e Recibos.
2. Derivar `pagosDoMes` via `useMemo` a partir de `recibos` (mesma competência, status pago/parcial, dedup por `contractId` pegando o mais recente).
3. Criar helper puro `nextDueDate(competencia, diaVencimento)` com clamp de fim de mês.
4. Renderizar KPIs + tabela desktop + cards mobile reutilizando `Badge`, `Table`, `DropdownMenu` já importados.
5. Estado vazio com CTA que muda `activeTab` pra `'pendentes'`.
6. Verificar visual em 375px, 768px e 1440px; validar hover/focus/disabled/loading; rodar typecheck.

Aprovar pra eu implementar?
