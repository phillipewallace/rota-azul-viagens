# Corrigir 500 em todas as rotas do backend

## Diagnóstico

Login funciona (200), mas **todas** as queries (`/trucks`, `/routes`, etc.) retornam 500. Causa: o banco da VPS está com schema antigo — falta colunas que as queries SELECT.

A auto-migração defensiva em `backend/src/config/database.ts` hoje só cobre 7 colunas de `route_points`/`routes`. Falta cobrir `trucks`, `drivers`, `schedules`, `customers`, `maintenance_records` e o resto de `routes`.

## Solução

Expandir `ensureCols` em `backend/src/config/database.ts` para garantir (via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) **todas** as colunas que o código SELECT/INSERT usa. Operação 100% idempotente, não toca dados.

### Colunas a garantir

**trucks:** `current_route TEXT`, `driver TEXT`, `current_route_id UUID`, `current_driver_id UUID`, `location_lat NUMERIC`, `location_lng NUMERIC`, `mileage INTEGER DEFAULT 0`, `last_maintenance DATE`, `status TEXT DEFAULT 'available'`, `updated_at TIMESTAMP DEFAULT now()`, `created_at TIMESTAMP DEFAULT now()`

**routes:** `description TEXT`, `total_distance NUMERIC`, `estimated_time INTEGER`, `estimated_duration INTEGER`, `optimized_order JSONB`, `polyline TEXT`, `status TEXT DEFAULT 'active'`

**drivers:** `phone TEXT`, `license TEXT`, `license_expiry DATE`, `status TEXT DEFAULT 'active'`, `created_at`, `updated_at`

**schedules / customers / maintenance_records:** garantir colunas usadas pelos respectivos `routes/*.ts` (varre rapidamente cada arquivo de rota antes de finalizar a lista).

### Tabelas auxiliares com `CREATE TABLE IF NOT EXISTS`
- `truck_location_history (truck_id, lat, lng, recorded_at)` — usada em `PUT /trucks/:id/location`.

### Logs melhores
Adicionar no `catch` de `/trucks` e `/routes` o `error.message` do Postgres no log (continua escondido do cliente). Isso garante que próxima falha apareça nominal no `pm2 logs` em vez de só "Erro ao buscar X".

## Como aplicar

```
cd /var/www/rota-azul-viagens
git pull        # ou SKIP_GIT=1 bash deploy.sh se repo privado
sudo bash deploy.sh
```

Backend reinicia → auto-migração roda → colunas faltantes são criadas → 500 some. **Nenhum dado é perdido.**

## Arquivos alterados

- `backend/src/config/database.ts` — expandir `ensureCols` + criar `truck_location_history`.
- `backend/src/routes/trucks.ts` e `backend/src/routes/routes.ts` — logar `error.message` real do PG no `catch`.
