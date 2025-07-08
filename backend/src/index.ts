
import express from 'express';
import cors from 'cors';
import path from 'path';
import { pool } from './config/database';

// Import routes
import trucksRoutes from './routes/trucks';
import routesRoutes from './routes/routes';
import driversRoutes from './routes/drivers';
import maintenanceRoutes from './routes/maintenance';
import schedulesRoutes from './routes/schedules';
import geocodingRoutes from './routes/geocoding';
import reportsRoutes from './routes/reports';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import mobileRoutes from './routes/mobile';
import managementRoutes from './routes/management';
import uploadRoutes from './routes/upload';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Test database connection
pool.connect()
  .then((client) => {
    console.log('✅ Database connected successfully');
    client.release();
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/trucks', trucksRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
