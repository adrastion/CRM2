import { Router } from 'express';
import { authenticateSuperAdminOrTester } from '../middleware/testerAuth';
import { authenticateSuperAdmin } from '../middleware/superAdminAuth';
import { authenticate } from '../middleware/auth';
import {
  ensurePlatformChatThread,
  getPlatformChatMessages,
  listPlatformChatThreads,
  markPlatformChatRead,
  sendPlatformChatMessage,
  updatePlatformChatMessage,
} from '../controllers/platformChatController';
import {
  attachSchoolNewsRole,
  createPlatformChangelog,
  deletePlatformChangelog,
  getPlatformNewsFile,
  getPlatformNewsImage,
  listPlatformChangelog,
  listPlatformNewsForRole,
  platformNewsUpload,
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
router.post(
  '/changelog',
  authenticateSuperAdmin,
  platformNewsUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  createPlatformChangelog
);
router.put(
  '/changelog/:id',
  authenticateSuperAdmin,
  platformNewsUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  updatePlatformChangelog
);
router.delete('/changelog/:id', authenticateSuperAdmin, deletePlatformChangelog);

/** Лента новостей для сотрудников школы (фильтр по роли). */
router.get('/news', authenticate, attachSchoolNewsRole, listPlatformNewsForRole);
router.get('/news/:id/image', authenticate, attachSchoolNewsRole, getPlatformNewsImage);
router.get('/news/:id/file', authenticate, attachSchoolNewsRole, getPlatformNewsFile);

/** Вложения для SA/Tester. */
router.get('/changelog/:id/image', authenticateSuperAdminOrTester, getPlatformNewsImage);
router.get('/changelog/:id/file', authenticateSuperAdminOrTester, getPlatformNewsFile);

router.get('/tester/notification-prefs', authenticateTester, getTesterNotificationPrefs);
router.put('/tester/notification-prefs', authenticateTester, updateTesterNotificationPrefs);
router.get('/tester/push/vapid-key', authenticateTester, getSharedVapidKey);
router.post('/tester/push/subscribe', authenticateTester, subscribeTesterPush);
router.post('/tester/push/unsubscribe', authenticateTester, unsubscribeTesterPush);
router.get('/tester/push/status', authenticateTester, testerPushStatus);

export default router;
