import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';
import {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addClientToGroup,
  removeClientFromGroup
} from '../controllers/groupController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Group management routes
router.get('/', getGroups);
router.get('/:id', getGroupById);
router.post('/', requireOwnerAdminOrTrainer, checkSubscriptionLimit('groups'), createGroup);
router.put('/:id', requireOwnerAdminOrTrainer, updateGroup);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteGroup);

// Group membership routes
router.post('/:id/clients', requireOwnerAdminOrTrainer, addClientToGroup);
router.delete('/:id/clients/:clientId', requireOwnerAdminOrTrainer, removeClientFromGroup);

export default router;
