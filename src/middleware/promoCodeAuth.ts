import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';

/**
 * Universal middleware to verify promo code admin OR marketer JWT token
 * This allows both promo code admins and marketers to access promo code and referral link routes
 */
export const authenticatePromoCodeOrMarketer = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Требуется токен доступа'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    if (!process.env.JWT_SECRET) {
      res.status(500).json({
        success: false,
        error: 'JWT секрет не настроен'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    // Check if it's a promo code admin token
    if (decoded.type === 'PROMO_CODE_ADMIN') {
      const admin = await prisma.promoCodeAdmin.findUnique({
        where: { id: decoded.userId },
        include: { tenant: true }
      });

      if (!admin || !admin.isActive) {
        res.status(401).json({
          success: false,
          error: 'Недействительный или неактивный администратор'
        });
        return;
      }

      if (!admin.tenant.isActive) {
        res.status(401).json({
          success: false,
          error: 'Аккаунт организации неактивен'
        });
        return;
      }

      // Attach admin and tenant to request
      (req as any).promoCodeAdmin = admin;
      (req as any).promoCodeAdminTenant = admin.tenant;
      (req as any).promoCodeAdminTenantId = admin.tenantId;
      
      next();
      return;
    }
    
    // Check if it's a marketer token
    if (decoded.type === 'MARKETER') {
      const marketer = await prisma.marketer.findUnique({
        where: { id: decoded.userId },
        include: { tenant: true }
      });

      if (!marketer || !marketer.isActive) {
        res.status(401).json({
          success: false,
          error: 'Недействительный или неактивный маркетолог'
        });
        return;
      }

      if (marketer.tenantId && marketer.tenant && !marketer.tenant.isActive) {
        res.status(401).json({
          success: false,
          error: 'Аккаунт организации неактивен'
        });
        return;
      }

      // Attach marketer and tenant to request
      (req as any).marketer = marketer;
      (req as any).marketerTenant = marketer.tenant || null;
      (req as any).marketerTenantId = marketer.tenantId || null;
      
      next();
      return;
    }
    
    // If token type is neither PROMO_CODE_ADMIN nor MARKETER
    res.status(403).json({
      success: false,
      error: 'Неверный тип токена. Требуется токен администратора промокодов или маркетолога.'
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Недействительный токен'
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Срок действия токена истёк'
      });
    } else {
      console.error('Promo code/marketer authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка аутентификации'
      });
    }
  }
});

