
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { setupDatabase } from './config/database';
import routesRouter from './routes/routes';
import trucksRouter from './routes/trucks';
import driversRouter from './routes/drivers';
import maintenanceRouter from './routes/maintenance';
import geocodingRouter from './routes/geocoding';
import reportsRouter from './routes/reports';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/routes', routesRouter);
app.use('/api/trucks', trucksRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/geocoding', geocodingRouter);
app.use('/api/reports', reportsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    googleMapsConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
    database: process.env.DB_NAME
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Erro no servidor:', err.stack);
  res.status(500).json({ 
    error: 'Algo deu errado!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const startServer = async () => {
  try {
    console.log('🚀 Iniciando servidor...');
    console.log(`📊 Conectando ao banco: ${process.env.DB_NAME} em ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`👤 Usuário: ${process.env.DB_USER}`);
    
    await setupDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗺️  Google Maps API: ${process.env.GOOGLE_MAPS_API_KEY ? 'Configurada' : 'Não configurada'}`);
      console.log(`📊 Banco de dados conectado: ${process.env.DB_NAME}`);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar o servidor:', error);
    process.exit(1);
  }
};

startServer();
