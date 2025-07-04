
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import trucksRoutes from './routes/trucks';
import routesRoutes from './routes/routes';
import mobileRoutes from './routes/mobile';
import reportsRoutes from './routes/reports';
import managementRoutes from './routes/management';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/management', managementRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
