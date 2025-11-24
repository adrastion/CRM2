import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  addBranchToTrainer,
  removeBranchFromTrainer,
  getTrainerEarnings,
  getAllTrainersEarnings
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

// Trainer earnings routes
router.get('/:id/earnings', getTrainerEarnings); // Trainer can see own earnings, admin/owner can see any
router.get('/earnings/all', getAllTrainersEarnings); // Only admin/owner

export default router;
