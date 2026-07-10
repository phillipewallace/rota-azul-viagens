## Objetivo

Ao invés de o usuário escolher produto num catálogo fixo, a medição vai **ler os itens direto do campo "descrição/objeto" do contrato** (`contract.descricao`). Cada linha reconhecida vira uma sugestão de item já preenchida (qtd + produto), que o usuário pode adicionar com 1 clique — ou editar antes.

## Como interpretar a descrição

O campo `descricao` é texto livre, então vou usar um parser simples e tolerante que reconhece linhas no estilo:

```text
2 Sanitários Químicos Comuns
1x Sanitário PNE
3 - Pia de Apoio
Cabine de banho
Locação mensal - 5 sanitários luxo
```

Regras do parser (por linha, ignorando vazias e cabeçalhos tipo "Objeto:"):
1. Extrai **quantidade** do começo da linha (`^\s*(\d+)\s*[x\-–:.)]?\s*`); se não achar, assume `1`.
2. O restante da linha vira **descrição do item** (trim, sem bullets `- • *`).
3. Sem inferência de preço — `valorUnit` inicia em `0` e o usuário preenche. (Alternativa que posso aplicar se preferir: ratear `valorMensal / soma(qtds)` como sugestão.)

Nada é adicionado automaticamente na tabela; cada item aparece como **sugestão clicável** dentro do card do contrato expandido.

## Fluxo novo no MedicaoDialog

1. Usuário escolhe cliente → lista contratos ativos (igual hoje).
2. Clica em **"Itens do contrato"** (substitui o botão "Produto" atual) no card do contrato → o card expande e mostra:
   - Um preview do texto da descrição (colapsável).
   - Uma **lista de itens detectados** (qtd editável + descrição editável + valor unit. editável), cada um com botão **"+ Adicionar"**.
   - Botão **"Adicionar todos"** no topo da lista.
   - Fallback quando `descricao` está vazia ou nada foi detectado: mensagem "Contrato sem itens na descrição" + botão **"Item avulso"** ligado ao contrato.
3. Botão **"Sugerir"** (linha única com `valorMensal`) e **"Item avulso"** continuam disponíveis como estão hoje.
4. Após adicionado, cada item vira uma linha normal na tabela de itens da medição (editável como já é), com badge do nº do contrato.

## Arquivos afetados

- `src/components/erp/MedicaoDialog.tsx` — único arquivo tocado:
  - Novo helper `parseContractItems(descricao: string): { quantidade: number; descricao: string }[]`.
  - Remove/renomeia o mini-form de "Produto" (catálogo fixo) — vira "Itens do contrato".
  - Remove `PRODUCT_CATALOG` e `productDraft` (não são mais necessários); mantém `rowFromProduct`, `rowSuggested`, `rowEmpty`.
  - Novo estado local por contrato expandido para editar as sugestões antes de adicionar.

Sem mudanças no backend, schema, PDF ou serviços.

## Fora de escopo

- Editar/estruturar o campo descrição no cadastro de contrato (continua texto livre).
- Vincular produtos ao contrato via tabela separada.
- Puxar sanitários efetivamente entregues (rota logística) — pedido diferente.
- Preço automático por item (posso adicionar rateio simples depois se quiser).

## Detalhes técnicos (parser)

```ts
function parseContractItems(text?: string) {
  if (!text) return [];
  return text
    .split(/\r?\n|;/)
    .map(l => l.replace(/^[\s\-•*]+/, '').trim())
    .filter(l => l && !/^(objeto|descri[cç][aã]o|itens?)\s*:?\s*$/i.test(l))
    .map(line => {
      const m = line.match(/^(\d+)\s*(?:x|un|unid|-|–|:|\.|\))?\s*(.+)$/i);
      if (m) return { quantidade: Number(m[1]) || 1, descricao: m[2].trim() };
      return { quantidade: 1, descricao: line };
    })
    .filter(x => x.descricao.length > 0);
}
```

Confirma que faz sentido assim, ou quer que eu (a) também sugira preço rateado a partir do `valorMensal`, e/ou (b) mantenha o catálogo fixo como fallback quando a descrição não bater?
