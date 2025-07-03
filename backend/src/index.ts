
import express from 'express';
import cors from 'cors';
import { pool, createTables } from './config/database';

// Import routes
import trucksRouter from './routes/trucks';
import driversRouter from './routes/drivers';
import routesRouter from './routes/routes';
import reportsRouter from './routes/reports';
import maintenanceRouter from './routes/maintenance';
import schedulesRouter from './routes/schedules';
import geocodingRouter from './routes/geocoding';
import mobileRouter from './routes/mobile';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002',
    'https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com'
  ],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/trucks', trucksRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/routes', routesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/geocoding', geocodingRouter);
app.use('/api/mobile', mobileRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('🔧 Configurando banco de dados...');
    await createTables();
    console.log('✅ Banco de dados configurado com sucesso!');
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  API Base: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar o servidor:', error);
    process.exit(1);
  }
};

startServer();
