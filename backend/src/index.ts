
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import driversRoutes from './routes/drivers';
import trucksRoutes from './routes/trucks';
import routesRoutes from './routes/routes';
import schedulesRoutes from './routes/schedules';
import reportsRoutes from './routes/reports';
import geocodingRoutes from './routes/geocoding';
import maintenanceRoutes from './routes/maintenance';
import mobileRoutes from './routes/mobile';
import managementRoutes from './routes/management';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://e145d80f-177c-4eb9-987f-d67c392fc5de.lovableproject.com']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/drivers', driversRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/management', managementRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Mobile API disponível em /api/mobile`);
  console.log(`📊 Management API disponível em /api/management`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
