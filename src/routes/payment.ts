import { Router } from 'express';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';
import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  createMonthlyPayments,
  recalculateMonthlyPayment
} from '../controllers/paymentController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Чтение — все аутентифицированные роли маршрута; запись денег — OWNER/ADMIN
router.get('/', getPayments);
router.get('/:id', getPaymentById);
router.post('/', requireOwnerOrAdmin, createPayment);
router.put('/:id', requireOwnerOrAdmin, updatePayment);
router.delete('/:id', requireOwnerOrAdmin, deletePayment);
router.post('/monthly/create', requireOwnerOrAdmin, createMonthlyPayments);
router.post('/:id/recalculate', requireOwnerOrAdmin, recalculateMonthlyPayment);

export default router;
