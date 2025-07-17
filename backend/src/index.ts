
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

// Middleware básico
app.use(cors({
  origin: ['https://admmicban.com.br', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware de log simplificado (apenas para requisições importantes)
app.use((req, res, next) => {
  if (req.path.includes('/optimize-intelligent') || req.path.includes('/geocoding')) {
    console.log(`🚀 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Test database connection
pool.connect()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection error:', err));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Registrar rotas na ordem correta (mais específicas primeiro)
console.log('🚀 [SERVER] Registrando rotas...');

// 1. Auth routes
app.use('/api/auth', authRoutes);

// 2. Routes (DEVE VIR ANTES do route-maintenance para evitar conflitos)
app.use('/api/routes', routesRoutes);

// 3. Route maintenance (depois das rotas específicas)
app.use('/api/routes-maintenance', routeMaintenanceRoutes);

// 4. Outras rotas
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

console.log('✅ [SERVER] Todas as rotas registradas');

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  console.log(`❌ [404] ${req.method} ${req.originalUrl} - Path: ${req.path}`);
  res.status(404).json({ 
    error: 'API route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 [SERVER ERROR]:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/api/health`);
  console.log(`🎯 Critical routes registered:`);
  console.log(`   - /api/routes/:id/optimize-intelligent`);
  console.log(`   - /api/geocoding/cep/:cep`);
});
