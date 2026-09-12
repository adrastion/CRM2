import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiResponse } from '../types';

export const ACCESS_COOKIE = 'crm_access_token';
export const CSRF_COOKIE = 'crm_csrf';

function cookieSecure(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
}

function cookieSameSite(): 'lax' | 'strict' | 'none' {
  const v = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (v === 'strict' || v === 'none') return v;
  return 'lax';
}

/** Включено ли выставление httpOnly cookie при логине (Bearer остаётся основным для multi-account). */
export function authCookiesEnabled(): boolean {
  const v = (process.env.AUTH_COOKIE_ENABLED || 'true').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

export function readAccessTokenFromCookie(req: Request): string | undefined {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const token = cookies?.[ACCESS_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

export function issueCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function setSessionCookies(res: Response, accessToken: string): void {
  if (!authCookiesEnabled()) return;

  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  const secure = cookieSecure();
  const sameSite = cookieSameSite();
  // SameSite=None требует Secure
  const effectiveSameSite = sameSite === 'none' && !secure ? 'lax' : sameSite;

  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: effectiveSameSite,
    path: '/',
    maxAge: maxAgeMs,
  });

  const csrf = issueCsrfToken();
  res.cookie(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure,
    sameSite: effectiveSameSite,
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookies(res: Response): void {
  const secure = cookieSecure();
  const sameSite = cookieSameSite();
  const effectiveSameSite = sameSite === 'none' && !secure ? 'lax' : sameSite;
  res.clearCookie(ACCESS_COOKIE, { path: '/', secure, sameSite: effectiveSameSite });
  res.clearCookie(CSRF_COOKIE, { path: '/', secure, sameSite: effectiveSameSite });
}

/**
 * CSRF double-submit: только если запрос идёт по cookie без Authorization Bearer.
 * Bearer (localStorage / account switcher) CSRF не требует.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const url = (req.originalUrl || req.url || '').split('?')[0];
  if (method === 'POST' && url === '/api/site-analytics/ping') {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const cookieToken = readAccessTokenFromCookie(req);
  if (!cookieToken) {
    next();
    return;
  }

  const cookies = (req as any).cookies as Record<string, string> | undefined;
  const csrfCookie = cookies?.[CSRF_COOKIE];
  const csrfHeader = String(req.headers['x-csrf-token'] || '');
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({
      success: false,
      error: 'CSRF token missing or invalid',
    } satisfies ApiResponse);
    return;
  }

  next();
}

/** Выдать/обновить CSRF cookie (для SPA). */
export function ensureCsrfCookie(req: Request, res: Response): void {
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  let csrf = cookies?.[CSRF_COOKIE];
  if (!csrf) {
    csrf = issueCsrfToken();
    const secure = cookieSecure();
    const sameSite = cookieSameSite();
    const effectiveSameSite = sameSite === 'none' && !secure ? 'lax' : sameSite;
    res.cookie(CSRF_COOKIE, csrf, {
      httpOnly: false,
      secure,
      sameSite: effectiveSameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  res.json({ success: true, data: { csrfToken: csrf } });
}

/** Если в payload есть JWT — выставить httpOnly + CSRF cookies. */
export function maybeSetAuthCookies(res: Response, payload: unknown): void {
  if (!payload || typeof payload !== 'object') return;
  const p = payload as Record<string, any>;
  const token =
    (typeof p.token === 'string' && p.token) ||
    (typeof p?.data?.token === 'string' && p.data.token) ||
    (typeof p?.session?.token === 'string' && p.session.token) ||
    null;
  if (token && token.length > 20) {
    setSessionCookies(res, token);
  }
}
