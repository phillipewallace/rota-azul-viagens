
# 🚀 Guia Completo - AlchemyRotas Mobile

## 📱 1. Teste Rápido no Navegador (Recomendado para Início)
```bash
cd mobile/
npm install
npm run dev
```
Acesse: http://localhost:3002
- Use F12 para abrir DevTools
- Clique no ícone de celular para simular mobile

## 🔧 2. Configuração Inicial do Capacitor

### Instalar Dependências:
```bash
cd mobile/
npm install

# Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm install @capacitor/geolocation @capacitor/app
```

### Inicializar Capacitor:
```bash
# Inicializar projeto (só uma vez)
npx cap init "AlchemyRotas Motorista" "app.alchemyrotas.mobile"
```

## 📋 3. Configuração do capacitor.config.ts

Edite o arquivo `capacitor.config.ts`:
```typescript
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.alchemyrotas.mobile',
  appName: 'AlchemyRotas Motorista',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Geolocation: {
      permissions: ["location"]
    }
  }
};

export default config;
```

## 🤖 4. Configuração Completa para Android APK

### Pré-requisitos:
1. **Java Development Kit (JDK 17)**
   - Download: https://adoptium.net/
   - Instale e configure JAVA_HOME

2. **Android Studio**
   - Download: https://developer.android.com/studio
   - Durante instalação, instale Android SDK e emuladores

3. **Configurar Variáveis de Ambiente:**
```bash
# Windows (adicionar no PATH do sistema):
C:\Users\SeuUsuario\AppData\Local\Android\Sdk\platform-tools
C:\Users\SeuUsuario\AppData\Local\Android\Sdk\tools

# Variável ANDROID_HOME:
C:\Users\SeuUsuario\AppData\Local\Android\Sdk
```

### Passos para Gerar APK:

#### Passo 1: Preparar o Projeto
```bash
# No diretório mobile/
npm run build
```

#### Passo 2: Adicionar Plataforma Android
```bash
npx cap add android
```

#### Passo 3: Sincronizar Arquivos
```bash
npx cap sync android
```

#### Passo 4: Abrir no Android Studio
```bash
npx cap open android
```

#### Passo 5: Configurar no Android Studio
1. **Aguardar sincronização do Gradle**
2. **Configurar assinatura do APK**:
   - File → Project Structure
   - Modules → app → Signing Configs
   - Criar novo signing config ou usar debug

3. **Build APK**:
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Aguardar conclusão

4. **Localizar APK**:
   - APK estará em: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Passo 6: Instalar no Dispositivo
```bash
# Via ADB (Android Debug Bridge)
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Ou copie o arquivo APK para o dispositivo e instale manualmente
```

## 📱 5. Teste em Dispositivo Real

### Habilitar Depuração USB:
1. **Configurações → Sobre o telefone**
2. **Toque 7x em "Número da compilação"**
3. **Voltar → Opções do desenvolvedor**
4. **Ativar "Depuração USB"**

### Conectar e Testar:
```bash
# Verificar dispositivos conectados
adb devices

# Instalar APK diretamente
adb install app-debug.apk

# Ou executar direto do projeto
npx cap run android
```

## 🔄 6. Comandos de Desenvolvimento

### Para desenvolvimento contínuo:
```bash
# Build e sync automático
npm run build && npx cap sync

# Live reload (desenvolvimento)
npx cap run android --livereload --external

# Logs do dispositivo
adb logcat
```

## 🐛 7. Solução de Problemas Comuns

### Erro de Gradle:
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### Erro de SDK:
- Abrir Android Studio
- SDK Manager → instalar SDK 33 ou superior
- Configurar ANDROID_HOME corretamente

### Erro de Permissões:
- Verificar `android/app/src/main/AndroidManifest.xml`
- Adicionar permissões necessárias:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 🚀 8. Deploy para Produção

### APK Release (Assinado):
1. **Gerar keystore**:
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000
```

2. **Configurar no Android Studio**:
   - Build → Generate Signed Bundle/APK
   - Selecionar keystore criado
   - Escolher "release"

3. **APK final estará em**:
   `android/app/build/outputs/apk/release/app-release.apk`

## 📦 9. Distribuição

### Opções de Distribuição:
1. **APK Direto**: Enviar arquivo APK
2. **Google Play Store**: Upload do Bundle AAB
3. **Firebase App Distribution**: Para testes beta
4. **Site próprio**: Download direto

## 🔧 10. Configurações Avançadas

### ícone do App:
- Substitua arquivos em `android/app/src/main/res/mipmap-*/`
- Use Android Studio → Image Asset Studio

### Nome do App:
- Edite `android/app/src/main/res/values/strings.xml`

### Permissões Adicionais:
- Edite `android/app/src/main/AndroidManifest.xml`

## 📞 11. Suporte e Próximos Passos

### Para Uso em Campo:
1. Gere APK de release
2. Instale no dispositivo do motorista
3. Configure backend em servidor dedicado
4. Teste conectividade GPS
5. Treine motorista no uso

### Monitoramento:
- Configure logs remotos
- Implemente crash reporting
- Monitore performance GPS

---

**🎯 Dica Importante**: Para primeiro teste, use o comando `npx cap run android --livereload` para desenvolvimento rápido. Para produção, sempre gere APK release assinado.

**⚠️ Lembrete**: Mantenha o backend rodando em servidor acessível pela internet para que o app mobile funcione corretamente em campo.
