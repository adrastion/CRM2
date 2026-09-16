import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import {
  isMaintenanceMode,
  isTestingMode,
  isEmailAllowlisted,
  MAINTENANCE_MESSAGE,
  TESTING_MODE_MESSAGE,
} from '../services/maintenanceService';
import { readAccessTokenFromCookie } from './authCookies';

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return readAccessTokenFromCookie(req) || null;
}

type DecodedAccess = {
  type?: string;
  email?: string;
  userId?: string;
  clientId?: string;
  parentId?: string;
};

function decodeToken(token: string): DecodedAccess | null {
  if (!process.env.JWT_SECRET) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET) as DecodedAccess;
  } catch {
    return null;
  }
}

function isSuperAdminToken(decoded: DecodedAccess | null): boolean {
  return decoded?.type === 'SUPER_ADMIN';
}

async function resolveEmailFromToken(decoded: DecodedAccess | null): Promise<string | null> {
  if (!decoded) return null;
  if (decoded.email) return String(decoded.email).trim().toLowerCase();

  if (decoded.type === 'client' && decoded.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: decoded.clientId },
      select: { email: true },
    });
    return client?.email?.trim().toLowerCase() || null;
  }

  if (decoded.type === 'parent' && decoded.parentId) {
    const parent = await prisma.parent.findUnique({
      where: { id: decoded.parentId },
      select: { email: true },
    });
    return parent?.email?.trim().toLowerCase() || null;
  }

  if (decoded.userId && (!decoded.type || decoded.type === 'USER' || !decoded.type)) {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { email: true },
    });
    if (user?.email) return user.email.trim().toLowerCase();
  }

  if (decoded.type === 'PLATFORM_STAFF' && decoded.userId) {
    const staff = await prisma.platformStaffUser.findUnique({
      where: { id: decoded.userId },
      select: { email: true },
    });
    return staff?.email?.trim().toLowerCase() || null;
  }

  if (decoded.type === 'MARKETER' || decoded.type === 'PROMO_CODE_ADMIN') {
    if (decoded.email) return String(decoded.email).trim().toLowerCase();
    if (decoded.userId) {
      if (decoded.type === 'MARKETER') {
        const m = await prisma.marketer.findUnique({
          where: { id: decoded.userId },
          select: { email: true },
        });
        return m?.email?.trim().toLowerCase() || null;
      }
      const a = await prisma.promoCodeAdmin.findUnique({
        where: { id: decoded.userId },
        select: { email: true },
      });
      return a?.email?.trim().toLowerCase() || null;
    }
  }

  if (decoded.type === 'TESTER' && decoded.userId) {
    const t = await prisma.tester.findUnique({
      where: { id: decoded.userId },
      select: { email: true },
    });
    return t?.email?.trim().toLowerCase() || null;
  }

  return null;
}

function pathOnly(req: Request): string {
  return (req.originalUrl || req.url || '').split('?')[0];
}

function isAlwaysAllowlisted(req: Request): boolean {
  const method = req.method.toUpperCase();
  const url = pathOnly(req);

  if (method === 'GET' && (url === '/health' || url.endsWith('/health'))) return true;
  if (method === 'GET' && url === '/api/maintenance/status') return true;
  if (method === 'GET' && url === '/api/maintenance/access') return true;
  if (method === 'GET' && url === '/api/legal/terms') return true;
  if (method === 'GET' && url === '/api/legal/privacy') return true;
  if (method === 'POST' && url === '/api/super-admin/auth/login') return true;
  if (method === 'POST' && url === '/api/site-analytics/ping') return true;
  if (method === 'GET' && url === '/api/auth/csrf') return true;

  return false;
}

/** Пути входа, открытые в режиме тестирования (чтобы allowlist-аккаунты могли залогиниться). */
function isTestingLoginPath(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method !== 'POST' && method !== 'GET') return false;
  const url = pathOnly(req);

  const posts = [
    '/api/auth/identify',
    '/api/auth/setup-password',
    '/api/auth/unified-login',
    '/api/auth/select-account',
    '/api/auth/login',
    '/api/auth/unified-staff-login',
    '/api/auth/marketer/login',
    '/api/client-auth/login',
    '/api/client-auth/parent/login',
    '/api/platform-staff/auth/login',
    '/api/marketers/login',
  ];
  if (method === 'POST' && posts.includes(url)) return true;

  // parent login might be under different path
  if (method === 'POST' && url.startsWith('/api/client-auth/') && url.endsWith('/login')) {
    return true;
  }

  return false;
}

export async function tokenHasAccess(
  token: string | null
): Promise<{ sa: boolean; allowlisted: boolean; email: string | null }> {
  if (!token) return { sa: false, allowlisted: false, email: null };
  const decoded = decodeToken(token);
  if (isSuperAdminToken(decoded)) {
    return { sa: true, allowlisted: true, email: decoded?.email || null };
  }
  const email = await resolveEmailFromToken(decoded);
  const allowlisted = await isEmailAllowlisted(email);
  return { sa: false, allowlisted, email };
}

/**
 * Блокирует API:
 * - maintenance → только SUPER_ADMIN
 * - testing → SUPER_ADMIN + email из allowlist
 */
export async function maintenanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (isAlwaysAllowlisted(req)) {
      next();
      return;
    }

    const maintenance = await isMaintenanceMode();
    if (maintenance) {
      const token = extractToken(req);
      const access = await tokenHasAccess(token);
      if (access.sa) {
        next();
        return;
      }
      res.status(503).json({
        success: false,
        code: 'MAINTENANCE',
        error: MAINTENANCE_MESSAGE,
      });
      return;
    }

    const testing = await isTestingMode();
    if (!testing) {
      next();
      return;
    }

    if (isTestingLoginPath(req)) {
      next();
      return;
    }

    const token = extractToken(req);
    const access = await tokenHasAccess(token);
    if (access.sa || access.allowlisted) {
      next();
      return;
    }

    res.status(503).json({
      success: false,
      code: 'TESTING_MODE',
      error: TESTING_MODE_MESSAGE,
    });
  } catch (e) {
    console.error('[maintenance] middleware error', e);
    next();
  }
}
