import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';
import {
  getTrainings,
  getTrainingById,
  createTraining,
  createTrainingsBatch,
  updateTraining,
  deleteTraining,
  deleteTrainingsBatch,
  removeDuplicateTrainings
} from '../controllers/trainingController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Training management routes
router.get('/', getTrainings);
router.post('/remove-duplicates', requireOwnerAdminOrTrainer, removeDuplicateTrainings); // Удаление дубликатов
// Batch endpoint без проверки лимитов для каждого запроса (проверяем общее количество)
router.post('/batch', requireOwnerAdminOrTrainer, createTrainingsBatch); // Batch создание тренировок
router.delete('/batch', requireOwnerAdminOrTrainer, deleteTrainingsBatch); // Batch удаление тренировок
router.get('/:id', getTrainingById);
router.post('/', requireOwnerAdminOrTrainer, checkSubscriptionLimit('trainings'), createTraining);
router.put('/:id', requireOwnerAdminOrTrainer, updateTraining);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteTraining);

export default router;
