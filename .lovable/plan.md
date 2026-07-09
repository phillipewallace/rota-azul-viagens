# Aba "Assinatura" — carimbar assinatura da empresa em qualquer PDF

Fluxo: usuário abre a aba, escolhe a empresa (que já tem `assinatura_url` cadastrada), faz upload de um PDF, visualiza páginas, clica/arrasta o retângulo onde a assinatura deve ficar (com página selecionada), e o sistema gera um novo PDF com a imagem da assinatura carimbada exatamente naquele ponto. Tudo client-side, sem alterações de backend nem de banco.

## Passos

### 1. Dependências
- Adicionar `pdf-lib` (edição do PDF final) e `pdfjs-dist` (renderização das páginas para pré-visualização). Nenhuma outra lib.

### 2. Nova página / rota
- Criar `src/pages/erp/ErpAssinatura.tsx`.
- Registrar rota em `src/App.tsx` sob o layout ERP (ex.: `/erp/assinatura`).
- Adicionar item de menu "Assinatura" no `ErpLayout.tsx` (mesmo padrão dos outros itens).

### 3. Componente da página — 3 blocos
1. **Seletor de empresa**: dropdown com `erpService.listCompanies()`. Se a empresa não tiver `assinaturaUrl`, mostra aviso e link para Configurações → Empresas.
2. **Upload + preview**:
   - Input de arquivo `.pdf` (drag&drop opcional).
   - Renderiza cada página via `pdfjs-dist` num `<canvas>` (uma por vez, com navegação Página anterior/próxima).
   - Overlay clicável: usuário clica na posição desejada; aparece um retângulo arrastável/redimensionável simples mostrando a prévia da assinatura (usa a imagem da `assinaturaUrl`).
   - Guarda por página: `{ page, xPct, yPct, wPct, hPct }` em pontos percentuais relativos ao tamanho da página (independente de zoom).
   - Botão "Aplicar em todas as páginas" (opcional, checkbox).
3. **Ações**: "Gerar PDF assinado" (baixa `assinado-<nome>.pdf`) e "Limpar".

### 4. Geração do PDF assinado (`src/utils/pdfSignatureStamp.ts`)
- Carrega o PDF original com `PDFDocument.load`.
- Baixa a imagem da assinatura (`assinaturaUrl`) e faz `embedPng`/`embedJpg` conforme o mime.
- Para cada marcação: converte percentuais para coordenadas em pontos PDF (lembrando que o eixo Y do pdf-lib é bottom-up) e faz `page.drawImage(sig, { x, y, width, height })`.
- Retorna `Uint8Array` que a página salva via `Blob` + `saveAs`.

### 5. Detalhes de UX
- Zoom fixo (largura ~800px) para simplicidade; navegação por miniaturas opcional em versão futura.
- Retângulo padrão ~180×60 px de canvas, redimensionável nos cantos.
- Delete da marca com tecla Delete ou botão "Remover".
- Toast de sucesso ao gerar.

### 6. Fora do escopo (deixado claro no plano)
- Sem validade jurídica formal (ICP-Brasil), sem trilha de auditoria, sem envio por link — é apenas carimbo visual da assinatura já cadastrada da empresa no PDF que o usuário enviar. Para assinatura eletrônica com validade, seguir caminho separado (opções A/B da conversa anterior).

## Arquivos
- **Novos**: `src/pages/erp/ErpAssinatura.tsx`, `src/utils/pdfSignatureStamp.ts`, componente interno `SignaturePlacer` (dentro da própria página ou `src/components/erp/SignaturePlacer.tsx`).
- **Editados**: `src/App.tsx` (rota), `src/pages/erp/ErpLayout.tsx` (menu), `package.json` (deps).

Aprovando, eu implemento na sequência.
