## Objetivo

Transformar a aba **Medições** (dentro do Financeiro) e o **modal de criação/edição** num fluxo realmente premium — mais rápido de operar, mais claro visualmente e com menos cliques. Sem mudar backend, schema ou PDF: só UX/UI da aba e do dialog.

## 1. Aba "Medições" (dentro de `ErpFinanceiro.tsx`)

Hoje é uma tabela plana com filtros básicos. Vira um painel com 3 camadas:

### 1.1 Barra de KPIs (topo, 4 cards translúcidos)
- **Total do mês** (soma `total` da competência filtrada) + delta vs. mês anterior.
- **Nº de medições** no período.
- **Ticket médio** (total / nº).
- **Clientes distintos** medidos.

Cards seguem o padrão premium já usado em Pendentes (translúcido, ícone, número grande).

### 1.2 Filtros unificados numa única linha sticky
- Competência (input `month` — hoje é texto).
- Range de competências (de/até) — opcional, colapsável.
- Cliente (SearchableSelect, alimentado da lista já carregada).
- Empresa emissora (SearchableSelect).
- Busca livre (nº medição, cliente, item).
- Botão **Limpar filtros** aparece só quando há filtro ativo.

### 1.3 Lista de medições — dois modos comutáveis
Toggle **Tabela / Cards** (persiste em localStorage).

- **Tabela** (default desktop): virtualizada (`VirtualRows`, como Pendentes), colunas: Nº · Cliente · Competência · Período · Itens · Total · Ações. Linha inteira clicável → abre visualização. Menu de ações: Ver, Editar, Baixar PDF, Duplicar (nova ação), Excluir.
- **Cards** (default mobile): 1 card por medição, título com nº, cliente destacado, badges de competência/itens, total grande à direita, ações em ícones.

### 1.4 Ações que hoje faltam
- **Duplicar medição** (cria nova rascunho com mesmos itens, competência = mês atual).
- **Selecionar múltiplas** → botão "Baixar PDFs (zip)" e "Excluir selecionadas" (com confirm).
- Estado vazio ilustrado ("Nenhuma medição em <mês>. Criar primeira?" com CTA).

---

## 2. Modal de criação/edição (`MedicaoDialog.tsx`)

Hoje é um form vertical com muitos blocos empilhados. Vira um layout em **wizard leve de 3 passos numa única tela** (stepper no topo, todos visíveis, mas com foco visual no passo ativo), mantendo tudo num único dialog largo.

### 2.1 Cabeçalho
- Título dinâmico: "Nova medição" ou "Editar MED-2026-0012".
- Stepper: **1. Cliente & período** → **2. Itens** → **3. Revisão**.
- Chip de total ao vivo no canto direito do header (fica sempre visível durante o scroll).

### 2.2 Passo 1 — Cliente & período
- Grid 3 colunas atual, porém:
  - Ao escolher cliente, mostra mini-resumo: nº contratos ativos, valor mensal somado, última medição gerada (data + nº). Ajuda a decidir período.
  - Botões rápidos de período: **Este mês**, **Mês passado**, **Personalizado** (colapsa os inputs date).
  - Empresa emissora com preview do logo pequeno ao lado.

### 2.3 Passo 2 — Itens (o coração da mudança)
Layout em **duas colunas** dentro do dialog:

```text
┌─────────────────────┬──────────────────────────────┐
│  Contratos do       │  Itens da medição            │
│  cliente (esq.)     │  (dir.)                      │
│                     │                              │
│  [busca]            │  [lista virtualizada de rows]│
│  ▸ Contrato #123    │  ...                         │
│    - 2× Sanit.      │  subtotal / desconto / total │
│  ▸ Contrato #124    │                              │
└─────────────────────┴──────────────────────────────┘
```

- **Coluna esquerda**: cada contrato é um card colapsável. Ao expandir mostra os itens parseados da descrição (já implementado) mas com melhorias:
  - Cada draft tem checkbox → seleciona vários → **Adicionar selecionados** de uma vez.
  - Botão "Sugerir preço" ratea `valorMensal / soma(qtds)` como valor unit. sugerido (só sugere, editável).
  - "Copiar do último recibo deste contrato" — puxa preços praticados na última medição/recibo deste contrato (via `medicoesService.list({customerId})` filtrando itens do contrato). Um clique preenche os valores.
  - Ícone de status verde quando algum item daquele contrato já foi adicionado à direita.
- **Coluna direita**: itens adicionados como linhas compactas editáveis inline, agrupadas visualmente por contrato (header pequeno com nº do contrato). Cada linha: descrição · qtd · v.unit · desc · total, com botão remover. Drag handle para reordenar (dnd-kit) — a ordem vira `ordem` no payload.
- **Barra de ferramentas** acima da coluna direita: **+ Item avulso**, **Aplicar desconto por %** (aplica em todas as linhas selecionadas), **Limpar tudo**.

### 2.4 Passo 3 — Revisão
- Preview compacto no formato do PDF (mini-render sem gerar PDF real): cabeçalho da empresa + tabela dos itens + totais.
- Campo de **observações** (com sugestões rápidas em chips: "Vencimento em 10 dias", "Pagamento via PIX", etc. — chips inserem texto).
- Desconto geral em R$ ou %.
- Checkbox **"Baixar PDF ao salvar"** e **"Salvar e criar outra"** no footer.

### 2.5 Footer sticky
- Esquerda: total ao vivo grande + itens contados.
- Direita: **Cancelar** · **Salvar rascunho** (opcional, se quiser guardar sem gerar número — fora de escopo se preferir) · **Gerar medição** (primário).
- Atalhos de teclado: `Ctrl+Enter` salva, `Esc` fecha, `Ctrl+K` foca busca de contrato.

---

## 3. Melhorias transversais (aba + modal)

- **Autosave de rascunho** do modal em `localStorage` (chave por cliente + editing id) para não perder trabalho se fechar sem querer — restaura com toast "Rascunho recuperado · Descartar".
- **Loading skeletons** ao invés de `Loader2` genérico na lista de medições e nos contratos do cliente.
- **Toasts com ação**: ao gerar medição, toast "Medição MED-… gerada · Ver / Baixar PDF".
- **Acessibilidade**: labels em todos inputs, foco visível, `aria-live` no total ao vivo.
- **Empty states** ilustrados com CTA em vez de textos secos.

---

## 4. Escopo & arquivos

Só frontend/UI, sem backend, sem schema, sem PDF.

- `src/pages/erp/ErpFinanceiro.tsx` — refatorar bloco da aba "Medições" (KPIs, filtros, toggle tabela/cards, seleção múltipla, duplicar).
- `src/components/erp/MedicaoDialog.tsx` — reescrever layout: stepper, 2-colunas em Itens, revisão, footer sticky, atalhos, autosave.
- `src/components/erp/MedicaoViewDialog.tsx` — pequeno ajuste para acomodar botão "Duplicar" a partir da visualização.
- Novo (opcional): `src/components/erp/MedicaoItemRow.tsx` extraído do dialog pra manter arquivo enxuto.

Nada muda em `medicoes.ts` (service), rotas backend, migrations ou `medicaoPdf.ts`.

## 5. Fora de escopo (posso fazer depois, se quiser)

- Rascunho persistido em banco (hoje só localStorage).
- Envio da medição por e-mail/WhatsApp direto do modal.
- Vínculo automático medição → recibo (converter medição em recibo com 1 clique). É a evolução natural, mas fica pra próximo passo.
- Templates de medição salvos ("Locação mensal padrão").

## 6. Perguntas rápidas antes de partir pra implementação

1. Quer os **3 passos como stepper** (foco num de cada vez) ou tudo visível numa página só, ancorado por seções? (Stepper é mais premium mas exige 2-3 cliques; single-page é mais rápido pra quem já conhece.)
2. **Duplicar medição** e **selecionar múltiplas para excluir/baixar** entram no mesmo shipping ou deixo pro segundo?
3. **Rascunho em localStorage** com restauração automática — OK ou prefere sem?
4. **"Copiar do último recibo"** e **"Sugerir preço rateado"** — implementar ambos ou só um?