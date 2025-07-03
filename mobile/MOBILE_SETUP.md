
# 🚀 Guia Rápido - Teste do App Mobile

## 1. Teste no Navegador (Mais Fácil)
```bash
cd mobile/
npm install
npm run dev
```
Acesse: http://localhost:3002
- Use F12 para abrir DevTools
- Clique no ícone de celular para simular mobile

## 2. Teste com Capacitor (App Nativo)

### Primeiro Setup:
```bash
cd mobile/
npm install

# Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Inicializar (só uma vez)
npx cap init "Rota Azul Motorista" "app.rotaazul.mobile"
```

### Para Android:
```bash
# Adicionar plataforma Android
npx cap add android

# Build e sync
npm run build
npx cap sync

# Abrir no Android Studio
npx cap open android
```

### Para iOS (só no Mac):
```bash
# Adicionar plataforma iOS
npx cap add ios

# Build e sync
npm run build
npx cap sync

# Abrir no Xcode
npx cap open ios
```

## 3. Build para Produção
```bash
npm run build
```

## Problemas Comuns:
- **Android Studio**: Instale pelo site oficial
- **Erro de SDK**: Configure ANDROID_HOME
- **iOS**: Precisa de Mac + Xcode
- **Hot Reload**: Use `npx cap run android --livereload`

## Teste Rápido:
1. Use o navegador primeiro
2. Simule um dispositivo móvel
3. Teste a funcionalidade de login por placa
4. Depois configure o Capacitor para app nativo
