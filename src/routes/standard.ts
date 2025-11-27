import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getStandards,
  getStandard,
  createStandard,
  updateStandard,
  deleteStandard,
  getClientStandards,
  addClientStandard,
  updateClientStandard,
  deleteClientStandard
} from '../controllers/standardController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Standards CRUD operations
router.get('/', getStandards);
router.get('/:id', getStandard);
router.post('/', requireOwnerAdminOrTrainer, createStandard);
router.put('/:id', requireOwnerAdminOrTrainer, updateStandard);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteStandard);

// Client standards (выполнения нормативов клиентом)
router.get('/clients/:clientId', getClientStandards);
router.post('/clients/:clientId', requireOwnerAdminOrTrainer, addClientStandard);
router.put('/clients/:clientId/:clientStandardId', requireOwnerAdminOrTrainer, updateClientStandard);
router.delete('/clients/:clientId/:clientStandardId', requireOwnerAdminOrTrainer, deleteClientStandard);

export default router;

