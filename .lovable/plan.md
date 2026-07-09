# Exportar recibos por período (ZIP)

Sim, é totalmente possível. Os recibos já ficam armazenados permanentemente na tabela `erp_receipts` (as abas "Pendentes" e "Pagos do mês" são só *views* filtradas — nada é apagado). A aba "Recibos" continua sendo o histórico completo, e vamos adicionar ali um botão para baixar em lote por intervalo de datas.

## 1. UI — aba "Recibos"

- Novo botão **"Exportar período"** (ícone `Download`) no header da aba, ao lado dos filtros existentes.
- Ao clicar, abre um **modal** (`Dialog` shadcn) com:
  - Campo **Data inicial** (date picker shadcn, `pointer-events-auto`).
  - Campo **Data final** (date picker shadcn).
  - Filtro opcional (checkbox): **"Incluir recibos sem validade jurídica"** — default ligado, respeitando a separação de abas.
  - Botão **Cancelar** e **Gerar ZIP** (com spinner enquanto processa).
- Validações no modal:
  - Ambas as datas obrigatórias.
  - Data final ≥ data inicial.
  - Aviso (toast) se o período retornar 0 recibos.
- Feedback: toast "Gerando X recibos…" → download automático do arquivo → toast de sucesso.

## 2. Geração do ZIP (frontend, sem backend novo)

Para evitar migração/rota nova e manter o PDF idêntico ao que já é emitido individualmente, o ZIP é montado **no navegador**:

- Buscar recibos do período via endpoint já existente `/erp/receipts` (adicionar params `from` / `to` na query se ainda não suportar — filtro simples por `data_emissao`).
- Para cada recibo retornado, chamar a função `generateReceiptPdf` já usada hoje (mesmo layout, mesmo nome de arquivo, respeitando `numero_display` para recibos sem validade).
- Empacotar com **JSZip** (lib leve, ~100kb, já compatível com o stack Vite/React) → gera `Blob` → dispara download via `URL.createObjectURL` + `<a download>`.
- Nome do arquivo: `recibos_YYYY-MM-DD_a_YYYY-MM-DD.zip`.
- Dentro do zip, subpastas opcionais: `com-validade/` e `sem-validade/` para facilitar organização contábil.

**Por que frontend e não backend:**
- O PDF é gerado hoje no cliente (`src/utils/receiptPdf.ts`), então mover para backend duplicaria código.
- Zero mudança de infra, zero migração, deploy imediato.
- Se o período for muito grande (>200 recibos), mostramos progresso ("Gerando 45/120…") e um aviso sugerindo dividir o período.

## 3. Escopo técnico

**Arquivos afetados:**
- `src/pages/erp/ErpFinanceiro.tsx` — botão + modal + handler de exportação na aba "Recibos".
- `src/services/contracts.ts` (ou `erp.ts`) — garantir que `listReceipts` aceite `from` / `to` (se ainda não aceita).
- `backend/src/routes/erp-receipts.ts` — se necessário, aceitar `?from=&to=` no `GET /` (filtro `WHERE data_emissao BETWEEN`). Sem migração.
- Nova dependência: `jszip` (via `bun add jszip`).

**Fora do escopo:**
- Nenhuma alteração em Pendentes, Pagos do mês, Sem validade.
- Nenhuma migração de banco.
- Sem envio por e-mail (posso adicionar depois se quiser).
- Sem `.rar` (formato proprietário, sem lib JS decente) — `.zip` é o padrão universal e abre em qualquer sistema.

## 4. Fluxo final do usuário

```text
Financeiro → aba Recibos → [Exportar período]
   ↓
Modal: 01/01/2026 até 31/01/2026  [Gerar ZIP]
   ↓
Toast "Gerando 42 recibos…" (progresso)
   ↓
Download: recibos_2026-01-01_a_2026-01-31.zip
   └── com-validade/
   │     ├── 0123.pdf
   │     └── 0124.pdf
   └── sem-validade/
         └── 0001.pdf
```

Aprovando, implemento nessa ordem.
