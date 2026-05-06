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
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" >/dev/null
ok "Schema garantido (dados preservados, admin garantido)"

# ─── 5) Backend: deps + build ───────────────────────────────────────────────
log "Backend: instalando deps + compilando TS…"
cd "${PROJECT_DIR}/backend"
npm ci >/dev/null 2>&1 || { warn "npm ci falhou (lockfile fora de sync), usando npm install…"; npm install --no-audit --no-fund >/dev/null; }
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
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=24h
GOOGLE_MAPS_API_KEY=
CORS_ORIGIN=https://${SERVER_NAME},http://localhost:5173,http://localhost:8080
EOF
fi
ok "Backend compilado"

# ─── 6) Frontend: build + publicar ──────────────────────────────────────────
log "Frontend: instalando deps + buildando (Vite)…"
cd "${PROJECT_DIR}"
npm ci >/dev/null 2>&1 || { warn "npm ci falhou (lockfile fora de sync), usando npm install…"; npm install --no-audit --no-fund >/dev/null; }
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
if [[ ! -f "$VHOST" ]]; then
  log "Criando vhost nginx…"
  cat > "$VHOST" <<NGINX
server {
  listen 80;
  server_name ${SERVER_NAME} www.${SERVER_NAME};
  root ${WEB_ROOT};
  index index.html;
  client_max_body_size 25M;

  location /api/ {
    proxy_pass http://127.0.0.1:3002/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:3002/uploads/;
  }

  location / { try_files \$uri /index.html; }
}
NGINX
  ln -sf "$VHOST" /etc/nginx/sites-enabled/alchemy-rotas
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t && systemctl reload nginx
ok "nginx recarregado"

echo
ok "✅ Deploy concluído!  →  https://${SERVER_NAME}"
echo "    Logs do backend:  pm2 logs ${SERVICE_NAME}"
echo "    Status:           pm2 status"
echo "    HTTPS (1x só):    apt install -y certbot python3-certbot-nginx && certbot --nginx -d ${SERVER_NAME}"
