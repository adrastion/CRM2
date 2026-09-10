import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSchoolNotificationPrefs,
  updateSchoolNotificationPrefs,
} from '../controllers/notificationPrefsController';

const router = Router();

router.use(authenticate);
router.get('/', getSchoolNotificationPrefs);
router.put('/', updateSchoolNotificationPrefs);

export default router;
