import { Router } from 'express';
import { platformStaffLogin, platformStaffChangePassword } from '../controllers/platformStaffAuthController';
import { authenticatePlatformStaff } from '../middleware/platformStaffAuth';

const router = Router();
router.post('/login', platformStaffLogin);
router.post('/change-password', authenticatePlatformStaff, platformStaffChangePassword);

export default router;
