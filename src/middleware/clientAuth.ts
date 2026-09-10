import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { isSessionVersionValid } from '../utils/sessionVersion';
import { readAccessTokenFromCookie } from './authCookies';

export interface ClientRequest extends Request {
  client?: {
    id: string;
    tenantId: string;
  };
  parent?: {
    id: string;
    tenantId: string;
  };
  userType?: 'client' | 'parent';
}

/**
 * Middleware для аутентификации клиента или родителя
 */
export const authenticateClient = async (
  req: ClientRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = readAccessTokenFromCookie(req);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }
    const decoded = jwt.verify(token, jwtSecret) as {
      type?: string;
      clientId?: string;
      parentId?: string;
      tenantId?: string;
      sv?: number;
    };

    if (decoded.type === 'client' && decoded.clientId && decoded.tenantId) {
      const client = await prisma.client.findUnique({
        where: { id: decoded.clientId },
        select: { id: true, tenantId: true, isActive: true, sessionVersion: true },
      });
      if (
        !client ||
        !client.isActive ||
        client.tenantId !== decoded.tenantId ||
        !isSessionVersionValid(decoded, client.sessionVersion)
      ) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or inactive client'
        });
      }
      req.client = {
        id: client.id,
        tenantId: client.tenantId
      };
      req.userType = 'client';
      return next();
    }

    if (decoded.type === 'parent' && decoded.parentId && decoded.tenantId) {
      const parent = await prisma.parent.findUnique({
        where: { id: decoded.parentId },
        select: { id: true, tenantId: true, sessionVersion: true },
      });
      if (
        !parent ||
        parent.tenantId !== decoded.tenantId ||
        !isSessionVersionValid(decoded, parent.sessionVersion)
      ) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or inactive parent'
        });
      }
      req.parent = {
        id: parent.id,
        tenantId: parent.tenantId
      };
      req.userType = 'parent';
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid token type'
    });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};
