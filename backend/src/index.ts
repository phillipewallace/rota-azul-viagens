
import express from 'express';
import cors from 'cors';
import { createTables } from './config/database';
import trucksRoutes from './routes/trucks';
import routesRoutes from './routes/routes';
import driversRoutes from './routes/drivers';
import schedulesRoutes from './routes/schedules';
import maintenanceRoutes from './routes/maintenance';
import geocodingRoutes from './routes/geocoding';
import reportsRoutes from './routes/reports';
import mobileRoutes from './routes/mobile';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Rota Azul API funcionando!' });
});

// Routes
app.use('/api/trucks', trucksRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/mobile', mobileRoutes);

// Initialize database and start server
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
