import { Router } from 'express';
import { authenticate, requireOwnerOrAdmin, requireOwner } from '../middleware/auth';
import { getSettings, updateSettings, updateOnboardingStatus, resetMembershipFees } from '../controllers/settingsController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Settings routes (only for owners and admins)
router.get('/', getSettings);
router.put('/', requireOwnerOrAdmin, updateSettings);
router.post('/onboarding', updateOnboardingStatus);
// Массовый сброс отметок членских — только OWNER
router.post('/reset-membership-fees', requireOwner, resetMembershipFees);

export default router;

