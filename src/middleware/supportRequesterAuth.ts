import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';
import { prisma } from '../lib/prisma';
import { isSessionVersionValid } from '../utils/sessionVersion';
import { assertAuthSessionActive } from '../services/authSessionService';
import { resolvePlatformInternalTenantId } from '../services/supportTicketHelpers';

export type SupportRequester =
  | { kind: 'TENANT_USER'; id: string; email?: string; tenantId: string; role: string }
  | { kind: 'MARKETER'; id: string; email?: string; tenantId: string; marketerId: string }
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
  jti?: string;
};

/**
 * Accepts JWTs for tenant user / marketer / promo-code-admin.
 * Rejects super-admin and platform-staff (no tenantId).
 */
export const authenticateSupportRequester = asyncHandler(async (req: any, res: Response<ApiResponse>, next: NextFunction) => {
  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Требуется токен доступа' });
    return;
  }
  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, error: 'JWT секрет не настроен' });
    return;
  }
  let decoded: AnyJwt;
  try {
    decoded = jwt.verify(token, secret) as AnyJwt;
  } catch {
    res.status(401).json({ success: false, error: 'Недействительный токен' });
    return;
  }

  if (decoded.type === 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Супер-администратор не может использовать API заявителя поддержки' });
    return;
  }

  const userId = decoded.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Неподдерживаемый токен для обращений в поддержку' });
    return;
  }

  const kind =
    decoded.type === 'MARKETER'
      ? 'MARKETER'
      : decoded.type === 'PROMO_CODE_ADMIN'
        ? 'PROMO_CODE_ADMIN'
        : 'TENANT_USER';

  if (kind === 'MARKETER') {
    const marketer = await prisma.marketer.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true, tenantId: true },
    });
    if (!marketer || !marketer.isActive) {
      res.status(401).json({ success: false, error: 'Недействительный или неактивный маркетолог' });
      return;
    }
    const tenantId =
      marketer.tenantId ||
      (typeof decoded.tenantId === 'string' && decoded.tenantId) ||
      (await resolvePlatformInternalTenantId());
    (req as SupportRequesterRequest).supportRequester = {
      kind: 'MARKETER',
      id: marketer.id,
      marketerId: marketer.id,
      email: marketer.email,
      tenantId,
    };
    next();
    return;
  }

  const tenantId = decoded.tenantId;
  if (!tenantId || typeof tenantId !== 'string') {
    res.status(401).json({ success: false, error: 'Неподдерживаемый токен для обращений в поддержку' });
    return;
  }

  if (kind === 'TENANT_USER') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, isActive: true, sessionVersion: true, email: true, role: true },
    });
    if (
      !user ||
      !user.isActive ||
      user.tenantId !== tenantId ||
      !isSessionVersionValid(decoded, user.sessionVersion)
    ) {
      res.status(401).json({ success: false, error: 'Недействительный или неактивный пользователь' });
      return;
    }
    if (!(await assertAuthSessionActive(decoded.jti, 'USER', user.id))) {
      res.status(401).json({ success: false, error: 'Сессия отозвана или истекла' });
      return;
    }
    (req as SupportRequesterRequest).supportRequester = {
      kind,
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
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
