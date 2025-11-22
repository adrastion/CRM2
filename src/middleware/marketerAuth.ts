import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';

const prisma = new PrismaClient();

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
    
    // Check if it's a marketer token
    if (decoded.type !== 'MARKETER') {
      res.status(403).json({
        success: false,
        error: 'Invalid token type. Marketer token required.'
      });
      return;
    }
    
    // Get marketer from database
    const marketer = await prisma.marketer.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true }
    });

    if (!marketer || !marketer.isActive) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive marketer'
      });
      return;
    }

    // Check if tenant is active
    if (!marketer.tenant.isActive) {
      res.status(401).json({
        success: false,
        error: 'Tenant account is inactive'
      });
      return;
    }

    // Attach marketer and tenant to request
    (req as any).marketer = marketer;
    (req as any).marketerTenant = marketer.tenant;
    (req as any).marketerTenantId = marketer.tenantId;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    } else {
      console.error('Marketer authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }
});

