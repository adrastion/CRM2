import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';
import { prisma } from '../lib/prisma';
import { isSessionVersionValid } from '../utils/sessionVersion';

export type SupportRequester =
  | { kind: 'TENANT_USER'; id: string; email?: string; tenantId: string }
  | { kind: 'MARKETER'; id: string; email?: string; tenantId: string }
  | { kind: 'PROMO_CODE_ADMIN'; id: string; email?: string; tenantId: string };

export type SupportRequesterRequest = {
  supportRequester?: SupportRequester;
};

type AnyJwt = Record<string, unknown> & {
  userId?: string;
  email?: string;
  tenantId?: string;
  type?: string;
  sv?: number;
};

/**
 * Accepts JWTs for tenant user / marketer / promo-code-admin.
 * Rejects super-admin and platform-staff (no tenantId).
 */
export const authenticateSupportRequester = asyncHandler(async (req: any, res: Response<ApiResponse>, next: NextFunction) => {
  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Access token is required' });
    return;
  }
  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, error: 'JWT secret not configured' });
    return;
  }
  let decoded: AnyJwt;
  try {
    decoded = jwt.verify(token, secret) as AnyJwt;
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }

  if (decoded.type === 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Super admin cannot use support requester API' });
    return;
  }

  const userId = decoded.userId;
  const tenantId = decoded.tenantId;
  if (!userId || !tenantId) {
    res.status(401).json({ success: false, error: 'Unsupported token for support requests' });
    return;
  }

  const kind =
    decoded.type === 'MARKETER'
      ? 'MARKETER'
      : decoded.type === 'PROMO_CODE_ADMIN'
        ? 'PROMO_CODE_ADMIN'
        : 'TENANT_USER';

  if (kind === 'TENANT_USER') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, isActive: true, sessionVersion: true, email: true },
    });
    if (
      !user ||
      !user.isActive ||
      user.tenantId !== tenantId ||
      !isSessionVersionValid(decoded, user.sessionVersion)
    ) {
      res.status(401).json({ success: false, error: 'Invalid or inactive user' });
      return;
    }
    (req as SupportRequesterRequest).supportRequester = {
      kind,
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    };
    next();
    return;
  }

  (req as SupportRequesterRequest).supportRequester = {
    kind,
    id: userId,
    email: typeof decoded.email === 'string' ? decoded.email : undefined,
    tenantId,
  };

  next();
});
