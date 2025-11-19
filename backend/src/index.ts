
import express from 'express';
import cors from 'cors';
import { pool } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import routesRoutes from './routes/routes';
import trucksRoutes from './routes/trucks';
import driversRoutes from './routes/drivers';
import schedulesRoutes from './routes/schedules';
import geocodingRoutes from './routes/geocoding';
import mobileRoutes from './routes/mobile';
import reportsRoutes from './routes/reports';
import maintenanceRoutes from './routes/maintenance';
import managementRoutes from './routes/management';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import analyticsRoutes from './routes/analytics';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://192.168.1.100:5173', 'https://admmicban.com.br'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'Database connected', 
      timestamp: result.rows[0].now,
      message: 'PostgreSQL connection successful'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      status: 'Database error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API Routes
console.log('🚀 [SERVER] Registrando rotas da API...');

app.use('/api/auth', authRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);

console.log('✅ [SERVER] Todas as rotas registradas com sucesso');

// Debug: Lista todas as rotas registradas
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) {
    console.log(`🔍 [DEBUG] Rota registrada: ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler: any) => {
      if (handler.route) {
        console.log(`🔍 [DEBUG] Sub-rota: ${handler.route.path}`);
      }
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  console.log('🏭 [SERVER] Modo produção - servindo arquivos estáticos');
  app.use(express.static('/var/www/rota-azul-viagens/dist'));
  
  // Handle client-side routing
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile('/var/www/rota-azul-viagens/dist/index.html');
    }
  });
} else {
  console.log('🔧 [SERVER] Modo desenvolvimento');
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [SERVER] Erro não tratado:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log('❌ [SERVER] Rota API não encontrada:', req.method, req.path);
  console.log('❌ [SERVER] Headers da requisição:', req.headers);
  res.status(404).json({ 
    error: 'API route not found',
    path: req.path,
    method: req.method,
    available_routes: [
      '/api/auth',
      '/api/routes', 
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

app.listen(PORT, () => {
  console.log(`🚀 [SERVER] Servidor rodando na porta ${PORT}`);
  console.log(`🌐 [SERVER] API disponível em: http://localhost:${PORT}/api`);
  console.log(`📊 [SERVER] Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 [SERVER] Geocoding disponível em: http://localhost:${PORT}/api/geocoding`);
});
