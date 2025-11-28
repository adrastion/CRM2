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
  validateClientQuery,
  exportClients,
  importClients,
  downloadClientTemplate,
  upload
} from '../controllers/clientController';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Export/Import clients (must be before /:id routes)
router.get('/export/excel', requireOwnerAdminOrTrainer, exportClients);
router.get('/export/template', requireOwnerAdminOrTrainer, downloadClientTemplate);
router.post('/import/excel', requireOwnerAdminOrTrainer, upload.single('file'), importClients);

// Client CRUD operations
router.get('/', validateClientQuery, getClients);
router.get('/:id', getClient);
router.post('/', requireOwnerAdminOrTrainer, checkSubscriptionLimit('clients'), validateCreateClient, createClient);
router.put('/:id', requireOwnerAdminOrTrainer, validateUpdateClient, updateClient);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteClient);

// Client achievements
router.post('/:id/achievements', requireOwnerAdminOrTrainer, addAchievement);
router.delete('/:id/achievements/:achievementId', requireOwnerAdminOrTrainer, removeAchievement);

// Client statistics
router.get('/:id/stats', getClientStats);

export default router;
