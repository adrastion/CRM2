import { Router } from 'express';
import {
  findClientsForRegistration,
  registerClient,
  loginClient,
  getClientProfile,
  getClientTrainings,
  findParentsForRegistration,
  registerParent
} from '../controllers/clientAuthController';
import { authenticateClient } from '../middleware/clientAuth';

const router = Router();

// Публичные маршруты
router.post('/find', findClientsForRegistration);
router.post('/register', registerClient);
router.post('/login', loginClient);
router.post('/parent/find', findParentsForRegistration);
router.post('/parent/register', registerParent);

// Защищенные маршруты
router.get('/profile', authenticateClient, getClientProfile);
router.get('/trainings', authenticateClient, getClientTrainings);

export default router;

