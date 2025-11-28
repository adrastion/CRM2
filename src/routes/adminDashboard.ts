import { Router } from 'express';
import {
  getAdminDashboard,
  updateAdminSettings,
  getTenantDetails,
  getAllTenants,
  getTransactionHistory,
  createExpense,
  payMarketer,
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

// Получить все аккаунты с статистикой
router.get('/tenants', getAllTenants);

// История транзакций
router.get('/transactions', getTransactionHistory);

// Создать расход
router.post('/expenses', createExpense);

// Выплата маркетологу
router.post('/marketers/pay', payMarketer);

export default router;

