import { Router } from 'express';
import {
  findClientsForRegistration,
  registerClient,
  loginClient,
  getClientProfile,
  getClientTrainings,
  findParentsForRegistration,
  registerParent,
  getAthleteCard,
  getClientCalendarPlan,
  getClientPayments,
  getPortalPaymentMethods,
  getPortalPaymentMethodQr,
  submitPortalPaymentReceipt,
  changePortalPassword,
} from '../controllers/clientAuthController';
import { authenticateClient } from '../middleware/clientAuth';
import { portalReceiptUpload } from '../controllers/paymentMethodController';
import { getClientDashboard, getClientTrainerCard, getPortalMembershipCatalog, changePortalMembership } from '../controllers/clientDashboardController';
import multer from 'multer';
import {
  clientCreateSupportTicket,
  clientListSupportTickets,
  clientGetSupportMessages,
  clientPostSupportMessage,
  clientGetSupportAttachment,
  clientSupportUnreadSummary,
  getSupportConfig,
} from '../controllers/supportTicketController';
import {
  ensureSupportAttachmentUploadDir,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MAX_FILES,
  supportAttachmentFilename,
} from '../services/supportTicketHelpers';

const clientSupportUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureSupportAttachmentUploadDir()),
    filename: (_req, file, cb) => cb(null, supportAttachmentFilename(file.originalname)),
  }),
  limits: {
    fileSize: SUPPORT_ATTACHMENT_MAX_BYTES,
    files: SUPPORT_ATTACHMENT_MAX_FILES,
  },
});
import {
  chatMediaUpload,
  clientEnsureThread,
  clientGetMedia,
  clientGetMessages,
  clientGetParticipants,
  clientGetPins,
  clientListThreads,
  clientDeleteMessage,
  clientMarkRead,
  clientPatchMessage,
  clientPinMessage,
  clientPostMediaMessage,
  clientPostMessage,
  clientUnpinMessage,
  clientUnreadTotal,
} from '../controllers/chatController';
import multer from 'multer';
import {
  clientListContracts,
  clientDownloadContract,
  clientDownloadAddendum,
  clientDownloadCertificate,
  clientUploadContract,
  clientUploadCertificate,
} from '../controllers/clientContractController';
import { ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';

const portalDocUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const tenantId =
        (req as any).client?.tenantId || (req as any).parent?.tenantId || 'unknown';
      cb(null, ensureUploadDir('client-contracts', String(tenantId)));
    },
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype) ||
      /\.(pdf|jpe?g|png)$/i.test(name);
    if (!ok) {
      cb(new Error('Допустимы PDF, JPG и PNG') as any);
      return;
    }
    cb(null, true);
  },
});

const portalCertUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype) ||
      /\.(pdf|jpe?g|png)$/i.test(name);
    if (!ok) {
      cb(new Error('Допустимы PDF, JPG и PNG') as any);
      return;
    }
    cb(null, true);
  },
});
import { loginRateLimiter } from '../middleware/loginRateLimit';
import {
  getPortalNotificationPrefs,
  updatePortalNotificationPrefs,
  getSharedVapidKey,
  subscribePortalPush,
  unsubscribePortalPush,
  portalPushStatus,
} from '../controllers/notificationPrefsController';
import {
  getPortalNotifications,
  getPortalNotificationsUnreadCount,
  markPortalNotificationsRead,
} from '../controllers/inboxNotificationController';
import {
  attachPortalNewsRole,
  getPlatformNewsFile,
  getPlatformNewsImage,
  listPlatformNewsForRole,
} from '../controllers/platformChangelogController';
import {
  attachIdeaActorFromPortal,
  createFeatureIdea,
  listMyFeatureIdeas,
} from '../controllers/clientFeatureIdeaController';

const router = Router();

// Публичные маршруты
router.post('/find', loginRateLimiter, findClientsForRegistration);
router.post('/register', loginRateLimiter, registerClient);
router.post('/login', loginRateLimiter, loginClient);
router.post('/parent/find', loginRateLimiter, findParentsForRegistration);
router.post('/parent/register', loginRateLimiter, registerParent);

// Защищенные маршруты
router.post('/change-password', authenticateClient, changePortalPassword);
router.get('/profile', authenticateClient, getClientProfile);
router.get('/trainings', authenticateClient, getClientTrainings);
router.get('/athlete-card', authenticateClient, getAthleteCard);
router.get('/calendar-plan', authenticateClient, getClientCalendarPlan);
router.get('/payments', authenticateClient, getClientPayments);
router.get('/payment-methods', authenticateClient, getPortalPaymentMethods);
router.get('/payment-methods/:id/qr', authenticateClient, getPortalPaymentMethodQr);
router.post(
  '/payments/:id/receipt',
  authenticateClient,
  (req, res, next) => {
    portalReceiptUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Ошибка загрузки' });
        return;
      }
      next();
    });
  },
  submitPortalPaymentReceipt
);
router.get('/dashboard', authenticateClient, getClientDashboard);
router.get('/membership-catalog', authenticateClient, getPortalMembershipCatalog);
router.post('/change-membership', authenticateClient, changePortalMembership);
router.get('/trainers/:trainerId/card', authenticateClient, getClientTrainerCard);
router.get('/notifications', authenticateClient, getPortalNotifications);
router.get('/notifications/unread-count', authenticateClient, getPortalNotificationsUnreadCount);
router.post('/notifications/read', authenticateClient, markPortalNotificationsRead);

router.get('/notification-prefs', authenticateClient, getPortalNotificationPrefs);
router.put('/notification-prefs', authenticateClient, updatePortalNotificationPrefs);
router.get('/push/vapid-key', authenticateClient, getSharedVapidKey);
router.post('/push/subscribe', authenticateClient, subscribePortalPush);
router.post('/push/unsubscribe', authenticateClient, unsubscribePortalPush);
router.get('/push/status', authenticateClient, portalPushStatus);

/** Новости платформы (фильтр по CLIENT / PARENT). */
router.get('/news', authenticateClient, attachPortalNewsRole, listPlatformNewsForRole);
router.get('/news/:id/image', authenticateClient, attachPortalNewsRole, getPlatformNewsImage);
router.get('/news/:id/file', authenticateClient, attachPortalNewsRole, getPlatformNewsFile);

/** Идеи для разработчика. */
router.get('/feature-ideas', authenticateClient, attachIdeaActorFromPortal, listMyFeatureIdeas);
router.post('/feature-ideas', authenticateClient, attachIdeaActorFromPortal, createFeatureIdea);

// Документы (договоры + личные сертификаты)
router.get('/clients/:clientId/contracts', authenticateClient, clientListContracts);
router.post(
  '/clients/:clientId/contracts',
  authenticateClient,
  (req, res, next) => {
    portalDocUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Ошибка загрузки' });
        return;
      }
      next();
    });
  },
  clientUploadContract
);
router.get(
  '/clients/:clientId/certificates/:kind/download',
  authenticateClient,
  clientDownloadCertificate
);
router.post(
  '/clients/:clientId/certificates/:kind',
  authenticateClient,
  (req, res, next) => {
    portalCertUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message || 'Ошибка загрузки' });
        return;
      }
      next();
    });
  },
  clientUploadCertificate
);
router.get(
  '/clients/:clientId/contracts/:contractId/download',
  authenticateClient,
  clientDownloadContract
);
router.get(
  '/clients/:clientId/contracts/:contractId/addenda/:addendumId/download',
  authenticateClient,
  clientDownloadAddendum
);

// Техподдержка (единственный канал SUPPORT)
router.get('/support/config', authenticateClient, getSupportConfig);
router.get('/support/unread-summary', authenticateClient, clientSupportUnreadSummary);
router.post(
  '/support/tickets',
  authenticateClient,
  clientSupportUpload.array('files', SUPPORT_ATTACHMENT_MAX_FILES),
  clientCreateSupportTicket
);
router.get('/support/tickets', authenticateClient, clientListSupportTickets);
router.get('/support/tickets/:ticketId/messages', authenticateClient, clientGetSupportMessages);
router.post(
  '/support/tickets/:ticketId/messages',
  authenticateClient,
  clientSupportUpload.array('files', SUPPORT_ATTACHMENT_MAX_FILES),
  clientPostSupportMessage
);
router.get('/support/attachments/:attachmentId', authenticateClient, clientGetSupportAttachment);

// Внутришкольные чаты
router.get('/chats/threads', authenticateClient, clientListThreads);
router.get('/chats/unread-total', authenticateClient, clientUnreadTotal);
router.post('/chats/threads/ensure', authenticateClient, clientEnsureThread);
router.get('/chats/threads/:id/messages', authenticateClient, clientGetMessages);
router.post('/chats/threads/:id/messages', authenticateClient, clientPostMessage);
router.post(
  '/chats/threads/:id/messages/media',
  authenticateClient,
  chatMediaUpload.single('file'),
  clientPostMediaMessage
);
router.get(
  '/chats/threads/:id/messages/:messageId/media/:attachmentId',
  authenticateClient,
  clientGetMedia
);
router.patch('/chats/threads/:id/messages/:messageId', authenticateClient, clientPatchMessage);
router.delete('/chats/threads/:id/messages/:messageId', authenticateClient, clientDeleteMessage);
router.post('/chats/threads/:id/read', authenticateClient, clientMarkRead);
router.get('/chats/threads/:id/participants', authenticateClient, clientGetParticipants);
router.get('/chats/threads/:id/pins', authenticateClient, clientGetPins);
router.post('/chats/threads/:id/pins', authenticateClient, clientPinMessage);
router.delete('/chats/threads/:id/pins/:messageId', authenticateClient, clientUnpinMessage);

export default router;

