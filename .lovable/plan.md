## Diagnóstico

Hoje só o **menu mobile** (`src/mobile/MobileMenu.tsx`) tem "Sair da conta". Faltam:

- **Desktop – sistema principal**: sidebar aberto pelo botão Menu em `src/pages/Index.tsx` não tem logout.
- **ERP (desktop e mobile)**: `src/pages/erp/ErpLayout.tsx` (sidebar fixa à esquerda e a top bar mobile) não tem logout.

Resultado: em desktop e dentro do ERP não há como deslogar. O hook `useAuth().logout()` já existe e faz tudo (limpa token, desinstala o interceptor demo, redireciona pra `/login`, mostra toast) — é só plugar na UI.

## O que vou fazer

### 1. Sidebar do sistema principal (desktop) — `src/pages/Index.tsx`
- Importar `useAuth` e o ícone `LogOut` do lucide.
- No `SheetContent`, adicionar um rodapé fixo com:
  - **Nome do usuário logado** (ex.: "demo") em texto pequeno, `text-muted-foreground`.
  - **Botão "Sair da conta"** ocupando a largura, com ícone `LogOut`, estilo destrutivo suave (`text-destructive hover:bg-destructive/10`), foco visível, transição 200ms.
- Como o sidebar atual usa cores chumbadas (`bg-gray-900`, `text-white`), NÃO vou refatorar o restante — só garanto que o novo bloco use tokens semânticos e fique legível sobre o fundo escuro existente.

### 2. Layout do ERP — `src/pages/erp/ErpLayout.tsx`
- **Sidebar desktop**: adicionar, logo abaixo do bloco de nav, um rodapé (antes do texto "ERP conectado em tempo real…") com:
  - Chip discreto do usuário.
  - Botão "Sair" com ícone `LogOut`, largura total, hover suave, focus ring, `transition-colors duration-200`.
- **Top bar mobile do ERP**: adicionar um botão-ícone `LogOut` compacto no canto direito (ao lado do badge de overdue), `aria-label="Sair"`, min 44px de toque.

### 3. Confirmação antes de sair
- Usar o helper existente `src/lib/confirm.tsx` para pedir "Deseja mesmo sair?" antes de chamar `logout()`. Evita clique acidental sem virar modal pesado.

### 4. Design system e estados
- Zero cor chumbada nova: `text-destructive`, `bg-destructive/10`, `text-muted-foreground`, `border-border`.
- Estados: hover, focus-visible (ring do token), active `scale-[0.98]`, disabled com `opacity-50`, loading (spinner no botão enquanto `logout()` roda — na prática é síncrono, então só uso `disabled` durante o await).
- Transições 150–200ms, sem exagero.
- Mobile-first: alvos ≥ 44px, safe-area respeitada na top bar do ERP.

## Fora de escopo (não vou mexer)
- Não refatoro o sidebar antigo do `Index.tsx` (cores chumbadas Gray/Blue) — pedido é só adicionar logout.
- Não mexo em `MobileMenu.tsx` (já tem logout).
- Nada de backend, rotas ou lógica de autenticação — só UI.

## Arquivos que vou alterar
- `src/pages/Index.tsx` — bloco de logout no rodapé do Sheet.
- `src/pages/erp/ErpLayout.tsx` — logout na sidebar desktop e na top bar mobile.

Nenhum arquivo novo, nenhuma dependência nova.
