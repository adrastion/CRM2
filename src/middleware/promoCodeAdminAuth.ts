import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from './errorHandler';

/**
 * Middleware to verify promo code admin JWT token
 */
export const authenticatePromoCodeAdmin = asyncHandler(async (
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
    
    // Check if it's a promo code admin token
    if (decoded.type !== 'PROMO_CODE_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Invalid token type. Promo code admin token required.'
      });
      return;
    }
    
    // Get admin from database
    const admin = await prisma.promoCodeAdmin.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true }
    });

    if (!admin || !admin.isActive) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive admin'
      });
      return;
    }

    // Check if tenant is active
    if (!admin.tenant.isActive) {
      res.status(401).json({
        success: false,
        error: 'Tenant account is inactive'
      });
      return;
    }

    // Attach admin and tenant to request
    (req as any).promoCodeAdmin = admin;
    (req as any).promoCodeAdminTenant = admin.tenant;
    (req as any).promoCodeAdminTenantId = admin.tenantId;

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
      console.error('Promo code admin authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }
});

