# Bug: Pendentes somem ao voltar de outra sub-aba

## Diagnóstico

Em `src/pages/erp/ErpFinanceiro.tsx` (linhas ~181-195), o carregamento de dados é feito por um único `load` acoplado aos filtros da aba **Recibos**:

```ts
const load = useCallback(async () => {
  const [p, r] = await Promise.all([
    receiptsService.pending(competencia),
    receiptsService.list(filterFrom || filterTo || quick !== 'none' ? {} : { competencia }),
  ]);
  setPendentes(p.pendentes);
  setRecibos(r);
}, [competencia, filterFrom, filterTo, quick]);

useEffect(() => { load() }, [load]);
```

Problema em cadeia:

1. O usuário entra em outra sub-aba (ex.: **Recibos**, **Pagos**, **Sem validade**) e mexe em qualquer filtro dessa aba (`filterFrom`, `filterTo`, `quick`, ou chips rápidos).
2. Como o `load` depende desses filtros, o `useEffect` dispara um **novo request de `/erp/receipts/pending`** — desnecessário para essa aba, e usando a `competencia` como parâmetro.
3. Se qualquer coisa nesse novo ciclo falhar silenciosamente (rede lenta, erro tratado como toast, request estourando `mountedRef`, ou simplesmente o React reordenar o `Promise.all` com um resultado vazio momentâneo), o `setPendentes(p.pendentes)` acaba sendo chamado com lista vazia — e a UI de Pendentes fica em branco até o próximo `load` (que só acontece com refresh da página, porque nenhum filtro de Pendentes existe hoje para re-disparar).
4. Além disso, o `setLoading(true)` global re-renderiza a página inteira: se o request de pendentes demora e o usuário volta rápido para a aba, o virtualizador `VirtualRows` remonta com `items=[]` até a resposta chegar.

Também há um efeito colateral do padrão atual: **mexer em filtros da aba Recibos re-baixa pendentes**, o que gasta rede/CPU à toa e é a raiz da instabilidade.

## Correção proposta

**Separar os dois carregamentos**, cada um com sua dependência real:

- `loadPendentes` → depende só de `[competencia]`. Chamado no mount, ao trocar competência e via botão "Atualizar".
- `loadRecibos` → depende de `[competencia, filterFrom, filterTo, quick]` (filtros da aba Recibos). Chamado no mount, ao trocar competência, e quando esses filtros mudam.
- Cada função usa seu próprio flag de loading (`loadingPendentes`, `loadingRecibos`) para não piscar a página inteira, e o botão "Atualizar" no header chama os dois em paralelo.
- Manter o `mountedRef` guard como está para evitar `setState` após unmount.

**Efeito da correção:**

- Mexer em filtros de "Recibos" **não toca mais** em `pendentes` → o bug do sumiço é eliminado na raiz.
- Menos requisições ao backend.
- Menor re-render da tela toda.

## Escopo

**Arquivo único afetado:**
- `src/pages/erp/ErpFinanceiro.tsx` — refatorar o bloco `load` / `useEffect` em duas funções e dois efeitos separados; ajustar o handler do botão "Atualizar" (se existir) para chamar as duas.

**Fora do escopo:**
- Nenhum novo filtro na aba Pendentes (fica para o próximo pedido).
- Nenhuma mudança em backend, rotas, migração, ou nas outras abas.

## Validação

- `tsgo --noEmit`.
- Fluxo manual: abrir Financeiro → alternar entre Pendentes / Recibos / Pagos / Sem validade / Gastos várias vezes, mexer em filtros da aba Recibos, voltar em Pendentes → a lista continua populada sem precisar de refresh.
- Verificar no console/network que o request `/erp/receipts/pending` só dispara quando muda competência ou clica em "Atualizar".

Aprovando, implemento.
