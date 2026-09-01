import { Router } from 'express';
import { authenticate, requireOwnerOrAdmin } from '../middleware/auth';
import {
  listFinanceTypes,
  createFinanceType,
  listFinanceOperations,
  createFinanceOperation,
  payoutTrainerSalary,
  getSalarySummary,
  getMembershipFinanceSummary,
  receiveMembershipPayment,
  updateMembershipAmount,
  getFinanceRefs,
} from '../controllers/financeController';

const router = Router();

router.use(authenticate);
router.use(requireOwnerOrAdmin);

router.get('/types', listFinanceTypes);
router.post('/types', createFinanceType);
router.get('/refs', getFinanceRefs);

router.get('/operations', listFinanceOperations);
router.post('/operations', createFinanceOperation);

router.get('/salary-summary', getSalarySummary);
router.post('/salary-payout', payoutTrainerSalary);

router.get('/membership-summary', getMembershipFinanceSummary);
router.post('/membership-payments/receive', receiveMembershipPayment);
router.put('/membership-payments/amount', updateMembershipAmount);

export default router;
