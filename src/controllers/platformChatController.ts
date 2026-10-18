import { Request, Response } from 'express';
import fs from 'fs';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createMessage,
  createMediaMessage,
  deleteMessage,
  ensureThread,
  getChatAttachmentFile,
  getMessages,
  listPlatformThreadsForActor,
  listThreadParticipants,
  listThreadPins,
  markThreadRead,
  pinThreadMessage,
  resolveSuperAdminActor,
  resolveTesterActor,
  unpinThreadMessage,
  updateMessage,
  ChatActor,
} from '../services/chatService';
import { ChatThreadType } from '@prisma/client';
import { badRequest } from '../utils/httpError';
import { ChatMediaKind } from '../utils/chatMedia';

function actorFromReq(req: Request): ChatActor {
  const platform = (req as any).platformChatActor as { kind: 'SUPER_ADMIN' | 'TESTER'; id: string };
  if (platform?.kind === 'SUPER_ADMIN') return resolveSuperAdminActor(platform.id);
  if (platform?.kind === 'TESTER') return resolveTesterActor(platform.id);
  if ((req as any).superAdmin?.id) return resolveSuperAdminActor((req as any).superAdmin.id);
  if ((req as any).tester?.id) return resolveTesterActor((req as any).tester.id);
  throw Object.assign(new Error('Не авторизован'), { statusCode: 401 });
}

function parseMentions(raw: unknown) {
  if (!raw) return undefined;
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value)) return undefined;
  return value
    .map((m) => ({
      type: String((m as any)?.type || ''),
      id: String((m as any)?.id || ''),
    }))
    .filter((m) => m.type && m.id);
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
  const data = await createMessage(actor, req.params.threadId, {
    body: String(req.body?.body || ''),
    replyToMessageId: req.body?.replyToMessageId ? String(req.body.replyToMessageId) : null,
    mentions: parseMentions(req.body?.mentions),
  });
  res.json({ success: true, data });
});

export const sendPlatformChatMedia = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw badRequest('Файл не загружен');
  try {
    const data = await createMediaMessage(actor, req.params.threadId, {
      file,
      kindHint: (req.body?.kind as ChatMediaKind) || null,
      caption: req.body?.caption || req.body?.body || '',
      replyToMessageId: req.body?.replyToMessageId ? String(req.body.replyToMessageId) : null,
      mentions: parseMentions(req.body?.mentions),
      durationMs: req.body?.durationMs != null ? Number(req.body.durationMs) : null,
    });
    res.status(201).json({ success: true, data });
  } catch (e) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }
    throw e;
  }
});

export const getPlatformChatMedia = asyncHandler(async (req: Request, res: Response) => {
  const actor = actorFromReq(req);
  const file = await getChatAttachmentFile(
    actor,
    req.params.threadId,
    req.params.messageId,
    req.params.attachmentId
  );
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
  );
  fs.createReadStream(file.absPath).pipe(res);
});

export const getPlatformChatParticipants = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await listThreadParticipants(actor, req.params.threadId);
  res.json({ success: true, data });
});

export const getPlatformChatPins = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await listThreadPins(actor, req.params.threadId);
  res.json({ success: true, data });
});

export const pinPlatformChatMessage = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await pinThreadMessage(actor, req.params.threadId, String(req.body?.messageId || ''));
  res.json({ success: true, data });
});

export const unpinPlatformChatMessage = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await unpinThreadMessage(actor, req.params.threadId, req.params.messageId);
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

export const deletePlatformChatMessage = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await deleteMessage(actor, req.params.threadId, req.params.messageId);
  res.json({ success: true, data });
});

export const markPlatformChatRead = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const actor = actorFromReq(req);
  const data = await markThreadRead(actor, req.params.threadId);
  res.json({ success: true, data });
});
