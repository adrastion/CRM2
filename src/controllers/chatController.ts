import { ChatThreadType } from '@prisma/client';
import multer from 'multer';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { ClientRequest } from '../middleware/clientAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, unauthorized } from '../utils/httpError';
import {
  createMessage,
  createMediaMessage,
  deleteMessage,
  ensureThread,
  getChatAttachmentFile,
  getMessages,
  getUnreadTotalForActor,
  listThreadParticipants,
  listThreadPins,
  listThreadsForActor,
  markThreadRead,
  pinThreadMessage,
  resolveClientActor,
  resolveStaffActor,
  unpinThreadMessage,
  updateMessage,
  EnsureThreadInput,
  ChatMentionDto,
} from '../services/chatService';
import { Response } from 'express';
import { ensureUploadDir } from '../utils/fileStorage';
import { ChatMediaKind } from '../utils/chatMedia';
import fs from 'fs';

const VALID_TYPES = new Set<string>([
  'CLIENT_ADMIN',
  'CLIENT_TRAINER',
  'GROUP',
  'TRAINER_ADMIN',
  'TRAINERS',
  'STAFF_TASK',
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
    staffTaskId: body?.staffTaskId ? String(body.staffTaskId) : undefined,
  };
}

function parseMentions(raw: unknown): ChatMentionDto[] | undefined {
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

async function staffActor(req: AuthenticatedRequest) {
  if (!req.user?.id || !req.tenant?.id) {
    throw unauthorized('Не авторизован');
  }
  return resolveStaffActor(req.user.id, req.tenant.id);
}

async function clientSideActor(req: ClientRequest) {
  const tenantId = req.client?.tenantId || req.parent?.tenantId;
  if (!tenantId) {
    throw unauthorized('Не авторизован');
  }
  return resolveClientActor({
    clientId: req.client?.id,
    parentId: req.parent?.id,
    tenantId,
  });
}

export const chatMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureUploadDir('chat-media', '_tmp'));
      } catch (e: any) {
        cb(e, '');
      }
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

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
  const data = await createMessage(actor, String(req.params.id), {
    body: String(req.body?.body || ''),
    replyToMessageId: req.body?.replyToMessageId ? String(req.body.replyToMessageId) : null,
    mentions: parseMentions(req.body?.mentions),
  });
  res.status(201).json({ success: true, data });
});

export const staffPostMediaMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const file = req.file;
  if (!file) throw badRequest('Файл не загружен');
  try {
    const data = await createMediaMessage(actor, String(req.params.id), {
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

export const staffGetMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actor = await staffActor(req);
  const file = await getChatAttachmentFile(
    actor,
    String(req.params.id),
    String(req.params.messageId),
    String(req.params.attachmentId)
  );
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
  );
  fs.createReadStream(file.absPath).pipe(res);
});

export const staffGetParticipants = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await listThreadParticipants(actor, String(req.params.id));
  res.json({ success: true, data });
});

export const staffGetPins = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await listThreadPins(actor, String(req.params.id));
  res.json({ success: true, data });
});

export const staffPinMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const messageId = String(req.body?.messageId || req.params.messageId || '');
  const data = await pinThreadMessage(actor, String(req.params.id), messageId);
  res.json({ success: true, data });
});

export const staffUnpinMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await unpinThreadMessage(
    actor,
    String(req.params.id),
    String(req.params.messageId)
  );
  res.json({ success: true, data });
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

export const staffDeleteMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const actor = await staffActor(req);
  const data = await deleteMessage(
    actor,
    String(req.params.id),
    String(req.params.messageId)
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
  const data = await createMessage(actor, String(req.params.id), {
    body: String(req.body?.body || ''),
    replyToMessageId: req.body?.replyToMessageId ? String(req.body.replyToMessageId) : null,
    mentions: parseMentions(req.body?.mentions),
  });
  res.status(201).json({ success: true, data });
});

export const clientPostMediaMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const file = req.file;
  if (!file) throw badRequest('Файл не загружен');
  try {
    const data = await createMediaMessage(actor, String(req.params.id), {
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

export const clientGetMedia = asyncHandler(async (req: ClientRequest, res: Response) => {
  const actor = await clientSideActor(req);
  const file = await getChatAttachmentFile(
    actor,
    String(req.params.id),
    String(req.params.messageId),
    String(req.params.attachmentId)
  );
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
  );
  fs.createReadStream(file.absPath).pipe(res);
});

export const clientGetParticipants = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await listThreadParticipants(actor, String(req.params.id));
  res.json({ success: true, data });
});

export const clientGetPins = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await listThreadPins(actor, String(req.params.id));
  res.json({ success: true, data });
});

export const clientPinMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const messageId = String(req.body?.messageId || '');
  const data = await pinThreadMessage(actor, String(req.params.id), messageId);
  res.json({ success: true, data });
});

export const clientUnpinMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await unpinThreadMessage(
    actor,
    String(req.params.id),
    String(req.params.messageId)
  );
  res.json({ success: true, data });
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

export const clientDeleteMessage = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await deleteMessage(
    actor,
    String(req.params.id),
    String(req.params.messageId)
  );
  res.json({ success: true, data });
});

export const clientMarkRead = asyncHandler(async (req: ClientRequest, res: Response<ApiResponse>) => {
  const actor = await clientSideActor(req);
  const data = await markThreadRead(actor, String(req.params.id));
  res.json({ success: true, data });
});
