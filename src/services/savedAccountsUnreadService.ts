import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { isSessionVersionValid } from '../utils/sessionVersion';
import { getActorUnreadTotal } from './notificationFanout';
import {
  getUnreadTotalForActor,
  resolveClientActor,
  resolveStaffActor,
} from './chatService';
import type { NotificationActorType } from './notificationPrefsService';

const MAX_ACCOUNTS = 8;

export type SavedAccountUnreadInput = {
  id: string;
  token: string;
};

/**
 * Unread для школьного USER с учётом чатов.
 */
export async function getSchoolUserUnreadTotal(
  userId: string,
  tenantId: string
): Promise<number> {
  const actor = await resolveStaffActor(userId, tenantId);
  const chatUnread = await getUnreadTotalForActor(actor);
  return getActorUnreadTotal('USER', userId, { chatUnreadOverride: chatUnread });
}

/**
 * Unread для CLIENT / PARENT с учётом чатов.
 */
export async function getPortalActorUnreadTotal(
  actorType: 'CLIENT' | 'PARENT',
  actorId: string,
  tenantId: string
): Promise<number> {
  const actor = await resolveClientActor({
    tenantId,
    ...(actorType === 'PARENT' ? { parentId: actorId } : { clientId: actorId }),
  });
  const chatUnread = await getUnreadTotalForActor(actor);
  return getActorUnreadTotal(actorType, actorId, { chatUnreadOverride: chatUnread });
}

function parseSlotId(id: string): { kind: string; entityId: string } | null {
  const idx = id.indexOf(':');
  if (idx <= 0) return null;
  return { kind: id.slice(0, idx), entityId: id.slice(idx + 1) };
}

/**
 * По JWT слота savedAccounts вернуть unread (0 при невалидном токене / неподдерживаемом типе).
 */
export async function unreadForSavedAccountToken(
  accountId: string,
  token: string
): Promise<number> {
  const slot = parseSlotId(accountId);
  if (!slot || !token || !process.env.JWT_SECRET) return 0;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as Record<string, unknown>;

    if (slot.kind === 'TENANT_USER') {
      const userId = typeof decoded.userId === 'string' ? decoded.userId : null;
      if (!userId || userId !== slot.entityId) return 0;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tenantId: true,
          isActive: true,
          sessionVersion: true,
          tenant: { select: { isActive: true } },
        },
      });
      if (
        !user ||
        !user.isActive ||
        !user.tenant.isActive ||
        !isSessionVersionValid(decoded as { sv?: number }, user.sessionVersion)
      ) {
        return 0;
      }
      return getSchoolUserUnreadTotal(user.id, user.tenantId);
    }

    if (slot.kind === 'CLIENT') {
      if (decoded.type !== 'client') return 0;
      const clientId = typeof decoded.clientId === 'string' ? decoded.clientId : null;
      const tenantId = typeof decoded.tenantId === 'string' ? decoded.tenantId : null;
      if (!clientId || !tenantId || clientId !== slot.entityId) return 0;
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, tenantId: true, isActive: true, sessionVersion: true },
      });
      if (
        !client ||
        !client.isActive ||
        client.tenantId !== tenantId ||
        !isSessionVersionValid(decoded as { sv?: number }, client.sessionVersion)
      ) {
        return 0;
      }
      return getPortalActorUnreadTotal('CLIENT', client.id, client.tenantId);
    }

    if (slot.kind === 'PARENT') {
      if (decoded.type !== 'parent') return 0;
      const parentId = typeof decoded.parentId === 'string' ? decoded.parentId : null;
      const tenantId = typeof decoded.tenantId === 'string' ? decoded.tenantId : null;
      if (!parentId || !tenantId || parentId !== slot.entityId) return 0;
      const parent = await prisma.parent.findUnique({
        where: { id: parentId },
        select: { id: true, tenantId: true, sessionVersion: true },
      });
      if (
        !parent ||
        parent.tenantId !== tenantId ||
        !isSessionVersionValid(decoded as { sv?: number }, parent.sessionVersion)
      ) {
        return 0;
      }
      return getPortalActorUnreadTotal('PARENT', parent.id, parent.tenantId);
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Batch unread для списка сохранённых аккаунтов (max 8).
 */
export async function batchSavedAccountsUnread(
  accounts: SavedAccountUnreadInput[]
): Promise<Record<string, number>> {
  const slice = accounts.slice(0, MAX_ACCOUNTS);
  const counts: Record<string, number> = {};
  await Promise.all(
    slice.map(async (item) => {
      const id = String(item.id || '').trim();
      const token = String(item.token || '').trim();
      if (!id) return;
      counts[id] = await unreadForSavedAccountToken(id, token);
    })
  );
  return counts;
}

export type { NotificationActorType };
