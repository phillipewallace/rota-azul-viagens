# Plano de Melhoria Visual e Funcional - AlchemyOps

O objetivo deste plano é melhorar a legibilidade das Ordens de Serviço (OS) no App do Funcionário e no ERP, organizando melhor os itens (Sanitários vs. Serviços) e refinando o fluxo de execução para serviços genéricos.

## Mudanças Propostas

### 1. App do Funcionário (Frontend)
- **Visual Estruturado dos Cards de OS**:
  - Redesenhar os cards na agenda para destacar o número da OS, cliente, endereço e status de forma mais clara.
  - Usar cores semânticas para diferenciar visualmente os status.
- **Lista Categorizada de Itens**:
  - Dentro do detalhe da OS, separar os itens em "Sanitários" e "Serviços/Produtos".
  - Mostrar quantidades de forma proeminente (ex: "3x Sanitário Comum").
- **Fluxo "Passo a Passo" para Serviços Genéricos**:
  - Implementar uma interface guiada para serviços que não são sanitários:
    1. Verificação do item.
    2. Espaço para fotos (com preview melhorado).
    3. Campo de relato obrigatório com dicas de preenchimento.

### 2. Painel ERP (Administrativo)
- **Melhoria na Exibição de Itens da OS**:
  - Atualizar o modal de detalhes da OS em `ServiceOrders.tsx` para refletir a mesma organização categorizada do App.
  - Exibir fotos de finalização em um tamanho maior ou com opção de zoom facilitada.

### 3. Backend (API)
- **Otimização de Retorno de Dados**:
  - Garantir que a API de OS (`/os`) retorne informações completas sobre os tipos de itens para que o frontend possa categorizá-los corretamente sem processamento extra pesado.

## Detalhes Técnicos
- **Componentes**: Uso de `Card`, `Badge` e `ScrollArea` do Shadcn UI com estilização customizada.
- **Icons**: Uso de `Lucide-React` para sinalização visual de categorias.
- **UX**: Implementação de animações suaves na transição do "Passo a Passo".

---
*Este plano foca na legibilidade e organização, conforme solicitado, mantendo a compatibilidade com o fluxo multi-sanitários já existente.*
