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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Test database connection
pool.connect()
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/routes/maintenance', routeMaintenanceRoutes); // Novo router de manutenção
app.use('/api/schedules', schedulesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/settings', settingsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
