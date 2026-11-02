import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { isSessionVersionValid } from '../utils/sessionVersion';
import { assertAuthSessionActive } from './authSessionService';
import {
  actorRoom,
  platformRoom,
  setRealtimeNamespace,
  tenantRoom,
} from './realtimeBus';

type RtIdentity = {
  tenantId: string | null;
  actorType: string;
  actorId: string;
  isPlatform: boolean;
};

async function resolveIdentity(decoded: any): Promise<RtIdentity | null> {
  if (!decoded || typeof decoded !== 'object') return null;

  if (decoded.type === 'SUPER_ADMIN' && decoded.userId) {
    const sa = await prisma.superAdmin.findUnique({ where: { id: decoded.userId } });
    if (!sa || !sa.isActive || !isSessionVersionValid(decoded, sa.sessionVersion)) return null;
    if (!(await assertAuthSessionActive(decoded.jti, 'SUPER_ADMIN', sa.id))) return null;
    return {
      tenantId: null,
      actorType: 'SUPER_ADMIN',
      actorId: sa.id,
      isPlatform: true,
    };
  }

  if (decoded.type === 'client' && decoded.clientId && decoded.tenantId) {
    const client = await prisma.client.findUnique({
      where: { id: decoded.clientId },
      select: { id: true, tenantId: true, isActive: true, sessionVersion: true },
    });
    if (
      !client?.isActive ||
      client.tenantId !== decoded.tenantId ||
      !isSessionVersionValid(decoded, client.sessionVersion)
    ) {
      return null;
    }
    if (!(await assertAuthSessionActive(decoded.jti, 'CLIENT', client.id))) return null;
    return {
      tenantId: client.tenantId,
      actorType: 'CLIENT',
      actorId: client.id,
      isPlatform: false,
    };
  }

  if (decoded.type === 'parent' && decoded.parentId && decoded.tenantId) {
    const parent = await prisma.parent.findUnique({
      where: { id: decoded.parentId },
      select: { id: true, tenantId: true, sessionVersion: true },
    });
    if (
      !parent ||
      parent.tenantId !== decoded.tenantId ||
      !isSessionVersionValid(decoded, parent.sessionVersion)
    ) {
      return null;
    }
    if (!(await assertAuthSessionActive(decoded.jti, 'PARENT', parent.id))) return null;
    return {
      tenantId: parent.tenantId,
      actorType: 'PARENT',
      actorId: parent.id,
      isPlatform: false,
    };
  }

  if (decoded.userId && decoded.tenantId && !decoded.type) {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, tenantId: true, isActive: true, sessionVersion: true },
    });
    if (
      !user?.isActive ||
      user.tenantId !== decoded.tenantId ||
      !isSessionVersionValid(decoded, user.sessionVersion)
    ) {
      return null;
    }
    if (!(await assertAuthSessionActive(decoded.jti, 'USER', user.id))) return null;
    return {
      tenantId: user.tenantId,
      actorType: 'USER',
      actorId: user.id,
      isPlatform: false,
    };
  }

  return null;
}

/** Namespace /realtime — доменные события без перезагрузки страницы */
export function attachRealtimeNamespace(io: Server): void {
  const nsp = io.of('/realtime');
  setRealtimeNamespace(nsp);

  nsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token || !process.env.JWT_SECRET) {
        next(new Error('Не авторизован'));
        return;
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      const identity = await resolveIdentity(decoded);
      if (!identity) {
        next(new Error('Не авторизован'));
        return;
      }
      (socket.data as { identity: RtIdentity }).identity = identity;
      next();
    } catch {
      next(new Error('Не авторизован'));
    }
  });

  nsp.on('connection', (socket) => {
    const identity = (socket.data as { identity: RtIdentity }).identity;
    void socket.join(actorRoom(identity.actorType, identity.actorId));
    if (identity.tenantId) {
      void socket.join(tenantRoom(identity.tenantId));
    }
    if (identity.isPlatform) {
      void socket.join(platformRoom());
    }
  });
}
