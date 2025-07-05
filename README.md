
# Rota Azul - Sistema de Roteirização de Viagens

Sistema completo de gestão e roteirização de viagens com três aplicações integradas:

## 📁 Estrutura do Projeto

```
rota-azul-viagens/
├── backend/          # API Node.js + Express + PostgreSQL
├── frontend/         # Dashboard Web (React + Vite)
├── mobile/           # App Mobile (React + Capacitor)
└── database/         # Scripts SQL
```

## 🚀 Como Executar

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend (Dashboard Web)
```bash
cd frontend
npm install
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npm run dev
```

### Build para Produção

#### Frontend
```bash
cd frontend
npm run build
# Os arquivos serão gerados na pasta frontend/dist/
```

#### Mobile
```bash
cd mobile
npm run build
npx cap sync
npx cap run android # ou ios
```

## 📊 Tecnologias

- **Backend**: Node.js, Express, PostgreSQL, JWT
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn/UI
- **Mobile**: React, Capacitor, TypeScript
- **Banco**: PostgreSQL

## 🔧 Configuração

1. Configure o banco PostgreSQL
2. Execute os scripts em `database/`
3. Configure as variáveis de ambiente no backend
4. Execute cada aplicação conforme instruções acima

## 📱 Deploy

- **Frontend**: A pasta `frontend/dist/` contém os arquivos estáticos para deploy em VPS
- **Backend**: Deploy em servidor Node.js
- **Mobile**: Gere APK/IPA com Capacitor
