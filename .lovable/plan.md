# Plano: campo "Responsável pelo documento" em Contrato e Orçamento

## Objetivo
Permitir informar, por documento (contrato e orçamento), o **nome, telefone e e-mail da pessoa responsável** — separado dos dados cadastrais do cliente/empresa. Assim, quando a mesma empresa fizer múltiplas locações com contatos diferentes, cada documento guarda o solicitante real.

## Escopo
- Contratos (`erp_contracts`) — página `ErpContracts.tsx`.
- Orçamentos (`erp_quotes`) — página `ErpQuotes.tsx`.
- PDFs de contrato e orçamento (exibir o responsável quando preenchido).
- **Fora do escopo:** Ordens de Serviço, Recibos, Recorrentes, Financeiro. Cliente permanece intocado (sem alteração no cadastro de clientes).

## Passo a passo

### 1) Banco de dados (migração nova)
Arquivo: `database/migration-erp-responsavel-documento.sql`
```sql
ALTER TABLE erp_contracts
  ADD COLUMN IF NOT EXISTS responsavel_nome     VARCHAR(160),
  ADD COLUMN IF NOT EXISTS responsavel_telefone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS responsavel_email    VARCHAR(160);

ALTER TABLE erp_quotes
  ADD COLUMN IF NOT EXISTS responsavel_nome     VARCHAR(160),
  ADD COLUMN IF NOT EXISTS responsavel_telefone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS responsavel_email    VARCHAR(160);
```
Rodar em produção junto do próximo deploy (padrão do projeto).

### 2) Backend
- `backend/src/routes/erp-contracts.ts`
  - `SELECT`: adicionar `c.responsavel_nome AS "responsavelNome"`, `c.responsavel_telefone AS "responsavelTelefone"`, `c.responsavel_email AS "responsavelEmail"`.
  - `POST`: incluir as três colunas no `INSERT` (aceitando `null`).
  - `PUT`: incluir as três colunas no `UPDATE` (permitindo limpar com `null`, usando o padrão `$n ?? null` já usado em campos livres como `descricao`).
- `backend/src/routes/erp-quotes.ts` — mesmas alterações (SELECT/POST/PUT).

### 3) Tipos do frontend
- `src/services/contracts.ts` (ou onde o tipo `Contract` estiver): adicionar `responsavelNome?`, `responsavelTelefone?`, `responsavelEmail?`.
- `src/services/quotes.ts` interface `Quote`: mesmos três campos opcionais.

### 4) UI — Contrato (`src/pages/erp/ErpContracts.tsx`)
No formulário de criar/editar contrato, adicionar uma seção **"Responsável pelo contrato"** (após dados do cliente, antes de datas), com 3 inputs:
- Nome do responsável (texto, até 160)
- Telefone (aplicar máscara já usada no projeto, se houver)
- E-mail (input `type="email"`)
Todos opcionais. Enviar no payload do `create` e `update`.

### 5) UI — Orçamento (`src/pages/ErpQuotes.tsx`)
Mesma seção **"Responsável pelo orçamento"** no form de criar/editar orçamento, com os 3 campos, opcionais.

### 6) PDFs
- `src/utils/contractPdf.ts` (e `contractDoc.ts` se aplicável): quando `responsavelNome` estiver preenchido, renderizar bloco "Responsável: {nome} — {telefone} — {email}" abaixo dos dados do cliente.
- `src/utils/quotePdf.ts`: mesmo bloco no cabeçalho do orçamento.
Campos vazios são omitidos silenciosamente.

### 7) Validação
- Validação leve no client: e-mail com regex simples (só valida se preenchido), telefone livre (não obriga formato). Sem bloquear submit por serem opcionais.
- Sem validação server-side extra além do tamanho da coluna.

### 8) Verificação
- `tsgo --noEmit` após edições.
- Teste manual: criar contrato com responsável → editar → limpar → gerar PDF; idem para orçamento.
- Contratos/orçamentos antigos continuam funcionando (campos ficam `null`).

## Arquivos que serão tocados
- `database/migration-erp-responsavel-documento.sql` (novo)
- `backend/src/routes/erp-contracts.ts`
- `backend/src/routes/erp-quotes.ts`
- `src/services/contracts.ts`
- `src/services/quotes.ts`
- `src/pages/erp/ErpContracts.tsx`
- `src/pages/ErpQuotes.tsx`
- `src/utils/contractPdf.ts` (e `contractDoc.ts` se necessário)
- `src/utils/quotePdf.ts`

## Pontos de decisão (me confirma antes de implementar)
1. **Nome dos campos ok?** "Responsável pelo contrato" / "Responsável pelo orçamento" — ou prefere "Solicitante"/"Contato do pedido"?
2. **Exibir no PDF?** Confirmo que deve aparecer no PDF de ambos, correto?
3. **Herdar do último documento?** Quando criar um novo contrato/orçamento para um cliente que já teve outro, quer pré-preencher com o último responsável usado (com opção de editar), ou sempre em branco?
