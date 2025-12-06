import { Router } from 'express';
import {
  getAdminDashboard,
  updateAdminSettings,
  getTenantDetails,
  getAllTenants,
  getTransactionHistory,
  createExpense,
  payMarketer,
  updateTenantPlan,
  getExpenseCategories,
  createExpenseCategory,
  getAnalyticsByPeriod,
  getRevenueForecast,
  bulkUpdateTenants,
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

// Обновить тариф tenant'а
router.put('/tenants/:tenantId/plan', updateTenantPlan);

// Массовое обновление аккаунтов
router.post('/tenants/bulk', bulkUpdateTenants);

// Категории расходов
router.get('/expense-categories', getExpenseCategories);
router.post('/expense-categories', createExpenseCategory);

// Расширенная аналитика
router.get('/analytics/period', getAnalyticsByPeriod);
router.get('/analytics/forecast', getRevenueForecast);

export default router;

