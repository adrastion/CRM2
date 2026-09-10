import { Router } from 'express';
import { superAdminLogin } from '../controllers/superAdminAuthController';
import { loginRateLimiter } from '../middleware/loginRateLimit';

const router = Router();

// Login super admin (public route)
router.post('/login', loginRateLimiter, superAdminLogin);

export default router;
