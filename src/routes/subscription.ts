import { Router } from 'express';
import {
  getSubscription,
  createPayment,
  handleWebhook,
  updatePlan,
  checkResourceLimit,
} from '../controllers/subscriptionController';
import { authenticate, requireOwner } from '../middleware/auth';

const router = Router();

// Webhook от YooKassa (не требует аутентификации, должен быть ПЕРЕД authenticate)
// Должен быть защищен IP-адресами YooKassa или проверкой подписи
router.post('/webhook', handleWebhook);

// Все остальные маршруты требуют аутентификации
router.use(authenticate);

// Получить текущую подписку (доступно всем авторизованным)
router.get('/', getSubscription);

// Проверить лимит ресурса (доступно всем авторизованным)
router.get('/check-limit', checkResourceLimit);

// Создать платеж (только для OWNER)
router.post('/payment', requireOwner, createPayment);

// Обновить план подписки (только для OWNER)
router.put('/plan', requireOwner, updatePlan);

export default router;

