import { ChatThreadType } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { ClientRequest } from '../middleware/clientAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, unauthorized } from '../utils/httpError';
import {
  createMessage,
  ensureThread,
  getMessages,
  getUnreadTotalForActor,
  listThreadsForActor,
  markThreadRead,
  resolveClientActor,
  resolveStaffActor,
  updateMessage,
  EnsureThreadInput,
} from '../services/chatService';
import { Response } from 'express';

const VALID_TYPES = new Set<string>([
  'CLIENT_ADMIN',
  'CLIENT_TRAINER',
  'GROUP',
  'TRAINER_ADMIN',
  'TRAINERS',
]);

function parseEnsureBody(body: any): EnsureThreadInput {
  const type = String(body?.type || '');
  if (!VALID_TYPES.has(type)) {
    throw badRequest('Некорректный type');
  }
  return {
    type: type as ChatThreadType,
    clientId: body?.clientId ? String(body.clientId) : undefined,
    trainerId: body?.trainerId ? String(body.trainerId) : undefined,
    groupId: body?.groupId ? String(body.groupId) : undefined,
  };
}

async function staffActor(req: AuthenticatedRequest) {
  if (!req.user?.id || !req.tenant?.id) {
    throw unauthorized('Unauthorized');
  }
  return resolveStaffActor(req.user.id, req.tenant.id);
}

async function clientSideActor(req: ClientRequest) {
  const tenantId = req.client?.tenantId || req.parent?.tenantId;
  if (!tenantId) {
    throw unauthorized('Unauthorized');
  }
  return resolveClientActor({
    clientId: req.client?.id,
    parentId: req.parent?.id,
    tenantId,
  });
}

export const staffListThreads = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await listThreadsForActor(actor);
  res.json({ success: true, data });
});

export const staffUnreadTotal = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const total = await getUnreadTotalForActor(actor);
  res.json({ success: true, data: { total } });
});

export const staffEnsureThread = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const input = parseEnsureBody(req.body);
  const thread = await ensureThread(actor, input);
  res.json({ success: true, data: thread });
});

export const staffGetMessages = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await getMessages(actor, String(req.params.id), {
    before: req.query.before ? String(req.query.before) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ success: true, data });
});

export const staffPostMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await createMessage(actor, String(req.params.id), String(req.body?.body || ''));
  res.status(201).json({ success: true, data });
});

export const staffPatchMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await updateMessage(
    actor,
    String(req.params.id),
    String(req.params.messageId),
    String(req.body?.body || '')
  );
  res.json({ success: true, data });
});

export const staffMarkRead = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await markThreadRead(actor, String(req.params.id));
  res.json({ success: true, data });
});

export const clientListThreads = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await listThreadsForActor(actor);
  res.json({ success: true, data });
});

export const clientUnreadTotal = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const total = await getUnreadTotalForActor(actor);
  res.json({ success: true, data: { total } });
});

export const clientEnsureThread = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const input = parseEnsureBody(req.body);
  const thread = await ensureThread(actor, input);
  res.json({ success: true, data: thread });
});

export const clientGetMessages = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await getMessages(actor, String(req.params.id), {
    before: req.query.before ? String(req.query.before) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ success: true, data });
});

export const clientPostMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await createMessage(actor, String(req.params.id), String(req.body?.body || ''));
  res.status(201).json({ success: true, data });
});

export const clientPatchMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await updateMessage(
    actor,
    String(req.params.id),
    String(req.params.messageId),
    String(req.body?.body || '')
  );
  res.json({ success: true, data });
});

export const clientMarkRead = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await markThreadRead(actor, String(req.params.id));
  res.json({ success: true, data });
});
