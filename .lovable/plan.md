
# Plano de Implementação Completo

## 1. Rastreamento em segundo plano (mobile, ativo apenas em movimento)

- Adicionar plugin `@capacitor-community/background-geolocation` no app mobile.
- Configurar serviço foreground com notificação persistente "Rota em andamento".
- Filtro de movimento: só envia coordenada quando deslocamento > 50m (`distanceFilter: 50`).
- Atualizar `AndroidManifest.xml` com permissões: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`.
- Tela de onboarding pedindo "permitir o tempo todo" antes de iniciar a primeira rota.
- Backend já tem endpoint de tracking — apenas garantir envio em background via fila persistente (retry quando offline).
- Parar serviço automaticamente quando rota é finalizada.

## 2. Bug do campo telefone cortado em "Nova Rota"

- Em `src/components/RoutePointsTable.tsx`, ajustar largura mínima da coluna de telefone (`min-w-[160px]`) e remover `truncate` no input.
- Garantir `overflow-x: auto` no wrapper da tabela e padding interno do input adequado.

## 3. Categorias do ponto (dois campos separados) + Observação

Schema (`route_points`):
- Adicionar `point_category` enum: `obra`, `evento`.
- Adicionar `operation_type` enum: `entrega`, `recolhimento`, `manutencao`.
- `observation` já existe — manter.

UI (web e mobile):
- Dois selects no card/linha do ponto: "Categoria" e "Operação".
- Campo observação textarea (já existe em parte — padronizar).
- Validação: ambos obrigatórios ao salvar.

Lógica automática no app mobile ao concluir ponto:
- **Recolhimento**: modal pergunta quantidade recolhida vs `restroomsQty`. Se igual → ponto sai da rota (marcado como concluído e removido da lista ativa). Se menor → permanece na rota com quantidade restante atualizada.
- **Entrega (obra)**: ao concluir, `operation_type` muda automaticamente para `manutencao` e o ponto permanece fixo na rota até futuro recolhimento.
- **Manutenção**: marca concluído mas mantém na rota até recolhimento.
- **Evento**: comportamento padrão (sai ao concluir).

## 4. Fotos obrigatórias (3 mínimas) — entrega/recolhimento/manutenção

Backend:
- Nova tabela `point_photos` (id, route_id, point_id, file_path, operation_type, uploaded_at, uploaded_by).
- Endpoint `POST /mobile/route/:routeId/point/:pointId/photos` (multipart, multer, salva em `/var/www/.../uploads/photos/{routeId}/{pointId}/`).
- Endpoint `GET /routes/:id/photos` para listar.
- Servir estáticos via nginx em `/uploads`.

Mobile:
- Tela de conclusão de ponto exige 3 fotos antes de habilitar botão "Concluir / Próximo ponto".
- Usa `@capacitor/camera` (já presente) com fila offline (IndexedDB) para reenvio.
- Preview das 3 fotos antes de confirmar.

Web:
- Mostrar fotos no detalhe do ponto e na rota concluída.

## 5. Aba "Rotas Concluídas" (web)

Backend:
- Tabela `completed_routes` (snapshot) com: route_id, started_at, finished_at, driver_id, driver_name, truck_id, total_distance, total_duration, points_snapshot (JSONB), photos_count.
- Atualização incremental: a cada ponto concluído, gravar/atualizar registro com pontos finalizados + fotos. Ao finalizar rota → marca `finished_at`.
- Endpoints: `GET /completed-routes`, `GET /completed-routes/:id`, `GET /completed-routes/:id/download-photos` (zip).

Web — nova rota `/rotas-concluidas`:
- Listagem em cards: nome da rota, motorista, data/hora início, data/hora fim, distância, qtd pontos, qtd fotos.
- Filtros: período, motorista, caminhão.
- Modal de detalhe: linha do tempo dos pontos com horário de conclusão de cada um, miniaturas das fotos (lightbox), mapa com trajeto real (polyline gravada).
- Botão "Baixar todas as fotos (ZIP)" e "Exportar PDF".
- Atualização ao vivo via polling (ou WebSocket se já houver) enquanto rota está em andamento.

## 6. Otimizador para rotas grandes (50+ pontos)

Abordagem híbrida no backend (`googleMapsOptimizer.ts`):

1. **Matriz de distâncias** via Google Distance Matrix API em chunks de 10×10 (com tráfego em tempo real, `departure_time=now`, `traffic_model=best_guess`).
2. **Algoritmo local**:
   - Construção inicial: Nearest Neighbor a partir do ponto de origem.
   - Melhoria: 2-opt + Or-opt (mover sequências de 1–3 pontos) com limite de iterações.
   - Respeita pontos fixos (origem/destino) e categorias `manutencao` (fixos na rota).
3. **Cálculo final**: Directions API em chunks de 25 (limite Google) reagrupando para obter polyline completa, distância e tempo finais.
4. Cache de matriz em memória/Redis por 1h para evitar custo repetido.
5. Endpoint único `POST /routes/:id/optimize-intelligent` lida com qualquer quantidade.
6. Exposição de métrica esperada: economia de km/min vs. ordem original.

Limites práticos: até ~150 pontos com tempo de processamento <15s.

## Detalhes técnicos

```text
Frontend web                Backend (Express/PG)            Mobile (Capacitor)
─────────────               ─────────────────────           ──────────────────
RoutePointsTable     ───►   /routes/:id (PUT)        ◄───   AddExtraStopPage
CompletedRoutesPage  ───►   /completed-routes        ◄───   PhotoCapture (3 fotos)
PhotoLightbox        ───►   /uploads/photos/...      ◄───   BackgroundGeo (50m)
                            /optimize-intelligent     
                            (Distance Matrix + 2-opt)
```

Migrações SQL necessárias:
- `point_category`, `operation_type`, `manutencao_until` em `route_points`.
- Tabela `point_photos`.
- Tabela `completed_routes` + `completed_route_points`.

Permissões para usuário `lipe` aplicadas após cada migração.

## Ordem de execução

1. Migrações DB + permissões.
2. Backend: categorias, fotos (multer + nginx), completed_routes, otimizador híbrido.
3. Web: fix telefone, campos categoria/observação, página Rotas Concluídas.
4. Mobile: background geolocation, fluxo de fotos obrigatórias, modal recolhimento qty, transição entrega→manutenção.
5. Build APK + deploy backend/frontend no VPS.

## Pontos de atenção

- `@capacitor-community/background-geolocation` requer rebuild Android (não funciona via hot-reload).
- Storage de fotos no VPS: criar dir `/var/www/rota-azul-viagens/uploads/` com permissão e limite de 50MB já configurado no nginx.
- Backups: incluir `/uploads` no plano de backup do servidor.
- Compatibilidade: rotas existentes sem `point_category` ficam com default `obra`/`entrega` para não quebrar.
