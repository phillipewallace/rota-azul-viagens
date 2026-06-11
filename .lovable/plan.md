# Plano — Clientes, Orçamentos (PDF), Estoque automático e Atraso de diárias

Entrega focada nos 4 pedidos. Tudo integrado ao ERP já iniciado (Fases 1+2 prontas: CNPJs emissores + resumo de estoque).

---

## 1. Aba Clientes (cadastro completo)

Expandir a tabela `customers` existente — sem quebrar o que já usa (rotas, sanitários, histórico).

**Novos campos** (migration aditiva, todos opcionais):
- `person_type` ('PF' | 'PJ', default 'PJ')
- `document` (CPF ou CNPJ, único quando preenchido)
- `ie` (inscrição estadual), `im` (inscrição municipal)
- `email`
- `numero`, `complemento`, `bairro`, `cidade`, `estado`
- `responsavel_nome`, `responsavel_cpf`
- `tipo_cliente` ('eventos' | 'obra' | 'industria' | 'outro')

**UI** em `src/pages/Customers.tsx`:
- Modal de edição com abas: **Dados Cadastrais | Endereço | Contato | Observações**.
- Toggle PF/PJ que troca a máscara (CPF 000.000.000-00 / CNPJ 00.000.000/0000-00) e os campos exibidos.
- Validação de CPF/CNPJ (dígitos verificadores) com `zod`.
- Auto-preenchimento via CEP (ViaCEP) já existente — estender para preencher cidade/estado/bairro.
- Card do cliente passa a mostrar documento + cidade/UF.

## 2. Aba Orçamentos no ERP

Novas tabelas:
```text
erp_quotes (
  id uuid pk, numero text unique,            -- ORC-AAAA-NNNN
  company_id uuid fk erp_companies,           -- CNPJ emissor
  customer_id uuid fk customers,
  modalidade text ('diaria'|'mensal'),
  data_emissao date, validade_dias int,
  observacoes text, condicoes_pagamento text,
  desconto_pct numeric, frete numeric,
  subtotal numeric, total numeric,
  status text ('rascunho'|'enviado'|'aprovado'|'recusado'|'convertido'),
  pdf_gerado_em timestamptz, created_at, updated_at
)
erp_quote_items (
  id uuid pk, quote_id uuid fk,
  produto text, descricao text,
  quantidade numeric, valor_unitario numeric, valor_total numeric,
  ordem int
)
```

**Backend** `/api/erp/quotes`:
- CRUD completo
- `POST /:id/duplicate`
- `POST /:id/convert-to-os` (cria OS e reserva sanitários se produto = sanitário)
- Numeração automática `ORC-{ano}-{seq}` por ano

**Frontend** nova página/aba `Orçamentos`:
- Lista com filtros (status, cliente, período, CNPJ emissor)
- Editor com:
  - Seleção do **CNPJ emissor** (dropdown dos cadastrados em Configurações)
  - Seleção do **cliente** (com busca, mostra documento)
  - Modalidade **Diária** ou **Mensal** (toggle)
  - Tabela de itens dinâmica: produto + descrição + qtd + valor unitário → calcula total da linha automaticamente
  - Possibilidade de adicionar/remover múltiplas linhas (1..N produtos diferentes)
  - Desconto (%) e frete (R$) opcionais
  - Subtotal + Total recalculados em tempo real
  - Validade (dias), condições de pagamento, observações
- Botão **Gerar PDF** profissional (template novo):
  - Cabeçalho com logo (se cadastrada) + razão social, CNPJ, IE, endereço, telefone, e-mail da empresa emissora
  - Bloco do cliente com nome, documento, endereço completo, contato
  - Identificação do orçamento (número, data, validade, modalidade)
  - Tabela de itens com qtd, descrição, valor unitário, valor total por linha
  - Resumo financeiro (subtotal, desconto, frete, **total**)
  - Condições de pagamento e observações
  - Rodapé com assinaturas e contato

## 3. Estoque automático (sanitários)

Regras já parcialmente prontas (status `disponivel|em_cliente|em_os|manutencao|inativo`). Adicionar automação:

- **Reserva ao converter orçamento → OS** (ou ao criar OS direto): seleciona N sanitários `disponivel` e move para `em_os`, registra `erp_os_sanitarios` (os_id, sanitario_id, alocado_em).
- **Entrega via rota** (`entrega` em `sanitario_movimentacoes`) já move o sanitário para `em_cliente` e vincula ao customer — manter, mas adicionar gatilho: se houver OS aberta do mesmo cliente, vincular a OS.
- **Recolhimento via rota** (`recolhimento`) já libera para `disponivel`. Adicionar: se o sanitário estava em uma OS aberta, marcar `devolvido_em` em `erp_os_sanitarios`.
- **Aba Sanitários (roteirização)**: badge "X disponíveis" já entregue na fase anterior — adicionar contagem "Y reservados em OS".

## 4. Atraso de diárias (recolhimento)

Tabela mínima de OS para suportar diárias agora (sem fechar a Fase 4 inteira):

```text
erp_service_orders (
  id uuid pk, numero text unique,             -- OS-AAAA-NNNN
  quote_id uuid fk null, company_id, customer_id,
  modalidade ('diaria'|'mensal'),
  data_inicio date, data_fim_prevista date,   -- diária usa fim_prevista p/ vencimento
  data_fechamento date null,
  status ('aberta'|'em_atraso'|'fechada'),
  valor_total numeric, observacoes,
  created_at, updated_at
)
erp_os_sanitarios (os_id, sanitario_id, alocado_em, devolvido_em)
```

**Regra de atraso (diária)**:
- Query computada (não cron): `status = 'aberta' AND modalidade = 'diaria' AND data_fim_prevista < CURRENT_DATE AND data_fechamento IS NULL` → exibido como **EM ATRASO**.
- Endpoint `/api/erp/service-orders/overdue` retorna a lista para painel.
- Card de alerta no Dashboard do ERP: "X diárias em atraso para recolhimento".
- Na aba Sanitários (roteirização), badge vermelho nos sanitários alocados a OS atrasada — facilita criar rota de recolhimento.
- Ao fechar a OS (botão **Fechar e contabilizar**) → status `fechada`, sanitários voltam para `disponivel`, lança receita no financeiro (módulo financeiro virá na próxima fase).

---

## Arquivos a criar/editar

**Backend (novos)**
- `database/migration-customers-erp.sql` — campos novos em `customers` + tabelas `erp_quotes`, `erp_quote_items`, `erp_service_orders`, `erp_os_sanitarios` + GRANTs + índices
- `backend/src/routes/erp-quotes.ts`
- `backend/src/routes/erp-service-orders.ts`

**Backend (editar)**
- `backend/src/routes/customers.ts` — incluir novos campos em GET/PUT
- `backend/src/routes/sanitarios.ts` — adicionar `reservados_em_os` ao stock-summary e gatilhos em entrega/recolhimento
- `backend/src/index.ts` — registrar novas rotas

**Frontend (novos)**
- `src/pages/ErpQuotes.tsx` (lista + editor)
- `src/components/erp/QuoteEditor.tsx`
- `src/components/erp/QuotePdf.ts` (geração via jspdf + autotable, layout profissional)
- `src/services/quotes.ts`

**Frontend (editar)**
- `src/hooks/useCustomers.ts` + `src/pages/Customers.tsx` — novos campos + PF/PJ + validação
- `src/services/erp.ts` — endpoints de quotes e service-orders
- `src/App.tsx` — rota `/erp/orcamentos`
- `src/pages/Sanitarios.tsx` — card "reservados em OS" e badge de atraso
- Menu/navegação do ERP — adicionar item **Orçamentos**

---

## Decisões assumidas (avise se quiser mudar)

1. **Numeração**: `ORC-2026-0001`, `OS-2026-0001` (sequencial por ano).
2. **PDF**: template limpo e profissional com a logo do CNPJ emissor (se cadastrada), cores neutras (cinza/azul). Sem necessidade de modelo de referência.
3. **OS mínima** entra junto agora (necessária pra suportar "atraso de diária" e fechar o loop estoque); fluxo completo de OS (mensal recorrente, financeiro) fica para a próxima fase.
4. **Cron**: não vou adicionar cron — o "atraso" é derivado por query, simples e sempre correto.

Posso seguir e implementar tudo isso?
