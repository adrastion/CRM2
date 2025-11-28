import { Router } from 'express';
import {
  getAdminDashboard,
  updateAdminSettings,
  getTenantDetails,
} from '../controllers/adminDashboardController';
import { authenticate, requireOwner } from '../middleware/auth';

const router = Router();

// Все маршруты требуют аутентификации и роль OWNER
// ВАЖНО: В будущем можно добавить специальную роль SUPER_ADMIN
router.use(authenticate);
router.use(requireOwner);

// Получить статистику дашборда
router.get('/', getAdminDashboard);

// Обновить настройки суперадмина
router.put('/settings', updateAdminSettings);

// Получить детальную информацию о tenant'е
router.get('/tenants/:tenantId', getTenantDetails);

export default router;

