import { Router } from 'express';
import {
  getAdminDashboard,
  updateAdminSettings,
  getTenantDetails,
} from '../controllers/adminDashboardController';
import { authenticateSuperAdmin } from '../middleware/superAdminAuth';

const router = Router();

// Все маршруты требуют аутентификации суперадмина
router.use(authenticateSuperAdmin);

// Получить статистику дашборда
router.get('/', getAdminDashboard);

// Обновить настройки суперадмина
router.put('/settings', updateAdminSettings);

// Получить детальную информацию о tenant'е
router.get('/tenants/:tenantId', getTenantDetails);

export default router;

