import { Router } from 'express';
import {
  getMarketers,
  getMarketer,
  createMarketer,
  updateMarketer,
  deleteMarketer,
  getMarketerStats,
} from '../controllers/marketerController';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';
import { authenticatePromoCodeAdmin } from '../middleware/promoCodeAdminAuth';
import { authenticateMarketer } from '../middleware/marketerAuth';

const router = Router();

// Public route for marketer to get their own stats (requires marketer auth)
router.get('/me/stats', authenticateMarketer, getMarketerStats);

// All other routes require promo code admin authentication
router.use(authenticatePromoCodeAdmin);

// Get marketer stats - accessible to authenticated promo code admins
router.get('/:id/stats', getMarketerStats);

// Marketer CRUD operations (accessible to promo code admins)
router.get('/', getMarketers);
router.get('/:id', getMarketer);
router.post('/', createMarketer);
router.put('/:id', updateMarketer);
router.delete('/:id', deleteMarketer);

export default router;

