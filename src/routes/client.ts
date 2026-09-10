import { Router } from 'express';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  addAchievement,
  removeAchievement,
  getClientStats,
  validateCreateClient,
  validateUpdateClient,
  validateClientQuery,
  exportClients,
  importClients,
  downloadClientTemplate,
  upload,
  updateMembershipFeeStatus,
  approveClientAccount,
  rejectClientAccount,
  approveParentAccount,
  assignClientTrial,
} from '../controllers/clientController';
import { authenticate, requireOwnerAdminOrTrainer, requireOwnerOrAdmin } from '../middleware/auth';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits';
import multer from 'multer';
import {
  staffListContracts,
  staffUploadContract,
  staffDownloadContract,
  staffDeleteContract,
  staffUploadAddendum,
  staffDownloadAddendum,
  staffDeleteAddendum,
  staffDownloadCertificate,
} from '../controllers/clientContractController';
import { ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';

const contractUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const tenantId = (req as any).tenantId || 'unknown';
      cb(null, ensureUploadDir('client-contracts', String(tenantId)));
    },
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!ok) {
      cb(new Error('Только PDF') as any);
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate);

router.get('/export/excel', requireOwnerAdminOrTrainer, exportClients);
router.get('/export/template', requireOwnerAdminOrTrainer, downloadClientTemplate);
router.post('/import/excel', requireOwnerAdminOrTrainer, upload.single('file'), importClients);

router.get('/', validateClientQuery, getClients);
router.get('/:id', getClient);
router.post('/', requireOwnerAdminOrTrainer, checkSubscriptionLimit('clients'), validateCreateClient, createClient);
router.put('/:id', requireOwnerAdminOrTrainer, validateUpdateClient, updateClient);
router.delete('/:id', requireOwnerAdminOrTrainer, deleteClient);

router.get('/:id/contracts', requireOwnerAdminOrTrainer, staffListContracts);
router.get(
  '/:id/certificates/:kind/download',
  requireOwnerAdminOrTrainer,
  staffDownloadCertificate
);
router.post(
  '/:id/contracts',
  requireOwnerOrAdmin,
  (req, res, next) => {
    contractUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Ошибка загрузки' });
        return;
      }
      next();
    });
  },
  staffUploadContract
);
router.get('/:id/contracts/:contractId/download', requireOwnerAdminOrTrainer, staffDownloadContract);
router.delete('/:id/contracts/:contractId', requireOwnerOrAdmin, staffDeleteContract);
router.post(
  '/:id/contracts/:contractId/addenda',
  requireOwnerOrAdmin,
  (req, res, next) => {
    contractUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Ошибка загрузки' });
        return;
      }
      next();
    });
  },
  staffUploadAddendum
);
router.get(
  '/:id/contracts/:contractId/addenda/:addendumId/download',
  requireOwnerAdminOrTrainer,
  staffDownloadAddendum
);
router.delete(
  '/:id/contracts/:contractId/addenda/:addendumId',
  requireOwnerOrAdmin,
  staffDeleteAddendum
);

router.post('/:id/achievements', requireOwnerAdminOrTrainer, addAchievement);
router.delete('/:id/achievements/:achievementId', requireOwnerAdminOrTrainer, removeAchievement);

router.get('/:id/stats', getClientStats);

router.put('/:id/membership-fee', requireOwnerOrAdmin, updateMembershipFeeStatus);

router.put('/:id/approve-account', requireOwnerAdminOrTrainer, approveClientAccount);
router.put('/:id/reject-account', requireOwnerAdminOrTrainer, rejectClientAccount);

router.post('/:id/trial', requireOwnerAdminOrTrainer, assignClientTrial);

router.put('/parents/:parentId/approve', requireOwnerOrAdmin, approveParentAccount);

export default router;
