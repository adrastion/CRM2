import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  SANDBOX_ROLES,
  SandboxRole,
  issueSandboxSession,
  listSandboxSessions,
  reopenSandboxSession,
  saveSandboxSession,
  deleteSandboxSession,
} from '../services/sandboxSessionService';

function saId(req: AuthenticatedRequest): string | null {
  return (req as any).superAdmin?.id || null;
}

export const listTestSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const id = saId(req);
  if (!id) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }
  const rows = await listSandboxSessions(id);
  res.json({ success: true, data: { roles: SANDBOX_ROLES, sessions: rows } });
});

export const enterTestSession = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const id = saId(req);
  if (!id) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }
  const sessionId = req.body?.sessionId ? String(req.body.sessionId) : '';
  if (sessionId) {
    const reopened = await reopenSandboxSession(id, sessionId);
    if (!reopened) {
      res.status(404).json({ success: false, error: 'Сессия не найдена' });
      return;
    }
    res.json({ success: true, data: reopened });
    return;
  }
  const role = String(req.body?.role || '') as SandboxRole;
  if (!SANDBOX_ROLES.includes(role)) {
    res.status(400).json({ success: false, error: 'Некорректная роль' });
    return;
  }
  const data = await issueSandboxSession(id, role);
  res.json({ success: true, data });
});

export const saveTestSession = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const id = saId(req);
  if (!id) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }
  const saved = await saveSandboxSession(id, String(req.params.id));
  if (!saved) {
    res.status(404).json({ success: false, error: 'Сессия не найдена' });
    return;
  }
  res.json({ success: true, data: saved });
});

export const deleteTestSession = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const id = saId(req);
  if (!id) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }
  const ok = await deleteSandboxSession(id, String(req.params.id));
  if (!ok) {
    res.status(404).json({ success: false, error: 'Сессия не найдена' });
    return;
  }
  res.json({ success: true, data: { id: req.params.id } });
});
