import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JWTPayload, ApiResponse } from '../types';
import { isSessionVersionValid } from '../utils/sessionVersion';
import { readAccessTokenFromCookie } from './authCookies';
import { assertAuthSessionActive } from '../services/authSessionService';

/**
 * Middleware to verify JWT token and authenticate user
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = readAccessTokenFromCookie(req);
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Требуется токен доступа'
      });
      return;
    }
    
    if (!process.env.JWT_SECRET) {
      res.status(500).json({
        success: false,
        error: 'JWT секрет не настроен'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true }
    });

    if (
      !user ||
      !user.isActive ||
      !isSessionVersionValid(decoded, user.sessionVersion)
    ) {
      res.status(401).json({
        success: false,
        error: 'Недействительный или неактивный пользователь'
      });
      return;
    }

    const sessionOk = await assertAuthSessionActive(decoded.jti, 'USER', user.id);
    if (!sessionOk) {
      res.status(401).json({
        success: false,
        error: 'Сессия отозвана или истекла'
      });
      return;
    }

    // Check if tenant is active
    if (!user.tenant.isActive) {
      res.status(401).json({
        success: false,
        error: 'Аккаунт организации неактивен'
      });
      return;
    }

    // Attach user and tenant to request
    req.user = user;
    req.tenant = user.tenant;
    req.tenantId = user.tenantId;
    req.authSessionId = decoded.jti;

    next();
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
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка аутентификации'
      });
    }
  }
};

/**
 * Middleware to check if user has required role
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Требуется аутентификация'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Недостаточно прав'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user is owner
 */
export const requireOwner = authorize('OWNER');

/**
 * Middleware to check if user is owner or admin
 */
export const requireOwnerOrAdmin = authorize('OWNER', 'ADMIN');

/**
 * Middleware to check if user is owner, admin, or trainer
 */
export const requireOwnerAdminOrTrainer = authorize('OWNER', 'ADMIN', 'TRAINER');

/**
 * Middleware to check if user is owner, admin, trainer, or promoter
 */
export const requireOwnerAdminTrainerOrPromoter = authorize(
  'OWNER',
  'ADMIN',
  'TRAINER',
  'PROMOTER'
);

/** OWNER или TRAINER (без ADMIN) — тренировочный план. */
export const requireOwnerOrTrainer = authorize('OWNER', 'TRAINER');

export { requireOwnerAdminOrSenior } from '../utils/branchAccess';

/**
 * Middleware to check tenant access
 * @deprecated Prefer JWT req.tenantId + stripClientTenantFields; do not trust body tenantId.
 */
export const checkTenantAccess = (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
  const requestedTenantId = req.params.tenantId || req.query.tenantId;
  
  if (requestedTenantId && requestedTenantId !== req.tenantId) {
    res.status(403).json({
      success: false,
      error: 'Нет доступа к этой организации'
    });
    return;
  }

  next();
};

/**
 * Middleware to validate tenant subdomain
 */
export const validateTenantSubdomain = async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const subdomain = req.headers['x-tenant-subdomain'] as string;
    
    if (!subdomain) {
      res.status(400).json({
        success: false,
        error: 'Требуется поддомен организации'
      });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain }
    });

    if (!tenant || !tenant.isActive) {
      res.status(404).json({
        success: false,
        error: 'Организация не найдена или неактивна'
      });
      return;
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;

    next();
  } catch (error) {
    console.error('Tenant validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки организации'
    });
  }
};
