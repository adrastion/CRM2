import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireOwnerAdminOrTrainer } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';
import { ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';
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
  listTrainerDocuments,
  uploadTrainerDocument,
  downloadTrainerDocument,
  deleteTrainerDocument,
} from '../controllers/trainerController';

const router = Router();

const trainerDocsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const tenantId = (req as any).tenant?.id || (req as any).tenantId || 'unknown';
      cb(null, ensureUploadDir('trainer-docs', String(tenantId)));
    },
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('image/') ||
      /\.(pdf|png|jpe?g|webp|gif|heic)$/i.test(name);
    if (ok) cb(null, true);
    else cb(new Error('Допустимы PDF и изображения'));
  },
});

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

// Documents
router.get('/:id/documents', requireOwnerAdminOrTrainer, listTrainerDocuments);
router.post(
  '/:id/documents',
  requireOwnerAdminOrTrainer,
  (req, res, next) => {
    trainerDocsUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Ошибка загрузки' });
        return;
      }
      next();
    });
  },
  uploadTrainerDocument
);
router.get('/:id/documents/:docId/download', requireOwnerAdminOrTrainer, downloadTrainerDocument);
router.delete('/:id/documents/:docId', requireOwnerAdminOrTrainer, deleteTrainerDocument);

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
