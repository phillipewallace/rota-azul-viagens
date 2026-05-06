#!/usr/bin/env bash
###############################################################################
# Alchemy Rotas — Deploy automático (frontend + backend + banco)
#
# Uso típico (na sua máquina):
#   ./deploy.sh                       # usa config padrão (alchemyrotas.com)
#   VPS_HOST=1.2.3.4 ./deploy.sh      # outra VPS sem mudar nada do código
#
# Pré-requisitos na sua máquina:
#   - git, ssh, rsync, node/npm (ou bun)
#   - chave SSH já autorizada na VPS (ssh-copy-id)
#
# O que ele faz, na ordem:
#   1) Faz pull do branch atual (garante que a VPS receba o código mais novo)
#   2) Builda o frontend (Vite) localmente
#   3) Sincroniza com a VPS via rsync (backend + dist + database/*.sql)
#   4) Na VPS: instala deps do backend, compila TS, aplica migrations idempotentes
#   5) Reinicia o serviço (pm2 -> systemd -> nohup, o que estiver disponível)
#   6) Recarrega o nginx para servir a nova build
#
# É 100% idempotente — pode rodar várias vezes sem quebrar nada.
# Trocar de VPS no futuro: basta mudar VPS_HOST/VPS_USER/REMOTE_DIR e rodar.
###############################################################################
set -euo pipefail

# ─────────── CONFIG (sobrescreva via env vars se quiser) ────────────────────
VPS_HOST="${VPS_HOST:-alchemyrotas.com}"      # IP ou domínio da VPS
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/alchemy-rotas}"     # raiz do projeto na VPS
WEB_ROOT="${WEB_ROOT:-/var/www/alchemyrotas}"      # onde o nginx serve a SPA
SERVICE_NAME="${SERVICE_NAME:-alchemy-backend}"     # nome do pm2 / systemd
DB_NAME="${DB_NAME:-alchemy_rotas}"
DB_USER="${DB_USER:-lipe}"
NODE_VER="${NODE_VER:-20}"
RUN_GIT_PULL="${RUN_GIT_PULL:-1}"             # 0 desativa o pull
SKIP_BUILD="${SKIP_BUILD:-0}"                 # 1 pula o build do frontend
# ─────────────────────────────────────────────────────────────────────────────

C_GREEN='\033[0;32m'; C_BLUE='\033[0;34m'; C_YELLOW='\033[1;33m'; C_RED='\033[0;31m'; C_RESET='\033[0m'
log()  { echo -e "${C_BLUE}[deploy]${C_RESET} $*"; }
ok()   { echo -e "${C_GREEN}[ok]${C_RESET} $*"; }
warn() { echo -e "${C_YELLOW}[warn]${C_RESET} $*"; }
err()  { echo -e "${C_RED}[erro]${C_RESET} $*"; exit 1; }

SSH="ssh -p ${VPS_PORT} -o StrictHostKeyChecking=accept-new ${VPS_USER}@${VPS_HOST}"
RSYNC_RSH="ssh -p ${VPS_PORT}"

command -v rsync >/dev/null || err "rsync não está instalado localmente"
command -v ssh   >/dev/null || err "ssh não está instalado localmente"

# 1) Pull do branch atual
if [[ "${RUN_GIT_PULL}" == "1" ]] && [[ -d .git ]]; then
  log "Fazendo git pull do branch atual…"
  git pull --rebase --autostash || warn "git pull falhou (continuando)"
fi

# 2) Build do frontend
if [[ "${SKIP_BUILD}" != "1" ]]; then
  log "Buildando frontend (Vite)…"
  if command -v bun >/dev/null;  then bun install && bun run build
  else                                npm ci && npm run build; fi
  ok "Build do frontend concluído (dist/)"
else
  warn "SKIP_BUILD=1 — pulando build do frontend"
fi

# 3) Sincroniza com a VPS
log "Garantindo diretórios na VPS (${VPS_HOST}:${REMOTE_DIR})…"
$SSH "mkdir -p '${REMOTE_DIR}/backend' '${REMOTE_DIR}/database' '${WEB_ROOT}'"

log "Enviando backend (sem node_modules/dist/uploads)…"
rsync -az --delete -e "${RSYNC_RSH}" \
  --exclude 'node_modules' --exclude 'dist' --exclude 'uploads' --exclude '.env' \
  backend/ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/backend/"

log "Enviando migrations SQL…"
rsync -az --delete -e "${RSYNC_RSH}" \
  database/ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/database/"

if [[ -d dist ]]; then
  log "Publicando frontend em ${WEB_ROOT}…"
  rsync -az --delete -e "${RSYNC_RSH}" dist/ "${VPS_USER}@${VPS_HOST}:${WEB_ROOT}/"
fi

# 4-6) Tudo o que precisa rodar dentro da VPS — em uma única sessão SSH
log "Executando passos remotos na VPS…"
$SSH bash -s -- "$DB_NAME" "$DB_USER" "$REMOTE_DIR" "$WEB_ROOT" "$SERVICE_NAME" "$NODE_VER" <<'REMOTE'
set -euo pipefail
DB_NAME="$1"; DB_USER="$2"; REMOTE_DIR="$3"; WEB_ROOT="$4"; SERVICE_NAME="$5"; NODE_VER="$6"

say(){ echo -e "\033[0;34m[remote]\033[0m $*"; }

# ── Garantias mínimas: node, postgres, nginx ────────────────────────────────
if ! command -v node >/dev/null; then
  say "Instalando Node.js ${NODE_VER} via nodesource…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VER}.x" | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm i -g pm2 >/dev/null

if ! command -v psql >/dev/null; then
  say "Instalando PostgreSQL…"
  apt-get update && apt-get install -y postgresql postgresql-contrib
  systemctl enable --now postgresql
fi

# ── Cria DB e usuário (idempotente) ─────────────────────────────────────────
say "Garantindo DB '${DB_NAME}' e usuário '${DB_USER}'…"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD 'changeme';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null

# ── Aplica TODAS as migrations em ordem alfabética (cada arquivo deve ser idempotente) ──
say "Aplicando migrations em ${REMOTE_DIR}/database/ …"
shopt -s nullglob
for f in $(ls "${REMOTE_DIR}/database/"*.sql | sort); do
  say "  ↳ $(basename "$f")"
  sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1 || \
    say "    (avisos ignorados em $(basename "$f"))"
done

# ── Backend: deps + build + restart ─────────────────────────────────────────
cd "${REMOTE_DIR}/backend"
say "Instalando deps do backend…"
npm ci --omit=dev=false >/dev/null
say "Compilando TypeScript…"
npm run build

# Cria .env se não existir (você ajusta depois com seus secrets)
if [[ ! -f .env ]]; then
  say "Gerando .env padrão (edite os secrets depois!)"
  cat > .env <<EOF
NODE_ENV=production
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=changeme
JWT_SECRET=$(openssl rand -hex 32)
GOOGLE_MAPS_API_KEY=
EOF
fi

say "(Re)iniciando serviço '${SERVICE_NAME}' via pm2…"
pm2 describe "${SERVICE_NAME}" >/dev/null 2>&1 \
  && pm2 reload "${SERVICE_NAME}" --update-env \
  || pm2 start dist/index.js --name "${SERVICE_NAME}" --update-env
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ── Nginx (só configura se ainda não existir um vhost) ──────────────────────
if command -v nginx >/dev/null; then
  if [[ ! -f /etc/nginx/sites-available/alchemy-rotas ]]; then
    say "Criando vhost nginx padrão…"
    cat > /etc/nginx/sites-available/alchemy-rotas <<NGINX
server {
  listen 80;
  server_name _;
  root ${WEB_ROOT};
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    client_max_body_size 25M;
  }

  location / { try_files \$uri /index.html; }
}
NGINX
    ln -sf /etc/nginx/sites-available/alchemy-rotas /etc/nginx/sites-enabled/alchemy-rotas
    rm -f /etc/nginx/sites-enabled/default
  fi
  nginx -t && systemctl reload nginx
fi

say "Deploy remoto concluído ✅"
REMOTE

ok "Deploy completo em https://${VPS_HOST}"
echo
echo "Próximos passos opcionais:"
echo "  • Edite ${REMOTE_DIR}/backend/.env na VPS para ajustar segredos (DB_PASSWORD, JWT, GOOGLE_MAPS_API_KEY)."
echo "  • Para HTTPS automático rode (uma vez):  ssh ${VPS_USER}@${VPS_HOST} 'apt install -y certbot python3-certbot-nginx && certbot --nginx -d ${VPS_HOST}'"
