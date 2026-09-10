import { Router } from 'express';
import { platformStaffLogin, platformStaffChangePassword } from '../controllers/platformStaffAuthController';
import { authenticatePlatformStaff } from '../middleware/platformStaffAuth';
import { loginRateLimiter } from '../middleware/loginRateLimit';

const router = Router();
router.post('/login', loginRateLimiter, platformStaffLogin);
router.post('/change-password', authenticatePlatformStaff, platformStaffChangePassword);

export default router;
