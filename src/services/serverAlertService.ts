import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { getVapidPublicKey } from './pushNotificationService';
import type { ServerMetricsSnapshot } from './serverMetricsService';

export interface AlertSettings {
  alertsEnabled: boolean;
  alertCpuPercent: number;
  alertMemoryPercent: number;
  alertDiskPercent: number;
  alertLoadPerCore: number;
  alertCooldownMinutes: number;
  lastAlertAt: string | null;
}

export interface CriticalReasons {
  isCritical: boolean;
  reasons: string[];
}

const DEFAULT_ALERTS: Omit<AlertSettings, 'lastAlertAt'> = {
  alertsEnabled: true,
  alertCpuPercent: 90,
  alertMemoryPercent: 90,
  alertDiskPercent: 90,
  alertLoadPerCore: 1,
  alertCooldownMinutes: 15,
};

async function ensureSettings() {
  let settings = await prisma.superAdminSettings.findFirst();
  if (!settings) {
    settings = await prisma.superAdminSettings.create({ data: {} });
  }
  return settings;
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const s = await ensureSettings();
  return {
    alertsEnabled: s.alertsEnabled ?? DEFAULT_ALERTS.alertsEnabled,
    alertCpuPercent: s.alertCpuPercent ?? DEFAULT_ALERTS.alertCpuPercent,
    alertMemoryPercent: s.alertMemoryPercent ?? DEFAULT_ALERTS.alertMemoryPercent,
    alertDiskPercent: s.alertDiskPercent ?? DEFAULT_ALERTS.alertDiskPercent,
    alertLoadPerCore: s.alertLoadPerCore ?? DEFAULT_ALERTS.alertLoadPerCore,
    alertCooldownMinutes: s.alertCooldownMinutes ?? DEFAULT_ALERTS.alertCooldownMinutes,
    lastAlertAt: s.lastAlertAt ? s.lastAlertAt.toISOString() : null,
  };
}

export async function updateAlertSettings(input: Partial<{
  alertsEnabled: boolean;
  alertCpuPercent: number;
  alertMemoryPercent: number;
  alertDiskPercent: number;
  alertLoadPerCore: number;
  alertCooldownMinutes: number;
}>): Promise<AlertSettings> {
  const settings = await ensureSettings();

  const updated = await prisma.superAdminSettings.update({
    where: { id: settings.id },
    data: {
      alertsEnabled:
        input.alertsEnabled !== undefined ? Boolean(input.alertsEnabled) : undefined,
      alertCpuPercent:
        input.alertCpuPercent !== undefined
          ? Math.max(1, Math.min(100, Number(input.alertCpuPercent)))
          : undefined,
      alertMemoryPercent:
        input.alertMemoryPercent !== undefined
          ? Math.max(1, Math.min(100, Number(input.alertMemoryPercent)))
          : undefined,
      alertDiskPercent:
        input.alertDiskPercent !== undefined
          ? Math.max(1, Math.min(100, Number(input.alertDiskPercent)))
          : undefined,
      alertLoadPerCore:
        input.alertLoadPerCore !== undefined
          ? Math.max(0.1, Number(input.alertLoadPerCore))
          : undefined,
      alertCooldownMinutes:
        input.alertCooldownMinutes !== undefined
          ? Math.max(1, Math.min(1440, Math.floor(Number(input.alertCooldownMinutes))))
          : undefined,
    },
  });

  return {
    alertsEnabled: updated.alertsEnabled,
    alertCpuPercent: updated.alertCpuPercent,
    alertMemoryPercent: updated.alertMemoryPercent,
    alertDiskPercent: updated.alertDiskPercent,
    alertLoadPerCore: updated.alertLoadPerCore,
    alertCooldownMinutes: updated.alertCooldownMinutes,
    lastAlertAt: updated.lastAlertAt ? updated.lastAlertAt.toISOString() : null,
  };
}

export function evaluateCritical(
  snapshot: ServerMetricsSnapshot,
  settings: AlertSettings
): CriticalReasons {
  const reasons: string[] = [];
  const loadThreshold = settings.alertLoadPerCore * snapshot.cpuCores;

  if (snapshot.cpuPercent >= settings.alertCpuPercent) {
    reasons.push(`CPU ${snapshot.cpuPercent}% (порог ${settings.alertCpuPercent}%)`);
  }
  if (snapshot.memoryPercent >= settings.alertMemoryPercent) {
    reasons.push(`RAM ${snapshot.memoryPercent}% (порог ${settings.alertMemoryPercent}%)`);
  }
  if (snapshot.diskPercent >= settings.alertDiskPercent) {
    reasons.push(`Диск ${snapshot.diskPercent}% (порог ${settings.alertDiskPercent}%)`);
  }
  if (snapshot.load1 >= loadThreshold) {
    reasons.push(
      `Load1 ${snapshot.load1} (порог ${Math.round(loadThreshold * 100) / 100} = ${settings.alertLoadPerCore}×${snapshot.cpuCores} ядер)`
    );
  }

  return { isCritical: reasons.length > 0, reasons };
}

interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSuperAdminPushSubscription(
  superAdminId: string,
  subscription: PushSubscriptionData,
  userAgent?: string
): Promise<void> {
  await prisma.superAdminPushSubscription.upsert({
    where: {
      superAdminId_endpoint: {
        superAdminId,
        endpoint: subscription.endpoint,
      },
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
      updatedAt: new Date(),
    },
    create: {
      superAdminId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
    },
  });
}

export async function removeSuperAdminPushSubscription(
  superAdminId: string,
  endpoint: string
): Promise<void> {
  await prisma.superAdminPushSubscription.deleteMany({
    where: { superAdminId, endpoint },
  });
}

export async function getSuperAdminPushStatus(superAdminId: string): Promise<{
  subscribed: boolean;
  count: number;
  vapidConfigured: boolean;
}> {
  const count = await prisma.superAdminPushSubscription.count({
    where: { superAdminId },
  });
  return {
    subscribed: count > 0,
    count,
    vapidConfigured: Boolean(getVapidPublicKey()),
  };
}

async function sendPushToAllSuperAdmins(title: string, body: string, data?: Record<string, unknown>) {
  if (!getVapidPublicKey()) {
    console.warn('[ServerAlerts] VAPID not configured, skip push');
    return;
  }

  const subscriptions = await prisma.superAdminPushSubscription.findMany({
    include: {
      superAdmin: { select: { id: true, isActive: true } },
    },
  });

  const active = subscriptions.filter((s) => s.superAdmin.isActive);
  if (active.length === 0) {
    console.log('[ServerAlerts] No active super-admin push subscriptions');
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: {
      type: 'server_load_critical',
      url: '/admin/dashboard',
      ...(data || {}),
    },
    requireInteraction: true,
    silent: false,
  });

  await Promise.allSettled(
    active.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.superAdminPushSubscription.delete({
            where: { id: subscription.id },
          });
        } else {
          console.error('[ServerAlerts] Push send error:', error);
        }
      }
    })
  );
}

/**
 * Проверить снимок на критичность и при необходимости отправить push супер-админам.
 */
export async function checkCriticalThresholds(
  snapshot: ServerMetricsSnapshot
): Promise<CriticalReasons> {
  const settings = await getAlertSettings();
  const evaluation = evaluateCritical(snapshot, settings);

  if (!settings.alertsEnabled || !evaluation.isCritical) {
    return evaluation;
  }

  const cooldownMs = settings.alertCooldownMinutes * 60 * 1000;
  if (settings.lastAlertAt) {
    const elapsed = Date.now() - new Date(settings.lastAlertAt).getTime();
    if (elapsed < cooldownMs) {
      return evaluation;
    }
  }

  const body = evaluation.reasons.join('; ');
  await sendPushToAllSuperAdmins('Критическая нагрузка сервера', body, {
    reasons: evaluation.reasons,
    metrics: {
      cpuPercent: snapshot.cpuPercent,
      memoryPercent: snapshot.memoryPercent,
      diskPercent: snapshot.diskPercent,
      load1: snapshot.load1,
    },
  });

  const dbSettings = await ensureSettings();
  await prisma.superAdminSettings.update({
    where: { id: dbSettings.id },
    data: { lastAlertAt: new Date() },
  });

  console.log('[ServerAlerts] Critical alert sent:', body);
  return evaluation;
}
