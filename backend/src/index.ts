
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import routesRoutes from './routes/routes';
import trucksRoutes from './routes/trucks';

import schedulesRoutes from './routes/schedules';
import geocodingRoutes from './routes/geocoding';
import mobileRoutes from './routes/mobile';
import mobileExtraRoutes from './routes/mobile-extra';

import maintenanceRoutes from './routes/maintenance';
import managementRoutes from './routes/management';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import analyticsRoutes from './routes/analytics';
import customersRoutes from './routes/customers';
import photosRoutes from './routes/photos';
import completedRoutesRoutes from './routes/completed-routes';
import trackingRoutes from './routes/tracking';
import sanitariosRoutes from './routes/sanitarios';
import erpInventoryRoutes from './routes/erp-inventory';
import erpCompaniesRoutes from './routes/erp-companies';
import erpQuotesRoutes from './routes/erp-quotes';
import erpServiceOrdersRoutes from './routes/erp-service-orders';
import erpDocSettingsRoutes from './routes/erp-doc-settings';
import erpContractsRoutes from './routes/erp-contracts';
import erpContractTemplatesRoutes from './routes/erp-contract-templates';
import erpReceiptsRoutes from './routes/erp-receipts';
import erpInvoicesRoutes from './routes/erp-invoices';
import erpMedicoesRoutes from './routes/erp-medicoes';
import erpExpensesRoutes from './routes/erp-expenses';
import erpExpenseCategoriesRoutes from './routes/erp-expense-categories';
import erpRecurringExpensesRoutes from './routes/erp-recurring-expenses';
import erpSignedPdfsRoutes from './routes/erp-signed-pdfs';
import checklistsRoutes from './routes/checklists';
import carretinhasRoutes from './routes/carretinhas';
import erpFuncionariosRoutes from './routes/erp-funcionarios';
import erpSanitariosNewRoutes from './routes/erp-sanitarios-new';
import appFuncionariosRoutes from './routes/app-funcionarios';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3002;

// Rodamos atrás de nginx em produção — necessário para que rate-limit e req.ip
// leiam corretamente o X-Forwarded-For (evita ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
app.set('trust proxy', 1);

// Segurança HTTP — headers seguros (sem CSP para não quebrar assets servidos)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: permite origens conhecidas + requisições sem Origin (APK Capacitor)
const ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://localhost:8080', 'http://192.168.1.100:5173',
  'https://alchemyrotas.com', 'https://www.alchemyrotas.com',
  'capacitor://localhost', 'http://localhost', 'https://localhost', 'ionic://localhost',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (/\.lovableproject\.com$/.test(new URL(origin).hostname) || /\.lovable\.app$/.test(new URL(origin).hostname)) {
      return cb(null, true);
    }
    return cb(new Error(`Origem não permitida: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limit agressivo no login para mitigar brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20, // 20 tentativas/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/erp/funcionarios/login', authLimiter);


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'Database connected', 
      timestamp: result.rows[0].now,
      message: 'PostgreSQL connection successful'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      status: 'Database error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API Routes (Públicas - Sem requireAuth global aqui)
console.log('🚀 [SERVER] Registrando rotas da API...');

app.use('/api/auth', authRoutes);
app.use('/api/erp/funcionarios/login', (req, res, next) => {
    // Rota de login deve ser pública antes de aplicar middlewares restritivos
    erpFuncionariosRoutes(req, res, next);
});

import { restrictDemo } from './middleware/restrictDemo';
app.use(restrictDemo);



app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/trucks', trucksRoutes);

app.use('/api/schedules', schedulesRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/mobile', mobileExtraRoutes);

app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/completed-routes', completedRoutesRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/sanitarios', sanitariosRoutes);
app.use('/api/erp', erpInventoryRoutes);
app.use('/api/erp/companies', erpCompaniesRoutes);
app.use('/api/erp/quotes', erpQuotesRoutes);
app.use('/api/erp/service-orders', erpServiceOrdersRoutes);
app.use('/api/erp/doc-settings', erpDocSettingsRoutes);
app.use('/api/erp/contracts', erpContractsRoutes);
app.use('/api/erp/contract-templates', erpContractTemplatesRoutes);
app.use('/api/erp/receipts', erpReceiptsRoutes);
app.use('/api/erp/invoices', erpInvoicesRoutes);
app.use('/api/erp/medicoes', erpMedicoesRoutes);
app.use('/api/erp/expenses', erpExpensesRoutes);
app.use('/api/erp/expense-categories', erpExpenseCategoriesRoutes);
app.use('/api/erp/recurring-expenses', erpRecurringExpensesRoutes);
app.use('/api/erp/signed-pdfs', erpSignedPdfsRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/carretinhas', carretinhasRoutes);
// A rota de login já foi registrada como pública acima
app.use('/api/erp/funcionarios', erpFuncionariosRoutes);
app.use('/api/erp/sanitarios-new', erpSanitariosNewRoutes);
app.use('/api/app-funcionarios', appFuncionariosRoutes);


// Servir uploads.
// Pastas sensíveis (NFs, docs assinados) EXIGEM auth — evita que qualquer um
// com a URL baixe uma nota fiscal (CNPJ, valores, cliente).
// Para funcionar em <a download>/window.open (sem header custom), aceitamos
// o Bearer token também via query `?token=...`.
import { requireAuth } from './middleware/requireAuth';
const SENSITIVE_UPLOAD_PREFIXES = ['/invoices/', '/signed/', '/receipts/'];
app.use('/uploads', (req, res, next) => {
  if (!SENSITIVE_UPLOAD_PREFIXES.some(p => req.path.startsWith(p))) return next();
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return (requireAuth as any)(req, res, next);
});
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { maxAge: '7d' }));



console.log('✅ [SERVER] Todas as rotas registradas com sucesso');

// Debug: Lista todas as rotas registradas
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) {
    console.log(`🔍 [DEBUG] Rota registrada: ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler: any) => {
      if (handler.route) {
        console.log(`🔍 [DEBUG] Sub-rota: ${handler.route.path}`);
      }
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  console.log('🏭 [SERVER] Modo produção - servindo arquivos estáticos');
  app.use(express.static('/var/www/rota-azul-viagens/dist'));
  
  // Handle client-side routing
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile('/var/www/rota-azul-viagens/dist/index.html');
    }
  });
} else {
  console.log('🔧 [SERVER] Modo desenvolvimento');
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [SERVER] Erro não tratado:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log('❌ [SERVER] Rota API não encontrada:', req.method, req.path);
  console.log('❌ [SERVER] Headers da requisição:', req.headers);
  res.status(404).json({ 
    error: 'API route not found',
    path: req.path,
    method: req.method,
    available_routes: [
      '/api/auth',
      '/api/routes', 
      '/api/trucks',
      
      '/api/schedules',
      '/api/geocoding',
      '/api/mobile',
      '/api/reports',
      '/api/maintenance',
      '/api/management',
      '/api/settings',
      '/api/upload'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [SERVER] Servidor rodando na porta ${PORT}`);
  console.log(`🌐 [SERVER] API disponível em: http://localhost:${PORT}/api`);
  console.log(`📊 [SERVER] Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 [SERVER] Geocoding disponível em: http://localhost:${PORT}/api/geocoding`);
});
