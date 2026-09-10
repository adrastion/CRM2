import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { getVapidPublicKey } from './pushNotificationService';
import {
  canReceivePushNow,
  getOrCreateNotificationPrefs,
  NotificationActorType,
  NotificationEventType,
} from './notificationPrefsService';
import { isPresenceOnline } from './chatPresence';

type SubRow = { endpoint: string; p256dh: string; auth: string };

function vapidReady(): boolean {
  return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY);
}

async function sendToSubscriptions(
  subscriptions: SubRow[],
  title: string,
  body: string,
  data: Record<string, unknown>,
  onGone: (endpoint: string) => Promise<void>
): Promise<void> {
  if (!vapidReady() || subscriptions.length === 0) return;
  const payload = JSON.stringify({
    title,
    body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data,
    requireInteraction: false,
    silent: false,
  });
  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        );
      } catch (error: any) {
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          await onGone(subscription.endpoint);
        } else {
          console.error('[ActorPush] send error', error?.statusCode || error);
        }
      }
    })
  );
}

export async function getSubscriptionsForActor(
  actorType: NotificationActorType,
  actorId: string
): Promise<SubRow[]> {
  if (actorType === 'USER') {
    return prisma.pushSubscription.findMany({
      where: { userId: actorId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  }
  if (actorType === 'SUPER_ADMIN') {
    return prisma.superAdminPushSubscription.findMany({
      where: { superAdminId: actorId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  }
  if (actorType === 'TESTER') {
    return prisma.testerPushSubscription.findMany({
      where: { testerId: actorId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  }
  if (actorType === 'CLIENT') {
    return prisma.portalPushSubscription.findMany({
      where: { clientId: actorId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  }
  return prisma.portalPushSubscription.findMany({
    where: { parentId: actorId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
}

async function removeSubscription(
  actorType: NotificationActorType,
  actorId: string,
  endpoint: string
): Promise<void> {
  if (actorType === 'USER') {
    await prisma.pushSubscription.deleteMany({ where: { userId: actorId, endpoint } });
  } else if (actorType === 'SUPER_ADMIN') {
    await prisma.superAdminPushSubscription.deleteMany({
      where: { superAdminId: actorId, endpoint },
    });
  } else if (actorType === 'TESTER') {
    await prisma.testerPushSubscription.deleteMany({ where: { testerId: actorId, endpoint } });
  } else if (actorType === 'CLIENT') {
    await prisma.portalPushSubscription.deleteMany({ where: { clientId: actorId, endpoint } });
  } else {
    await prisma.portalPushSubscription.deleteMany({ where: { parentId: actorId, endpoint } });
  }
}

export async function saveActorPushSubscription(
  actorType: NotificationActorType,
  actorId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<void> {
  const data = {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent || null,
  };

  if (actorType === 'USER') {
    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: actorId, endpoint: data.endpoint } },
      create: { userId: actorId, ...data },
      update: { p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent },
    });
    return;
  }
  if (actorType === 'SUPER_ADMIN') {
    await prisma.superAdminPushSubscription.upsert({
      where: { superAdminId_endpoint: { superAdminId: actorId, endpoint: data.endpoint } },
      create: { superAdminId: actorId, ...data },
      update: { p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent },
    });
    return;
  }
  if (actorType === 'TESTER') {
    await prisma.testerPushSubscription.upsert({
      where: { testerId_endpoint: { testerId: actorId, endpoint: data.endpoint } },
      create: { testerId: actorId, ...data },
      update: { p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent },
    });
    return;
  }
  if (actorType === 'CLIENT') {
    await prisma.portalPushSubscription.upsert({
      where: { clientId_endpoint: { clientId: actorId, endpoint: data.endpoint } },
      create: { clientId: actorId, parentId: null, ...data },
      update: { p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent },
    });
    return;
  }
  await prisma.portalPushSubscription.upsert({
    where: { parentId_endpoint: { parentId: actorId, endpoint: data.endpoint } },
    create: { parentId: actorId, clientId: null, ...data },
    update: { p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent },
  });
}

export async function removeActorPushSubscription(
  actorType: NotificationActorType,
  actorId: string,
  endpoint: string
): Promise<void> {
  await removeSubscription(actorType, actorId, endpoint);
}

export async function sendPushToActor(
  actorType: NotificationActorType,
  actorId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  eventType: NotificationEventType
): Promise<void> {
  const prefs = await getOrCreateNotificationPrefs(actorType, actorId);
  const applySchedule = actorType === 'USER';
  if (!canReceivePushNow(prefs, eventType, new Date(), { applySchedule })) return;

  const subscriptions = await getSubscriptionsForActor(actorType, actorId);
  await sendToSubscriptions(subscriptions, title, body, data, (endpoint) =>
    removeSubscription(actorType, actorId, endpoint)
  );
}

function parsePresenceKey(key: string): { actorType: NotificationActorType; actorId: string } | null {
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  const kind = key.slice(0, idx);
  const actorId = key.slice(idx + 1);
  if (!actorId) return null;
  if (kind === 'USER') return { actorType: 'USER', actorId };
  if (kind === 'CLIENT') return { actorType: 'CLIENT', actorId };
  if (kind === 'PARENT') return { actorType: 'PARENT', actorId };
  if (kind === 'SUPER_ADMIN') return { actorType: 'SUPER_ADMIN', actorId };
  if (kind === 'TESTER') return { actorType: 'TESTER', actorId };
  return null;
}

/**
 * Push о новом сообщении в чате (fire-and-forget safe).
 * peerKeys — presence keys пиров без автора (из resolvePeerPresenceKeys).
 */
export async function notifyChatMessagePush(args: {
  peerKeys: string[];
  threadId: string;
  tenantId: string | null;
  authorName: string;
  preview: string;
}): Promise<void> {
  try {
    const preview =
      args.preview.length > 120 ? `${args.preview.slice(0, 117)}…` : args.preview;
    const title = 'Новое сообщение';
    const body = `${args.authorName}: ${preview}`;
    const data = {
      type: 'chat_message',
      threadId: args.threadId,
      url: args.tenantId ? '/chats' : '/admin/dashboard?section=chats',
    };

    await Promise.allSettled(
      args.peerKeys.map(async (key) => {
        if (isPresenceOnline(key)) return; // уже в чате в реальном времени
        const parsed = parsePresenceKey(key);
        if (!parsed) return;
        await sendPushToActor(
          parsed.actorType,
          parsed.actorId,
          title,
          body,
          data,
          'chat_message'
        );
      })
    );
  } catch (e) {
    console.error('[ActorPush] chat notify failed', e);
  }
}

/**
 * Push о новой публикации в «Изменения» для SA и Tester.
 */
export async function notifyChangelogPush(args: {
  title: string;
  authorSuperAdminId: string;
  entryId: string;
}): Promise<void> {
  try {
    const [sas, testers] = await Promise.all([
      prisma.superAdmin.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.tester.findMany({ where: { isActive: true }, select: { id: true } }),
    ]);
    const title = 'Новое в «Изменения»';
    const body = args.title;
    const data = {
      type: 'platform_changelog',
      entryId: args.entryId,
      url: '/admin/dashboard?section=changelog',
    };

    await Promise.allSettled([
      ...sas
        .filter((s) => s.id !== args.authorSuperAdminId)
        .map((s) =>
          sendPushToActor('SUPER_ADMIN', s.id, title, body, data, 'platform_changelog')
        ),
      ...testers.map((t) =>
        sendPushToActor(
          'TESTER',
          t.id,
          title,
          body,
          { ...data, url: '/tester/dashboard?tab=changelog' },
          'platform_changelog'
        )
      ),
    ]);
  } catch (e) {
    console.error('[ActorPush] changelog notify failed', e);
  }
}
