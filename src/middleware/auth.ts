import { prisma } from '../lib/prisma';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JWTPayload, ApiResponse } from '../types';

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
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access token is required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!process.env.JWT_SECRET) {
      res.status(500).json({
        success: false,
        error: 'JWT secret not configured'
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

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive user'
      });
      return;
    }

    // Check if tenant is active
    if (!user.tenant.isActive) {
      res.status(401).json({
        success: false,
        error: 'Tenant account is inactive'
      });
      return;
    }

    // Attach user and tenant to request
    req.user = user;
    req.tenant = user.tenant;
    req.tenantId = user.tenantId;

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
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
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
        error: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
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
 * Middleware to check tenant access
 */
export const checkTenantAccess = (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): void => {
  const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  
  if (requestedTenantId && requestedTenantId !== req.tenantId) {
    res.status(403).json({
      success: false,
      error: 'Access denied to this tenant'
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
        error: 'Tenant subdomain is required'
      });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { subdomain }
    });

    if (!tenant || !tenant.isActive) {
      res.status(404).json({
        success: false,
        error: 'Tenant not found or inactive'
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
      error: 'Tenant validation failed'
    });
  }
};
