import { Router } from 'express';
import multer from 'multer';
import {
  getMarketers,
  getMarketer,
  createMarketer,
  updateMarketer,
  deleteMarketer,
  getMarketerStats,
  registerMarketer,
} from '../controllers/marketerController';
import {
  getMarketerDashboard,
  listMarketerClients,
  getMarketerClientCard,
  createMarketerLead,
  updateMarketerLead,
  claimMarketerClient,
  listMarketerTasks,
  createMarketerTask,
  updateMarketerTask,
  listMarketerChats,
  ensureMarketerChat,
  listMarketerChatMessages,
  postMarketerChatMessage,
  getMarketerFinance,
  listMarketerPublications,
  listMarketerClosingDocs,
  downloadMarketerPublicationImage,
  downloadMarketerPublicationFile,
  downloadMarketerClosingDoc,
  updateMarketerBankDetails,
  createMarketerPayout,
  cancelMarketerPayout,
  sendMarketerPayoutSignCode,
  confirmMarketerPayoutSign,
  downloadMarketerPayoutDocument,
  uploadMarketerNpdReceipt,
  downloadMarketerNpdReceipt,
  getMarketerTeam,
  getMarketerInvite,
  resolveMarketerInvitePublic,
  getMarketerActivity,
  getMarketerProfile,
  updateMarketerProfile,
  getMarketerOnboarding,
  acceptMarketerOnboarding,
  changeMarketerPassword,
} from '../controllers/marketerCabinetController';
import { authenticatePromoCodeAdmin } from '../middleware/promoCodeAdminAuth';
import { authenticateMarketer } from '../middleware/marketerAuth';
import { loginRateLimiter } from '../middleware/loginRateLimit';
import {
  attachMarketerNewsRole,
  getPlatformNewsFile,
  getPlatformNewsImage,
  listPlatformNewsForRole,
} from '../controllers/platformChangelogController';
import {
  attachIdeaActorFromMarketer,
  createFeatureIdea,
  listMyFeatureIdeas,
} from '../controllers/clientFeatureIdeaController';
import {
  getMarketerNotificationPrefs,
  updateMarketerNotificationPrefs,
} from '../controllers/notificationPrefsController';
import { ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';

const npdReceiptUploadDir = ensureUploadDir('marketer-cabinet', 'npd-receipts');
const npdReceiptUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, npdReceiptUploadDir),
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

const router = Router();

router.post('/register', loginRateLimiter, registerMarketer);
router.get('/invite/:token', resolveMarketerInvitePublic);

// Cabinet (marketer JWT)
router.get('/me/stats', authenticateMarketer, getMarketerStats);
router.get('/me/team', authenticateMarketer, getMarketerTeam);
router.get('/me/invite', authenticateMarketer, getMarketerInvite);
router.get('/me/activity', authenticateMarketer, getMarketerActivity);
router.get('/me/profile', authenticateMarketer, getMarketerProfile);
router.patch('/me/profile', authenticateMarketer, updateMarketerProfile);
router.get('/me/onboarding', authenticateMarketer, getMarketerOnboarding);
router.post('/me/onboarding/accept', authenticateMarketer, acceptMarketerOnboarding);
router.get('/me/dashboard', authenticateMarketer, getMarketerDashboard);
router.get('/me/clients', authenticateMarketer, listMarketerClients);
router.get('/me/clients/:id', authenticateMarketer, getMarketerClientCard);
router.post('/me/leads', authenticateMarketer, createMarketerLead);
router.patch('/me/leads/:id', authenticateMarketer, updateMarketerLead);
router.post('/me/clients/claim', authenticateMarketer, claimMarketerClient);
router.get('/me/tasks', authenticateMarketer, listMarketerTasks);
router.post('/me/tasks', authenticateMarketer, createMarketerTask);
router.patch('/me/tasks/:id', authenticateMarketer, updateMarketerTask);
router.get('/me/chats', authenticateMarketer, listMarketerChats);
router.post('/me/chats/:channel/ensure', authenticateMarketer, ensureMarketerChat);
router.get('/me/chats/:threadId/messages', authenticateMarketer, listMarketerChatMessages);
router.post('/me/chats/:threadId/messages', authenticateMarketer, postMarketerChatMessage);
router.get('/me/finance', authenticateMarketer, getMarketerFinance);
router.put('/me/bank-details', authenticateMarketer, updateMarketerBankDetails);
router.post('/me/payouts', authenticateMarketer, createMarketerPayout);
router.post('/me/payouts/:id/cancel', authenticateMarketer, cancelMarketerPayout);
router.post('/me/payouts/:id/send-sign-code', authenticateMarketer, sendMarketerPayoutSignCode);
router.post('/me/payouts/:id/confirm-sign', authenticateMarketer, confirmMarketerPayoutSign);
router.get('/me/payouts/:id/document', authenticateMarketer, downloadMarketerPayoutDocument);
router.post(
  '/me/payouts/:id/npd-receipt',
  authenticateMarketer,
  npdReceiptUpload.single('file'),
  uploadMarketerNpdReceipt
);
router.get('/me/payouts/:id/npd-receipt', authenticateMarketer, downloadMarketerNpdReceipt);
router.get('/me/publications', authenticateMarketer, listMarketerPublications);
router.get('/me/publications/:id/image', authenticateMarketer, downloadMarketerPublicationImage);
router.get('/me/publications/:id/file', authenticateMarketer, downloadMarketerPublicationFile);
router.get('/me/closing-docs', authenticateMarketer, listMarketerClosingDocs);
router.get('/me/closing-docs/:id/file', authenticateMarketer, downloadMarketerClosingDoc);

/** Новости платформы для маркетолога. */
router.get('/me/news', authenticateMarketer, attachMarketerNewsRole, listPlatformNewsForRole);
router.get('/me/news/:id/image', authenticateMarketer, attachMarketerNewsRole, getPlatformNewsImage);
router.get('/me/news/:id/file', authenticateMarketer, attachMarketerNewsRole, getPlatformNewsFile);

router.post('/me/change-password', authenticateMarketer, changeMarketerPassword);
router.get('/me/notification-prefs', authenticateMarketer, getMarketerNotificationPrefs);
router.put('/me/notification-prefs', authenticateMarketer, updateMarketerNotificationPrefs);

router.get('/me/feature-ideas', authenticateMarketer, attachIdeaActorFromMarketer, listMyFeatureIdeas);
router.post('/me/feature-ideas', authenticateMarketer, attachIdeaActorFromMarketer, createFeatureIdea);

router.use(authenticatePromoCodeAdmin);

router.get('/:id/stats', getMarketerStats);
router.get('/', getMarketers);
router.get('/:id', getMarketer);
router.post('/', createMarketer);
router.put('/:id', updateMarketer);
router.delete('/:id', deleteMarketer);

export default router;
