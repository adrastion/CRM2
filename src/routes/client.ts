import { Router } from 'express';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  addAchievement,
  removeAchievement,
  getClientStats,
  validateCreateClient,
  validateUpdateClient,
  validateClientQuery
} from '../controllers/clientController';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Client CRUD operations
router.get('/', validateClientQuery, getClients);
router.get('/:id', getClient);
router.post('/', requireOwnerAdminOrTrainer, validateCreateClient, createClient);
router.put('/:id', requireOwnerAdminOrTrainer, validateUpdateClient, updateClient);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteClient);

// Client achievements
router.post('/:id/achievements', requireOwnerAdminOrTrainer, addAchievement);
router.delete('/:id/achievements/:achievementId', requireOwnerAdminOrTrainer, removeAchievement);

// Client statistics
router.get('/:id/stats', getClientStats);

export default router;
