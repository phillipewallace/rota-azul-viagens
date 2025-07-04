
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { setupDatabase, checkTables } from './config/database';

// Import routes
import trucksRouter from './routes/trucks';
import driversRouter from './routes/drivers';
import routesRouter from './routes/routes';
import schedulesRouter from './routes/schedules';
import maintenanceRouter from './routes/maintenance';
import reportsRouter from './routes/reports';
import managementRouter from './routes/management';
import mobileRouter from './routes/mobile';
import geocodingRouter from './routes/geocoding';
import authRouter from './routes/auth';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:3002', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📋 Body:`, JSON.stringify(req.body, null, 2).substring(0, 200));
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'PostgreSQL'
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/trucks', trucksRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/routes', routesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/management', managementRouter);
app.use('/api/mobile', mobileRouter);
app.use('/api/geocoding', geocodingRouter);

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🚀 Starting AlchemyRotas API Server...');
    
    // Setup database connection
    await setupDatabase();
    
    // Check if tables exist
    await checkTables();
    
    app.listen(PORT, () => {
      console.log('');
      console.log('🚚 ═══════════════════════════════════════');
      console.log('🚚   ROTA AZUL API - SERVER ONLINE     ');
      console.log('🚚 ═══════════════════════════════════════');
      console.log(`🚚 Server: http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/login`);
      console.log(`📱 Mobile: http://localhost:${PORT}/api/mobile/truck/:plate`);
      console.log('🚚 ═══════════════════════════════════════');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
