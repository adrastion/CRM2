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
  updateTenantSubscriptionEndDate,
  getTenantGrantHistory,
  getExpenseCategories,
  createExpenseCategory,
  getAnalyticsByPeriod,
  getRevenueForecast,
  bulkUpdateTenants,
  getKPIMetrics,
  getAuditLogs,
  getPlanPrices,
  updatePlanPrice,
  createPlan,
  updatePlan,
  archivePlan,
  restorePlan,
  getMarketerStats,
  exportTransactions,
  exportTenants,
  exportMarketers,
  getDashboardPresets,
  saveDashboardPreset,
  deleteDashboardPreset,
} from '../controllers/adminDashboardController';
import {
  getLogFileInfo,
  readLogFile,
  downloadLogFile,
  clearLogFile,
} from '../controllers/logFileController';
import {
  authenticateSuperAdmin,
  authenticatePlatformViewer,
  requirePlatformWrite,
} from '../middleware/superAdminAuth';

const router = Router();

/* ------------------------------------------------------------------ */
/* Каталог тарифов                                                    */
/*                                                                    */
/* Просмотр доступен супер-админу и персоналу платформы, изменение —   */
/* только супер-админу (requirePlatformWrite).                        */
/* ------------------------------------------------------------------ */
router.get('/plans/prices', authenticatePlatformViewer, getPlanPrices);
router.get('/plans', authenticatePlatformViewer, getPlanPrices);
router.post('/plans', authenticatePlatformViewer, requirePlatformWrite, createPlan);
router.put('/plans/prices', authenticatePlatformViewer, requirePlatformWrite, updatePlanPrice);
router.put('/plans/:code', authenticatePlatformViewer, requirePlatformWrite, updatePlan);
router.post('/plans/:code/archive', authenticatePlatformViewer, requirePlatformWrite, archivePlan);
router.post('/plans/:code/restore', authenticatePlatformViewer, requirePlatformWrite, restorePlan);

// Остальные маршруты требуют аутентификации суперадмина
router.use(authenticateSuperAdmin);

// Получить статистику дашборда
router.get('/', getAdminDashboard);

// Обновить настройки суперадмина
router.put('/settings', updateAdminSettings);

// Файл ошибок сервера: путь задаётся в настройках
router.get('/logs/error-file', getLogFileInfo);
router.get('/logs/error-file/content', readLogFile);
router.get('/logs/error-file/download', downloadLogFile);
router.delete('/logs/error-file', clearLogFile);

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

// Выдача тарифа аккаунту, изменение срока и история выдачи
router.put('/tenants/:tenantId/plan', updateTenantPlan);
router.put('/tenants/:tenantId/subscription/end-date', updateTenantSubscriptionEndDate);
router.get('/tenants/:tenantId/grant-history', getTenantGrantHistory);

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

// Экспорт данных
router.get('/export/transactions', exportTransactions);
router.get('/export/tenants', exportTenants);
router.get('/export/marketers', exportMarketers);

// Пресеты дашборда
router.get('/dashboard/presets', getDashboardPresets);
router.post('/dashboard/presets', saveDashboardPreset);
router.delete('/dashboard/presets/:id', deleteDashboardPreset);

export default router;
