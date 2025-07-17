
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

// ✅ MIDDLEWARE DE DEBUG DETALHADO PARA TODAS AS REQUISIÇÕES
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
  next();
});

// Test database connection
pool.connect()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection error:', err));

// ✅ ORDEM CORRIGIDA: ROTAS ESPECÍFICAS PRIMEIRO
app.use('/api/auth', authRoutes);
app.use('/api/routes', routesRoutes); // ✅ Esta deve vir ANTES da route-maintenance
app.use('/api/routes/maintenance', routeMaintenanceRoutes); // ✅ Agora vem depois
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

// ✅ MIDDLEWARE PARA CAPTURAR ROTAS NÃO ENCONTRADAS COM MAIS DETALHES
app.use('*', (req, res) => {
  console.log(`❌ [404] Rota não encontrada: ${req.method} ${req.originalUrl}`);
  console.log(`❌ [404] Path completo: ${req.path}`);
  console.log(`❌ [404] Base URL: ${req.baseUrl}`);
  console.log(`❌ [404] Headers relevantes:`, {
    'content-type': req.get('content-type'),
    'user-agent': req.get('user-agent'),
    'origin': req.get('origin')
  });
  
  res.status(404).json({ 
    error: 'API route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_routes: [
      '/api/auth', 
      '/api/routes', 
      '/api/routes/:id/optimize-intelligent',
      '/api/routes/maintenance',
      '/api/trucks', 
      '/api/drivers', 
      '/api/schedules', 
      '/api/geocoding', 
      '/api/mobile', 
      '/api/reports', 
      '/api/maintenance', 
      '/api/management', 
      '/api/settings', 
      '/api/upload'
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
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📍 Server routes registered in order:`);
  console.log(`   1. /api/auth`);
  console.log(`   2. /api/routes (includes /:id/optimize-intelligent)`);
  console.log(`   3. /api/routes/maintenance`);
  console.log(`   4. /api/drivers, trucks, schedules, etc.`);
});
