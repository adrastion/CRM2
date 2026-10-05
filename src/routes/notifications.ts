import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSchoolNotifications,
  getSchoolNotificationsUnreadCount,
  markSchoolNotificationsRead,
} from '../controllers/inboxNotificationController';

const router = Router();
router.use(authenticate);
router.get('/', getSchoolNotifications);
router.get('/unread-count', getSchoolNotificationsUnreadCount);
router.post('/read', markSchoolNotificationsRead);

export default router;
