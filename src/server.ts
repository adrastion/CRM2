import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenant';
import branchRoutes from './routes/branch';
import hallRoutes from './routes/hall';
import clientRoutes from './routes/client';
import trainerRoutes from './routes/trainer';
import groupRoutes from './routes/group';
import membershipRoutes from './routes/membership';
import paymentRoutes from './routes/payment';
import trainingRoutes from './routes/training';
import attendanceRoutes from './routes/attendance';
import reportRoutes from './routes/report';
import promoCodeRoutes from './routes/promoCode';
import referralLinkRoutes from './routes/referralLink';
import marketerRoutes from './routes/marketer';
import promoCodeAdminRoutes from './routes/promoCodeAdmin';
import settingsRoutes from './routes/settings';
import clientMembershipRoutes from './routes/clientMembership';
import standardRoutes from './routes/standard';
import subscriptionRoutes from './routes/subscription';
import adminDashboardRoutes from './routes/adminDashboard';
import superAdminAuthRoutes from './routes/superAdminAuth';
import competitionRoutes from './routes/competition';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for express-rate-limit when behind a reverse proxy
// Set to 1 if behind a single reverse proxy (nginx, etc.), or the number of proxies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting - увеличенные лимиты для поддержки batch операций
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'), // limit each IP to 500 requests per windowMs (увеличено для batch операций)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Исключаем batch endpoints из строгого лимитирования
  skip: (req) => {
    return req.path.includes('/batch') || req.path.includes('/remove-duplicates');
  }
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/halls', hallRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/referral-links', referralLinkRoutes);
app.use('/api/marketers', marketerRoutes);
app.use('/api/promo-code-admins', promoCodeAdminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/client-memberships', clientMembershipRoutes);
app.use('/api/standards', standardRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/super-admin/auth', superAdminAuthRoutes);
app.use('/api/admin-dashboard', adminDashboardRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
