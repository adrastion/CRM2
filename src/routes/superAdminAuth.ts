import { Router } from 'express';
import { superAdminLogin } from '../controllers/superAdminAuthController';

const router = Router();

// Login super admin (public route)
router.post('/login', superAdminLogin);

export default router;

