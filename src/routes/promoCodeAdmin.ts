import { Router } from 'express';
import {
  getPromoCodeAdmins,
  getPromoCodeAdmin,
  createPromoCodeAdmin,
  updatePromoCodeAdmin,
  deletePromoCodeAdmin,
} from '../controllers/promoCodeAdminController';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';

const router = Router();

// All routes require regular admin authentication (only admins can manage promo code admins)
router.use(authenticate);
router.use(requireOwnerOrAdmin);

// Promo code admin CRUD operations
router.get('/', getPromoCodeAdmins);
router.get('/:id', getPromoCodeAdmin);
router.post('/', createPromoCodeAdmin);
router.put('/:id', updatePromoCodeAdmin);
router.delete('/:id', deletePromoCodeAdmin);

export default router;

