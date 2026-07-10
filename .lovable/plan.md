# Plano: Dropdowns pesquisáveis em todo o sistema

## Objetivo
Hoje quase todos os campos de seleção usam `<Select>` do shadcn (baseado em Radix), que não tem busca embutida — precisa rolar/clicar letra por letra. Vamos trocar por um combobox com input de busca (Command + Popover), mantendo a mesma aparência e comportamento (label, placeholder, valor controlado), mas com filtro por texto.

## Abordagem (chave para não virar refatoração gigante)

Criar **um único componente reutilizável** `SearchableSelect` que:
- Recebe as mesmas props que já usamos hoje: `value`, `onValueChange`, `placeholder`, `disabled`, opções `{ value, label, hint? }[]`.
- Renderiza um botão estilizado igual ao `SelectTrigger` atual (mesma altura, borda, foco) para não quebrar layout.
- Ao abrir, mostra um `CommandInput` (busca) + lista filtrada por `label` (e por `hint` opcional, ex.: placa do caminhão).
- Suporta “Todos” / opção especial no topo (ex.: `all`).
- Suporta grupos (opcional) e opção “nenhum encontrado”.
- Fecha ao selecionar; tecla `Enter` seleciona o primeiro resultado.

Assim substituímos cada `<Select>` por `<SearchableSelect options={...} />` em poucas linhas, sem reescrever cada tela.

## Passo a passo

### 1. Componente base
- Criar `src/components/ui/searchable-select.tsx` usando `Popover` + `Command` (já presentes no projeto, ver `SanitarioMultiCombobox` como referência).
- Largura do popover = largura do trigger (via `triggerRef.offsetWidth`).
- Acessibilidade: `role="combobox"`, `aria-expanded`, navegação por teclado nativa do `Command`.

### 2. Levantamento dos Selects existentes
Rodar `rg "from \"@/components/ui/select\"" -l` para listar todos os arquivos. Áreas conhecidas que serão migradas:
- Filtros: `DateFilters`, `ManagementFilters`, `MaintenanceFilters` (mês, ano, caminhão, rota, status, tipo).
- Rotas: `CreateRouteModal`, `RouteForm`, `RoutePointsTable` (motorista, caminhão, cliente).
- Cadastros: `TruckForm`, `DriverForm`, formulários de `Customers`, `Sanitarios`, `Carretinhas`.
- ERP: `MedicaoDialog`, `RegistrarPagamentoDialog`, `BoletoVencimentoDialog`, `ContractViewDialog`, `ErpFinanceiro`, `ErpContracts`, `ErpCompanies`, `ErpQuotes`, `ServiceOrders`, `Checklists`, `Settings` (usuários/empresas/templates).
- Manutenção: `MaintenanceModal`.
- Mobile web (`src/mobile/*`): telas com seleção de rota/caminhão.

### 3. Migração incremental
Para cada arquivo:
- Importar `SearchableSelect` no lugar de `Select/SelectTrigger/SelectContent/SelectItem`.
- Converter o array de `<SelectItem>` em `options={[{value,label,hint?}]}`.
- Manter `value` e `onValueChange` exatamente como estão.
- Selects com poucas opções fixas e sem ganho real de busca (ex.: 2–3 itens tipo “Sim/Não”, “Ativo/Inativo”): **manter** como estão — busca só atrapalha.

Critério “tem busca”: 5+ opções OU lista dinâmica (caminhões, motoristas, clientes, contratos, rotas, empresas, categorias, meses).

### 4. Casos especiais
- Onde já existe combobox custom (ex.: `SanitarioMultiCombobox`, autocomplete de cliente em `MedicaoDialog`), **não mexer** — já são pesquisáveis.
- Selects nativos `<select>` HTML puro (se houver algum) serão convertidos junto.
- Mobile driver app (`mobile/src/*`) é um projeto separado — **fora do escopo** deste pedido, a menos que você peça explicitamente.

### 5. Verificação
- `tsgo` para garantir que a API do novo componente bate em todos os call sites.
- Abrir manualmente as telas mais usadas (Rotas, Manutenção, Financeiro, Medições) e confirmar que:
  - O visual do trigger continua idêntico.
  - Digitar filtra a lista.
  - Selecionar preenche o valor e fecha o popover.
  - Filtros “Todos” continuam funcionando.

## Fora do escopo
- Mudar lógica de negócio, endpoints ou dados.
- Redesenhar formulários.
- App mobile nativo (Capacitor).

## Detalhes técnicos (para referência)
- Stack: shadcn `Popover` + `Command` (cmdk) já instalados.
- Sem novas dependências.
- Componente aceita `className` para casos que precisam largura customizada.
- Fallback: se `options` estiver vazio, mostra “Sem opções”.

Aprova que eu já implemento?
