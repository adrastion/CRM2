import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getMaintenanceStatus,
  setMaintenanceMode,
  setMaintenanceSchedule,
  getTestingModeStatus,
  setTestingMode,
  getPublicAccessStatus,
  getTermsOfService,
  setTermsOfService,
  getPrivacyPolicy,
  setPrivacyPolicy,
  listTestingAccountCandidates,
  getPlatformChatDeleteLimit,
  setPlatformChatDeleteLimit,
} from '../services/maintenanceService';
import { tokenHasAccess } from '../middleware/maintenance';
import { readAccessTokenFromCookie } from '../middleware/authCookies';

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return readAccessTokenFromCookie(req) || null;
}

export const getAdminMaintenance = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const data = await getMaintenanceStatus();
    res.json({ success: true, data });
  }
);

export const updateAdminMaintenance = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    if (typeof req.body?.enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'Требуется enabled (boolean)' });
      return;
    }
    const data = await setMaintenanceMode(req.body.enabled);
    res.json({ success: true, data });
  }
);

export const updateAdminMaintenanceSchedule = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    const raw = req.body?.scheduledAt;
    const scheduledAt = raw === null || raw === '' ? null : String(raw || '');
    if (scheduledAt === '') {
      res.status(400).json({ success: false, error: 'Укажите дату и время' });
      return;
    }
    try {
      const data = await setMaintenanceSchedule(scheduledAt);
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e?.message || 'Некорректная дата' });
    }
  }
);

export const getAdminTestingMode = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const data = await getTestingModeStatus();
    res.json({ success: true, data });
  }
);

export const updateAdminTestingMode = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    if (typeof req.body?.enabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'Требуется enabled (boolean)' });
      return;
    }
    let allowlist: string[] | undefined;
    if (Array.isArray(req.body.allowlist)) {
      allowlist = req.body.allowlist.map((e: unknown) => String(e));
    } else if (typeof req.body.allowlist === 'string') {
      allowlist = req.body.allowlist.split(/[\n,;]+/);
    }
    const data = await setTestingMode({
      enabled: req.body.enabled,
      allowlist,
    });
    res.json({ success: true, data });
  }
);

/** Список существующих аккаунтов для выбора в режиме тестирования. */
export const getTestingAccountCandidates = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const accounts = await listTestingAccountCandidates();
    res.json({ success: true, data: { accounts } });
  }
);

export const getAdminTerms = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const data = await getTermsOfService();
  res.json({ success: true, data });
});

export const updateAdminTerms = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  try {
    const data = await setTermsOfService(String(req.body?.content ?? ''));
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message || 'Не удалось сохранить' });
  }
});

export const getPublicTerms = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const data = await getTermsOfService();
  res.json({ success: true, data });
});

export const getAdminPrivacy = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const data = await getPrivacyPolicy();
  res.json({ success: true, data });
});

export const updateAdminPrivacy = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  try {
    const data = await setPrivacyPolicy(String(req.body?.content ?? ''));
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message || 'Не удалось сохранить' });
  }
});

export const getPublicPrivacy = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const data = await getPrivacyPolicy();
  res.json({ success: true, data });
});

export const listPublicMarketerLegalDocs = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const { MarketerLegalDocumentService } = await import('../services/marketerLegalDocumentService');
    const data = await MarketerLegalDocumentService.listPublic();
    res.json({ success: true, data });
  }
);

export const downloadPublicMarketerLegalDoc = asyncHandler(async (req: Request, res: Response) => {
  const key = String(req.params.key || '');
  const { MarketerLegalDocumentService } = await import('../services/marketerLegalDocumentService');
  try {
    const file = await MarketerLegalDocumentService.resolveAbsolutePath(key);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '_')}"`);
    const fs = await import('fs');
    fs.createReadStream(file.abs).pipe(res);
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 404;
    res.status(status).json({ success: false, error: e?.message || 'Документ не найден' });
  }
});

export const getPublicAccessStatusHandler = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const data = await getPublicAccessStatus();
    res.json({ success: true, data });
  }
);

/** Можно ли текущему токену пользоваться сайтом при testing/maintenance/closed. */
export const getAccessCheck = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const status = await getPublicAccessStatus();
  const token = extractToken(req);
  const access = await tokenHasAccess(token);

  let canAccess = true;
  let mode: 'none' | 'maintenance' | 'testing' | 'closed_testing' = 'none';
  let message = '';

  if (status.maintenance.enabled) {
    mode = 'maintenance';
    message = status.maintenance.message;
    canAccess = access.sa;
  } else if (status.closedTesting.enabled) {
    mode = 'closed_testing';
    message = status.closedTesting.message;
    canAccess = access.sa || access.allowlisted;
  } else if (status.testing.enabled) {
    mode = 'testing';
    message = status.testing.message;
    canAccess = access.sa || access.allowlisted;
  }

  res.json({
    success: true,
    data: {
      canAccess,
      mode,
      message,
      isSuperAdmin: access.sa,
      isAllowlisted: access.allowlisted,
      maintenance: status.maintenance,
      testing: { enabled: status.testing.enabled, message: status.testing.message },
      closedTesting: status.closedTesting,
    },
  });
});

export const getAdminPlatformChatSettings = asyncHandler(
  async (_req: Request, res: Response<ApiResponse>) => {
    const data = await getPlatformChatDeleteLimit();
    res.json({ success: true, data });
  }
);

export const updateAdminPlatformChatSettings = asyncHandler(
  async (req: Request, res: Response<ApiResponse>) => {
    try {
      const data = await setPlatformChatDeleteLimit(
        Number(req.body?.platformChatMessageDeleteLimitMinutes)
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ success: false, error: e?.message || 'Некорректные данные' });
    }
  }
);
