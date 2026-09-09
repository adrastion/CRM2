import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  staffEnsureThread,
  staffGetMessages,
  staffListThreads,
  staffMarkRead,
  staffPostMessage,
  staffUnreadTotal,
} from '../controllers/chatController';

const router = Router();

router.use(authenticate);

router.get('/threads', staffListThreads);
router.get('/unread-total', staffUnreadTotal);
router.post('/threads/ensure', staffEnsureThread);
router.get('/threads/:id/messages', staffGetMessages);
router.post('/threads/:id/messages', staffPostMessage);
router.post('/threads/:id/read', staffMarkRead);

export default router;
