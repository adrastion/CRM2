import { Router } from 'express';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';
import {
  getClientCategories,
  getClientCategory,
  createClientCategory,
  updateClientCategory,
  deleteClientCategory
} from '../controllers/clientCategoryController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Client category routes
router.get('/', getClientCategories);
router.get('/:id', getClientCategory);
router.post('/', requireOwnerOrAdmin, createClientCategory);
router.put('/:id', requireOwnerOrAdmin, updateClientCategory);
router.delete('/:id', requireOwnerOrAdmin, deleteClientCategory);

export default router;

