import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getMemberships,
  getMembershipById,
  createMembership,
  updateMembership,
  deleteMembership
} from '../controllers/membershipController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Membership management routes
router.get('/', getMemberships);
router.get('/:id', getMembershipById);
router.post('/', requireOwnerAdminOrTrainer, createMembership);
router.put('/:id', requireOwnerAdminOrTrainer, updateMembership);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteMembership);

export default router;
