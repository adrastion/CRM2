import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { postSiteAnalyticsPing } from '../controllers/siteAnalyticsController';

const router = Router();

const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много запросов' },
});

router.post('/ping', pingLimiter, postSiteAnalyticsPing);

export default router;
