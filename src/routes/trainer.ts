import { Router } from 'express';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';
import {
  getTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  addBranchToTrainer,
  removeBranchFromTrainer,
  getTrainerEarnings,
  getAllTrainersEarnings,
  getTrainerNotificationSettings,
  updateTrainerNotificationSettings,
  getTrainerSalaryLedger,
  postTrainerSalaryLedger,
  getSalaryPayoutReminder,
  accrueFixedMonthlySalaries,
  backfillSalaryFromAttendance,
  backfillSalaryFromPayments,
} from '../controllers/trainerController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Static paths before /:id
router.get('/earnings/all', getAllTrainersEarnings); // Only admin/owner
router.get('/salary-payout-reminder', getSalaryPayoutReminder);
router.post('/accrue-fixed-monthly', accrueFixedMonthlySalaries);
router.post('/backfill-salary-from-attendance', backfillSalaryFromAttendance);
router.post('/backfill-salary-from-payments', backfillSalaryFromPayments);

// Trainer management routes
router.get('/', getTrainers);
router.get('/:id', getTrainerById);
router.post('/', requireOwnerAdminOrTrainer, checkSubscriptionLimit('trainers'), createTrainer);
router.put('/:id', requireOwnerAdminOrTrainer, updateTrainer);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteTrainer);

// Trainer branch assignment routes
router.post('/:id/branches', requireOwnerAdminOrTrainer, addBranchToTrainer);
router.delete('/:id/branches/:branchId', requireOwnerAdminOrTrainer, removeBranchFromTrainer);

// Trainer earnings / salary ledger
router.get('/:id/earnings', getTrainerEarnings);
router.get('/:id/salary-ledger', getTrainerSalaryLedger);
router.post('/:id/salary-ledger', postTrainerSalaryLedger);

// Trainer notification settings routes
router.get('/:id/notifications', getTrainerNotificationSettings);
router.put('/:id/notifications', updateTrainerNotificationSettings);

export default router;
