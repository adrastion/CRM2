import { Router } from 'express';
import {
  getAdminDashboard,
  updateAdminSettings,
  getTenantDetails,
  getAllTenants,
  getTransactionHistory,
  createExpense,
  updateExpense,
  deleteExpense,
  payMarketer,
  updateTenantPlan,
  getExpenseCategories,
  createExpenseCategory,
  getAnalyticsByPeriod,
  getRevenueForecast,
  bulkUpdateTenants,
  getKPIMetrics,
  getAuditLogs,
  getPlanPrices,
  updatePlanPrice,
  getMarketerStats,
  exportTransactions,
  exportTenants,
  exportMarketers,
  getDashboardPresets,
  saveDashboardPreset,
  deleteDashboardPreset,
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

// Расходы
router.post('/expenses', createExpense);
router.put('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

// Выплата маркетологу
router.post('/marketers/pay', payMarketer);
router.get('/marketers/stats', getMarketerStats);

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
router.get('/analytics/kpi', getKPIMetrics);

// Логи аудита
router.get('/audit-logs', getAuditLogs);

// Управление тарифами
router.get('/plans/prices', getPlanPrices);
router.put('/plans/prices', updatePlanPrice);

// Экспорт данных
router.get('/export/transactions', exportTransactions);
router.get('/export/tenants', exportTenants);
router.get('/export/marketers', exportMarketers);

// Пресеты дашборда
router.get('/dashboard/presets', getDashboardPresets);
router.post('/dashboard/presets', saveDashboardPreset);
router.delete('/dashboard/presets/:id', deleteDashboardPreset);

export default router;

