
# Guia de Migração para VPS - AlchemyRotas

## 1. Preparação da VPS

### Instalar dependências:
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Instalar PM2 para gerenciar aplicação
sudo npm install -g pm2
```

## 2. Configuração do Banco de Dados

### Criar banco e usuário:
```bash
sudo -u postgres psql

CREATE DATABASE alchemy_rotas;
CREATE USER alchemy_user WITH PASSWORD 'sua_senha_forte';
GRANT ALL PRIVILEGES ON DATABASE alchemy_rotas TO alchemy_user;
\q
```

### Executar schema:
```bash
sudo -u postgres psql -d alchemy_rotas -f database/production-database.sql
```

## 3. Deploy da Aplicação

### Backend:
```bash
# Copiar arquivos do backend
cd /var/www/alchemy-rotas-backend
git clone seu-repositorio backend
cd backend

# Instalar dependências
npm install --production

# Configurar variáveis de ambiente
cp .env.production .env
# Editar .env com suas configurações reais

# Compilar TypeScript
npm run build

# Iniciar com PM2
pm2 start dist/index.js --name "alchemy-backend"
pm2 startup
pm2 save
```

### Frontend:
```bash
cd /var/www/alchemy-rotas-frontend
git clone seu-repositorio frontend
cd frontend

# Instalar dependências
npm install

# Build para produção
npm run build

# Os arquivos estão em frontend/dist/
# Configurar nginx para servir estes arquivos
```

## 4. Configuração do Nginx

```nginx
# /etc/nginx/sites-available/alchemy-rotas
server {
    listen 80;
    server_name seu-dominio.com;

    # Frontend
    location / {
        root /var/www/alchemy-rotas-frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Ativar site:
```bash
sudo ln -s /etc/nginx/sites-available/alchemy-rotas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. SSL com Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d seu-dominio.com
```

## 6. Monitoramento

```bash
# Ver logs do backend
pm2 logs alchemy-backend

# Status da aplicação
pm2 status

# Reiniciar se necessário
pm2 restart alchemy-backend
```

## 7. Backup Automático

Adicionar ao crontab:
```bash
# Backup diário às 2h da manhã
0 2 * * * pg_dump -h localhost -U alchemy_user alchemy_rotas > /backups/alchemy_$(date +\%Y\%m\%d).sql
```

## Alterações no Código para VPS

### Backend:
- ✅ Logs detalhados já implementados
- ✅ Tratamento de erros de chave estrangeira implementado
- ✅ Configurações de ambiente prontas

### Frontend:
- ✅ Estrutura de pastas reorganizada
- ✅ Build configurado para pasta dist/
- ⚠️ Verificar API_BASE_URL em src/services/config.ts

Nenhuma alteração adicional no código é necessária!
