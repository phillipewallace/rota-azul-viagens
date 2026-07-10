
# Medição detalhada por produto

Hoje, ao adicionar um contrato na medição, o sistema cria **1 linha única** com o valor mensal do contrato (ex: "Contrato 0007 — R$ 1.200"). O pedido é mudar para **listar os produtos** que compõem aquele contrato (ex: "Contrato 0007 — Sanitário Químico Comum · qtd 3 · R$ 300 = R$ 900" + "Contrato 0007 — Pia · qtd 1 · R$ 150"), mantendo o mesmo layout e fluxo do dialog.

## 1. Catálogo de produtos

Como contratos hoje não têm produtos vinculados no banco, vou usar as **categorias já existentes de sanitários** (`comum`, `pne`, `pia`, `luxo`, `cabine_banho`) como catálogo base, com rótulos amigáveis:

- Sanitário Químico Comum
- Sanitário PNE (Acessível)
- Pia de Apoio
- Sanitário Luxo
- Cabine de Banho

Também mantenho a opção **"Item avulso"** (produto livre digitado à mão), do jeito que já existe.

## 2. Fluxo dentro do MedicaoDialog

Sem mudar layout geral. As alterações ficam na seção **"Adicionar contratos ativos do cliente"** e na tabela de itens:

1. Ao clicar num contrato (botão `+ 0007 · R$ 1.200`), em vez de já criar uma linha, abre um **mini formulário inline** (popover ou bloco expansível dentro do card do contrato) com:
   - Select de **Produto** (searchable, usando o catálogo acima)
   - **Quantidade** (default 1)
   - **Valor unitário** (default = valor mensal do contrato ÷ quantidade, editável)
   - Botão "Adicionar item"
2. Cada clique em "Adicionar item" insere uma linha na tabela com:
   - Descrição = "`{Nome do produto}`" (editável)
   - Badge do nº do contrato na coluna `#` (já existe hoje)
   - Qtd, Vunit, Total conforme informado
   - Unidade = "UN"
3. Um mesmo contrato pode gerar **várias linhas** (3 comuns + 1 PNE + 1 pia).
4. "Item avulso" continua adicionando linha em branco, sem contrato vinculado.

Rodapé (desconto geral, obs, totais) fica igual.

## 3. Sugestão inteligente (opcional, marcada como "sugerir")

Um botão pequeno **"Sugerir produtos"** no card do contrato que:
- Pré-preenche uma linha "Locação — Sanitário Químico Comum, qtd 1, valor = valorMensal" (fallback compatível com o comportamento atual quando o usuário só quer replicar o valor sem detalhar).

Isso mantém rapidez para quem não quer detalhar produto por produto.

## 4. Backend e banco

**Sem mudanças de schema.** A tabela `erp_medicao_itens` já guarda `descricao`, `quantidade`, `unidade`, `valor_unit`, `contract_id`, `contract_numero` — que é exatamente o que precisamos. Cada produto vira uma row na tabela como qualquer outro item.

Não vou adicionar coluna "categoria/produto_id" nas medições — a descrição textual já cumpre o papel de identificar o produto no PDF/histórico, e evita acoplar medições ao cadastro de sanitários (que pode mudar).

## 5. PDF da medição

O `medicaoPdf.ts` já renderiza uma linha por item com descrição, qtd, valor unit e total. Como agora vão haver N linhas por contrato, o PDF automaticamente sai detalhado. Vou apenas:
- Garantir agrupamento visual: linhas do mesmo `contract_numero` ficam **consecutivas** (já ficam, pois são adicionadas em sequência) e o número do contrato aparece na coluna, sem repetir descrição do contrato.

## 6. Retrocompatibilidade

Medições antigas (1 linha por contrato) continuam abrindo/editando normalmente — cada linha antiga é só um item genérico. Nada muda para elas.

## 7. Arquivos afetados

- `src/components/erp/MedicaoDialog.tsx` — adicionar mini-form de produto por contrato, catálogo de categorias, botão "Sugerir produtos".
- `src/utils/medicaoPdf.ts` — pequeno ajuste visual se necessário (agrupamento por contrato).
- **Nada** de backend, migrations ou services.

## Fora do escopo

- Cadastro editável de produtos/preços em Settings.
- Vincular produtos ao contrato no cadastro do contrato.
- Puxar automaticamente sanitários entregues (OS/sanitários alocados) para a medição.
- Alterações no layout geral do dialog ou dos filtros da tela ErpFinanceiro.

Aprovando, implemento só as mudanças no `MedicaoDialog` (e ajuste mínimo no PDF se precisar).
