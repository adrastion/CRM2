import { Request, Response } from 'express';
import Joi from 'joi';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { maybeSetAuthCookies } from '../middleware/authCookies';
import { extractSessionMeta } from '../services/authSessionService';
import {
  requestEmailLogin,
  verifyEmailLoginCode,
  requestPushLogin,
  verifyPushLoginCode,
  startQrLogin,
  getQrStatus,
  approveQrChallenge,
  denyQrChallenge,
  getEmail2faEnabled,
  setEmail2faEnabled,
} from '../services/loginChallengeService';
import { AccountType } from '../services/unifiedAuthService';
import { AuthenticatedRequest } from '../types';

const identifierSchema = Joi.object({
  identifier: Joi.string().trim().min(3).max(255).required(),
  rememberMe: Joi.boolean().default(false),
});

const qrStartSchema = Joi.object({
  rememberMe: Joi.boolean().default(false),
});

const codeSchema = Joi.object({
  challengeToken: Joi.string().required(),
  code: Joi.string().trim().length(6).required(),
  rememberMe: Joi.boolean().optional(),
});

const qrApproveSchema = Joi.object({
  challengeToken: Joi.string().required(),
  secret: Joi.string().required(),
});

export const validateLoginIdentifier = validate(identifierSchema);
export const validateQrStart = validate(qrStartSchema);
export const validateLoginCode = validate(codeSchema);
export const validateQrApprove = validate(qrApproveSchema);

export const emailLoginRequest = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const data = await requestEmailLogin(req.body.identifier, Boolean(req.body.rememberMe));
  res.json({ success: true, data });
});

export const emailLoginVerify = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const result = await verifyEmailLoginCode({
    challengeToken: req.body.challengeToken,
    code: req.body.code,
    meta: extractSessionMeta(req),
  });
  maybeSetAuthCookies(res, result);
  res.json({ success: true, data: result });
});

export const email2faVerify = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const result = await verifyEmailLoginCode({
    challengeToken: req.body.challengeToken,
    code: req.body.code,
    meta: extractSessionMeta(req),
  });
  maybeSetAuthCookies(res, result);
  res.json({ success: true, data: result });
});

export const pushLoginRequest = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const data = await requestPushLogin(req.body.identifier, Boolean(req.body.rememberMe));
  res.json({ success: true, data });
});

export const pushLoginVerify = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const result = await verifyPushLoginCode({
    challengeToken: req.body.challengeToken,
    code: req.body.code,
    meta: extractSessionMeta(req),
  });
  maybeSetAuthCookies(res, result);
  res.json({ success: true, data: result });
});

export const qrLoginStart = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const data = await startQrLogin(Boolean(req.body.rememberMe));
  res.json({ success: true, data });
});

export const qrLoginStatus = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const challengeToken = String(req.query.challengeToken || '');
  const data = await getQrStatus(challengeToken);
  if (data.session) maybeSetAuthCookies(res, data.session);
  res.json({ success: true, data });
});

function resolveActorFromReq(req: AuthenticatedRequest): { accountType: AccountType; accountId: string } | null {
  const u = req.user as any;
  if (u?.id && u?.tenantId) {
    return { accountType: 'TENANT_USER', accountId: u.id };
  }
  const client = (req as any).client;
  if (client?.id) return { accountType: 'CLIENT', accountId: client.id };
  const parent = (req as any).parent;
  if (parent?.id) return { accountType: 'PARENT', accountId: parent.id };
  const sa = (req as any).superAdmin;
  if (sa?.id) return { accountType: 'SUPER_ADMIN', accountId: sa.id };
  const tester = (req as any).tester;
  if (tester?.id) return { accountType: 'TESTER', accountId: tester.id };
  const marketer = (req as any).marketer;
  if (marketer?.id) return { accountType: 'MARKETER', accountId: marketer.id };
  const staff = (req as any).platformStaff;
  if (staff?.id) return { accountType: 'PLATFORM_STAFF', accountId: staff.id };
  const promo = (req as any).promoCodeAdmin;
  if (promo?.id) return { accountType: 'PROMO_CODE_ADMIN', accountId: promo.id };
  return null;
}

export const qrLoginApprove = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = resolveActorFromReq(req);
  if (!actor) {
    res.status(401).json({ success: false, error: 'Нужна активная сессия' });
    return;
  }
  const data = await approveQrChallenge({
    challengeToken: req.body.challengeToken,
    secret: req.body.secret,
    accountType: actor.accountType,
    accountId: actor.accountId,
  });
  res.json({ success: true, data });
});

export const qrLoginDeny = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const data = await denyQrChallenge({
    challengeToken: req.body.challengeToken,
    secret: req.body.secret,
  });
  res.json({ success: true, data });
});

export const getLoginSecurity = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = resolveActorFromReq(req);
  if (!actor) {
    res.status(401).json({ success: false, error: 'Нужна активная сессия' });
    return;
  }
  const email2faEnabled = await getEmail2faEnabled(actor.accountType, actor.accountId);
  res.json({ success: true, data: { email2faEnabled } });
});

export const updateLoginSecurity = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = resolveActorFromReq(req);
  if (!actor) {
    res.status(401).json({ success: false, error: 'Нужна активная сессия' });
    return;
  }
  if (typeof req.body?.email2faEnabled !== 'boolean') {
    res.status(400).json({ success: false, error: 'Укажите email2faEnabled' });
    return;
  }
  const data = await setEmail2faEnabled(actor.accountType, actor.accountId, req.body.email2faEnabled);
  res.json({ success: true, data });
});
