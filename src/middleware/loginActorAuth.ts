import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';
import { readAccessTokenFromCookie } from './authCookies';

/**
 * Принимает JWT любой роли единого входа (школа, клиент, SA, …)
 * и кладёт соответствующего актора на req для QR approve / security.
 */
export const authenticateLoginActor = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = readAccessTokenFromCookie(req) || undefined;
  }
  if (!token) {
    res.status(401).json({ success: false, error: 'Нужна активная сессия' });
    return;
  }
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ success: false, error: 'JWT secret not configured' });
    return;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401).json({ success: false, error: 'Сессия недействительна' });
    return;
  }

  req.authSessionId = typeof decoded.jti === 'string' ? decoded.jti : undefined;

  if (decoded.type === 'client' && decoded.clientId) {
    (req as any).client = { id: decoded.clientId };
    next();
    return;
  }
  if (decoded.type === 'parent' && decoded.parentId) {
    (req as any).parent = { id: decoded.parentId };
    next();
    return;
  }
  if (decoded.type === 'SUPER_ADMIN' && decoded.userId) {
    (req as any).superAdmin = { id: decoded.userId };
    next();
    return;
  }
  if (decoded.type === 'TESTER' && decoded.userId) {
    (req as any).tester = { id: decoded.userId };
    next();
    return;
  }
  if (decoded.type === 'MARKETER' && decoded.userId) {
    (req as any).marketer = { id: decoded.userId };
    next();
    return;
  }
  if (decoded.type === 'PLATFORM_STAFF' && decoded.userId) {
    (req as any).platformStaff = { id: decoded.userId };
    next();
    return;
  }
  if (decoded.type === 'PROMO_CODE_ADMIN' && (decoded.userId || decoded.adminId)) {
    (req as any).promoCodeAdmin = { id: decoded.userId || decoded.adminId };
    next();
    return;
  }
  if (decoded.userId && decoded.tenantId && !decoded.type) {
    (req as any).user = { id: decoded.userId, tenantId: decoded.tenantId };
    next();
    return;
  }
  // TENANT_USER JWT иногда с role без type
  if (decoded.userId && (decoded.role || decoded.tenantId)) {
    (req as any).user = { id: decoded.userId, tenantId: decoded.tenantId };
    next();
    return;
  }

  res.status(401).json({ success: false, error: 'Нужна активная сессия' });
});
