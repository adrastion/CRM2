import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { PasswordResetService } from '../services/passwordResetService';
import { EmailVerifyService } from '../services/emailVerifyService';
import { OtpAccountType } from '../services/emailOtpService';
import { unauthorized } from '../utils/httpError';
import Joi from 'joi';
import { validate } from '../middleware/validation';

const NEUTRAL = 'Если аккаунт с этим email существует, мы отправили код на почту';

/** Сессия staff / client / parent из Authorization Bearer. */
export type AnyAuthSession =
  | { kind: 'user'; id: string; tenantId: string }
  | { kind: 'client'; id: string; tenantId: string }
  | { kind: 'parent'; id: string; tenantId: string };

export function resolveAnyAuthSession(req: Request): AnyAuthSession | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (decoded.type === 'client' && decoded.clientId) {
      return { kind: 'client', id: decoded.clientId, tenantId: decoded.tenantId };
    }
    if (decoded.type === 'parent' && decoded.parentId) {
      return { kind: 'parent', id: decoded.parentId, tenantId: decoded.tenantId };
    }
    // Staff JWT (unified / AuthService): userId + tenantId + role
    if (decoded.userId && decoded.tenantId && decoded.role) {
      return { kind: 'user', id: decoded.userId, tenantId: decoded.tenantId };
    }
    if (decoded.accountType === 'TENANT_USER' && (decoded.id || decoded.userId)) {
      return {
        kind: 'user',
        id: decoded.id || decoded.userId,
        tenantId: decoded.tenantId,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export const requestPasswordResetCode = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const email = String(req.body.email || '');
  const result = await PasswordResetService.requestCode(email);
  res.json({ success: true, data: result, message: result.message || NEUTRAL });
});

export const verifyPasswordResetCode = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { email, code } = req.body;
  const result = await PasswordResetService.verifyCode(String(email || ''), String(code || ''));
  res.json({ success: true, data: result });
});

export const confirmPasswordReset = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { resetToken, newPassword, accountType, accountId } = req.body;
  const result = await PasswordResetService.confirm({
    resetToken: String(resetToken || ''),
    newPassword: String(newPassword || ''),
    accountType: String(accountType || ''),
    accountId: String(accountId || ''),
  });
  res.json({ success: true, data: result, message: result.message });
});

export const sendEmailVerification = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const session = resolveAnyAuthSession(req);
  if (!session) throw unauthorized('Требуется авторизация');

  const result = await EmailVerifyService.sendVerification({
    accountType: session.kind as OtpAccountType,
    accountId: session.id,
  });
  res.json({ success: true, data: result, message: result.message });
});

export const verifyEmailCode = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const session = resolveAnyAuthSession(req);
  if (!session) throw unauthorized('Требуется авторизация');

  const result = await EmailVerifyService.verifyCode({
    accountType: session.kind as OtpAccountType,
    accountId: session.id,
    code: String(req.body.code || ''),
  });
  res.json({ success: true, data: result, message: result.message });
});

/** Для совместимости: старый endpoint смены пароля по JWT-ссылке. */
export const legacyResetPasswordUnavailable = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  res.status(400).json({
    success: false,
    error: 'Сброс по ссылке больше не поддерживается. Запросите код на email через «Забыли пароль?»',
  });
});

export const validatePasswordResetRequest = validate(
  Joi.object({
    email: Joi.string().email().required(),
  })
);

export const validatePasswordResetVerify = validate(
  Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().pattern(/^\d{6}$/).required(),
  })
);

export const validatePasswordResetConfirm = validate(
  Joi.object({
    resetToken: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
    accountType: Joi.string().required(),
    accountId: Joi.string().required(),
  })
);

export const validateEmailVerifyCode = validate(
  Joi.object({
    code: Joi.string().pattern(/^\d{6}$/).required(),
  })
);
