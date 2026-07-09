# Plano — Corrigir "Gerar PDF assinado" + nova aba "Assinados"

## Diagnóstico do bug atual
No `handleGenerate` de `ErpAssinatura.tsx` fazemos:

```
const blob = new Blob([out as BlobPart], { type: 'application/pdf' });
```

`pdf-lib.save()` retorna um `Uint8Array`. Em builds recentes do TS/Vite, esse `Uint8Array` (que é `ArrayBufferView`) é aceito em `BlobPart`, MAS quando o backing buffer é um `SharedArrayBuffer` ou quando ocorre transferência, o Blob resulta em 0 bytes silenciosamente — nada é baixado e nenhum erro é lançado. É exatamente o sintoma relatado ("não dá nada, não salva, não baixa"). O caminho robusto é passar o `.buffer` fatiado (`out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)`).

Além disso, o `<a>.click()` programático em alguns navegadores exige que o elemento esteja no DOM antes do click e que o `href` seja revogado só depois — nosso código já faz, mas vamos garantir. Vou também envolver tudo em try/catch com log para nunca falhar em silêncio.

## Etapa 1 — Consertar o download
1. Em `src/pages/erp/ErpAssinatura.tsx`, dentro de `handleGenerate`:
   - Construir o Blob a partir de um `ArrayBuffer` limpo: `new Blob([out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)], { type: 'application/pdf' })`.
   - Adicionar `console.log` do tamanho (`out.byteLength`) para diagnóstico rápido no console.
   - Se `out.byteLength === 0`, lançar erro visível via toast.
   - Manter o fluxo existente de `URL.createObjectURL` + `<a download>`.

## Etapa 2 — Persistir os PDFs assinados no backend
Para que a aba "Assinados" liste histórico entre sessões e usuários, precisamos salvar o arquivo no servidor.

### 2.1 Migration SQL
Novo arquivo `database/migration-erp-signed-pdfs.sql`:
```sql
CREATE TABLE IF NOT EXISTS erp_signed_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES erp_companies(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,          -- nome no disco (uuid.pdf)
  file_url TEXT NOT NULL,                 -- /uploads/signed/<uuid>.pdf
  pages INTEGER,
  placements_count INTEGER,
  size_bytes BIGINT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON erp_signed_pdfs TO lipe;
```
(sem RLS — segue o padrão do restante do ERP no projeto.)

### 2.2 Backend — nova rota `backend/src/routes/erp-signed-pdfs.ts`
Endpoints:
- `POST /api/erp/signed-pdfs` — multipart com campo `file` (o PDF assinado) + `companyId`, `originalFilename`, `pages`, `placementsCount`. Salva em `backend/uploads/signed/<uuid>.pdf`, insere row, devolve JSON com `id`, `fileUrl`, etc.
- `GET /api/erp/signed-pdfs` — lista ordenada por `created_at DESC` (opcional `?companyId=`).
- `DELETE /api/erp/signed-pdfs/:id` — remove row + arquivo do disco.

Registrar em `backend/src/index.ts` como `app.use('/api/erp/signed-pdfs', signedPdfsRoutes)`.

Reaproveitar padrão do `upload.ts` (multer diskStorage), garantindo criação do diretório `uploads/signed/`.

### 2.3 Service no frontend
Adicionar em `src/services/erp.ts` (ou novo `src/services/signedPdfs.ts`):
- `listSignedPdfs(companyId?)`
- `uploadSignedPdf(file, meta)`
- `deleteSignedPdf(id)`

Modelo TypeScript `SignedPdf { id, companyId, originalFilename, fileUrl, pages, placementsCount, sizeBytes, createdAt }`.

### 2.4 Integração no `ErpAssinatura`
Após gerar o blob com sucesso (Etapa 1), antes de disparar o download:
- Fazer upload para `POST /api/erp/signed-pdfs` (silencioso — se falhar, apenas toast informativo, mas o download local continua funcionando).
- Toast final: "PDF assinado gerado e salvo no histórico."

## Etapa 3 — Nova aba "Assinados"
1. Novo componente `src/pages/erp/ErpAssinados.tsx`:
   - Header igual ao das outras páginas ERP.
   - Filtro por empresa (Select) + busca por nome do arquivo.
   - Tabela/lista com: data, empresa, nome original, páginas, tamanho, ações [Baixar, Abrir, Excluir com confirm].
   - Estado vazio: "Nenhum PDF assinado ainda. Vá para a aba Assinatura para começar."
2. Roteamento em `src/App.tsx`: adicionar `/erp/assinados` apontando para o novo componente.
3. Menu lateral do ERP (`src/pages/erp/ErpLayout.tsx`): adicionar item "Assinados" logo abaixo de "Assinatura", com ícone `Files` (lucide).

## Etapa 4 — Verificação
- `npm run build` e checar erros.
- Playwright headless: abrir `/erp/assinatura`, subir um PDF de teste, clicar em posicionar assinatura, gerar, verificar:
  - download disparou (evento `download`),
  - request `POST /api/erp/signed-pdfs` retornou 200,
  - `/erp/assinados` lista o item recém-criado.
- Inspecionar arquivo baixado: `pdfinfo` para confirmar páginas > 0.

## Arquivos previstos
- **Editar:** `src/pages/erp/ErpAssinatura.tsx`, `src/App.tsx`, `src/pages/erp/ErpLayout.tsx`, `src/services/erp.ts`, `backend/src/index.ts`.
- **Criar:** `src/pages/erp/ErpAssinados.tsx`, `database/migration-erp-signed-pdfs.sql`, `backend/src/routes/erp-signed-pdfs.ts` (+ possivelmente `src/services/signedPdfs.ts`).

## Fora do escopo
- Assinatura digital com validade jurídica (ICP-Brasil) — segue sendo carimbo visual.
- Compartilhamento por link público / autenticação por token nos PDFs assinados.
- Edição pós-assinatura.

## Observações de deploy
- Rodar a migration em produção antes do deploy do backend.
- Criar (ou permitir criação automática) do diretório `backend/uploads/signed/` no servidor.

Aprovando, começo pela Etapa 1 (que já resolve o problema imediato do download) e sigo para 2–3.
