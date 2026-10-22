import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getMemberships,
  getMembershipById,
  createMembership,
  updateMembership,
  deleteMembership,
  mergeMemberships,
  getMembershipStats,
  archiveMembership,
  restoreMembership,
  duplicateMembership,
} from '../controllers/membershipController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Membership management routes
router.get('/', getMemberships);
router.get('/stats', getMembershipStats);
router.post('/merge', requireOwnerAdminOrTrainer, mergeMemberships);
router.post('/:id/archive', requireOwnerAdminOrTrainer, archiveMembership);
router.post('/:id/restore', requireOwnerAdminOrTrainer, restoreMembership);
router.post('/:id/duplicate', requireOwnerAdminOrTrainer, duplicateMembership);
router.get('/:id', getMembershipById);
router.post('/', requireOwnerAdminOrTrainer, createMembership);
router.put('/:id', requireOwnerAdminOrTrainer, updateMembership);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteMembership);

export default router;
