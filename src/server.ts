import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';

import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { csrfProtection } from './middleware/authCookies';
import { stripClientTenantFields } from './middleware/tenantGuard';
import { redactString } from './utils/safeLog';
import authRoutes from './routes/auth';
import clientAuthRoutes from './routes/clientAuth';
import tenantRoutes from './routes/tenant';
import branchRoutes from './routes/branch';
import hallRoutes from './routes/hall';
import clientRoutes from './routes/client';
import trainerRoutes from './routes/trainer';
import groupRoutes from './routes/group';
import membershipRoutes from './routes/membership';
import paymentRoutes from './routes/payment';
import financeRoutes from './routes/finance';
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
import schoolEventRoutes from './routes/schoolEvent';
import pushNotificationRoutes from './routes/pushNotifications';
import platformStaffAuthRoutes from './routes/platformStaffAuthRoutes';
import platformStaffRoutes from './routes/platformStaffRoutes';
import superAdminSupportRoutes from './routes/superAdminSupportRoutes';
import supportRequesterRoutes from './routes/supportRequesterRoutes';
import searchRoutes from './routes/search';
import chatRoutes from './routes/chat';
import platformRoutes from './routes/platform';
import notificationPrefsRoutes from './routes/notificationPrefs';
import maintenanceRoutes from './routes/maintenance';
import { maintenanceMiddleware } from './middleware/maintenance';
import { attachSupportCallSocket } from './services/supportCallSocket';
import { attachChatNamespace } from './services/chatSocket';
import { cleanupExpiredDesignerRecordings } from './controllers/supportTicketController';
import { createMonthlyPaymentsForAllTenants } from './controllers/paymentController';
import { sendDailyTrainingNotifications, sendTrainingReminders } from './services/notificationService';
import {
  collectAndStoreSample,
  cleanupOldMetricSamples,
} from './services/serverMetricsService';
import { checkCriticalThresholds } from './services/serverAlertService';
import { accrueFixedMonthlyForAllTenants } from './services/trainerSalaryService';

// Load .env from project root (works when cwd is not CRM2 or when using ts-node from src/)
const rootEnv = path.join(__dirname, '..', '.env');
dotenv.config({ path: rootEnv });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}
if (!process.env.DATABASE_URL) {
  console.warn(
    '\n⚠️  DATABASE_URL is not set. Create a `.env` file in the project root (next to package.json).\n' +
      '   Example (Windows PowerShell):  Copy-Item env.example .env\n' +
      '   Then edit .env and set DATABASE_URL, e.g. postgresql://USER:PASSWORD@localhost:5432/martial_arts_crm?schema=public\n' +
      '   Cron jobs that use the database are disabled until DATABASE_URL is set.\n'
  );
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for express-rate-limit when behind a reverse proxy
// Set to 1 if behind a single reverse proxy (nginx, etc.), or the number of proxies
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        // API отдаёт JSON; скрипты/стили не нужны. Отчёты CSP не ломают SPA (она на другом origin).
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    hsts:
      process.env.NODE_ENV === 'production'
        ? { maxAge: 15552000, includeSubDomains: true }
        : false,
  })
);

app.use(cookieParser());
app.use(csrfProtection);
// Rate limiting - увеличенные лимиты для поддержки batch операций
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // limit each IP to 1000 requests per windowMs (увеличено для поддержки множественных запросов)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Исключаем batch endpoints и health check из строгого лимитирования
  skip: (req) => {
    return req.path.includes('/batch') ||
           req.path.includes('/remove-duplicates') ||
           req.path.startsWith('/socket.io') ||
           req.path === '/health';
  }
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-CSRF-Token'],
  exposedHeaders: ['Content-Disposition'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware (без PII / токенов в URL)
morgan.token('safe-url', (req) => {
  const url = (req as any).originalUrl || req.url || '';
  return redactString(String(url));
});
if (process.env.NODE_ENV === 'development') {
  app.use(morgan(':method :safe-url :status :response-time ms'));
} else {
  app.use(
    morgan(
      ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length]'
    )
  );
}

// Static files — публичная раздача /uploads отключена (P0).
// Файлы отдаются только через authenticated download endpoints.

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Режим техобслуживания: 503 для всех, кроме SUPER_ADMIN (+ allowlist)
app.use(maintenanceMiddleware);

// API routes — школьные роуты снимают client-supplied tenantId из body
const schoolTenantGuard = stripClientTenantFields;

app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/client-auth', clientAuthRoutes);
app.use('/api/tenant', schoolTenantGuard, tenantRoutes);
app.use('/api/branches', schoolTenantGuard, branchRoutes);
app.use('/api/halls', schoolTenantGuard, hallRoutes);
app.use('/api/clients', schoolTenantGuard, clientRoutes);
app.use('/api/trainers', schoolTenantGuard, trainerRoutes);
app.use('/api/groups', schoolTenantGuard, groupRoutes);
app.use('/api/search', schoolTenantGuard, searchRoutes);
app.use('/api/memberships', schoolTenantGuard, membershipRoutes);
app.use('/api/payments', schoolTenantGuard, paymentRoutes);
app.use('/api/finance', schoolTenantGuard, financeRoutes);
app.use('/api/trainings', schoolTenantGuard, trainingRoutes);
app.use('/api/attendances', schoolTenantGuard, attendanceRoutes);
app.use('/api/competitions', schoolTenantGuard, competitionRoutes);
app.use('/api/school-events', schoolTenantGuard, schoolEventRoutes);
app.use('/api/reports', schoolTenantGuard, reportRoutes);
app.use('/api/promo-codes', schoolTenantGuard, promoCodeRoutes);
app.use('/api/referral-links', schoolTenantGuard, referralLinkRoutes);
app.use('/api/marketers', schoolTenantGuard, marketerRoutes);
app.use('/api/promo-code-admins', schoolTenantGuard, promoCodeAdminRoutes);
app.use('/api/settings', schoolTenantGuard, settingsRoutes);
app.use('/api/client-memberships', schoolTenantGuard, clientMembershipRoutes);
app.use('/api/standards', schoolTenantGuard, standardRoutes);
app.use('/api/subscriptions', schoolTenantGuard, subscriptionRoutes);
app.use('/api/super-admin/auth', superAdminAuthRoutes);
app.use('/api/admin-dashboard', adminDashboardRoutes);
app.use('/api/push-notifications', pushNotificationRoutes);
app.use('/api/notification-prefs', notificationPrefsRoutes);
app.use('/api/platform-staff/auth', platformStaffAuthRoutes);
app.use('/api/platform-staff', platformStaffRoutes);
app.use('/api/super-admin/support', superAdminSupportRoutes);
app.use('/api/support', supportRequesterRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/platform', platformRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const httpServer = http.createServer(app);
const io = attachSupportCallSocket(httpServer);
attachChatNamespace(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);

  if (!process.env.DATABASE_URL) {
    return;
  }

  // Настройка автоматического создания ежемесячных платежей
  // Запускается каждый день в 00:00 (полночь)
  // Можно изменить время через переменную окружения CRON_MONTHLY_PAYMENTS_TIME (формат: "0 0 * * *")
  const cronSchedule = process.env.CRON_MONTHLY_PAYMENTS_TIME || '0 0 * * *';
  
  cron.schedule(cronSchedule, async () => {
    console.log('[Cron] Scheduled task: Creating monthly payments...');
    try {
      await createMonthlyPaymentsForAllTenants();
    } catch (error) {
      console.error('[Cron] Error in scheduled monthly payments creation:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow'
  });

  console.log(`⏰ Monthly payments cron job scheduled: ${cronSchedule}`);

  // Начисление фикс. месячной зарплаты (схема fixed_monthly) в день выплаты
  cron.schedule(cronSchedule, async () => {
    console.log('[Cron] Scheduled task: Accruing fixed monthly trainer salaries...');
    try {
      await accrueFixedMonthlyForAllTenants(new Date());
    } catch (error) {
      console.error('[Cron] Error accruing fixed monthly salaries:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow'
  });

  // Настройка уведомлений о тренировках
  // Проверка каждую минуту для напоминаний
  cron.schedule('* * * * *', async () => {
    try {
      await sendTrainingReminders();
    } catch (error) {
      console.error('[Cron] Error in training reminders:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow'
  });

  // Ежедневные уведомления - проверка каждую минуту для точного времени
  cron.schedule('* * * * *', async () => {
    try {
      await sendDailyTrainingNotifications();
    } catch (error) {
      console.error('[Cron] Error in daily training notifications:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow'
  });

  console.log(`⏰ Training notifications cron jobs scheduled (timezone: ${process.env.TZ || 'Europe/Moscow'})`);

  // Снятие пробных членств после окончания занятия
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { cleanupExpiredTrialMemberships } = await import('./services/trialMembershipService');
      const n = await cleanupExpiredTrialMemberships();
      if (n > 0) {
        console.log(`[Cron] Deactivated ${n} expired trial group membership(s)`);
      }
    } catch (error) {
      console.error('[Cron] Error cleaning up trial memberships:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow'
  });

  // Абонемент без живого покрытия → слет с групп с ежемесячной оплатой
  cron.schedule('20 * * * *', async () => {
    try {
      const { cleanupExpiredMembershipMonthlyGroups } = await import(
        './services/clientMembershipService'
      );
      const n = await cleanupExpiredMembershipMonthlyGroups();
      if (n > 0) {
        console.log(`[Cron] Removed ${n} membership(s) from monthly-payment groups (expired/debt pack)`);
      }
    } catch (error) {
      console.error('[Cron] Error cleaning membership monthly groups:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow',
  });
  console.log('⏰ Membership→monthly-group cleanup scheduled (hourly at :20)');

  // Удаление просроченных записей звонков дизайнеров (хранение 14 дней)
  cron.schedule('15 3 * * *', async () => {
    try {
      const removed = await cleanupExpiredDesignerRecordings();
      if (removed > 0) {
        console.log(`[Cron] Removed ${removed} expired designer call recording(s)`);
      }
    } catch (error) {
      console.error('[Cron] Error cleaning designer call recordings:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow',
  });
  console.log('⏰ Designer call recordings cleanup scheduled (daily 03:15)');

  // Мониторинг нагрузки сервера: сэмпл каждые 30 секунд + проверка критических порогов
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const snapshot = await collectAndStoreSample();
      await checkCriticalThresholds(snapshot);
    } catch (error) {
      console.error('[Cron] Error collecting server metrics:', error);
    }
  });
  console.log('⏰ Server metrics collection scheduled (every 30s)');

  // Retention: удаление сэмплов старше 30 дней (ежедневно в 03:30)
  cron.schedule('30 3 * * *', async () => {
    try {
      const removed = await cleanupOldMetricSamples();
      if (removed > 0) {
        console.log(`[Cron] Removed ${removed} old server metric sample(s)`);
      }
    } catch (error) {
      console.error('[Cron] Error cleaning old server metrics:', error);
    }
  }, {
    timezone: process.env.TZ || 'Europe/Moscow',
  });
  console.log('⏰ Server metrics retention cleanup scheduled (daily 03:30)');
});

export default app;
