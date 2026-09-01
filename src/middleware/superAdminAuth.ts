import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';

const prisma = new PrismaClient();

/**
 * Доступ к панели платформы: супер-админ или персонал платформы.
 *
 * Разделение прав:
 * — супер-админ (`superAdmin`) — полный доступ, включая изменение тарифов;
 * — персонал платформы (`platformStaff`) — только чтение.
 */
export type PlatformActorType = 'SUPER_ADMIN' | 'PLATFORM_STAFF';

export interface PlatformActor {
  type: PlatformActorType;
  id: string;
  email: string;
  /** Роль персонала платформы: SUPPORT | DESIGNER | SECURITY. */
  role?: string;
  canWrite: boolean;
}

/**
 * Middleware to verify super admin JWT token
 */
export const authenticateSuperAdmin = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token is required'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    if (!process.env.JWT_SECRET) {
      res.status(500).json({
        success: false,
        error: 'JWT secret not configured'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    
    // Check if it's a super admin token
    if (decoded.type !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Invalid token type. Super admin token required.'
      });
      return;
    }
    
    // Get super admin from database
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.userId },
    });

    if (!superAdmin || !superAdmin.isActive) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive super admin'
      });
      return;
    }

    // Attach super admin to request
    (req as any).superAdmin = superAdmin;
    (req as any).platformActor = {
      type: 'SUPER_ADMIN',
      id: superAdmin.id,
      email: superAdmin.email,
      canWrite: true,
    } satisfies PlatformActor;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }
    throw error;
  }
});

/**
 * Пропускает и супер-админа, и персонал платформы.
 *
 * Используется для справочных данных (например, каталога тарифов), которые
 * персоналу нужно видеть, но не менять. Право на запись выставляется в
 * `platformActor.canWrite` и проверяется в `requirePlatformWrite`.
 */
export const authenticatePlatformViewer = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Access token is required' });
    return;
  }

  if (!process.env.JWT_SECRET) {
    res.status(500).json({ success: false, error: 'JWT secret not configured' });
    return;
  }

  const token = authHeader.substring(7);

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }

  if (decoded.type === 'SUPER_ADMIN') {
    const superAdmin = await prisma.superAdmin.findUnique({ where: { id: decoded.userId } });
    if (!superAdmin || !superAdmin.isActive) {
      res.status(401).json({ success: false, error: 'Invalid or inactive super admin' });
      return;
    }

    (req as any).superAdmin = superAdmin;
    (req as any).platformActor = {
      type: 'SUPER_ADMIN',
      id: superAdmin.id,
      email: superAdmin.email,
      canWrite: true,
    } satisfies PlatformActor;
    next();
    return;
  }

  if (decoded.type === 'PLATFORM_STAFF') {
    const staff = await prisma.platformStaffUser.findUnique({ where: { id: decoded.userId } });
    if (!staff || !staff.isActive) {
      res.status(401).json({ success: false, error: 'Invalid or inactive staff account' });
      return;
    }

    (req as any).platformStaff = staff;
    (req as any).platformActor = {
      type: 'PLATFORM_STAFF',
      id: staff.id,
      email: staff.email,
      role: staff.role,
      // Персонал платформы тарифы не редактирует.
      canWrite: false,
    } satisfies PlatformActor;
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: 'Требуется доступ супер-админа или персонала платформы',
  });
});

/**
 * Разрешает изменение только тому, у кого есть право на запись.
 * Персонал платформы получает 403 с понятным сообщением.
 */
export const requirePlatformWrite = (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const actor = (req as any).platformActor as PlatformActor | undefined;

  if (!actor) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (!actor.canWrite) {
    res.status(403).json({
      success: false,
      error: 'Изменение тарифов доступно только супер-администратору',
    });
    return;
  }

  next();
};
