import { Router } from 'express';
import {
  getReferralLinks,
  getReferralLink,
  createReferralLink,
  updateReferralLink,
  deleteReferralLink,
  trackReferralClick,
  getReferralLinkStats,
} from '../controllers/referralLinkController';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';
import { authenticatePromoCodeOrMarketer } from '../middleware/promoCodeAuth';

const router = Router();

// Public endpoint for tracking clicks (no auth required)
// This must be before authenticate middleware
router.post('/track/:code', trackReferralClick);

// All other routes require promo code admin OR marketer authentication
router.use(authenticatePromoCodeOrMarketer);

// Referral link CRUD operations (all accessible to authenticated marketers)
router.get('/', getReferralLinks);
router.get('/:id', getReferralLink);
router.post('/', createReferralLink);
router.put('/:id', updateReferralLink);
router.delete('/:id', deleteReferralLink);

// Referral link statistics
router.get('/:id/stats', getReferralLinkStats);

export default router;

