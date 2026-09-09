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
  linkTenantOwnerAsSuperAdmin,
  unlinkTenantOwnerSuperAdmin,
  linkTenantOwnerAsTester,
  unlinkTenantOwnerTester,
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
  listDevNotes,
  createDevNote,
  updateDevNote,
  deleteDevNote,
  uploadDevNoteAttachments,
  downloadDevNoteAttachment,
  deleteDevNoteAttachment,
} from '../controllers/superAdminDevNoteController';
import {
  listPlannerEvents,
  createPlannerEvent,
  updatePlannerEvent,
  deletePlannerEvent,
} from '../controllers/superAdminPlannerController';
import multer from 'multer';
import { ensureUploadDir, uniqueUploadFilename } from '../utils/fileStorage';
import {
  getLogFileInfo,
  readLogFile,
  downloadLogFile,
  clearLogFile,
} from '../controllers/logFileController';
import {
  getLiveServerMetrics,
  getServerMetricsHistory,
  getServerAlertSettings,
  updateServerAlertSettings,
  getServerMetricsVapidKey,
  subscribeSuperAdminPush,
  unsubscribeSuperAdminPush,
  getSuperAdminPushSubscriptionStatus,
} from '../controllers/serverMetricsController';
import {
  authenticateSuperAdmin,
  authenticatePlatformViewer,
  requirePlatformWrite,
} from '../middleware/superAdminAuth';

const devNotesUploadDir = ensureUploadDir('dev-notes');
const devNotesUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, devNotesUploadDir),
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
});

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
router.post('/tenants/:tenantId/link-super-admin', linkTenantOwnerAsSuperAdmin);
router.delete('/tenants/:tenantId/link-super-admin', unlinkTenantOwnerSuperAdmin);
router.post('/tenants/:tenantId/link-tester', linkTenantOwnerAsTester);
router.delete('/tenants/:tenantId/link-tester', unlinkTenantOwnerTester);

// Массовое обновление аккаунтов
router.post('/tenants/bulk', bulkUpdateTenants);

// Заметки разработок
router.get('/dev-notes', listDevNotes);
router.post('/dev-notes', createDevNote);
router.put('/dev-notes/:id', updateDevNote);
router.delete('/dev-notes/:id', deleteDevNote);
router.post(
  '/dev-notes/:id/attachments',
  devNotesUpload.array('files', 10),
  uploadDevNoteAttachments
);
router.get(
  '/dev-notes/:id/attachments/:attachmentId/download',
  downloadDevNoteAttachment
);
router.delete(
  '/dev-notes/:id/attachments/:attachmentId',
  deleteDevNoteAttachment
);

// Планировщик платформы (календарь SA)
router.get('/planner/events', listPlannerEvents);
router.post('/planner/events', createPlannerEvent);
router.put('/planner/events/:id', updatePlannerEvent);
router.delete('/planner/events/:id', deletePlannerEvent);

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

// Мониторинг нагрузки сервера (только супер-админ)
router.get('/server-metrics/live', getLiveServerMetrics);
router.get('/server-metrics/history', getServerMetricsHistory);
router.get('/server-metrics/alert-settings', getServerAlertSettings);
router.put('/server-metrics/alert-settings', updateServerAlertSettings);
router.get('/server-metrics/vapid-key', getServerMetricsVapidKey);
router.post('/server-metrics/push/subscribe', subscribeSuperAdminPush);
router.post('/server-metrics/push/unsubscribe', unsubscribeSuperAdminPush);
router.get('/server-metrics/push/status', getSuperAdminPushSubscriptionStatus);

export default router;
