import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  chatMediaUpload,
  staffEnsureThread,
  staffGetMedia,
  staffGetMessages,
  staffGetParticipants,
  staffGetPins,
  staffListThreads,
  staffMarkRead,
  staffDeleteMessage,
  staffPatchMessage,
  staffPinMessage,
  staffPostMediaMessage,
  staffPostMessage,
  staffUnpinMessage,
  staffUnreadTotal,
} from '../controllers/chatController';

const router = Router();

router.use(authenticate);

router.get('/threads', staffListThreads);
router.get('/unread-total', staffUnreadTotal);
router.post('/threads/ensure', staffEnsureThread);
router.get('/threads/:id/messages', staffGetMessages);
router.post('/threads/:id/messages', staffPostMessage);
router.post(
  '/threads/:id/messages/media',
  chatMediaUpload.single('file'),
  staffPostMediaMessage
);
router.get(
  '/threads/:id/messages/:messageId/media/:attachmentId',
  staffGetMedia
);
router.patch('/threads/:id/messages/:messageId', staffPatchMessage);
router.delete('/threads/:id/messages/:messageId', staffDeleteMessage);
router.post('/threads/:id/read', staffMarkRead);
router.get('/threads/:id/participants', staffGetParticipants);
router.get('/threads/:id/pins', staffGetPins);
router.post('/threads/:id/pins', staffPinMessage);
router.delete('/threads/:id/pins/:messageId', staffUnpinMessage);

export default router;
