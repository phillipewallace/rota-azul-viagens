# Plano: Resolver os 25 itens da revisão V2

Objetivo: deixar o sistema V2 (fotos, sanitários, rotas concluídas, tracking BG, otimizador híbrido) 100% funcional, seguro e consistente em web + mobile + backend.

## 1. Backend — Bugs críticos

1. **Photo URL mismatch**: alinhar mobile e backend em `POST /api/photos/route/:routeId/point/:pointId/photos` (mobile hoje envia sem `/photos` no fim). Corrigir `mobile/src/services/photoUpload.ts`.
2. **finish-route não cria snapshot**: em `backend/src/routes/mobile.ts` (`/truck/:id/finish-route`) chamar internamente a lógica de `completed-routes/:routeId/finish` (copiar pontos, fotos, distância, duração) dentro de uma transação.
3. **Mapeamento perdido em update de ponto**: `backend/src/routes/mobile.ts` PUT `/truck/:truckId/route/point/:pointId` aceita só `completed`. Estender para `recolhidoQty`, `autoRemoved`, `sanitarioRecolhidos`, `sanitarioNumbers`, `operationType`, `observation` e gravar com COALESCE/defaults.
4. **Atomicidade em sanitários**: `POST /api/sanitarios/movimentar` envolver UPDATE de `sanitarios` + INSERT em `sanitario_movimentacoes` em `BEGIN/COMMIT/ROLLBACK`. Validar números existentes antes.
5. **Auto-criação de sanitário**: quando o motorista digita um número novo, criar automaticamente em `sanitarios` (status `em_cliente`) dentro da mesma transação.
6. **Photos sync count**: incluir contagem por ponto (não só por rota) em `point_photos` para `completed_routes` ter detalhe.
7. **Tracking purge + índice**: migration adicionando `CREATE INDEX IF NOT EXISTS idx_tracking_brin ON tracking_locations USING BRIN (recorded_at)` e job de purge (`DELETE WHERE recorded_at < NOW() - INTERVAL '30 days'`) via endpoint cron-friendly `/api/tracking/purge`.
8. **HybridOptimizer**:
   - Remover Google API key hardcoded → usar `process.env.GOOGLE_MAPS_API_KEY`.
   - Trocar `matrixCache` por LRU (limite 50 matrizes).
   - 2-opt/Or-opt respeitando pontos fixos (origem, destino, `manutencao`).
   - Distance Matrix em chunks de 10x10 (limite Google) com merge.
   - Fallback graceful quando matriz falha (usar distância haversine).
9. **Routes update**: garantir colunas `sanitario_numbers`, `sanitario_recolhidos`, `recolhido_qty`, `auto_removed`, `operation_type`, `category` com defaults seguros e `Array.isArray` checks (revisar INSERT/UPDATE em `routes.ts`).

## 2. Backend — Segurança

10. **requireAuth** middleware em todos os novos routers: `photos.ts`, `tracking.ts`, `sanitarios.ts`, `completed-routes.ts`. Criar `backend/src/middleware/requireAuth.ts` (já existe padrão em `auth.ts` — extrair).
11. **Rate limit** simples (memória) para `POST /api/tracking/location` (1/s por truck) para evitar flood.
12. **Validação de tipos**: usar checks (`typeof`, `isUUID`) em todos os params; retornar 400 explícito.
13. **CORS**: adicionar `capacitor://localhost`, `http://localhost`, `https://localhost`, `ionic://localhost` à allowlist em `backend/src/index.ts`.
14. **Photos fileFilter**: bloquear extensões duplas e validar mime real (`image/jpeg|png|webp`).
15. **Multer storage**: limitar 10 fotos/request e 15MB cada (já existe) + sanitizar `routeId/pointId` como UUID antes de criar diretório.

## 3. Mobile — Bugs e UX

16. **photoUpload endpoint**: corrigir URL para `/photos/route/:r/point/:p/photos` e enviar header `Authorization`.
17. **Fila offline**: ao iniciar app, chamar `flushQueue()` (já existe listener `online`, falta no boot).
18. **MobileDriver flow**: garantir sequência Operação → Quantidade (recolhimento) → Números sanitários → Fotos (3 mín) → PUT ponto com TODOS os campos (`recolhidoQty`, `autoRemoved`, `sanitarioNumbers`, `sanitarioRecolhidos`, `operationType`).
19. **Background tracking**: iniciar em `MobileDriver` quando rota carrega; parar em finish-route; persistir `watcherId` para sobreviver re-render.
20. **useMobile mapping**: mapear `sanitario_numbers` ↔ `sanitarioNumbers` no fetch e no PUT.
21. **AndroidManifest**: adicionar permissões `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `CAMERA`.

## 4. Web — UX e consistência

22. **RoutePointsTable**: validar input de sanitários (apenas números separados por vírgula, trim, dedupe) antes de salvar.
23. **Página Sanitarios**: refresh após movimentação manual; mostrar última localização GPS (join com `tracking_locations` se disponível).
24. **CompletedRoutes**: corrigir link de download `photos.zip` e exibir count por ponto.

## 5. Config / Deploy

25. **Documentar** em `DEPLOY_V2.md`: migration combinada (`migration-v2-categorias-fotos-concluidas.sql` + `migration-v2-sanitarios.sql` + novo índice BRIN), nova env `GOOGLE_MAPS_API_KEY` no backend, restart `pm2 restart rota-azul-backend`, rebuild APK com permissões.

## Detalhes técnicos

- Novo arquivo: `backend/src/middleware/requireAuth.ts` (extrai JWT de `Authorization: Bearer`, valida via `jsonwebtoken`, anexa `req.user`).
- Novo arquivo: `backend/src/utils/lruCache.ts` (LRU simples).
- Nova migration: `database/migration-v2-fixes.sql` (índice BRIN, colunas faltantes, defaults).
- Mobile: registrar `flushQueue()` em `mobile/src/App.tsx` no mount.
- HybridOptimizer: refatorar `optimize()` para receber `fixedIndices: number[]` e nunca permutá-los nos swaps.

## Entregáveis

- Backend: 4 arquivos novos + edits em `index.ts`, `mobile.ts`, `photos.ts`, `tracking.ts`, `sanitarios.ts`, `completed-routes.ts`, `routes.ts`, `hybridOptimizer.ts`.
- Mobile: edits em `photoUpload.ts`, `MobileDriver.tsx`, `App.tsx`, `useMobile.ts`, `AndroidManifest.xml`.
- Web: edits em `RoutePointsTable.tsx`, `Sanitarios.tsx`, `CompletedRoutes.tsx`.
- DB: 1 nova migration SQL.
- Docs: `DEPLOY_V2.md` atualizado.

Após aprovação, implemento tudo em sequência e listo os comandos exatos de deploy (psql + pm2 + cap sync).
