
import express from 'express';
import cors from 'cors';
import { pool } from './config/database';
import authRoutes from './routes/auth';
import driversRoutes from './routes/drivers';
import trucksRoutes from './routes/trucks';
import routesRoutes from './routes/routes';
import routeMaintenanceRoutes from './routes/route-maintenance';
import schedulesRoutes from './routes/schedules';
import reportsRoutes from './routes/reports';
import geocodingRoutes from './routes/geocoding';
import mobileRoutes from './routes/mobile';
import uploadRoutes from './routes/upload';
import managementRoutes from './routes/management';
import maintenanceRoutes from './routes/maintenance';
import settingsRoutes from './routes/settings';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ MIDDLEWARE DE DEBUG MAIS DETALHADO
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [${timestamp}] ${req.method} ${req.originalUrl}`);
  console.log(`📍 [DEBUG] Path: ${req.path}`);
  console.log(`📍 [DEBUG] Route: ${req.route?.path || 'N/A'}`);
  console.log(`📍 [DEBUG] Params:`, req.params);
  console.log(`📍 [DEBUG] Query:`, req.query);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📍 [DEBUG] Body keys:`, Object.keys(req.body));
  }
  
  // ✅ DEBUG ESPECÍFICO PARA ROUTES
  if (req.originalUrl.includes('/routes/') && req.originalUrl.includes('optimize-intelligent')) {
    console.log(`🎯🎯🎯 [SERVER DEBUG] ROTA DE OTIMIZAÇÃO DETECTADA!`);
    console.log(`🎯 [SERVER DEBUG] URL completa: ${req.originalUrl}`);
    console.log(`🎯 [SERVER DEBUG] Method: ${req.method}`);
    console.log(`🎯 [SERVER DEBUG] Base URL: ${req.baseUrl}`);
    console.log(`🎯 [SERVER DEBUG] Path: ${req.path}`);
  }
  
  next();
});

// Test database connection
pool.connect()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection error:', err));

// ✅ ORDEM CRÍTICA: ROTAS MAIS ESPECÍFICAS PRIMEIRO
console.log('🚀 [SERVER] Registrando rotas na ordem correta...');

// 1. Auth (não tem conflitos)
app.use('/api/auth', authRoutes);
console.log('✅ [SERVER] 1. /api/auth registrado');

// 2. Routes PRIMEIRO (contém rotas específicas como /:id/optimize-intelligent)
app.use('/api/routes', routesRoutes);
console.log('✅ [SERVER] 2. /api/routes registrado (inclui /:id/optimize-intelligent)');

// 3. Route-maintenance DEPOIS (para não interceptar as rotas específicas)
app.use('/api/routes/maintenance', routeMaintenanceRoutes);
console.log('✅ [SERVER] 3. /api/routes/maintenance registrado');

// 4. Todas as outras rotas (ordem normal)
app.use('/api/drivers', driversRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/settings', settingsRoutes);

console.log('✅ [SERVER] Todas as rotas registradas com sucesso!');

// ✅ MIDDLEWARE PARA CAPTURAR ROTAS NÃO ENCONTRADAS COM INFORMAÇÕES DETALHADAS
app.use('*', (req, res) => {
  console.log(`❌❌❌ [404] ROTA NÃO ENCONTRADA - DIAGNÓSTICO COMPLETO:`);
  console.log(`❌ [404] Method: ${req.method}`);
  console.log(`❌ [404] URL original: ${req.originalUrl}`);
  console.log(`❌ [404] Path: ${req.path}`);
  console.log(`❌ [404] Base URL: ${req.baseUrl}`);
  console.log(`❌ [404] Params:`, req.params);
  console.log(`❌ [404] Query:`, req.query);
  console.log(`❌ [404] Headers relevantes:`, {
    'content-type': req.get('content-type'),
    'user-agent': req.get('user-agent')?.substring(0, 50) + '...',
    'origin': req.get('origin')
  });
  
  // ✅ VERIFICAÇÃO ESPECIAL PARA OTIMIZAÇÃO INTELIGENTE
  if (req.originalUrl.includes('optimize-intelligent')) {
    console.log(`🎯🎯🎯 [404] ERRO NA ROTA DE OTIMIZAÇÃO INTELIGENTE!`);
    console.log(`🎯 [404] Esta rota deveria ser capturada por /api/routes`);
    console.log(`🎯 [404] Verifique se o middleware está na ordem correta`);
  }
  
  res.status(404).json({ 
    error: 'API route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_routes: [
      '/api/auth/*', 
      '/api/routes/*', 
      '/api/routes/:id/optimize-intelligent',
      '/api/routes/maintenance/*',
      '/api/trucks/*', 
      '/api/drivers/*', 
      '/api/schedules/*', 
      '/api/geocoding/*', 
      '/api/mobile/*', 
      '/api/reports/*', 
      '/api/maintenance/*', 
      '/api/management/*', 
      '/api/settings/*', 
      '/api/upload/*'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 [SERVER ERROR]:', err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(port, () => {
  console.log(`🚀🚀🚀 Server is running on port ${port}`);
  console.log(`📍 ROTAS REGISTRADAS NA ORDEM:`);
  console.log(`   1. /api/auth/* (autenticação)`);
  console.log(`   2. /api/routes/* (inclui /:id/optimize-intelligent) ⭐`);
  console.log(`   3. /api/routes/maintenance/* (manutenção de rotas)`);
  console.log(`   4. /api/drivers/*, trucks/*, schedules/*, etc.`);
  console.log(`🎯 ROTA CRÍTICA: /api/routes/:id/optimize-intelligent`);
  console.log(`✅ Servidor pronto para receber requisições!`);
});
