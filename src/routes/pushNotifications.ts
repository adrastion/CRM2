import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getVapidKey,
  subscribeToPush,
  unsubscribeFromPush,
  getUserPushSubscriptions
} from '../controllers/pushNotificationController';

const router = Router();

// Публичный endpoint для получения VAPID ключа
router.get('/vapid-key', getVapidKey);

// Все остальные routes требуют аутентификации
router.use(authenticate);

router.post('/subscribe', subscribeToPush);
router.post('/unsubscribe', unsubscribeFromPush);
router.get('/subscriptions', getUserPushSubscriptions);

export default router;

