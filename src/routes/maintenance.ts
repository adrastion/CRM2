import { Router } from 'express';
import {
  getPublicAccessStatusHandler,
  getAccessCheck,
  getPublicTerms,
} from '../controllers/maintenanceController';

const router = Router();

/** Публичный статус maintenance + testing (без allowlist). */
router.get('/status', getPublicAccessStatusHandler);

/** Проверка доступа текущего токена. */
router.get('/access', getAccessCheck);

export default router;
