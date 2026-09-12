import { prisma } from '../lib/prisma';
import { sendPushToActor } from './actorPushService';
import {
  NotificationActorType,
  NotificationEventType,
} from './notificationPrefsService';
import { getSeniorBranchIds } from '../utils/branchAccess';

export type NotificationCategory =
  | 'chat'
  | 'finance'
  | 'athlete'
  | 'attendance'
  | 'salary'
  | 'training'
  | 'offer'
  | 'system';

export type NotifyRecipient = {
  actorType: NotificationActorType;
  actorId: string;
};

export type FanoutPayload = {
  tenantId?: string | null;
  category: NotificationCategory;
  type: string;
  title: string;
  body?: string;
  /** Deep-link + entity ids */
  data?: Record<string, unknown>;
  eventType: NotificationEventType;
  recipients: NotifyRecipient[];
  /** Не слать push (только inbox) */
  inboxOnly?: boolean;
};

function dedupeRecipients(list: NotifyRecipient[]): NotifyRecipient[] {
  const seen = new Set<string>();
  const out: NotifyRecipient[] = [];
  for (const r of list) {
    const key = `${r.actorType}:${r.actorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Записать в inbox и (опционально) отправить push. */
export async function fanoutNotification(payload: FanoutPayload): Promise<void> {
  const recipients = dedupeRecipients(payload.recipients);
  if (recipients.length === 0) return;

  const dataJson = payload.data ? JSON.stringify(payload.data) : null;
  const url =
    typeof payload.data?.url === 'string' ? payload.data.url : undefined;

  await prisma.inAppNotification.createMany({
    data: recipients.map((r) => ({
      tenantId: payload.tenantId || null,
      actorType: r.actorType,
      actorId: r.actorId,
      category: payload.category,
      type: payload.type,
      title: payload.title,
      body: payload.body || null,
      data: dataJson,
    })),
  });

  if (payload.inboxOnly) return;

  await Promise.allSettled(
    recipients.map((r) =>
      sendPushToActor(
        r.actorType,
        r.actorId,
        payload.title,
        payload.body || '',
        {
          type: payload.type,
          category: payload.category,
          url,
          ...(payload.data || {}),
        },
        payload.eventType
      )
    )
  );
}

/** OWNER + ADMIN (+ старшие тренеры филиала) тенанта. */
export async function resolveSchoolManagers(
  tenantId: string,
  opts?: {
    excludeUserId?: string;
    branchId?: string | null;
    includeSeniors?: boolean;
    roles?: Array<'OWNER' | 'ADMIN'>;
  }
): Promise<NotifyRecipient[]> {
  const roles = opts?.roles || ['OWNER', 'ADMIN'];
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      role: { in: roles },
      ...(opts?.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
    },
    select: { id: true, role: true },
  });

  const recipients: NotifyRecipient[] = users.map((u) => ({
    actorType: 'USER',
    actorId: u.id,
  }));

  if (opts?.includeSeniors !== false && opts?.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: opts.branchId, tenantId, isActive: true },
      select: { seniorTrainerId: true, seniorTrainer: { select: { userId: true } } },
    });
    if (branch?.seniorTrainer?.userId && branch.seniorTrainer.userId !== opts?.excludeUserId) {
      recipients.push({ actorType: 'USER', actorId: branch.seniorTrainer.userId });
    }
  } else if (opts?.includeSeniors !== false) {
    const seniors = await prisma.branch.findMany({
      where: { tenantId, isActive: true, seniorTrainerId: { not: null } },
      select: { seniorTrainer: { select: { userId: true } } },
    });
    for (const b of seniors) {
      const uid = b.seniorTrainer?.userId;
      if (uid && uid !== opts?.excludeUserId) {
        recipients.push({ actorType: 'USER', actorId: uid });
      }
    }
  }

  return dedupeRecipients(recipients);
}

/** ADMIN (+ seniors) — без OWNER, для attendance. */
export async function resolveSchoolAdmins(
  tenantId: string,
  opts?: { excludeUserId?: string; branchId?: string | null }
): Promise<NotifyRecipient[]> {
  return resolveSchoolManagers(tenantId, {
    excludeUserId: opts?.excludeUserId,
    branchId: opts?.branchId,
    roles: ['ADMIN'],
    includeSeniors: true,
  });
}

/** Клиент + активные родители с ЛК. */
export async function resolveClientAndParents(clientId: string): Promise<NotifyRecipient[]> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      password: true,
      isAccountApproved: true,
      parents: {
        where: { password: { not: null }, isAccountApproved: true },
        select: { id: true },
      },
    },
  });
  if (!client) return [];
  const out: NotifyRecipient[] = [];
  if (client.password && client.isAccountApproved) {
    out.push({ actorType: 'CLIENT', actorId: client.id });
  }
  for (const p of client.parents) {
    out.push({ actorType: 'PARENT', actorId: p.id });
  }
  return out;
}

/** Участники группы: клиенты + родители. */
export async function resolveGroupMembers(groupId: string): Promise<NotifyRecipient[]> {
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId, isActive: true },
    select: { clientId: true },
  });
  const all: NotifyRecipient[] = [];
  for (const m of memberships) {
    all.push(...(await resolveClientAndParents(m.clientId)));
  }
  return dedupeRecipients(all);
}

export async function listInbox(
  actorType: NotificationActorType,
  actorId: string,
  opts?: { limit?: number; chatUnreadOverride?: number }
): Promise<{
  items: Array<{
    id: string;
    category: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
    readAt: string | null;
    createdAt: string;
  }>;
  aggregates: Array<{
    category: string;
    title: string;
    count: number;
    latestAt: string | null;
    url?: string;
  }>;
  unreadTotal: number;
}> {
  const limit = opts?.limit ?? 40;
  const rows = await prisma.inAppNotification.findMany({
    where: { actorType, actorId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const unreadByCategory = await prisma.inAppNotification.groupBy({
    by: ['category'],
    where: { actorType, actorId, readAt: null },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  const inboxChatUnread = unreadByCategory.find((c) => c.category === 'chat')?._count._all || 0;
  const chatUnread =
    opts?.chatUnreadOverride != null
      ? Math.max(opts.chatUnreadOverride, inboxChatUnread)
      : inboxChatUnread;
  const financeUnread = unreadByCategory.find((c) => c.category === 'finance')?._count._all || 0;

  const aggregates: Array<{
    category: string;
    title: string;
    count: number;
    latestAt: string | null;
    url?: string;
  }> = [];

  if (chatUnread > 0) {
    aggregates.push({
      category: 'chat',
      title: `У вас новое сообщение (${chatUnread})`,
      count: chatUnread,
      latestAt:
        unreadByCategory.find((c) => c.category === 'chat')?._max.createdAt?.toISOString() ||
        new Date().toISOString(),
      url: actorType === 'CLIENT' || actorType === 'PARENT' ? '/client/dashboard' : '/chats',
    });
  }
  // Агрегат «Финансы (N)» только для школьного staff (OWNER)
  const aggregateFinance = actorType === 'USER';
  if (aggregateFinance && financeUnread > 0) {
    aggregates.push({
      category: 'finance',
      title: `Финансы (${financeUnread})`,
      count: financeUnread,
      latestAt:
        unreadByCategory.find((c) => c.category === 'finance')?._max.createdAt?.toISOString() ||
        null,
      url: '/finance',
    });
  }

  const items = rows
    .filter((r) => {
      if (r.category === 'chat') return false;
      if (aggregateFinance && r.category === 'finance') return false;
      return true;
    })
    .map((r) => ({
      id: r.id,
      category: r.category,
      type: r.type,
      title: r.title,
      body: r.body,
      data: r.data ? (JSON.parse(r.data) as Record<string, unknown>) : null,
      readAt: r.readAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
    }));

  const otherUnread = unreadByCategory
    .filter((c) => {
      if (c.category === 'chat') return false;
      if (aggregateFinance && c.category === 'finance') return false;
      return true;
    })
    .reduce((s, c) => s + c._count._all, 0);

  const unreadTotal =
    chatUnread + (aggregateFinance ? financeUnread : 0) + otherUnread;

  return { items, aggregates, unreadTotal };
}

export async function markInboxRead(
  actorType: NotificationActorType,
  actorId: string,
  opts: { ids?: string[]; category?: string; all?: boolean }
): Promise<number> {
  const where: any = {
    actorType,
    actorId,
    readAt: null,
  };
  if (opts.all) {
    // keep where
  } else if (opts.category) {
    where.category = opts.category;
  } else if (opts.ids?.length) {
    where.id = { in: opts.ids };
  } else {
    return 0;
  }

  const result = await prisma.inAppNotification.updateMany({
    where,
    data: { readAt: new Date() },
  });
  return result.count;
}

/** Для attendance: проверить, что старший относится к branch. */
export async function userManagesBranch(userId: string, branchId: string): Promise<boolean> {
  const ids = await getSeniorBranchIds(userId);
  return ids.includes(branchId);
}
