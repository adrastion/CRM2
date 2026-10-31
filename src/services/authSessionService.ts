import { Request } from 'express';
import { prisma } from '../lib/prisma';

export type AuthActorType =
  | 'USER'
  | 'CLIENT'
  | 'PARENT'
  | 'SUPER_ADMIN'
  | 'TESTER'
  | 'MARKETER';

export type SessionRequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

const LAST_SEEN_THROTTLE_MS = 10 * 60 * 1000;

export function extractSessionMeta(req: Request): SessionRequestMeta {
  const xf = req.headers['x-forwarded-for'];
  let ip: string | null = null;
  if (typeof xf === 'string' && xf.trim()) {
    ip = xf.split(',')[0].trim();
  } else if (Array.isArray(xf) && xf[0]) {
    ip = String(xf[0]).split(',')[0].trim();
  } else if (req.ip) {
    ip = req.ip;
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
  return { ipAddress: ip, userAgent: ua };
}

/** Краткое имя устройства из User-Agent. */
export function deviceLabelFromUa(userAgent?: string | null): string {
  if (!userAgent) return 'Неизвестное устройство';
  const ua = userAgent;

  let browser = 'Браузер';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  let os = 'устройство';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} · ${os}`;
}

/** Парсит TTL вида 7d / 30d / 12h / 3600s в Date. */
export function expiresAtFromTtl(ttl: string, from = new Date()): Date {
  const m = /^(\d+)\s*([smhd])$/i.exec(String(ttl).trim());
  const amount = m ? Number(m[1]) : 7;
  const unit = (m?.[2] || 'd').toLowerCase();
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60 * 1000
        : unit === 'h'
          ? amount * 60 * 60 * 1000
          : amount * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}

export async function createAuthSession(args: {
  actorType: AuthActorType;
  actorId: string;
  expiresAt: Date;
  meta?: SessionRequestMeta | null;
}): Promise<{ id: string }> {
  const userAgent = args.meta?.userAgent || null;
  const session = await prisma.authSession.create({
    data: {
      actorType: args.actorType,
      actorId: args.actorId,
      deviceLabel: deviceLabelFromUa(userAgent),
      userAgent,
      ipAddress: args.meta?.ipAddress || null,
      expiresAt: args.expiresAt,
    },
    select: { id: true },
  });
  return session;
}

export async function assertAuthSessionActive(
  jti: string | undefined,
  actorType: AuthActorType,
  actorId: string
): Promise<boolean> {
  if (!jti) return false;
  const session = await prisma.authSession.findFirst({
    where: {
      id: jti,
      actorType,
      actorId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, lastSeenAt: true },
  });
  if (!session) return false;

  const age = Date.now() - new Date(session.lastSeenAt).getTime();
  if (age >= LAST_SEEN_THROTTLE_MS) {
    void prisma.authSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => undefined);
  }
  return true;
}

export async function revokeAuthSessionById(
  actorType: AuthActorType,
  actorId: string,
  sessionId: string
): Promise<boolean> {
  const result = await prisma.authSession.updateMany({
    where: { id: sessionId, actorType, actorId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export async function revokeOtherAuthSessions(
  actorType: AuthActorType,
  actorId: string,
  keepSessionId: string
): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: {
      actorType,
      actorId,
      revokedAt: null,
      id: { not: keepSessionId },
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function revokeAllAuthSessions(
  actorType: AuthActorType,
  actorId: string
): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: { actorType, actorId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listActiveAuthSessions(actorType: AuthActorType, actorId: string) {
  return prisma.authSession.findMany({
    where: {
      actorType,
      actorId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      deviceLabel: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });
}

/** После sessionVersion++ — отозвать все строки AuthSession актора. */
export async function revokeSessionsOnVersionBump(
  actorType: AuthActorType,
  actorId: string
): Promise<void> {
  await revokeAllAuthSessions(actorType, actorId);
}
