
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import trucksRoutes from './routes/trucks';
import routesRoutes from './routes/routes';
import mobileRoutes from './routes/mobile';
import reportsRoutes from './routes/reports';
import managementRoutes from './routes/management';
import driversRoutes from './routes/drivers';
import settingsRoutes from './routes/settings';
import schedulesRoutes from './routes/schedules';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 [SERVER] Iniciando servidor...');
console.log(`📊 [SERVER] Porta configurada: ${PORT}`);
console.log(`🌍 [SERVER] Ambiente: ${process.env.NODE_ENV || 'development'}`);

// Middleware
console.log('🔧 [SERVER] Configurando middlewares...');
app.use(cors());
app.use(express.json());

// Middleware de log para todas as requisições
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📥 [${timestamp}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '***';
    console.log('📋 [REQUEST] Body:', sanitizedBody);
  }
  next();
});

// Routes
console.log('🛣️ [SERVER] Configurando rotas...');
app.use('/api/auth', authRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/schedules', schedulesRoutes);

// Health check
app.get('/health', (req, res) => {
  console.log('💚 [HEALTH] Health check solicitado');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware de log para respostas
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`📤 [RESPONSE] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    return originalSend.call(this, data);
  };
  next();
});

app.listen(PORT, () => {
  console.log(`✅ [SERVER] Servidor rodando na porta ${PORT}`);
  console.log(`🌐 [SERVER] Servidor disponível em: http://localhost:${PORT}`);
  console.log('📋 [SERVER] Rotas disponíveis:');
  console.log('   🔐 /api/auth - Autenticação');
  console.log('   🚛 /api/trucks - Caminhões');
  console.log('   🛣️ /api/routes - Rotas');
  console.log('   📱 /api/mobile - Mobile');
  console.log('   📊 /api/reports - Relatórios');
  console.log('   📋 /api/management - Gestão');
  console.log('   👥 /api/drivers - Motoristas');
  console.log('   ⚙️ /api/settings - Configurações');
  console.log('   📅 /api/schedules - Agendamentos');
  console.log('   💚 /health - Health Check');
});
