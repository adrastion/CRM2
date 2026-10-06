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
  listPlatformPublicationsAdmin,
  createPlatformPublicationAdmin,
  listMarketerClosingDocsAdmin,
  createMarketerClosingDocAdmin,
  downloadPlatformPublicationImageAdmin,
  downloadPlatformPublicationFileAdmin,
  downloadMarketerClosingDocAdmin,
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
  listFeatureIdeasAdmin,
  acceptFeatureIdea,
  rejectFeatureIdea,
} from '../controllers/clientFeatureIdeaController';
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
  getSuperAdminNotificationPrefs,
  updateSuperAdminNotificationPrefs,
} from '../controllers/notificationPrefsController';
import {
  publishSchoolOffer,
  listSchoolOffers,
} from '../controllers/inboxNotificationController';
import {
  getAdminMaintenance,
  updateAdminMaintenance,
  getAdminTestingMode,
  updateAdminTestingMode,
  getTestingAccountCandidates,
  getAdminTerms,
  updateAdminTerms,
  getAdminPrivacy,
  updateAdminPrivacy,
} from '../controllers/maintenanceController';
import {
  getSiteTrafficLive,
  getSiteTrafficSummary,
  getSiteTrafficQuietHours,
} from '../controllers/siteAnalyticsController';
import {
  getMarketers as listPlatformMarketers,
  getMarketer as getPlatformMarketer,
  createMarketer as createPlatformMarketer,
  updateMarketer as updatePlatformMarketer,
  deleteMarketer as deletePlatformMarketer,
  getMarketerStats as getPlatformMarketerDetailStats,
} from '../controllers/marketerController';
import {
  getPromoCodes as getPlatformPromoCodes,
  getPromoCode as getPlatformPromoCode,
  createPromoCode as createPlatformPromoCode,
  updatePromoCode as updatePlatformPromoCode,
  deletePromoCode as deletePlatformPromoCode,
} from '../controllers/promoCodeController';
import {
  getReferralLinks as getPlatformReferralLinks,
  getReferralLink as getPlatformReferralLink,
  createReferralLink as createPlatformReferralLink,
  updateReferralLink as updatePlatformReferralLink,
  deleteReferralLink as deletePlatformReferralLink,
} from '../controllers/referralLinkController';
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

const marketerCabinetUploadDir = ensureUploadDir('marketer-cabinet', 'publications');
const marketerDocsUploadDir = ensureUploadDir('marketer-cabinet', 'docs');
const marketerPubsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, marketerCabinetUploadDir),
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 4 },
});
const marketerDocsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, marketerDocsUploadDir),
    filename: (_req, file, cb) => cb(null, uniqueUploadFilename(file.originalname)),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
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

// Платформенный CRUD маркетологов / промо / рефералок (без выбора школы)
router.get('/platform/marketers', listPlatformMarketers);
router.get('/platform/marketers/:id', getPlatformMarketer);
router.post('/platform/marketers', createPlatformMarketer);
router.put('/platform/marketers/:id', updatePlatformMarketer);
router.delete('/platform/marketers/:id', deletePlatformMarketer);
router.get('/platform/marketers/:id/stats', getPlatformMarketerDetailStats);

router.get('/platform/promo-codes', getPlatformPromoCodes);
router.get('/platform/promo-codes/:id', getPlatformPromoCode);
router.post('/platform/promo-codes', createPlatformPromoCode);
router.put('/platform/promo-codes/:id', updatePlatformPromoCode);
router.delete('/platform/promo-codes/:id', deletePlatformPromoCode);

router.get('/platform/referral-links', getPlatformReferralLinks);
router.get('/platform/referral-links/:id', getPlatformReferralLink);
router.post('/platform/referral-links', createPlatformReferralLink);
router.put('/platform/referral-links/:id', updatePlatformReferralLink);
router.delete('/platform/referral-links/:id', deletePlatformReferralLink);

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

// Идеи клиентов («Связь с разработчиком»)
router.get('/feature-ideas', listFeatureIdeasAdmin);
router.post('/feature-ideas/:id/accept', acceptFeatureIdea);
router.post('/feature-ideas/:id/reject', rejectFeatureIdea);

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

router.get('/site-traffic/live', getSiteTrafficLive);
router.get('/site-traffic/summary', getSiteTrafficSummary);
router.get('/site-traffic/quiet-hours', getSiteTrafficQuietHours);

router.get('/notification-prefs', getSuperAdminNotificationPrefs);
router.put('/notification-prefs', updateSuperAdminNotificationPrefs);

router.get('/school-offers', listSchoolOffers);
router.post('/school-offers', publishSchoolOffer);

router.get('/marketer-publications', listPlatformPublicationsAdmin);
router.post(
  '/marketer-publications',
  marketerPubsUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  createPlatformPublicationAdmin
);
router.get('/marketer-publications/:id/image', downloadPlatformPublicationImageAdmin);
router.get('/marketer-publications/:id/file', downloadPlatformPublicationFileAdmin);
router.get('/marketer-closing-docs', listMarketerClosingDocsAdmin);
router.post('/marketer-closing-docs', marketerDocsUpload.single('file'), createMarketerClosingDocAdmin);
router.get('/marketer-closing-docs/:id/file', downloadMarketerClosingDocAdmin);

router.get('/maintenance', getAdminMaintenance);
router.put('/maintenance', updateAdminMaintenance);
router.get('/testing-mode', getAdminTestingMode);
router.put('/testing-mode', updateAdminTestingMode);
router.get('/testing-mode/accounts', getTestingAccountCandidates);
router.get('/terms', getAdminTerms);
router.put('/terms', updateAdminTerms);
router.get('/privacy', getAdminPrivacy);
router.put('/privacy', updateAdminPrivacy);

export default router;
