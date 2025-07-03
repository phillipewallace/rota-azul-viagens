import express from 'express';
import cors from 'cors';
import { pool, createTables } from './config/database';

// Import routes
import driverRoutes from './routes/drivers';
import truckRoutes from './routes/trucks';
import routeRoutes from './routes/routes';
import scheduleRoutes from './routes/schedules';
import geocodingRoutes from './routes/geocoding';
import mobileRoutes from './routes/mobile';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:8080',
    'https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com'
  ],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/drivers', driverRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/mobile', mobileRoutes);

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
