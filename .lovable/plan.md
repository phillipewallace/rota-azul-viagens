## Diagnóstico

Fiz a auditoria ponta a ponta dos 3 campos do "Responsável pelo orçamento" (`responsavelNome`, `responsavelTelefone`, `responsavelEmail`).

### Orçamento (Quote) — provavelmente **já funciona**

- **DB**: migration `migration-erp-responsavel-documento.sql` criou as 3 colunas em `erp_quotes` e `erp_contracts`. ✅
- **Backend** (`backend/src/routes/erp-quotes.ts`): `QUOTE_SELECT` retorna `responsavelNome/Telefone/Email` tanto no GET `/` quanto no GET `/:id`. INSERT (POST), UPDATE (PUT) e convert (linha 319) salvam/copiam corretamente. ✅
- **Front** (`src/pages/ErpQuotes.tsx`): form tem inputs (linhas 795–809), hidrata do backend (linhas 211–213 e 258–260), envia no payload (linhas 308–310). ✅
- **PDF de orçamento** (`src/utils/quotePdf.ts` linhas 109–120): já imprime bloco **"Contato deste orçamento"** quando qualquer um dos 3 campos existe. ✅
- **Chamada** `generateQuotePdf(q)` (ErpQuotes.tsx linhas 271 e 647): passa o objeto direto da lista, que inclui os campos.

Se o usuário está vendo orçamentos **sem** o bloco no PDF, a causa mais provável é:
1. **Orçamento antigo** criado *antes* da migration, com `NULL` nos 3 campos (o PDF só imprime o bloco se pelo menos 1 tiver valor).
2. **Salvamento não persistiu** porque o `editing` foi enviado sem os campos preenchidos — precisa reabrir e checar se os inputs vêm preenchidos.
3. O bloco existe, mas está numa posição em que passou despercebido (fica logo abaixo do endereço/contato do cliente, antes de "DADOS DA LOCAÇÃO").

**Ação**: confirmo isso rapidamente gerando um PDF de teste com um orçamento novo (com o responsável preenchido) e outro sem, para comparar.

### Ordem de Serviço (OS) — **definitivamente NÃO passa**

Aqui a corrente está quebrada em 3 lugares:

1. **DB**: a OS (`erp_service_orders`) **não tem** as colunas `responsavel_*`. Só o orçamento tem. Como a OS é filha do orçamento (`quote_id`), o responsável precisa vir por JOIN.
2. **Backend** (`backend/src/routes/erp-service-orders.ts`): nenhum SELECT (nem no `GET /`, nem no `GET /:id`, nem no listagem gerencial) faz JOIN com `erp_quotes` para trazer `responsavel_nome/telefone/email`.
3. **PDF da OS** (`src/utils/serviceOrderPdf.ts`):
   - Interface `ServiceOrderPdfInput` (linhas 15–35) **não declara** os campos.
   - Renderização (linhas 84–98, bloco CLIENTE) só imprime `customer.contact_name` e `customer.contact_phone` do snapshot do **cliente** — não o responsável específico daquele pedido.
4. **Chamadas**:
   - `src/pages/ServiceOrders.tsx` linhas 140–168 e
   - `src/components/erp/ErpServiceOrdersPanel.tsx` linhas 218–243
   
   Nenhuma monta os 3 campos ao chamar `generateServiceOrderPdf(...)`.

---

## Plano de correção

### Passo 1 — Confirmar o Orçamento em runtime (5 min, sem código)
Antes de mexer, testar:
- Criar/editar 1 orçamento, preencher os 3 campos de responsável, salvar.
- Reabrir o orçamento — os 3 inputs devem vir preenchidos.
- Baixar o PDF — o bloco **"Contato deste orçamento:"** deve aparecer entre os dados do cliente e "DADOS DA LOCAÇÃO".

Se **não aparecer** com um orçamento novo → há bug de persistência/hidratação e vou investigar/corrigir. Se aparecer → orçamento OK, seguir só com OS.

### Passo 2 — Trazer responsável do orçamento até a OS (backend)

`backend/src/routes/erp-service-orders.ts`:

- No `GET /:id` (busca de detalhe usada pelo download do PDF), adicionar `LEFT JOIN erp_quotes q ON q.id = o.quote_id` e selecionar:
  ```sql
  q.responsavel_nome     AS "responsavelNome",
  q.responsavel_telefone AS "responsavelTelefone",
  q.responsavel_email    AS "responsavelEmail"
  ```
- Opcional (bom pra tela): fazer o mesmo no `GET /` (lista), pra mostrar o responsável nos cards/tabela de OS futuramente. Fora de escopo agora se quiser minimizar.

Sem migration nova. Não crio coluna nova na OS — reaproveitamos o dado do orçamento vinculado (fonte única = orçamento).

### Passo 3 — Aceitar os campos no PDF da OS

`src/utils/serviceOrderPdf.ts`:

- Adicionar na `ServiceOrderPdfInput`:
  ```ts
  responsavelNome?: string | null;
  responsavelTelefone?: string | null;
  responsavelEmail?: string | null;
  ```
- Dentro do bloco **CLIENTE** (após a linha `Responsável/Contato` do cliente, ~linha 98), adicionar um bloco pequeno destacado **"CONTATO DESTE PEDIDO"** somente se algum dos 3 vier preenchido:
  ```
  Responsável: <nome>   |   Tel.: <tel>   |   E-mail: <email>
  ```
  Formatação idêntica à do PDF de orçamento pra manter consistência visual.

### Passo 4 — Passar os campos nas 2 chamadas do front

- `src/pages/ServiceOrders.tsx` (`downloadOsPdf`, linhas 140–168): adicionar `responsavelNome: d.responsavelNome, responsavelTelefone: d.responsavelTelefone, responsavelEmail: d.responsavelEmail` no objeto passado.
- `src/components/erp/ErpServiceOrdersPanel.tsx` (`downloadServiceOrderPdf`, linhas 218–243): mesma coisa.

### Passo 5 — Verificação visual (obrigatória)
- Gerar PDF de orçamento com e sem responsável — comparar.
- Gerar PDF de OS de uma OS cujo orçamento tem responsável — conferir o bloco.
- Gerar PDF de OS de OS antiga (orçamento sem responsável) — garantir que **não** aparece linha vazia.

---

## Fora de escopo

- Adicionar coluna `responsavel_*` diretamente em `erp_service_orders` (permitiria OS avulsa sem orçamento também ter responsável). Se quiser isso, vira migration + campo no form da OS. Falar comigo se preferir esse caminho.
- Editar responsável direto na tela de OS (hoje edita só no orçamento).
- Recibos/medições — não foram pedidos aqui.

---

## Perguntas

1. Confirmo primeiro o comportamento do orçamento em runtime (Passo 1), ou vai direto pra correção da OS assumindo que orçamento está OK?
2. Quer também mostrar o responsável na **tabela/cards** de OS (não só no PDF)? Custa 1 SELECT a mais no `GET /`.
3. Quer permitir editar o responsável direto na OS (nova coluna própria) ou mantém a fonte única no orçamento?