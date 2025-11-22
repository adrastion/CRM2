import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment
} from '../controllers/paymentController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Payment management routes
router.get('/', getPayments);
router.get('/:id', getPaymentById);
router.post('/', requireOwnerAdminOrTrainer, createPayment);
router.put('/:id', requireOwnerAdminOrTrainer, updatePayment);
router.delete('/:id', requireOwnerAdminOrTrainer, deletePayment);

export default router;
