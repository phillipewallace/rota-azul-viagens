# AlchemyRotas Mobile - Guia de Build APK

## Pré-requisitos

1. **Node.js** (versão 18 ou superior)
2. **Android Studio** instalado e configurado
3. **Java Development Kit (JDK)** 11 ou 17
4. **Android SDK** (instalado via Android Studio)

## Configuração do Ambiente

### 1. Instalar dependências
```bash
cd mobile
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e configure a URL da API:
```bash
cp .env.example .env
```

Para desenvolvimento local:
```env
VITE_API_URL=http://localhost:3001/api
```

Para produção:
```env
VITE_API_URL=https://admmicban.com.br/api
```

### 3. Build da aplicação web
```bash
npm run build
```

## Configuração do Capacitor

### 1. Adicionar plataforma Android (primeira vez)
```bash
npm run add:android
```

### 2. Sincronizar arquivos
```bash
npm run sync
```

## Build do APK

### 1. Abrir no Android Studio
```bash
npm run android
```

### 2. Build via linha de comando
```bash
cd android
./gradlew assembleDebug
```

O APK será gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Build de Release (para produção)
```bash
cd android
./gradlew assembleRelease
```

## Permissões Necessárias

O app solicita as seguintes permissões:
- ✅ **Localização** (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION)
- ✅ **Internet** (INTERNET, ACCESS_NETWORK_STATE)
- ✅ **Camera** (para futuras funcionalidades)

## Testando o APK

1. Instale o APK no dispositivo:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

2. Ou use o comando direto:
```bash
npm run android
```

## Solução de Problemas

### Erro de API Connection
- Verifique se o backend está rodando
- Confirme a URL da API no arquivo `.env`
- Para teste local, use o IP da máquina ao invés de `localhost`

### Erro de Build
- Limpe o cache: `npm run sync`
- Rebuild: `npm run build && npm run sync`
- Verifique se todas as dependências estão instaladas

### Permissões de Localização
- O app solicitará permissões na primeira execução
- Certifique-se de aceitar as permissões de localização

## APIs Integradas

O mobile está alinhado com o backend nas seguintes rotas:
- `GET /mobile/truck/:plate` - Buscar dados do caminhão
- `PUT /mobile/truck/:id/location` - Atualizar localização
- `PUT /mobile/truck/:truckId/route/point/:pointId` - Marcar ponto como concluído
- `POST /mobile/truck/:truckId/finish-route` - Finalizar rota