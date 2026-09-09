import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';
import { isSessionVersionValid } from '../utils/sessionVersion';

/**
 * Middleware: JWT type TESTER.
 */
export const authenticateTester = asyncHandler(async (
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

  try {
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET) as any;
    if (decoded.type !== 'TESTER') {
      res.status(403).json({ success: false, error: 'Требуется токен тестировщика' });
      return;
    }

    const tester = await prisma.tester.findUnique({ where: { id: decoded.userId } });
    if (!tester || !tester.isActive || !isSessionVersionValid(decoded, tester.sessionVersion)) {
      res.status(401).json({ success: false, error: 'Invalid or inactive tester' });
      return;
    }

    (req as any).tester = tester;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }
    throw error;
  }
});

/**
 * Супер-админ или тестировщик (платформенные чаты / changelog read).
 */
export const authenticateSuperAdminOrTester = asyncHandler(async (
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

  let decoded: any;
  try {
    decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }

  if (decoded.type === 'SUPER_ADMIN') {
    const superAdmin = await prisma.superAdmin.findUnique({ where: { id: decoded.userId } });
    if (
      !superAdmin ||
      !superAdmin.isActive ||
      !isSessionVersionValid(decoded, superAdmin.sessionVersion)
    ) {
      res.status(401).json({ success: false, error: 'Invalid or inactive super admin' });
      return;
    }
    (req as any).superAdmin = superAdmin;
    (req as any).platformChatActor = { kind: 'SUPER_ADMIN', id: superAdmin.id };
    next();
    return;
  }

  if (decoded.type === 'TESTER') {
    const tester = await prisma.tester.findUnique({ where: { id: decoded.userId } });
    if (!tester || !tester.isActive || !isSessionVersionValid(decoded, tester.sessionVersion)) {
      res.status(401).json({ success: false, error: 'Invalid or inactive tester' });
      return;
    }
    (req as any).tester = tester;
    (req as any).platformChatActor = { kind: 'TESTER', id: tester.id };
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: 'Требуется доступ супер-админа или тестировщика',
  });
});
