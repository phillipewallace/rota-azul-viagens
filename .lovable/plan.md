## Objetivo

Separar dois fluxos hoje misturados:

- **Gerar recibo** → continua exclusivo para emitir recibos internos (com PDF do app).
- **Marcar pago** → passa a ser **exclusivo para vincular uma Nota Fiscal já emitida no site do governo** (o cliente pagou por NF, não por recibo). Ao clicar, abre modal pedindo:
  - **Número da NF** (texto obrigatório)
  - **Série** (opcional)
  - **Data de emissão** (default: hoje)
  - **Valor** (default: valor da mensalidade; permite baixa parcial)
  - **Forma de pagamento** (pix, boleto, transferência, etc.)
  - **PDF da NF** (upload obrigatório)
  - **Observações** (opcional)

Ao confirmar: a NF é salva, o contrato deixa a lista de **Pendentes** naquela competência (mesmo comportamento de um recibo pago), e a NF aparece na nova aba **Notas Fiscais**.

## Nova aba: Notas Fiscais

Adicionada dentro de `ErpFinanceiro` (mesmo estilo das outras abas — pendentes / recibos / etc.), com:

- **KPIs**: total emitido no mês, quantidade, ticket médio, próximos 7 dias.
- **Filtros**: busca (número, cliente, contrato), empresa emissora, período (emissão), forma de pagamento, status.
- **Tabela**: nº NF, série, cliente, contrato, empresa, data emissão, valor, forma pagamento, status, ações.
- **Ações por linha**:
  - **Ver PDF** (abre em nova aba)
  - **Baixar PDF**
  - **Editar** (número/valor/forma/observações — troca PDF opcional)
  - **Cancelar** (soft, com motivo — reabre o contrato como pendente)
- **Ações em lote**: exportar CSV, cancelar.

## Backend

**Nova tabela** `erp_invoices` (nota fiscal governamental vinculada a contrato/competência):

```
id UUID PK
contract_id UUID FK → erp_contracts
competencia CHAR(7)          -- YYYY-MM (unicidade: 1 NF ativa por contrato+competência)
numero TEXT NOT NULL
serie TEXT
data_emissao DATE NOT NULL
valor NUMERIC(12,2) NOT NULL
forma_pagamento TEXT
observacoes TEXT
pdf_url TEXT NOT NULL         -- /uploads/invoices/<uuid>.pdf
pdf_original_filename TEXT
pdf_size_bytes BIGINT
status TEXT DEFAULT 'ativa'   -- ativa | cancelada
cancelado_em TIMESTAMPTZ
motivo_cancelamento TEXT
created_by TEXT
created_at TIMESTAMPTZ
```

Índices + `UNIQUE (contract_id, competencia) WHERE status='ativa'`.

Migration em `database/migration-erp-notas-fiscais.sql` (idempotente + `GRANT` para o user `lipe`, seguindo padrão do projeto).

**Nova rota** `backend/src/routes/erp-invoices.ts` registrada em `/api/erp/invoices`:

- `GET /` — lista com filtros (contractId, competencia, from, to, status, formaPagamento, search).
- `GET /pending-check?contractId=&competencia=` — usado pelo botão (sanity).
- `POST /` — multipart (PDF + campos). Cria NF. Rejeita se já existir ativa para (contrato,competência) — igual ao fluxo de recibos.
- `PATCH /:id` — edita metadados (não o PDF).
- `POST /:id/replace-pdf` — multipart, substitui o PDF.
- `POST /:id/cancel` — soft (motivo obrigatório), libera contrato para pendente.
- `DELETE /:id` — admin/manager, hard delete apagando arquivo.

**Ajuste no `/receipts/pending`**: incluir na condição `NOT EXISTS` também nota fiscal ativa da mesma competência — assim contrato com NF vinculada some de Pendentes exatamente como quando tem recibo.

## Frontend

- `src/services/invoices.ts` — service com tipos + upload multipart.
- Nova aba **"Notas Fiscais"** em `ErpFinanceiro.tsx` (entre "Sem validade" e "Medições").
- Novo componente `src/components/erp/VincularNfDialog.tsx` (modal do Marcar pago).
- **Botão "Marcar pago"** (individual, em Pendentes) passa a abrir `VincularNfDialog`. Ao sucesso, recarrega pendentes + notas.
- **Ação em lote "Marcar pago"** (barra flutuante de recibos, linhas 2250-2256) permanece agindo sobre **recibos abertos** (fluxo antigo `togglePaid`) — separado do novo fluxo de NF, que é da aba Pendentes. Deixamos o rótulo mais claro: "Registrar pagamento" no lote de recibos.
- **Ação em lote "Gerar selecionados"** (linha 1189) — mantém geração de recibo em lote (não mexe).
- Tooltip do botão "Marcar pago" (linha 1262): atualizado para "Vincular Nota Fiscal (pagamento fora do sistema)".

## Detalhes técnicos

- Upload no padrão do `erp-signed-pdfs.ts` (multer diskStorage em `uploads/invoices/`), reaproveitando o mesmo estilo/whitelist de mimetype PDF.
- Visualização usa `toAbsoluteUrl(pdf_url)` (mesmo utilitário do resto do módulo).
- CSV usa `xlsx`/utilitário existente (`exportRecibosCsv` como referência).
- Status do contrato "pago via NF" derivado da existência de NF ativa — sem alterar `erp_receipts`.

## Fora de escopo

- Não emitir NF-e (só vincular a NF já emitida no portal do governo).
- Não integrar SEFAZ / consulta de chave.
- Não alterar fluxo de "Gerar recibo" (recibo interno continua igual).
