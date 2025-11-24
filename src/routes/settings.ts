import { Router } from 'express';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';
import { getSettings, updateSettings } from '../controllers/settingsController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Settings routes (only for owners and admins)
router.get('/', getSettings);
router.put('/', requireOwnerOrAdmin, updateSettings);

export default router;

