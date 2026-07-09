# Filtros na aba Pendentes

## Campos disponíveis em cada `PendingReceipt`

Já vêm do backend `/erp/receipts/pending`, nenhuma mudança de API necessária:
`contractNumero`, `customerName`, `customerDocument`, `companyRazaoSocial`, `companyCnpj`, `diaVencimento` (número, 1-31), `dataInicio`, `valorMensal`.

## Nova barra de filtros

Adicionar um bloco `<CardContent>` acima da tabela (mesmo padrão visual da barra da aba "Recibos" para manter consistência), dentro de `<TabsContent value="pendentes">`:

- **Buscar** — `Input` com ícone `Search`. Casa (case-insensitive, `includes`) contra:
  - `contractNumero`, `customerName`, `customerDocument`, `companyRazaoSocial`, `companyCnpj`.
- **Empresa** — `Select` alimentado pelo `companies` já carregado. Filtra por `companyRazaoSocial` (ou por `companyId` se disponível). Valor `all` = todas.
- **Vencimento — De / Até** — dois `Input type="date"`. Calcula a data de vencimento efetiva de cada pendente na competência selecionada (`competencia` + `diaVencimento`, ajustando para o último dia do mês quando `diaVencimento` for maior que o mês) e mantém apenas os que caem no intervalo (`>= from` e `<= to`, cada bound opcional).
- **Chips rápidos** (mesmo `QuickChip` já usado em Recibos):
  - "Todos" (default)
  - "Vencidos" (venc < hoje)
  - "Vence em 7 dias" (0 ≤ dias até venc ≤ 7)
- **Botão "Limpar"** — só aparece quando há qualquer filtro ativo.

## Lógica

- Filtragem 100% client-side via `useMemo pendentesFiltrados` sobre o array `pendentes`. Zero requests novos, resposta instantânea.
- Estado local novo: `pendSearch`, `pendCompany` (id ou razão social), `pendVencFrom`, `pendVencTo`, `pendQuick`.
- Helper `vencDate(competencia, diaVencimento)` reaproveitando o `nextDueDate` já existente no arquivo (ou variante que trava o vencimento na própria competência mesmo se já tiver passado).

## Ajustes acessórios

- **Contador do badge da aba** muda para `{filtrados}/{total}` quando houver filtro ativo, para o usuário não achar que os pendentes sumiram.
- **Checkbox "Selecionar todos"** passa a operar sobre `pendentesFiltrados` (marca/desmarca só os visíveis). O `<VirtualRows items={...}>` recebe a lista filtrada.
- **Mensagem de vazio** vira contextual: "Nenhum pendente para os filtros selecionados" quando filtros ativos; texto original ("Nenhuma cobrança pendente para {mês}") quando sem filtros.
- **KPI "Pendente do mês"** continua somando o total (não filtrado) — filtro é só de visualização, não deve distorcer o gerencial. Se houver filtro ativo, mostra sublabel "(exibindo X de Y)".
- **Coluna Vencimento** passa a mostrar `DD/MM/AAAA` (mais útil pra bater com o filtro) além do "dia N".

## Arquivos afetados

- `src/pages/erp/ErpFinanceiro.tsx` — apenas este arquivo. Sem backend, sem novos componentes, sem migrações.

## Fora do escopo

- Nenhuma alteração em Recibos / Pagos / Sem validade / Gastos.
- Sem persistência dos filtros (resetam ao sair da página) — se quiser lembrar por sessão, faço num próximo passo.

## Validação

- `tsgo --noEmit`.
- Manual: digitar em cada filtro, verificar que a lista, o badge, o "selecionar todos" e o botão "Gerar selecionados" reagem em tempo real.

Aprovando, implemento.
