import { Router } from 'express';
import { authenticateSuperAdminOrTester } from '../middleware/testerAuth';
import { authenticateSuperAdmin } from '../middleware/superAdminAuth';
import {
  ensurePlatformChatThread,
  getPlatformChatMessages,
  listPlatformChatThreads,
  markPlatformChatRead,
  sendPlatformChatMessage,
  updatePlatformChatMessage,
} from '../controllers/platformChatController';
import {
  createPlatformChangelog,
  deletePlatformChangelog,
  listPlatformChangelog,
  updatePlatformChangelog,
} from '../controllers/platformChangelogController';
import { authenticateTester } from '../middleware/testerAuth';
import {
  getTesterNotificationPrefs,
  updateTesterNotificationPrefs,
  getSharedVapidKey,
  subscribeTesterPush,
  unsubscribeTesterPush,
  testerPushStatus,
} from '../controllers/notificationPrefsController';

const router = Router();

router.get('/chats/threads', authenticateSuperAdminOrTester, listPlatformChatThreads);
router.post('/chats/threads/ensure', authenticateSuperAdminOrTester, ensurePlatformChatThread);
router.get('/chats/threads/:threadId/messages', authenticateSuperAdminOrTester, getPlatformChatMessages);
router.post('/chats/threads/:threadId/messages', authenticateSuperAdminOrTester, sendPlatformChatMessage);
router.patch(
  '/chats/threads/:threadId/messages/:messageId',
  authenticateSuperAdminOrTester,
  updatePlatformChatMessage
);
router.post('/chats/threads/:threadId/read', authenticateSuperAdminOrTester, markPlatformChatRead);

router.get('/changelog', authenticateSuperAdminOrTester, listPlatformChangelog);
router.post('/changelog', authenticateSuperAdmin, createPlatformChangelog);
router.put('/changelog/:id', authenticateSuperAdmin, updatePlatformChangelog);
router.delete('/changelog/:id', authenticateSuperAdmin, deletePlatformChangelog);

router.get('/tester/notification-prefs', authenticateTester, getTesterNotificationPrefs);
router.put('/tester/notification-prefs', authenticateTester, updateTesterNotificationPrefs);
router.get('/tester/push/vapid-key', authenticateTester, getSharedVapidKey);
router.post('/tester/push/subscribe', authenticateTester, subscribeTesterPush);
router.post('/tester/push/unsubscribe', authenticateTester, unsubscribeTesterPush);
router.get('/tester/push/status', authenticateTester, testerPushStatus);

export default router;
