## Objetivo
Ao alocar um sanitário (aba Sanitários → "Alocar a cliente"), permitir:
1. Escolher a **empresa** a partir da lista de Clientes (dropdown com busca).
2. Informar **endereço manual** da obra/local onde o sanitário ficará (não precisa ser o endereço cadastrado da empresa).
3. Esse endereço fica salvo no sanitário e fica disponível para ser **puxado depois ao montar uma rota** (sem precisar redigitar).

## Mudanças

### Frontend — `src/pages/Sanitarios.tsx`
No modal/painel de "Alocar a cliente":
- Substituir o input livre de cliente por um **Combobox** que lista clientes da API `/api/customers` (com busca por nome).
- Adicionar campo **"Endereço da obra/local"** (texto livre), pré-preenchido com o endereço cadastrado do cliente quando ele é selecionado, mas editável.
- Campos opcionais: `lat/lng` (geocoding automático ao confirmar, usando o serviço de geocoding já existente).
- Ao confirmar, chamar `POST /api/sanitarios/movimentar` com `operationType: 'entrega'`, `customerName`, `address`, `lat`, `lng` — endpoint já aceita esses campos hoje, sem mudança de backend.

### Frontend — Criação de Rota (`src/components/RouteForm.tsx` / `RoutePointsTable.tsx`)
- Ao adicionar um ponto na rota, oferecer a opção **"Puxar de sanitário alocado"**: abre um seletor que lista sanitários com `status = 'em_cliente'` mostrando `numero | cliente | endereço`.
- Ao escolher, preenche automaticamente no ponto da rota: `customerName`, `address`, `lat`, `lng`, e adiciona o `numero` ao campo `sanitario_recolhidos` (recolhimento) ou `sanitario_numbers` (entrega) — o operador escolhe qual.
- Usa o endpoint existente `GET /api/sanitarios?status=em_cliente` (já implementado).

### Backend
Nenhuma mudança de schema necessária — `sanitarios.current_customer_name`, `current_address`, `current_lat`, `current_lng` já existem. Endpoint `/movimentar` já persiste tudo.

## Detalhes técnicos
- Combobox de clientes: usar `Command` + `Popover` (shadcn) consumindo `useCustomers()`.
- Geocoding do endereço manual: chamar `src/services/geocoding.ts` no submit (best-effort, não bloqueia).
- Seletor de sanitários alocados na rota: novo componente leve `SanitarioPickerModal.tsx` reutilizável.

## Fora de escopo
- Não cria tabela de "obras/locais" reutilizáveis (modelo simples solicitado).
- Não altera fluxo de Carretinhas, Checklists ou PDF.
