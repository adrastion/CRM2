import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';
import {
  getTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
  removeDuplicateTrainings
} from '../controllers/trainingController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Training management routes
router.get('/', getTrainings);
router.post('/remove-duplicates', requireOwnerAdminOrTrainer, removeDuplicateTrainings); // Удаление дубликатов
router.get('/:id', getTrainingById);
router.post('/', requireOwnerAdminOrTrainer, checkSubscriptionLimit('trainings'), createTraining);
router.put('/:id', requireOwnerAdminOrTrainer, updateTraining);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteTraining);

export default router;
