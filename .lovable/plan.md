# Plano — Corrigir pré-visualização do PDF na aba Assinatura

## Diagnóstico

A aba mostra "0 páginas · Clique na pré-visualização..." e nenhum canvas é desenhado. Isso significa que o `pdfjs.getDocument(...).promise` **falha ou nunca resolve** — por isso `numPages` fica em 0 e o `useEffect` de renderização não dispara.

Causas prováveis, em ordem:

1. **`pdfjs-dist` v6 (instalada: `^6.1.200`) é incompatível com o padrão de uso atual.**
   - A v6 é ESM-only, exige APIs muito recentes e mudou a assinatura de `page.render()` (o parâmetro `canvasContext` foi removido/alterado — hoje espera `{ canvas, viewport }`).
   - Nosso código passa `{ canvasContext, viewport, canvas }`, o que pode disparar throw dentro da Promise de render.
   - O worker importado via `pdfjs-dist/build/pdf.worker.min.mjs?url` precisa **casar exatamente** a versão do `pdf.mjs`. Em v6 há relatos de o worker não subir corretamente quando o Vite pré-bundleia o `pdfjs-dist` (o main roda como ESM, o worker como classic script, mismatch de versão → `getDocument` fica pendurado sem rejeitar).

2. **Falta de log/feedback do erro.** O `try/catch` em volta do `getDocument` só chama `toast`. Se a Promise fica pendurada (não rejeita), nem o toast aparece — é exatamente o sintoma "nada acontece".

3. **`pre-bundle` do Vite.** O `pdfjs-dist` costuma quebrar quando o Vite tenta otimizá-lo; a solução padrão é excluí-lo do `optimizeDeps` ou usar o build `legacy`.

## Passos da correção

### 1. Fixar versão estável do `pdfjs-dist`
- Downgrade para `pdfjs-dist@4.8.69` (última linha estável amplamente usada no ecossistema React/Vite, mesma major do worker exportado como `.mjs`, API `page.render({ canvasContext, viewport })` funcionando).
- Manter `pdf-lib` como está (não tem relação com o bug).

### 2. Ajustar o carregamento do worker
- Trocar a importação para o build **legacy** (mais tolerante em navegadores/Vite):
  - `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` → manter, mas usar a mesma major da lib para garantir versão idêntica.
- Configurar `GlobalWorkerOptions.workerSrc` **uma única vez** em módulo separado (`src/utils/pdfjsWorker.ts`) importado no topo da página, evitando duplicidade caso outras telas usem pdfjs no futuro.

### 3. Ajustar `vite.config.ts`
- Adicionar `optimizeDeps.exclude: ['pdfjs-dist']` para o Vite não pré-bundleá-lo (evita mismatch de versão main × worker).
- Adicionar `worker: { format: 'es' }` se necessário.

### 4. Corrigir `page.render(...)` em `ErpAssinatura.tsx`
- Passar apenas `{ canvasContext: ctx, viewport: scaled }` (retirar `canvas`, que é ignorado/errado dependendo da versão).
- Guardar a `RenderTask` retornada e chamar `.cancel()` no cleanup do `useEffect` (evita race entre render de páginas ao navegar rápido).

### 5. Melhorar feedback de erro
- Envolver `getDocument(...).promise` num `try/catch` que também loga `console.error` com o erro real.
- Adicionar timeout de 10s: se não resolver, mostrar toast "Falha ao ler o PDF (worker não carregou)".
- Mostrar no card, quando `pdfFile` está setado mas `pdfDoc` ainda não, a mensagem "Carregando PDF…" em vez do estado atual (que engana o usuário mostrando "0 páginas").

### 6. Sanidade dos bytes
- Passar `new Uint8Array(pdfBytes.slice(0))` para `getDocument({ data })` — algumas versões do pdfjs não aceitam `ArrayBuffer` puro e ficam em Promise pendente.

### 7. Verificação
- Rodar typecheck.
- Testar no navegador com um PDF simples: confirmar que:
  - o número de páginas aparece,
  - o canvas é desenhado,
  - navegação entre páginas funciona,
  - clique posiciona a assinatura,
  - "Gerar PDF assinado" baixa o arquivo com o carimbo correto.

## Arquivos a alterar

- **`package.json`** — downgrade `pdfjs-dist` para `^4.8.69`.
- **`vite.config.ts`** — `optimizeDeps.exclude` do `pdfjs-dist`.
- **`src/utils/pdfjsWorker.ts`** *(novo)* — configuração única do `workerSrc`.
- **`src/pages/erp/ErpAssinatura.tsx`** — usar o módulo do worker, ajustar `page.render`, cancelar `RenderTask`, melhorar feedback de erro/carregamento, converter bytes para `Uint8Array`.

## Fora do escopo

- Sem mudanças em backend, banco, ou na lógica de `pdfSignatureStamp.ts` (a geração final via `pdf-lib` não é afetada).
- Sem mexer em outras telas ERP.

Aprovando, eu aplico exatamente esses passos.
