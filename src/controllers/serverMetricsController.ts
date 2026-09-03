import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  collectLiveMetrics,
  getMetricsHistory,
  HistoryRange,
} from '../services/serverMetricsService';
import {
  getAlertSettings,
  updateAlertSettings,
  evaluateCritical,
  saveSuperAdminPushSubscription,
  removeSuperAdminPushSubscription,
  getSuperAdminPushStatus,
} from '../services/serverAlertService';
import { getVapidPublicKey } from '../services/pushNotificationService';

const VALID_RANGES: HistoryRange[] = ['1h', '6h', '24h', '7d', '30d'];

/**
 * Текущий снимок метрик (live)
 */
export const getLiveServerMetrics = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const snapshot = await collectLiveMetrics();
  const settings = await getAlertSettings();
  const critical = evaluateCritical(snapshot, settings);

  res.json({
    success: true,
    data: {
      ...snapshot,
      critical: critical.isCritical,
      criticalReasons: critical.reasons,
      alertSettings: settings,
    },
  });
});

/**
 * История метрик для графиков
 */
export const getServerMetricsHistory = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const rangeParam = String(req.query.range || '1h') as HistoryRange;
  const range = VALID_RANGES.includes(rangeParam) ? rangeParam : '1h';
  const points = await getMetricsHistory(range);

  res.json({
    success: true,
    data: { range, points },
  });
});

/**
 * Настройки алертов
 */
export const getServerAlertSettings = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const settings = await getAlertSettings();
  res.json({ success: true, data: settings });
});

export const updateServerAlertSettings = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const {
    alertsEnabled,
    alertCpuPercent,
    alertMemoryPercent,
    alertDiskPercent,
    alertLoadPerCore,
    alertCooldownMinutes,
  } = req.body || {};

  const settings = await updateAlertSettings({
    alertsEnabled,
    alertCpuPercent,
    alertMemoryPercent,
    alertDiskPercent,
    alertLoadPerCore,
    alertCooldownMinutes,
  });

  res.json({
    success: true,
    data: settings,
    message: 'Настройки алертов обновлены',
  });
});

/**
 * VAPID для супер-админских push
 */
export const getServerMetricsVapidKey = asyncHandler(async (
  _req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    res.status(503).json({
      success: false,
      error: 'Push notifications not configured (VAPID keys missing)',
    });
    return;
  }
  res.json({ success: true, data: { publicKey } });
});

/**
 * Подписка супер-админа на browser push
 */
export const subscribeSuperAdminPush = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const superAdmin = (req as any).superAdmin;
  if (!superAdmin?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (!getVapidPublicKey()) {
    res.status(503).json({
      success: false,
      error: 'Push notifications not configured',
    });
    return;
  }

  const { subscription, userAgent } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    res.status(400).json({
      success: false,
      error: 'Invalid subscription data',
    });
    return;
  }

  await saveSuperAdminPushSubscription(
    superAdmin.id,
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    },
    userAgent
  );

  res.json({
    success: true,
    message: 'Подписка на уведомления о нагрузке сервера оформлена',
  });
});

export const unsubscribeSuperAdminPush = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const superAdmin = (req as any).superAdmin;
  if (!superAdmin?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
  if (!endpoint) {
    res.status(400).json({ success: false, error: 'Endpoint is required' });
    return;
  }

  await removeSuperAdminPushSubscription(superAdmin.id, endpoint);

  res.json({
    success: true,
    message: 'Подписка отменена',
  });
});

export const getSuperAdminPushSubscriptionStatus = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const superAdmin = (req as any).superAdmin;
  if (!superAdmin?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const status = await getSuperAdminPushStatus(superAdmin.id);
  res.json({ success: true, data: status });
});
