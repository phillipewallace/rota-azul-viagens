
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

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

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚚 Rota Azul API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`📱 Mobile endpoint: http://localhost:${PORT}/api/mobile/truck/:plate`);
});
