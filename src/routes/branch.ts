import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';
import {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
} from '../controllers/branchController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Branch management routes
router.get('/', getBranches);
router.get('/:id', getBranchById);
router.post('/', requireOwnerAdminOrTrainer, checkSubscriptionLimit('branches'), createBranch);
router.put('/:id', requireOwnerAdminOrTrainer, updateBranch);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteBranch);

export default router;
