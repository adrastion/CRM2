import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  downloadPublicApk,
  getPublicNews,
  getPublicNewsImage,
  getPublicSiteConfig,
  getPublicVacancies,
  postPublicFeedback,
  postVacancyApplication,
} from '../controllers/publicSiteController';

const router = Router();

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много запросов, попробуйте позже' },
});

router.get('/config', getPublicSiteConfig);
router.get('/news', getPublicNews);
router.get('/news/:id/image', getPublicNewsImage);
router.get('/vacancies', getPublicVacancies);
router.post('/feedback', formLimiter, postPublicFeedback);
router.post('/vacancies/:id/apply', formLimiter, postVacancyApplication);
router.get('/download/apk', downloadPublicApk);

export default router;
