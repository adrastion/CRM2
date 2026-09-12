import { Router } from 'express';
import { authenticate, requireOwnerOrAdmin, requireOwner, requireOwnerAdminOrSenior } from '../middleware/auth';
import {
  listFinanceTypes,
  createFinanceType,
  listFinanceOperations,
  createFinanceOperation,
  deleteFinanceOperation,
  payoutTrainerSalary,
  getSalarySummary,
  getMembershipFinanceSummary,
  receiveMembershipPayment,
  updateMembershipAmount,
  getFinanceRefs,
} from '../controllers/financeController';
import {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentMethodQrFile,
  paymentQrUpload,
  listAwaitingReceipts,
  getReceiptFile,
  confirmPaymentReceipt,
  rejectPaymentReceipt,
} from '../controllers/paymentMethodController';

const router = Router();

router.use(authenticate);
router.use(requireOwnerAdminOrSenior);

router.get('/types', listFinanceTypes);
router.post('/types', createFinanceType);
router.get('/refs', getFinanceRefs);

router.get('/operations', listFinanceOperations);
router.post('/operations', createFinanceOperation);
router.delete('/operations/:id', requireOwner, deleteFinanceOperation);

router.get('/salary-summary', getSalarySummary);
router.post('/salary-payout', payoutTrainerSalary);

router.get('/membership-summary', getMembershipFinanceSummary);
router.post('/membership-payments/receive', receiveMembershipPayment);
router.put('/membership-payments/amount', updateMembershipAmount);

router.get('/payment-methods', listPaymentMethods);
router.post(
  '/payment-methods',
  requireOwner,
  (req, res, next) => {
    paymentQrUpload.single('qr')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Upload failed' });
        return;
      }
      next();
    });
  },
  createPaymentMethod
);
router.put(
  '/payment-methods/:id',
  requireOwner,
  (req, res, next) => {
    paymentQrUpload.single('qr')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Upload failed' });
        return;
      }
      next();
    });
  },
  updatePaymentMethod
);
router.delete('/payment-methods/:id', requireOwner, deletePaymentMethod);
router.get('/payment-methods/:id/qr', getPaymentMethodQrFile);

router.get('/payment-receipts', listAwaitingReceipts);
router.get('/payment-receipts/:paymentId/file', getReceiptFile);
router.post('/payment-receipts/:paymentId/confirm', requireOwnerOrAdmin, confirmPaymentReceipt);
router.post('/payment-receipts/:paymentId/reject', requireOwnerOrAdmin, rejectPaymentReceipt);

export default router;
