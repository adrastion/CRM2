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
  upload,
  updateMembershipFeeStatus,
  approveClientAccount,
  rejectClientAccount,
  approveParentAccount,
  assignClientTrial,
} from '../controllers/clientController';
import { authenticate, requireOwnerAdminOrTrainer, requireOwnerOrAdmin } from '../middleware/auth';
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

// Membership fee status (only OWNER or ADMIN)
router.put('/:id/membership-fee', requireOwnerOrAdmin, updateMembershipFeeStatus);

// Approve / reject client account (OWNER, ADMIN, or TRAINER)
router.put('/:id/approve-account', requireOwnerAdminOrTrainer, approveClientAccount);
router.put('/:id/reject-account', requireOwnerAdminOrTrainer, rejectClientAccount);

// Пробное занятие
router.post('/:id/trial', requireOwnerAdminOrTrainer, assignClientTrial);

// Approve parent account (OWNER or ADMIN)
router.put('/parents/:parentId/approve', requireOwnerOrAdmin, approveParentAccount);

export default router;
