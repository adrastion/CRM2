import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface ClientRequest extends Request {
  client?: {
    id: string;
    tenantId: string;
  };
}

/**
 * Middleware для аутентификации клиента
 */
export const authenticateClient = (req: ClientRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

    if (decoded.type !== 'client') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    req.client = {
      id: decoded.clientId,
      tenantId: decoded.tenantId
    };

    return next();
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

