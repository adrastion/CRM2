import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';

/**
 * Удаляет client-supplied tenantId / id из body после authenticate,
 * чтобы нельзя было переназначить запись в другую школу (mass-assignment).
 */
export const stripClientTenantFields = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    delete (req.body as any).tenantId;
    delete (req.body as any).tenant_id;
  }
  next();
};

/** JWT tenant обязателен; иначе 401 (не допускаем where: { tenantId: undefined }). */
export function requireTenantId(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): string | null {
  const tenantId = req.tenantId || req.tenant?.id;
  if (!tenantId) {
    res.status(401).json({ success: false, error: 'Tenant context required' });
    return null;
  }
  return tenantId;
}
