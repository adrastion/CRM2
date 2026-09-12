import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  isMaintenanceMode,
  MAINTENANCE_MESSAGE,
} from '../services/maintenanceService';
import { readAccessTokenFromCookie } from './authCookies';

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return readAccessTokenFromCookie(req) || null;
}

function isSuperAdminToken(token: string): boolean {
  if (!process.env.JWT_SECRET) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { type?: string };
    return decoded?.type === 'SUPER_ADMIN';
  } catch {
    return false;
  }
}

function isAllowlisted(req: Request): boolean {
  const method = req.method.toUpperCase();
  const url = (req.originalUrl || req.url || '').split('?')[0];

  if (method === 'GET' && (url === '/health' || url.endsWith('/health'))) {
    return true;
  }

  if (method === 'GET' && url === '/api/maintenance/status') {
    return true;
  }

  if (method === 'POST' && url === '/api/super-admin/auth/login') {
    return true;
  }

  if (method === 'POST' && url === '/api/site-analytics/ping') {
    return true;
  }

  return false;
}

/**
 * Блокирует API во время техобслуживания для всех, кроме SUPER_ADMIN.
 * Allowlist: status, health, SA login.
 */
export async function maintenanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (isAllowlisted(req)) {
      next();
      return;
    }

    const enabled = await isMaintenanceMode();
    if (!enabled) {
      next();
      return;
    }

    const token = extractToken(req);
    if (token && isSuperAdminToken(token)) {
      next();
      return;
    }

    res.status(503).json({
      success: false,
      code: 'MAINTENANCE',
      error: MAINTENANCE_MESSAGE,
    });
  } catch (e) {
    console.error('[maintenance] middleware error', e);
    next();
  }
}
