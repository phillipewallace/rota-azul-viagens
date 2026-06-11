# Refatoração Completa do Módulo ERP

Escopo grande — vou organizar em fases para entregar com qualidade. Antes de começar preciso confirmar alguns pontos chave (no fim do plano).

## Visão Geral

Transformar o ERP atual (que hoje só tem itens/categorias/funcionários/veículos) num ERP operacional completo, integrado ao módulo de roteirização e com módulo financeiro próprio.

## Fase 1 — Sanitários como item de estoque do ERP

- Migrar os sanitários da aba de roteirização para dentro do ERP, mas mantendo a visualização atual em "Sanitários" da roteirização (passa a ler do ERP).
- Cada sanitário continua tendo **numeração única** (não é só quantidade — é estoque serializado).
- Status por unidade: `disponivel`, `em_os` (alocado a uma OS), `manutencao`, `inativo`.
- Na aba "Sanitários" da roteirização: mostrar **quantidade máxima disponível em estoque** (contagem dos que estão `disponivel`) + lista atual já existente.

## Fase 2 — Configurações: até 3 CNPJs (Empresas Emissoras)

- Nova seção em **Configurações → Empresas Emissoras**: cadastrar até 3 CNPJs (razão social, CNPJ, IE, endereço, telefone, e-mail, logo opcional).
- Esses CNPJs aparecem como seletor obrigatório ao gerar Orçamento ou OS.

## Fase 3 — Orçamentos

- Nova aba **Orçamentos** no ERP.
- Campos: cliente (da aba clientes), CNPJ emissor, modalidade (diária/mensal), quantidade de sanitários, valor, prazo, observações, itens extras.
- **Geração de PDF** com layout profissional (logo + dados do CNPJ emissor + cliente + itens + valores + assinatura).
- Botão **"Converter em OS"** dentro do orçamento — gera a OS automaticamente herdando todos os dados e já reservando os sanitários no estoque.

## Fase 4 — Ordens de Serviço (OS)

- Nova aba **Ordens de Serviço** no ERP.
- Ao abrir OS: selecionar quantos sanitários e **quais numerações** (ou auto-alocar dos disponíveis). Cada sanitário alocado fica `em_os`.
- Modalidades:
  - **Diária**: data início + data fim prevista. Quando passa do prazo sem fechamento → notificação + flag "atrasado" no painel. Ao fechar manualmente → contabiliza pagamento único no financeiro.
  - **Mensal**: gera lançamento financeiro recorrente automático todo mês enquanto a OS estiver aberta. Cada mês tem botão "Pago/Não pago"; ao marcar como pago contabiliza no financeiro.
- **Notificação ao gerar OS**: "Ordem de serviço Nº X foi gerada. Sanitários: 0123, 0124, 0125."
- **PDF da OS** com mesmo padrão visual do orçamento.
- Ao fechar OS: sanitários voltam para `disponivel` (e idealmente entram numa rota de recolhimento — mas isso pode ficar pra depois).

## Fase 5 — Módulo Financeiro

Nova aba **Financeiro** no ERP, agregando:
- **Receitas**: pagamentos de OS (diárias fechadas + mensais marcadas como pagas), com data, cliente, OS de origem, CNPJ emissor, valor.
- **Despesas**: manutenções (já existentes em `/maintenance`) — exibir valor, descrição do serviço e caminhão.
- Filtros por período, por CNPJ, por tipo.
- Totalizadores: receita do mês, despesa do mês, saldo.
- Painel com cards: OSs em atraso (diárias), mensalidades em aberto, próximos vencimentos.

## Fase 6 — Integração Roteirização ↔ ERP

- Aba "Sanitários" da roteirização: badge "X disponíveis em estoque" lendo do ERP.
- Quando uma rota faz `entrega` de um sanitário → automaticamente vincula à OS correspondente (se existir) ou cria movimentação avulsa.
- Quando faz `recolhimento` → libera o sanitário no ERP.

---

## Detalhes Técnicos

### Backend (novas tabelas + endpoints)

```text
erp_companies            (id, razao_social, cnpj, ie, endereco, telefone, email, logo_url, ativo)
erp_quotes               (id, numero, company_id, customer_id, modalidade, qtd, valor_unit,
                          valor_total, prazo_dias, status, observacoes, pdf_url, created_at)
erp_quote_items          (id, quote_id, descricao, qtd, valor_unit, valor_total)
erp_service_orders       (id, numero, quote_id?, company_id, customer_id, modalidade,
                          data_inicio, data_fim_prevista, data_fechamento, status,
                          valor, observacoes, pdf_url, created_at)
erp_os_sanitarios        (os_id, sanitario_id, alocado_em, devolvido_em)
erp_financial_entries    (id, tipo[receita|despesa], origem[os|manutencao|manual],
                          referencia_id, company_id, customer_id?, descricao,
                          valor, data_competencia, data_pagamento, status[pago|pendente|atrasado])
erp_os_monthly_billings  (id, os_id, mes_referencia, valor, pago, pago_em, financial_entry_id)
```

Endpoints novos sob `/api/erp/`:
- `companies` (CRUD, limite 3)
- `quotes` (CRUD, `POST /:id/pdf`, `POST /:id/convert-to-os`)
- `service-orders` (CRUD, `POST /:id/close`, `POST /:id/pdf`, `POST /:id/billing/:mes/pay`)
- `financial` (listagem com filtros, totalizadores)
- Job/cron: gera billings mensais + marca diárias atrasadas

### Frontend

Reestruturar `src/components/erp/` com tabs:
`Dashboard | Estoque | Sanitários | Funcionários | Veículos | Orçamentos | Ordens de Serviço | Financeiro`

- PDFs: usar `jspdf + jspdf-autotable` (já está no projeto via `PDFGenerator.tsx`) com template novo para Orçamento e OS.
- Notificações: usar o `toast` existente + criar tabela `notifications` simples para persistir as relevantes (OS criada, OS atrasada, mensalidade vencida).

### Sanitarios — Roteirização
- `src/pages/Sanitarios.tsx`: adicionar badge "Disponíveis em estoque: N" no topo.
- Bloquear alocação em rota se sanitário estiver `em_os` em OS aberta (com aviso, não erro fatal).

---

## Perguntas antes de começar

1. **Numeração de OS/Orçamento**: prefere sequencial simples (`OS-0001`, `ORC-0001`) reiniciando por ano, ou contínuo?
2. **PDF**: tem um modelo/layout de referência (logo, cores, campos obrigatórios fiscais)? Posso usar layout padrão limpo com a logo do CNPJ emissor por enquanto?
3. **Mensal — dia de cobrança**: a mensalidade vence sempre no dia que a OS foi aberta (ex.: OS aberta dia 10 → vence todo dia 10), ou dia fixo configurável (ex.: todo dia 5)?
4. **Estratégia de entrega**: posso entregar **Fase 1 + 2 + 3 (Sanitários migrados + CNPJs + Orçamentos com PDF)** primeiro num PR grande, depois Fase 4 (OS) e Fase 5 (Financeiro) na sequência? Ou prefere tudo de uma vez (vai demorar mais e ter mais risco de bugs)?

Responda essas 4 e eu começo a implementar.

---

## ✅ Fase 1+2 — Entregue nesta iteração

Implementado:
- Migration `database/migration-erp-companies.sql` (tabela `erp_companies` + trigger de limite 3).
- Backend `/api/erp/companies` (GET/POST/PUT/DELETE) com validação de limite e dedupe de CNPJ.
- Backend `GET /api/sanitarios/stock-summary` (contagem por status).
- Frontend: serviço `erpService.list/create/update/deleteCompany` + tipo `ErpCompany`.
- UI: nova seção **Empresas Emissoras (CNPJs)** em Configurações com CRUD inline.
- UI: 5 cards de resumo de estoque no topo da página `/sanitarios` (Disponíveis, Em cliente, Em OS, Manutenção, Total).

⚠️ **Deploy obrigatório antes de usar:**
```bash
psql -U lipe -d alchemyrotas -f database/migration-erp-companies.sql
sudo ./deploy.sh
```

## 🟡 Próximas fases (aguardando confirmação das 4 perguntas)

- Fase 3 — Orçamentos com PDF + botão "Converter em OS"
- Fase 4 — Ordens de Serviço (diária/mensal) com alocação de sanitários por numeração
- Fase 5 — Módulo Financeiro (receitas de OS + despesas de manutenção)
- Fase 6 — Integração total roteirização ↔ ERP
