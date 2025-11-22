import { Router } from 'express';
import {
  getPromoCodes,
  getPromoCode,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  getPromoCodeStats,
} from '../controllers/promoCodeController';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';
import { authenticatePromoCodeOrMarketer } from '../middleware/promoCodeAuth';

const router = Router();

// All routes require promo code admin OR marketer authentication
router.use(authenticatePromoCodeOrMarketer);

// Promo code CRUD operations (all accessible to authenticated marketers)
router.get('/', getPromoCodes);
router.get('/:id', getPromoCode);
router.post('/', createPromoCode);
router.put('/:id', updatePromoCode);
router.delete('/:id', deletePromoCode);

// Promo code statistics
router.get('/:id/stats', getPromoCodeStats);

export default router;

