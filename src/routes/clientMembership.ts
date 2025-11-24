import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getClientMemberships,
  createClientMembership,
  updateClientMembership,
  markVisitUsed,
  deleteClientMembership
} from '../controllers/clientMembershipController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Client membership routes
router.get('/', getClientMemberships);
router.post('/', requireOwnerAdminOrTrainer, createClientMembership);
router.put('/:id', requireOwnerAdminOrTrainer, updateClientMembership);
router.post('/:id/mark-visit', markVisitUsed);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteClientMembership);

export default router;

