import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';

export type PlatformStaffRole = 'SUPPORT' | 'DESIGNER' | 'SECURITY';

export const authenticatePlatformStaff = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Требуется токен доступа' });
    return;
  }
  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ success: false, error: 'JWT секрет не настроен' });
    return;
  }
  const decoded = jwt.verify(token, jwtSecret) as any;
  if (decoded.type !== 'PLATFORM_STAFF') {
    res.status(403).json({ success: false, error: 'Требуется токен сотрудника платформы' });
    return;
  }
  const staff = await prisma.platformStaffUser.findUnique({
    where: { id: decoded.userId },
  });
  if (!staff?.isActive) {
    res.status(401).json({ success: false, error: 'Недействительный или неактивный аккаунт сотрудника' });
    return;
  }
  (req as any).platformStaff = staff;
  next();
});

export const requirePlatformStaffRoles = (...roles: PlatformStaffRole[]) =>
  asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    const staff = (req as any).platformStaff;
    if (!staff) {
      res.status(401).json({ success: false, error: 'Не авторизован' });
      return;
    }
    if (!roles.includes(staff.role as PlatformStaffRole)) {
      res.status(403).json({ success: false, error: 'Недостаточно прав для роли' });
      return;
    }
    next();
  });
