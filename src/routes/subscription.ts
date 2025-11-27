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

// Все маршруты требуют аутентификации
router.use(authenticate);

// Получить текущую подписку (доступно всем авторизованным)
router.get('/', getSubscription);

// Проверить лимит ресурса (доступно всем авторизованным)
router.get('/check-limit', checkResourceLimit);

// Создать платеж (только для OWNER)
router.post('/payment', requireOwner, createPayment);

// Обновить план подписки (только для OWNER)
router.put('/plan', requireOwner, updatePlan);

// Webhook от YooKassa (не требует аутентификации, но должен быть защищен IP или ключом)
router.post('/webhook', handleWebhook);

export default router;

