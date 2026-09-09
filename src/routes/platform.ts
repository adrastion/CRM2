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

export default router;
