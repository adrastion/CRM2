import { prisma } from '../lib/prisma';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { designerCanAccessTicket, DESIGNER_SUPERADMIN_CHANNEL } from '../controllers/supportTicketController';

type JoinRole = 'designer' | 'requester' | 'client';

interface SocketIdentity {
  kind: 'PLATFORM_STAFF' | 'SUPPORT_REQUESTER' | 'CLIENT';
  userId?: string;
  role?: string;
  tenantId?: string;
  clientId?: string;
  parentId?: string;
}

async function resolveIdentity(decoded: any): Promise<SocketIdentity | null> {
  if (!decoded || typeof decoded !== 'object') return null;
  if (decoded.type === 'SUPER_ADMIN') return null;

  if (decoded.type === 'PLATFORM_STAFF') {
    const staff = await prisma.platformStaffUser.findUnique({ where: { id: decoded.userId } });
    if (!staff?.isActive) return null;
    return { kind: 'PLATFORM_STAFF', userId: staff.id, role: staff.role };
  }

  if (decoded.type === 'client' && decoded.clientId) {
    return { kind: 'CLIENT', clientId: decoded.clientId, tenantId: decoded.tenantId };
  }
  if (decoded.type === 'parent' && decoded.parentId) {
    return { kind: 'CLIENT', parentId: decoded.parentId, tenantId: decoded.tenantId };
  }

  if (decoded.type === 'MARKETER' || decoded.type === 'PROMO_CODE_ADMIN') {
    if (!decoded.userId || !decoded.tenantId) return null;
    return { kind: 'SUPPORT_REQUESTER', userId: decoded.userId, tenantId: decoded.tenantId };
  }

  if (decoded.userId && decoded.tenantId) {
    return { kind: 'SUPPORT_REQUESTER', userId: decoded.userId, tenantId: decoded.tenantId };
  }

  return null;
}

async function validateDesignerTicketAccess(
  identity: SocketIdentity,
  ticket: { channel: string; tenantId: string; clientId: string | null; parentId: string | null; assignedStaffId: string | null }
): Promise<boolean> {
  if (ticket.channel === DESIGNER_SUPERADMIN_CHANNEL) return false;
  if (ticket.channel !== 'DESIGNER') return false;

  if (identity.kind === 'PLATFORM_STAFF') {
    if (identity.role === 'SECURITY') return false;
    if (!identity.userId || !identity.role) return false;
    return designerCanAccessTicket({ id: identity.userId, role: identity.role }, ticket);
  }

  if (identity.kind === 'SUPPORT_REQUESTER') {
    if (ticket.tenantId !== identity.tenantId) return false;
    if (ticket.clientId !== null || ticket.parentId !== null) return false;
    return true;
  }

  if (identity.kind === 'CLIENT') {
    if (ticket.tenantId !== identity.tenantId) return false;
    if (identity.clientId && ticket.clientId === identity.clientId) return true;
    if (identity.parentId && ticket.parentId === identity.parentId) return true;
    return false;
  }

  return false;
}

function joinRole(identity: SocketIdentity): JoinRole {
  if (identity.kind === 'PLATFORM_STAFF' && identity.role === 'DESIGNER') return 'designer';
  if (identity.kind === 'CLIENT') return 'client';
  return 'requester';
}

export function attachSupportCallSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
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
      const identity = await resolveIdentity(decoded);
      if (!identity) {
        next(new Error('Unauthorized'));
        return;
      }
      (socket.data as any).identity = identity;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const identity = (socket.data as any).identity as SocketIdentity;

    socket.on('join-ticket', async (ticketId: string, cb?: (r: { ok: boolean; error?: string; role?: JoinRole; peersInRoom?: number }) => void) => {
      try {
        if (typeof ticketId !== 'string' || !ticketId) {
          cb?.({ ok: false, error: 'ticketId required' });
          return;
        }
        const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) {
          cb?.({ ok: false, error: 'Not found' });
          return;
        }
        const allowed = await validateDesignerTicketAccess(identity, ticket);
        if (!allowed) {
          cb?.({ ok: false, error: 'Forbidden' });
          return;
        }

        const prevRoom = (socket.data as any).room as string | undefined;
        if (prevRoom) {
          await socket.leave(prevRoom);
        }

        const room = `support-call:${ticketId}`;
        await socket.join(room);
        (socket.data as any).room = room;
        (socket.data as any).ticketId = ticketId;
        const jr = joinRole(identity);
        (socket.data as any).joinRole = jr;

        const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
        const others = await io.in(room).fetchSockets();
        const hasDesigner = others.some(
          (s) => s.id !== socket.id && ((s.data as any).joinRole as JoinRole | undefined) === 'designer'
        );
        socket.emit('room-state', { hasDesigner });
        socket.to(room).emit('peer-joined', { role: jr });
        cb?.({ ok: true, role: jr, peersInRoom: size });
      } catch {
        cb?.({ ok: false, error: 'Server error' });
      }
    });

    socket.on('webrtc-signal', (msg: { ticketId: string; payload: unknown }) => {
      const room = (socket.data as any).room as string | undefined;
      const tid = (socket.data as any).ticketId as string | undefined;
      if (!room || !tid || !msg?.ticketId || msg.ticketId !== tid) return;
      const joinRoleVal = (socket.data as any).joinRole as JoinRole | undefined;
      socket.to(room).emit('webrtc-signal', {
        payload: msg.payload,
        fromRole: joinRoleVal,
      });
    });

    socket.on('disconnect', () => {
      const room = (socket.data as any).room as string | undefined;
      const jr = (socket.data as any).joinRole as JoinRole | undefined;
      if (room && jr) {
        socket.to(room).emit('peer-left', { role: jr });
      }
    });
  });

  return io;
}
