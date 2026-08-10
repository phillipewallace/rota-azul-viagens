#!/usr/bin/env bash
###############################################################################
# Alchemy Rotas — Deploy local na VPS (sem SSH, sem senha)
#
# Uso (DENTRO da VPS, dentro da pasta do repositório git clonado):
#   sudo ./deploy.sh
#
# O que ele faz (idempotente, pode rodar sempre):
#   1) git pull do branch atual
#   2) Garante node 20, pm2, postgres, nginx (instala se faltar)
#   3) Garante DB 'roteirizador1' + usuário 'lipe' com a senha já usada
#   4) Aplica todos os database/*.sql (idempotentes)
#   5) Instala deps + builda backend (TS) + builda frontend (Vite)
#   6) Publica frontend em /var/www/alchemyrotas
#   7) Cria/garante vhost nginx e reinicia pm2 + nginx
###############################################################################
set -euo pipefail

# ─── Config (mesmos valores que já estão em backend/.env) ───────────────────
DB_NAME="${DB_NAME:-roteirizador1}"
DB_USER="${DB_USER:-lipe}"
DB_PASS="${DB_PASS:-20087419}"
WEB_ROOT="${WEB_ROOT:-/var/www/alchemyrotas}"
SERVICE_NAME="${SERVICE_NAME:-alchemy-backend}"
SERVER_NAME="${SERVER_NAME:-alchemyrotas.com}"
NODE_VER="${NODE_VER:-20}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

C_G='\033[0;32m'; C_B='\033[0;34m'; C_Y='\033[1;33m'; C_R='\033[0;31m'; C_0='\033[0m'
log()  { echo -e "${C_B}[deploy]${C_0} $*"; }
ok()   { echo -e "${C_G}[ok]${C_0}    $*"; }
warn() { echo -e "${C_Y}[warn]${C_0}  $*"; }
err()  { echo -e "${C_R}[erro]${C_0}  $*"; exit 1; }

[[ $EUID -eq 0 ]] || err "Rode com sudo: sudo ./deploy.sh"

# ─── 1) git pull ────────────────────────────────────────────────────────────
if [[ -d "${PROJECT_DIR}/.git" ]] && [[ "${SKIP_GIT:-0}" != "1" ]]; then
  log "Atualizando código (git pull)…"
  GIT_TERMINAL_PROMPT=0 git -C "${PROJECT_DIR}" pull --rebase --autostash 2>/dev/null \
    || warn "git pull pulado (repo privado? rode com SKIP_GIT=1 ou configure SSH key / token)"
fi

# ─── 2) Dependências do sistema ─────────────────────────────────────────────
if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt "${NODE_VER}" ]]; then
  log "Instalando Node.js ${NODE_VER}…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VER}.x" | bash -
  apt-get install -y nodejs
fi
command -v pm2   >/dev/null || npm i -g pm2 >/dev/null
command -v psql  >/dev/null || { log "Instalando PostgreSQL…"; apt-get update && apt-get install -y postgresql postgresql-contrib; systemctl enable --now postgresql; }
command -v nginx >/dev/null || { log "Instalando nginx…"; apt-get install -y nginx; systemctl enable --now nginx; }
ok "Dependências do sistema OK"

# ─── 3) Banco: usuário, DB, senha, permissões ───────────────────────────────
log "Garantindo DB '${DB_NAME}' e usuário '${DB_USER}'…"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';" >/dev/null
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "ALTER SCHEMA public OWNER TO ${DB_USER};" >/dev/null 2>&1 || true
ok "Postgres pronto"

# ─── 4) Schema único e idempotente (preserva dados, só adiciona o que falta) ─
log "Aplicando database/ensure-schema.sql (único, seguro, sem DROP)…"
sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${PROJECT_DIR}/database/ensure-schema.sql" \
  || err "Falha ao aplicar ensure-schema.sql — verifique sintaxe"

# 🛡️ Salvaguarda: NÃO aplicar nenhum arquivo SQL que contenha DROP/TRUNCATE/DELETE
# Aplica todas as migrations em ordem alfabética. Como cada uma usa IF NOT EXISTS,
# rodar várias vezes é seguro (idempotente) e preserva 100% dos dados existentes.
log "Aplicando database/migration-*.sql (idempotentes, sem destruir dados)…"
shopt -s nullglob
for mig in $(ls "${PROJECT_DIR}/database/"migration-*.sql 2>/dev/null | sort); do
  base="$(basename "$mig")"
  if grep -Eiq '\b(DROP[[:space:]]+TABLE|TRUNCATE|DELETE[[:space:]]+FROM)\b' "$mig"; then
    warn "Pulando $base (contém comando destrutivo — protegendo dados)"
    continue
  fi
  log "  → $base"
  sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "$mig" >/dev/null \
    || warn "Falha em $base (não interrompendo deploy — verificar manualmente)"
done
shopt -u nullglob

sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};" >/dev/null 2>&1 || true
ok "Schema + migrations aplicados (dados preservados)"

# ─── 5) Backend: deps + build ───────────────────────────────────────────────
log "Backend: instalando deps + compilando TS…"
cd "${PROJECT_DIR}/backend"
npm ci >/dev/null 2>&1 \
  || { warn "npm ci falhou (lockfile fora de sync), usando npm install…"; \
       npm install --no-audit --no-fund >/dev/null 2>&1 \
       || { warn "npm install falhou por peer deps, tentando --legacy-peer-deps…"; \
            npm install --no-audit --no-fund --legacy-peer-deps >/dev/null; }; }
npm run build
if [[ ! -f .env ]]; then
  log "Gerando backend/.env padrão…"
  cat > .env <<EOF
NODE_ENV=production
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=24h
GOOGLE_MAPS_API_KEY=
CORS_ORIGIN=https://${SERVER_NAME},http://localhost:5173,http://localhost:8080
EOF
else
  # Segurança: se o JWT_SECRET ainda for o placeholder/inseguro herdado,
  # rotaciona automaticamente para um valor forte (invalida sessões antigas).
  CURRENT_JWT=$(grep -E '^JWT_SECRET=' .env | head -1 | cut -d= -f2-)
  if [[ -z "$CURRENT_JWT" || "$CURRENT_JWT" == "your-super-secret-jwt-key" || "$CURRENT_JWT" == "your-secret-key-change-in-production" || ${#CURRENT_JWT} -lt 32 ]]; then
    NEW_JWT="$(openssl rand -hex 48)"
    if grep -qE '^JWT_SECRET=' .env; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|" .env
    else
      echo "JWT_SECRET=${NEW_JWT}" >> .env
    fi
    warn "JWT_SECRET fraco detectado — rotacionado automaticamente (sessões antigas serão invalidadas)"
  fi
fi
ok "Backend compilado"

# ─── 5.1) Diretório de uploads (logos, PDFs assinados, fotos) ───────────────
log "Garantindo diretório de uploads…"
UPLOADS_DIR="${PROJECT_DIR}/backend/uploads"
mkdir -p "${UPLOADS_DIR}/logos" "${UPLOADS_DIR}/photos" "${UPLOADS_DIR}/contracts"
chown -R root:root "${UPLOADS_DIR}"
chmod -R 755 "${UPLOADS_DIR}"
ok "Uploads OK em ${UPLOADS_DIR}"

# ─── 5.2) Importação one-shot dos ERPs legados (DSR + MIC BAN) ──────────────
# v2: agora enriquece com dados extraídos das Observações (endereço, descrição,
# CNO, responsável nome/tel/email, data de entrega, qtde de limpezas).
# Marker versionado: se só existe o marker antigo (v1), roda mais uma vez pra
# enriquecer contratos já importados. Depois cria .imported-legacy-erp-v2.

IMPORT_MARKER_V1="${PROJECT_DIR}/backend/scripts/.imported-legacy-erp"
IMPORT_MARKER="${PROJECT_DIR}/backend/scripts/.imported-legacy-erp-v2"
IMPORT_SCRIPT="${PROJECT_DIR}/backend/scripts/import-legacy-erp.js"
CONVERT_SCRIPT="${PROJECT_DIR}/backend/scripts/convert-legacy-xlsx.py"
LEGACY_DIR="${PROJECT_DIR}/backend/scripts/legacy-data"

if [[ -f "$IMPORT_SCRIPT" && ! -f "$IMPORT_MARKER" ]]; then
  # (a) Python + libs pra converter XLSX → JSON enriquecido (idempotente)
  if [[ -f "$CONVERT_SCRIPT" ]]; then
    command -v python3 >/dev/null || { log "Instalando python3…"; apt-get install -y python3 python3-pip >/dev/null; }
    if ! python3 -c "import pandas, openpyxl" 2>/dev/null; then
      log "Instalando pandas + openpyxl…"
      pip3 install --break-system-packages --quiet pandas openpyxl 2>/dev/null \
        || pip3 install --quiet pandas openpyxl 2>/dev/null \
        || warn "Falha instalando pandas — usando JSONs já existentes"
    fi

    # (b) Regenera JSON se XLSX for mais novo que JSON (ou JSON não existir)
    NEED_CONVERT=0
    for pair in "DSR.xlsx:dsr.json" "MICBAN.xlsx:micban.json"; do
      x="${LEGACY_DIR}/${pair%%:*}"; j="${LEGACY_DIR}/${pair##*:}"
      [[ -f "$x" ]] || continue
      [[ ! -f "$j" || "$x" -nt "$j" ]] && NEED_CONVERT=1
    done
    if [[ "$NEED_CONVERT" == "1" ]] && python3 -c "import pandas, openpyxl" 2>/dev/null; then
      log "Convertendo XLSX legados → JSON enriquecido…"
      python3 "$CONVERT_SCRIPT" || warn "convert-legacy-xlsx.py falhou — usando JSON existente"
    fi
  fi

  # (c) Import com --update-existing (enriquece contratos já criados só em campos vazios)
  log "Enriquecendo contratos legados (DSR + MIC BAN) com dados das Observações…"
  log "  → Dry-run (nada é gravado):"
  (cd "${PROJECT_DIR}/backend" && node scripts/import-legacy-erp.js --update-existing) || warn "Dry-run falhou"
  log "  → Aplicando de verdade:"
  if (cd "${PROJECT_DIR}/backend" && node scripts/import-legacy-erp.js --apply --update-existing); then
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$IMPORT_MARKER"
    rm -f "$IMPORT_MARKER_V1"
    ok "Importação/enriquecimento concluído (marker: $IMPORT_MARKER)"
  else
    warn "Importação falhou — sem marker, tentará novamente no próximo deploy"
  fi
elif [[ -f "$IMPORT_MARKER" ]]; then
  ok "Importação legada v2 já executada em $(cat "$IMPORT_MARKER") — pulando"
fi

# ─── 5.2a) ROLLBACK opcional da importação de COBRANÇA ───────────────────────
# Rode:  sudo ROLLBACK_COB=1 ./deploy.sh              (apaga contratos -COB- + filhos)
#        sudo ROLLBACK_COB=1 PURGE_CUSTOMERS=1 SINCE=2026-08-01 ./deploy.sh
# Apaga SOMENTE erp_contracts com origem='importacao' e numero LIKE '%-COB-%'.
COB_ROLLBACK="${PROJECT_DIR}/backend/scripts/rollback-cobranca-erp.js"
if [[ "${ROLLBACK_COB:-0}" == "1" && -f "$COB_ROLLBACK" ]]; then
  ROLL_ARGS=(--apply)
  [[ "${PURGE_CUSTOMERS:-0}" == "1" ]] && ROLL_ARGS+=(--purge-customers)
  [[ -n "${SINCE:-}" ]] && ROLL_ARGS+=(--since "${SINCE}")
  log "Rollback da importação de COBRANÇA…"
  log "  → Dry-run:"
  (cd "${PROJECT_DIR}/backend" && node scripts/rollback-cobranca-erp.js) || warn "Dry-run do rollback falhou"
  log "  → Aplicando:"
  (cd "${PROJECT_DIR}/backend" && node scripts/rollback-cobranca-erp.js "${ROLL_ARGS[@]}") \
    && ok "Rollback aplicado" || warn "Rollback falhou — verifique manualmente"
  # impede que o próprio deploy reimporte em seguida
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "${PROJECT_DIR}/backend/scripts/.imported-cobranca-erp-v2"
fi

# ─── 5.2b) Importação das planilhas de COBRANÇA (MICBAN + DSR) ───────────────
# DESLIGADA por padrão. Para rodar de novo: sudo RUN_COB_IMPORT=1 ./deploy.sh
COB_MARKER_V1="${PROJECT_DIR}/backend/scripts/.imported-cobranca-erp-v1"
COB_MARKER="${PROJECT_DIR}/backend/scripts/.imported-cobranca-erp-v2"
COB_IMPORT="${PROJECT_DIR}/backend/scripts/import-cobranca-erp.js"
COB_CONVERT="${PROJECT_DIR}/backend/scripts/convert-cobranca-xlsx.py"
COB_MIC_XLSX="${LEGACY_DIR}/COBRANCA_MICBAN.xlsx"
COB_DSR_XLSX="${LEGACY_DIR}/COBRANCA_DSR.xlsx"
COB_MIC_JSON="${LEGACY_DIR}/cobranca-micban.json"
COB_DSR_JSON="${LEGACY_DIR}/cobranca-dsr.json"

if [[ "${RUN_COB_IMPORT:-0}" == "1" && -f "$COB_IMPORT" ]]; then

  # (a) Regenera JSONs somente se os XLSX existirem e forem mais novos
  if [[ -f "$COB_CONVERT" && ( -f "$COB_MIC_XLSX" || -f "$COB_DSR_XLSX" ) ]]; then
    NEED_COB_CONVERT=0
    [[ -f "$COB_MIC_XLSX" && ( ! -f "$COB_MIC_JSON" || "$COB_MIC_XLSX" -nt "$COB_MIC_JSON" ) ]] && NEED_COB_CONVERT=1
    [[ -f "$COB_DSR_XLSX" && ( ! -f "$COB_DSR_JSON" || "$COB_DSR_XLSX" -nt "$COB_DSR_JSON" ) ]] && NEED_COB_CONVERT=1
    if [[ "$NEED_COB_CONVERT" == "1" ]]; then
      command -v python3 >/dev/null || { log "Instalando python3…"; apt-get install -y python3 python3-pip >/dev/null; }
      python3 -c "import pandas" 2>/dev/null || {
        log "Instalando pandas + leitor de xlsx…"
        pip3 install --break-system-packages --quiet pandas openpyxl python-calamine 2>/dev/null \
          || pip3 install --quiet pandas openpyxl python-calamine 2>/dev/null \
          || warn "Falha instalando pandas — usando JSONs versionados"
      }
      if python3 -c "import pandas" 2>/dev/null; then
        log "Convertendo planilhas de COBRANÇA → JSON…"
        CONV_ARGS=()
        [[ -f "$COB_MIC_XLSX" ]] && CONV_ARGS+=(--micban "$COB_MIC_XLSX")
        [[ -f "$COB_DSR_XLSX" ]] && CONV_ARGS+=(--dsr "$COB_DSR_XLSX")
        python3 "$COB_CONVERT" "${CONV_ARGS[@]}" || warn "convert-cobranca-xlsx.py falhou — usando JSONs versionados"
      fi
    fi
  fi

  if [[ -f "$COB_MIC_JSON" || -f "$COB_DSR_JSON" ]]; then
    log "Importando contratos de COBRANÇA (MICBAN + DSR)…"
    log "  → Dry-run (nada é gravado):"
    (cd "${PROJECT_DIR}/backend" && node scripts/import-cobranca-erp.js --update-existing) \
      || warn "Dry-run da cobrança falhou"
    log "  → Aplicando de verdade:"
    if (cd "${PROJECT_DIR}/backend" && node scripts/import-cobranca-erp.js --apply --update-existing); then
      date -u +"%Y-%m-%dT%H:%M:%SZ" > "$COB_MARKER"
      rm -f "$COB_MARKER_V1"
      ok "Cobrança importada (marker: $COB_MARKER)"
    else
      warn "Importação da cobrança falhou — sem marker, tentará novamente no próximo deploy"
    fi
  else
    warn "JSONs de cobrança ausentes — importação pulada"
  fi
elif [[ -f "$COB_MARKER" ]]; then
  ok "Cobrança já importada em $(cat "$COB_MARKER") — pulando"
fi




# ─── 5.3) Usuário de demonstração (idempotente) ─────────────────────────────
DEMO_SCRIPT="${PROJECT_DIR}/backend/scripts/ensure-demo-user.js"
if [[ -f "$DEMO_SCRIPT" ]]; then
  log "Garantindo usuário demo (demo / demo1234)…"
  (cd "${PROJECT_DIR}/backend" && node scripts/ensure-demo-user.js) || warn "Falha ao garantir usuário demo"
fi






# ─── 6) Frontend: build + publicar ──────────────────────────────────────────
log "Frontend: instalando deps + buildando (Vite)…"
cd "${PROJECT_DIR}"
npm ci >/dev/null 2>&1 \
  || { warn "npm ci falhou (lockfile fora de sync), usando npm install…"; \
       npm install --no-audit --no-fund >/dev/null 2>&1 \
       || { warn "npm install falhou por peer deps, tentando --legacy-peer-deps…"; \
            npm install --no-audit --no-fund --legacy-peer-deps >/dev/null; }; }
npm run build
mkdir -p "${WEB_ROOT}"
rm -rf "${WEB_ROOT:?}/"*
cp -r "${PROJECT_DIR}/dist/." "${WEB_ROOT}/"
ok "Frontend publicado em ${WEB_ROOT}"

# ─── 7) PM2 (backend) ───────────────────────────────────────────────────────
log "Reiniciando backend via pm2…"
cd "${PROJECT_DIR}/backend"
pm2 describe "${SERVICE_NAME}" >/dev/null 2>&1 \
  && pm2 reload "${SERVICE_NAME}" --update-env \
  || pm2 start dist/index.js --name "${SERVICE_NAME}" --update-env
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
ok "pm2 OK ($(pm2 jlist | grep -c '\"name\"'))"

# ─── 8) Nginx vhost ─────────────────────────────────────────────────────────
VHOST="/etc/nginx/sites-available/alchemy-rotas"
log "Limpando vhosts antigos conflitantes (rota-azul-viagens, default, porta 3001)…"
# Remove links de qualquer vhost antigo para o mesmo server_name
for f in /etc/nginx/sites-enabled/*; do
  [[ -e "$f" ]] || continue
  base="$(basename "$f")"
  [[ "$base" == "alchemy-rotas" ]] && continue
  if grep -qE "server_name[^;]*${SERVER_NAME}|proxy_pass[^;]*:3001" "$f" 2>/dev/null; then
    warn "Removendo vhost conflitante: $f"
    rm -f "$f"
  fi
done
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/rota-azul-viagens
# Detecta certificado SSL existente (Let's Encrypt) para emitir vhost https
SSL_CERT="/etc/letsencrypt/live/${SERVER_NAME}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${SERVER_NAME}/privkey.pem"
HAS_SSL=0
[[ -f "$SSL_CERT" && -f "$SSL_KEY" ]] && HAS_SSL=1

log "Regravando vhost nginx (porta backend: 3002, ssl=${HAS_SSL})…"
{
  cat <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name ${SERVER_NAME} www.${SERVER_NAME};
NGINX
  if [[ "$HAS_SSL" == "1" ]]; then
    cat <<NGINX
  return 301 https://\$host\$request_uri;
}
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name ${SERVER_NAME} www.${SERVER_NAME};
  ssl_certificate ${SSL_CERT};
  ssl_certificate_key ${SSL_KEY};
NGINX
  fi
  cat <<NGINX
  root ${WEB_ROOT};
  index index.html;
  client_max_body_size 25M;

  location /api/ {
    proxy_pass http://127.0.0.1:3002/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 300s;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:3002/uploads/;
  }

  location / { try_files \$uri /index.html; }
}
NGINX
} > "$VHOST"
ln -sf "$VHOST" /etc/nginx/sites-enabled/alchemy-rotas
nginx -t && systemctl reload nginx
ok "nginx recarregado"

echo
ok "✅ Deploy concluído!  →  https://${SERVER_NAME}"
echo "    Logs do backend:  pm2 logs ${SERVICE_NAME}"
echo "    Status:           pm2 status"
echo "    HTTPS (1x só):    apt install -y certbot python3-certbot-nginx && certbot --nginx -d ${SERVER_NAME}"
