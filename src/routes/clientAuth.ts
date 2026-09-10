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
} from '../controllers/clientAuthController';
import { authenticateClient } from '../middleware/clientAuth';
import { getClientDashboard } from '../controllers/clientDashboardController';
import {
  clientCreateSupportTicket,
  clientListSupportTickets,
  clientGetSupportMessages,
  clientPostSupportMessage,
} from '../controllers/supportTicketController';
import {
  clientEnsureThread,
  clientGetMessages,
  clientListThreads,
  clientMarkRead,
  clientPatchMessage,
  clientPostMessage,
  clientUnreadTotal,
} from '../controllers/chatController';
import {
  clientListContracts,
  clientDownloadContract,
  clientDownloadAddendum,
  clientDownloadCertificate,
} from '../controllers/clientContractController';
import { loginRateLimiter } from '../middleware/loginRateLimit';
import {
  getPortalNotificationPrefs,
  updatePortalNotificationPrefs,
  getSharedVapidKey,
  subscribePortalPush,
  unsubscribePortalPush,
  portalPushStatus,
} from '../controllers/notificationPrefsController';

const router = Router();

// Публичные маршруты
router.post('/find', loginRateLimiter, findClientsForRegistration);
router.post('/register', loginRateLimiter, registerClient);
router.post('/login', loginRateLimiter, loginClient);
router.post('/parent/find', loginRateLimiter, findParentsForRegistration);
router.post('/parent/register', loginRateLimiter, registerParent);

// Защищенные маршруты
router.get('/profile', authenticateClient, getClientProfile);
router.get('/trainings', authenticateClient, getClientTrainings);
router.get('/athlete-card', authenticateClient, getAthleteCard);
router.get('/calendar-plan', authenticateClient, getClientCalendarPlan);
router.get('/payments', authenticateClient, getClientPayments);
router.get('/dashboard', authenticateClient, getClientDashboard);

router.get('/notification-prefs', authenticateClient, getPortalNotificationPrefs);
router.put('/notification-prefs', authenticateClient, updatePortalNotificationPrefs);
router.get('/push/vapid-key', authenticateClient, getSharedVapidKey);
router.post('/push/subscribe', authenticateClient, subscribePortalPush);
router.post('/push/unsubscribe', authenticateClient, unsubscribePortalPush);
router.get('/push/status', authenticateClient, portalPushStatus);

// Документы (договоры + личные сертификаты)
router.get('/clients/:clientId/contracts', authenticateClient, clientListContracts);
router.get(
  '/clients/:clientId/certificates/:kind/download',
  authenticateClient,
  clientDownloadCertificate
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

// Техподдержка / дизайн (клиент или родитель)
router.post('/support/tickets', authenticateClient, clientCreateSupportTicket);
router.get('/support/tickets', authenticateClient, clientListSupportTickets);
router.get('/support/tickets/:ticketId/messages', authenticateClient, clientGetSupportMessages);
router.post('/support/tickets/:ticketId/messages', authenticateClient, clientPostSupportMessage);

// Внутришкольные чаты
router.get('/chats/threads', authenticateClient, clientListThreads);
router.get('/chats/unread-total', authenticateClient, clientUnreadTotal);
router.post('/chats/threads/ensure', authenticateClient, clientEnsureThread);
router.get('/chats/threads/:id/messages', authenticateClient, clientGetMessages);
router.post('/chats/threads/:id/messages', authenticateClient, clientPostMessage);
router.patch('/chats/threads/:id/messages/:messageId', authenticateClient, clientPatchMessage);
router.post('/chats/threads/:id/read', authenticateClient, clientMarkRead);

export default router;

