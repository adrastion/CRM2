import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSchoolNotifications,
  markSchoolNotificationsRead,
} from '../controllers/inboxNotificationController';

const router = Router();
router.use(authenticate);
router.get('/', getSchoolNotifications);
router.post('/read', markSchoolNotificationsRead);

export default router;
