import { Server } from 'socket.io';
import {
  canAccessThread,
  CreatedMessagePayload,
  resolveClientActor,
  resolveStaffActor,
  resolveSuperAdminActor,
  resolveTesterActor,
  setChatMessageEmitter,
  setChatUnreadEmitter,
  ChatActor,
  presenceKeyForActor,
  resolvePeerPresenceKeys,
  actorPersonalRoom,
} from './chatService';
import { markPresenceOffline, markPresenceOnline, isPresenceOnline } from './chatPresence';
import { isSessionVersionValid } from '../utils/sessionVersion';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';

interface ChatSocketIdentity {
  actor: ChatActor;
  presenceKey: string;
}

async function resolveChatIdentity(decoded: any): Promise<ChatActor | null> {
  if (!decoded || typeof decoded !== 'object') return null;
  if (decoded.type === 'PLATFORM_STAFF') return null;
  if (decoded.type === 'MARKETER' || decoded.type === 'PROMO_CODE_ADMIN') return null;

  if (decoded.type === 'SUPER_ADMIN' && decoded.userId) {
    const sa = await prisma.superAdmin.findUnique({ where: { id: decoded.userId } });
    if (!sa || !sa.isActive || !isSessionVersionValid(decoded, sa.sessionVersion)) return null;
    return resolveSuperAdminActor(sa.id);
  }

  if (decoded.type === 'TESTER' && decoded.userId) {
    const tester = await prisma.tester.findUnique({ where: { id: decoded.userId } });
    if (!tester || !tester.isActive || !isSessionVersionValid(decoded, tester.sessionVersion)) {
      return null;
    }
    return resolveTesterActor(tester.id);
  }

  if (decoded.type === 'client' && decoded.clientId && decoded.tenantId) {
    return resolveClientActor({ clientId: decoded.clientId, tenantId: decoded.tenantId });
  }
  if (decoded.type === 'parent' && decoded.parentId && decoded.tenantId) {
    return resolveClientActor({ parentId: decoded.parentId, tenantId: decoded.tenantId });
  }

  if (decoded.userId && decoded.tenantId && !decoded.type) {
    return resolveStaffActor(decoded.userId, decoded.tenantId);
  }

  return null;
}

function roomName(threadId: string): string {
  return `chat:thread:${threadId}`;
}

/**
 * Namespace /chat на уже созданном Socket.IO (общий path /socket.io с support-call).
 */
export function attachChatNamespace(io: Server): void {
  const nsp = io.of('/chat');

  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error('Unauthorized'));
        return;
      }
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        next(new Error('Config'));
        return;
      }
      const decoded = jwt.verify(token, secret) as any;
      const actor = await resolveChatIdentity(decoded);
      if (!actor) {
        next(new Error('Unauthorized'));
        return;
      }
      const presenceKey = presenceKeyForActor(actor);
      (socket.data as ChatSocketIdentity).actor = actor;
      (socket.data as ChatSocketIdentity).presenceKey = presenceKey;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  nsp.on('connection', (socket) => {
    const data = socket.data as ChatSocketIdentity;
    const actor = data.actor;
    const presenceKey = data.presenceKey;

    markPresenceOnline(presenceKey, socket.id);
    void socket.join(actorPersonalRoom(presenceKey));
    nsp.emit('chat:presence', { key: presenceKey, online: true });

    socket.on('disconnect', () => {
      markPresenceOffline(presenceKey, socket.id);
      if (!isPresenceOnline(presenceKey)) {
        nsp.emit('chat:presence', { key: presenceKey, online: false });
      }
    });

    socket.on(
      'chat:join',
      async (threadId: string, cb?: (r: { ok: boolean; error?: string }) => void) => {
        try {
          if (!threadId) {
            cb?.({ ok: false, error: 'threadId required' });
            return;
          }
          const thread = await prisma.chatThread.findFirst({ where: { id: threadId } });
          if (!thread || !(await canAccessThread(actor, thread))) {
            cb?.({ ok: false, error: 'Forbidden' });
            return;
          }
          await socket.join(roomName(threadId));
          cb?.({ ok: true });
        } catch {
          cb?.({ ok: false, error: 'Error' });
        }
      }
    );

    socket.on('chat:leave', (threadId: string) => {
      if (threadId) socket.leave(roomName(threadId));
    });

    socket.on('chat:typing', (payload: { threadId: string }) => {
      if (!payload?.threadId) return;
      socket.to(roomName(payload.threadId)).emit('chat:typing', {
        threadId: payload.threadId,
        actorKind: actor.kind,
      });
    });
  });

  setChatMessageEmitter((payload: CreatedMessagePayload) => {
    nsp.to(roomName(payload.threadId)).emit('chat:message', payload);
  });

  setChatUnreadEmitter(({ thread, author }) => {
    void (async () => {
      try {
        const keys = await resolvePeerPresenceKeys(thread, author);
        for (const key of keys) {
          nsp.to(actorPersonalRoom(key)).emit('chat:unread', {
            threadId: thread.id,
            unreadDelta: 1,
          });
        }
      } catch (e) {
        console.error('chat unread notify error', e);
      }
    })();
  });
}
