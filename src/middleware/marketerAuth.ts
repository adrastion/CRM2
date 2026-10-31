import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';
import { assertAuthSessionActive } from '../services/authSessionService';

/**
 * Middleware to verify marketer JWT token
 */
export const authenticateMarketer = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Требуется токен доступа',
      });
      return;
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      res.status(500).json({
        success: false,
        error: 'JWT секрет не настроен',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    if (decoded.type !== 'MARKETER') {
      res.status(403).json({
        success: false,
        error: 'Неверный тип токена. Требуется токен маркетолога.',
      });
      return;
    }

    if (typeof decoded.jti === 'string' && decoded.jti) {
      const active = await assertAuthSessionActive(decoded.jti, 'MARKETER', decoded.userId);
      if (!active) {
        res.status(401).json({
          success: false,
          error: 'Сессия завершена. Войдите снова.',
        });
        return;
      }
      req.authSessionId = decoded.jti;
    }

    const marketer = await prisma.marketer.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!marketer || !marketer.isActive) {
      res.status(401).json({
        success: false,
        error: 'Недействительный или неактивный маркетолог',
      });
      return;
    }

    if (marketer.tenantId && marketer.tenant && !marketer.tenant.isActive) {
      res.status(401).json({
        success: false,
        error: 'Аккаунт организации неактивен',
      });
      return;
    }

    (req as any).marketer = marketer;
    (req as any).marketerTenant = marketer.tenant || null;
    (req as any).marketerTenantId = marketer.tenantId || null;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Недействительный токен',
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Срок действия токена истёк',
      });
    } else {
      console.error('Marketer authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка аутентификации',
      });
    }
  }
});
