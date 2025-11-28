import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';

const prisma = new PrismaClient();

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

    // Update last login
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLogin: new Date() },
    });

    // Attach super admin to request
    (req as any).superAdmin = superAdmin;

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

