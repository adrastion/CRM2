import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  addBranchToTrainer,
  removeBranchFromTrainer
} from '../controllers/trainerController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Trainer management routes
router.get('/', getTrainers);
router.get('/:id', getTrainerById);
router.post('/', requireOwnerAdminOrTrainer, createTrainer);
router.put('/:id', requireOwnerAdminOrTrainer, updateTrainer);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteTrainer);

// Trainer branch assignment routes
router.post('/:id/branches', requireOwnerAdminOrTrainer, addBranchToTrainer);
router.delete('/:id/branches/:branchId', requireOwnerAdminOrTrainer, removeBranchFromTrainer);

export default router;
