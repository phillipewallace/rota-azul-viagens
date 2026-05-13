# Plano: App Mobile de Checklist + Aba Caminhões no ERP

Vamos pausar a aba de Gestão Interna e construir um novo fluxo completo para checklists de caminhões, dividido em duas partes que conversam pelo backend único (alchemyrotas.com/api).

## 1. Novo App Mobile — "Checklist Caminhões"

Diretório novo `mobile-checklist/` (separado do `mobile/` do motorista, para não interferir no app de rotas em produção).

### Fluxo do usuário
1. Tela inicial: input de placa → busca caminhão pelo backend (`GET /api/mobile/truck/:plate`, já existe).
2. Mostra dados do caminhão (nome, placa, modelo).
3. Abre formulário de checklist completo (ver seções abaixo) com observações por item.
4. Ao final pede:
   - Nome completo de quem assinou
   - RG ou CPF
   - Assinatura desenhada na tela (canvas → PNG base64)
5. Envia tudo ao backend e mostra confirmação.

### Checklist (extremamente completa, agrupada em categorias)
Cada item tem status (OK / Atenção / Crítico / N/A) + campo de observação opcional.

- **Documentação**: CRLV, seguro, ANTT, tacógrafo
- **Externo / Lataria**: para-choques, retrovisores, faróis, lanternas, setas, luz de freio, ré, placas, adesivos, vazamentos visíveis
- **Pneus e rodas**: dianteiros, traseiros, estepe, calibragem, sulcos, parafusos, calotas
- **Motor / Compartimento**: óleo motor, água radiador, fluido freio, fluido direção, arla, correias, mangueiras, bateria, filtros
- **Cabine interna**: cintos, bancos, painel, ar-condicionado, buzina, limpadores, palhetas, espelhos internos, rádio, triângulo, macaco, chave de roda, extintor, kit primeiros socorros
- **Freios e suspensão**: freio de serviço, freio de mão, ABS, ruídos, suspensão, amortecedores
- **Sistema elétrico**: setas, pisca-alerta, luz interna, luz da placa, faróis altos/baixos, neblina
- **Carroceria/Carreta** (quando aplicável): travas, lonas, ganchos, plataforma, hidráulico, conexões
- **Equipamentos sanitários** (específico do negócio): tanques, mangueiras, bombas, válvulas, vazamentos
- **Limpeza geral**: cabine, baú, externo
- **Combustível e KM**: nível combustível, hodômetro registrado, hora-início

Total estimado: 60-80 itens distribuídos. Componente reusável `ChecklistItem` com radio + textarea condicional.

### Identificação e assinatura
- Modal final com:
  - Input "Nome de quem assinou" (obrigatório, validação zod ≥ 3 chars)
  - Input "RG ou CPF" (obrigatório, mínimo 5 chars, sem máscara forçada)
  - Canvas de assinatura (`react-signature-canvas` ou implementação simples com pointer events) → exporta PNG
- Botão "Enviar checklist" só ativa quando 100% dos itens marcados + nome + documento + assinatura.

### Stack
- Vite + React + TypeScript + Tailwind + Capacitor (mesmo padrão do `mobile/` atual)
- API em `https://alchemyrotas.com/api`
- Endpoint base: `/api/checklists`

## 2. Backend — novas rotas e tabelas

### Schema (em `database/ensure-schema.sql`, idempotente — deploy aplica sozinho)

```sql
CREATE TABLE IF NOT EXISTS public.truck_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  truck_plate TEXT NOT NULL,
  truck_name TEXT,
  signer_name TEXT NOT NULL,
  signer_document TEXT NOT NULL,
  signature_url TEXT,            -- caminho /uploads/signatures/...
  odometer_km NUMERIC,
  fuel_level TEXT,
  general_notes TEXT,
  summary_status TEXT,           -- ok | attention | critical
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checklists_truck ON public.truck_checklists(truck_id);
CREATE INDEX IF NOT EXISTS idx_checklists_created ON public.truck_checklists(created_at DESC);

CREATE TABLE IF NOT EXISTS public.truck_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES public.truck_checklists(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  status TEXT NOT NULL,          -- ok | attention | critical | na
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON public.truck_checklist_items(checklist_id);
```

### Rotas novas (`backend/src/routes/checklists.ts`, registradas em `index.ts` como `/api/checklists`)
- `POST /api/checklists` — recebe payload completo + assinatura base64; transação atômica que insere checklist + itens; salva PNG da assinatura em `/uploads/signatures/<id>.png`.
- `GET /api/checklists` — lista com filtros: `truck_id`, `plate`, `from`, `to`, `status`, `signer`, paginação.
- `GET /api/checklists/:id` — detalhe com todos os itens.
- `DELETE /api/checklists/:id` — admin only.

## 3. Sistema principal — nova aba "Caminhões"

> Renomeio cuidadoso: já existe `/trucks` (cadastro). Esta nova aba será **"Checklists"** dentro do menu, ou um sub-tab "Checklists" na página de Caminhões. Confirmar abaixo.

### UI
- Página `src/pages/Checklists.tsx` rota `/checklists`.
- Filtros no topo: placa, motorista/assinante, período (data inicial/final), status (ok/atenção/crítico).
- Lista em cards (ou tabela) mostrando: data, placa, caminhão, signatário, status resumo, badge de itens críticos.
- Clique abre modal/drawer com checklist completa renderizada (todos os itens, observações, assinatura como imagem).
- Botão **Exportar/Imprimir** no detalhe → gera PDF A4 usando `jspdf` + `jspdf-autotable` (já padrão do projeto em `exporters.ts`) com cabeçalho, dados do caminhão, itens agrupados por categoria, observações, assinatura embutida e nome+documento do assinante.
- Botão "Imprimir" usa `window.print()` em uma view limpa como alternativa.

### Service
- `src/services/checklists.ts` com `listChecklists(filters)`, `getChecklist(id)`, `deleteChecklist(id)`.

### Menu
- Adicionar item "Checklists" em `src/pages/Index.tsx` (menu lateral) com ícone `ClipboardCheck`.

## 4. Deploy junto com o sistema (sem psql)

- Schema entra em `database/ensure-schema.sql` que já roda automático no `deploy.sh`. Você não toca no banco.
- Backend: novas rotas + uploads/signatures na build/deploy normal.
- Frontend principal: nova página entra no build atual.
- Mobile checklist: app separado com seu próprio `npm run build`. Servimos o build em `https://alchemyrotas.com/checklist/` (subpath) ou subdomínio. **Decisão necessária abaixo.**
- APK Android gerado por `npx cap sync && cap build` — você baixa e instala.

## 5. Pontos a confirmar antes de implementar

1. **Onde mostrar a aba no ERP**: nova entrada de menu chamada **"Checklists"** ou um sub-tab dentro da página `/trucks` existente?
2. **Distribuição do app mobile**: subpath web `alchemyrotas.com/checklist` + APK Android; ou só APK?
3. **Pausar Gestão Interna**: esconder o botão do menu (mantendo o código) ou remover totalmente as rotas?
4. **Pausa do projeto ERP de assignments**: descarto a próxima etapa (atribuições por funcionário) que estava em planejamento, certo?

Assim que você responder esses 4 pontos eu implemento tudo de uma vez (schema + backend + app mobile + aba no ERP + deploy).
