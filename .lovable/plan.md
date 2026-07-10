
# Medição em PDF no Financeiro

Fluxo de negócio:
**Medição (proposta de faturamento) → Cliente aprova → Cliente paga → Sistema emite Recibo(s)**

Diferente do recibo unificado (que agrupa recibos já emitidos), a **medição** é o passo *anterior* — consolida, num único PDF, tudo que a empresa cliente deve pagar no período, com todos os contratos ativos daquele CNPJ/cliente, produtos, quantidades, limpezas e valor total.

---

## 1. Escopo e regras

- **Agrupamento por cliente (CNPJ/documento):** uma medição = 1 cliente + N contratos ativos no período.
- **Período:** competência (mês/ano) escolhida no topo do Financeiro. Cada item herda o mesmo cálculo automático de 30 dias já usado nos recibos (`computeCompetenciaPeriodo`).
- **Itens da medição** (por contrato):
  - Nº contrato, tipo (locação/obra/evento), local (obra/CNO ou endereço evento).
  - Produtos/quantidade (a princípio a descrição/valor mensal do contrato; futuramente detalhamento por sanitário).
  - Nº de limpezas no período (do campo `limpezas` já existente em `observacoes`, se houver — MVP: só exibe se estiver preenchido).
  - Período (DD/MM/AAAA – DD/MM/AAAA) e valor.
- **Totais:** subtotal, descontos (opcional, campo manual), total geral.
- **Status da medição:** `rascunho` → `enviada` → `aprovada` → `paga` → `recibos_emitidos` → (opcional) `cancelada`.
- **Numeração própria:** `MED-YYYY-NNNN` (sequencial por ano, independente do recibo).
- Uma medição pode gerar **N recibos** (um por contrato) automaticamente ao mudar pra "paga".

---

## 2. Backend

### 2.1 Migração `database/migration-erp-medicoes.sql` (nova)
```
erp_medicoes
  id UUID PK
  numero TEXT UNIQUE            -- MED-2026-0001
  cliente_documento TEXT
  cliente_nome TEXT
  company_id UUID               -- empresa emissora
  competencia CHAR(7)           -- YYYY-MM
  periodo_inicio DATE
  periodo_fim DATE
  status TEXT DEFAULT 'rascunho'  -- rascunho|enviada|aprovada|paga|recibos_emitidos|cancelada
  subtotal NUMERIC(12,2)
  desconto NUMERIC(12,2) DEFAULT 0
  total NUMERIC(12,2)
  observacoes TEXT
  aprovada_em TIMESTAMPTZ
  aprovada_por TEXT
  paga_em TIMESTAMPTZ
  forma_pagamento TEXT
  pdf_url TEXT
  created_by TEXT
  created_at / updated_at

erp_medicao_itens
  id UUID PK
  medicao_id UUID FK (cascade)
  contract_id UUID
  contract_numero TEXT
  descricao TEXT
  quantidade NUMERIC(12,2) DEFAULT 1
  valor_unit NUMERIC(12,2)
  valor_total NUMERIC(12,2)
  periodo_inicio DATE
  periodo_fim DATE
  limpezas INT
  receipt_id UUID NULL          -- preenchido quando vira recibo
  ordem INT
```
+ `GRANT SELECT, INSERT, UPDATE, DELETE ... TO lipe;` + índices por `cliente_documento`, `competencia`, `status`.

### 2.2 Rota `backend/src/routes/erp-medicoes.ts` (nova, registrar no `index.ts`)
- `GET /erp/medicoes?competencia=&status=&clienteDoc=` — lista.
- `GET /erp/medicoes/:id` — detalhe (com itens).
- `POST /erp/medicoes/preview` — body `{ clienteDocumento, competencia, contractIds? }` retorna itens calculados (sem persistir) usando contratos ativos daquele cliente.
- `POST /erp/medicoes` — cria (status `rascunho`), snapshot dos itens.
- `PUT /erp/medicoes/:id` — edita rascunho (desconto, observações, itens).
- `POST /erp/medicoes/:id/status` — transições `enviada`/`aprovada`/`cancelada`.
- `POST /erp/medicoes/:id/pagar` — body `{ formaPagamento, dataPagamento }` → dentro de transação:
  1. cria um `erp_receipts` por item (usando o pipeline atual de recibo, marcando `pago=true`);
  2. grava `receipt_id` em cada `erp_medicao_itens`;
  3. atualiza medição para `recibos_emitidos` (paga).
- `GET /erp/medicoes/:id/pdf-data` — payload pra front montar PDF (ou serve URL persistida se já gerada).

Reaproveita helper de numeração (mesmo padrão do `erp-receipts.ts`) — sequencial por ano na tabela `erp_medicoes`.

---

## 3. Frontend

### 3.1 Serviço `src/services/medicoes.ts` (novo)
CRUD + `preview`, `pagar`, `mudarStatus`, `pdfData`. Mesmo padrão de `erp.ts`.

### 3.2 Aba nova no `ErpFinanceiro.tsx`: **"Medições"**
Colunas: Nº, Cliente, Competência, Período, Contratos, Total, Status (badge colorido), Ações.

Ações por linha:
- 👁 Ver (abre `MedicaoViewDialog`)
- 📄 Baixar PDF
- ✏️ Editar (só `rascunho`)
- ➡️ Marcar enviada / aprovada
- 💰 Registrar pagamento (abre modal → escolhe forma → gera recibos)
- 🗑 Cancelar

Botão topo da aba: **"Nova medição"**.

### 3.3 `NovaMedicaoDialog` (novo componente)
Passo 1: escolher **cliente** (autocomplete pelos clientes com contrato ativo).
Passo 2: sistema chama `/preview` e mostra tabela editável dos contratos ativos (checkboxes pra incluir/excluir cada contrato, campo de qtd/valor editável, período pré-calculado igual aos recibos).
Passo 3: campos `desconto`, `observações`.
Rodapé: totais + botões **Salvar rascunho** / **Salvar e enviar**.

### 3.4 `MedicaoViewDialog` (novo)
Read-only, mesma diagramação do PDF (header empresa, dados cliente, tabela itens, totais, status). Botões: baixar PDF, enviar, aprovar, registrar pagamento (conforme status atual).

### 3.5 `src/utils/medicaoPdf.ts` (novo)
Reaproveita helpers de `receiptPdf.ts` (logo, header empresa, footer, cores). Layout **idêntico ao recibo unificado**:
- Cabeçalho: logo + dados empresa emissora.
- Bloco "MEDIÇÃO Nº MED-YYYY-NNNN" + competência + período + status.
- Bloco cliente (nome/CNPJ/endereço).
- Tabela itens: `# | Contrato | Descrição | Período | Qtd | Valor unit. | Total`.
- Totais: subtotal, desconto, **total geral** em destaque.
- Rodapé: observações + "Aguardando aprovação / Aprovada em … / Paga em …".
- Área de assinatura do cliente (linha "De acordo — cliente").

### 3.6 Ao **registrar pagamento**
Modal com: forma de pagamento, data. Ao confirmar → chama `/pagar` → backend gera N recibos → front atualiza aba **Pagos** (já existente) com os novos recibos + oferece "baixar recibo unificado" desses recibos recém-criados (reusa fluxo atual).

---

## 4. Integração com o fluxo existente

- **Aba Pendentes:** ganha ícone "incluir em medição" (opcional) — marca o pendente como "coberto por medição X" (grava `medicao_id` no `erp_receipts` só quando pagar).
- **Aba Pagos:** recibos gerados via medição mostram badge "via MED-YYYY-NNNN" com link.
- **Contratos:** nenhuma alteração de schema — medição só lê `erp_contracts`.
- **ContractViewDialog:** nada muda.
- **Recibo unificado:** continua existindo (agrupa recibos já emitidos). Medição é o passo anterior.

---

## 5. Detalhes técnicos

- Numeração `MED-YYYY-NNNN`: `SELECT COALESCE(MAX(seq),0)+1 FROM ... WHERE numero LIKE 'MED-YYYY-%'` dentro de transação (mesmo padrão do recibo).
- Snapshot: itens copiam `descricao`, `valor_unit`, `periodo_inicio/fim` no momento da criação — edição posterior no contrato não afeta medições já criadas.
- Idempotência do `/pagar`: se já está `recibos_emitidos`, retorna 409.
- Transições permitidas validadas no backend (máquina de estados).
- Migração idempotente (`IF NOT EXISTS`), incluída no `deploy.sh` junto às demais.

---

## 6. Arquivos afetados

**Novos**
- `database/migration-erp-medicoes.sql`
- `backend/src/routes/erp-medicoes.ts`
- `src/services/medicoes.ts`
- `src/components/erp/NovaMedicaoDialog.tsx`
- `src/components/erp/MedicaoViewDialog.tsx`
- `src/components/erp/RegistrarPagamentoMedicaoDialog.tsx`
- `src/utils/medicaoPdf.ts`

**Editados**
- `backend/src/index.ts` — registrar rota `erp-medicoes`.
- `src/pages/erp/ErpFinanceiro.tsx` — nova aba "Medições" + integração badge nos Pagos.
- `deploy.sh` — aplicar a nova migração.

---

## 7. Fora de escopo (MVP)

- Envio automático por e-mail (fica só download/compartilhar PDF).
- Assinatura digital do cliente na medição (por ora, só linha física pra assinar).
- Detalhamento por número de sanitário na medição (fica valor mensal do contrato).
- Edição/estorno de recibo gerado por medição (usar fluxo já existente da aba Pagos).

---

## 8. Perguntas antes de codar

1. **Escolha de contratos:** todos os ativos do cliente entram por padrão e você desmarca, ou começa vazia e você adiciona? *(sugiro "todos marcados por padrão")*
2. **Desconto:** valor único no rodapé, ou por item também?
3. **Numeração:** `MED-YYYY-NNNN` está bom, ou prefere outro prefixo (ex.: `M-YYYY-NNNN`)?
4. **Quando "Registrar pagamento":** já geramos os recibos automaticamente e mandamos pra aba Pagos, correto? (é o que o plano assume)
