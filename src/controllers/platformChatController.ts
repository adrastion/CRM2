import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createMessage,
  ensureThread,
  getMessages,
  listPlatformThreadsForActor,
  markThreadRead,
  resolveSuperAdminActor,
  resolveTesterActor,
  updateMessage,
  ChatActor,
} from '../services/chatService';
import { ChatThreadType } from '@prisma/client';

function actorFromReq(req: Request): ChatActor {
  const platform = (req as any).platformChatActor as { kind: 'SUPER_ADMIN' | 'TESTER'; id: string };
  if (platform?.kind === 'SUPER_ADMIN') return resolveSuperAdminActor(platform.id);
  if (platform?.kind === 'TESTER') return resolveTesterActor(platform.id);
  if ((req as any).superAdmin?.id) return resolveSuperAdminActor((req as any).superAdmin.id);
  if ((req as any).tester?.id) return resolveTesterActor((req as any).tester.id);
  throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
}

export const listPlatformChatThreads = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await listPlatformThreadsForActor(actor);
  res.json({ success: true, data });
});

export const ensurePlatformChatThread = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const type = req.body?.type as ChatThreadType;
  if (type !== 'PLATFORM_TESTERS' && type !== 'SUPER_ADMINS') {
    res.status(400).json({ success: false, error: 'Недопустимый тип платформенного чата' });
    return;
  }
  if (type === 'SUPER_ADMINS' && actor.kind !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Нет доступа' });
    return;
  }
  const thread = await ensureThread(actor, { type });
  res.json({ success: true, data: thread });
});

export const getPlatformChatMessages = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await getMessages(actor, req.params.threadId, {
    before: req.query.before as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ success: true, data });
});

export const sendPlatformChatMessage = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await createMessage(actor, req.params.threadId, req.body?.body);
  res.json({ success: true, data });
});

export const updatePlatformChatMessage = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await updateMessage(
    actor,
    req.params.threadId,
    req.params.messageId,
    String(req.body?.body || '')
  );
  res.json({ success: true, data });
});

export const markPlatformChatRead = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await markThreadRead(actor, req.params.threadId);
  res.json({ success: true, data });
});
