import path from 'path';
import multer from 'multer';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import {
  absoluteUploadPath,
  decodeUploadOriginalName,
  ensureUploadDir,
  safeUnlink,
  uniqueUploadFilename,
} from '../utils/fileStorage';

const VIS = new Set(['PERSONAL', 'SHARED']);
const CATEGORY_KEYS = new Set(['general', 'work', 'ideas', 'personal', 'important']);
const REMINDER_KEYS = new Set(['none', 'in_1h', 'tomorrow', 'in_1d', 'in_1w']);

function parseRelatedLink(v: unknown): string | null {
  if (v == null || v === '' || v === 'none') return null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s === 'none') return null;
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object' && parsed.type && parsed.id) {
        return JSON.stringify({
          type: String(parsed.type),
          id: String(parsed.id),
          label: parsed.label ? String(parsed.label) : '',
        });
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof v === 'object' && v && (v as any).type && (v as any).id) {
    return JSON.stringify({
      type: String((v as any).type),
      id: String((v as any).id),
      label: (v as any).label ? String((v as any).label) : '',
    });
  }
  return null;
}

function requireTenantUser(req: AuthenticatedRequest) {
  if (!req.tenant?.id || !req.user?.id) {
    throw badRequest('Требуется авторизация сотрудника школы');
  }
  return { tenantId: req.tenant.id, userId: req.user.id, role: req.user.role };
}

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
  role: true,
} as const;

const noteInclude = {
  author: { select: authorSelect },
  attachments: { orderBy: { createdAt: 'desc' as const } },
};

function parseJsonArray(v: unknown): string[] | null {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) {
    const arr = v.map(String).map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        const arr = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        return arr.length ? arr : null;
      }
    } catch {
      /* comma list */
    }
    const arr = v
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr : null;
  }
  return null;
}

function assertCanEdit(
  existing: { visibility: string; authorUserId: string },
  userId: string,
  role: string
) {
  const isOwner = role === 'OWNER';
  const isAuthor = existing.authorUserId === userId;
  if (existing.visibility === 'PERSONAL' && !isAuthor) {
    throw forbidden('Личную заметку может править только автор');
  }
  if (existing.visibility === 'SHARED' && !isAuthor && !isOwner) {
    throw forbidden('Общую заметку может править автор или владелец');
  }
}

async function enrichRelatedTasks(tenantId: string, note: any) {
  let ids: string[] = [];
  try {
    ids = note.relatedTaskIds ? JSON.parse(note.relatedTaskIds) : [];
  } catch {
    ids = [];
  }
  if (!ids.length) return { ...note, relatedTasks: [] };
  const tasks = await prisma.staffTask.findMany({
    where: { tenantId, id: { in: ids } },
    include: {
      assignees: {
        include: {
          user: { select: authorSelect },
        },
      },
    },
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return {
    ...note,
    relatedTasks: ids.map((id) => byId.get(id)).filter(Boolean),
  };
}

export const listStaffNotes = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireTenantUser(req);
    const visibility = req.query.visibility ? String(req.query.visibility) : undefined;

    const notes = await prisma.staffNote.findMany({
      where: {
        tenantId,
        ...(visibility === 'PERSONAL'
          ? { visibility: 'PERSONAL', authorUserId: userId }
          : visibility === 'SHARED'
            ? { visibility: 'SHARED' }
            : {
                OR: [
                  { visibility: 'SHARED' },
                  { visibility: 'PERSONAL', authorUserId: userId },
                ],
              }),
      },
      include: noteInclude,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });

    const enriched = await Promise.all(notes.map((n) => enrichRelatedTasks(tenantId, n)));
    res.json({ success: true, data: enriched });
  }
);

export const createStaffNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireTenantUser(req);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '');
    const visibility = String(req.body?.visibility || 'PERSONAL').toUpperCase();

    if (!title) throw badRequest('Укажите заголовок', 'title');
    if (!VIS.has(visibility)) throw badRequest('visibility: PERSONAL или SHARED', 'visibility');

    const tags = parseJsonArray(req.body?.tags);
    const related = parseJsonArray(req.body?.relatedTaskIds);
    let categoryKey = 'general';
    if (req.body?.categoryKey != null) {
      const raw = String(req.body.categoryKey).trim().toLowerCase();
      if (!CATEGORY_KEYS.has(raw)) throw badRequest('Некорректная категория', 'categoryKey');
      categoryKey = raw;
    }
    let reminderKey = 'none';
    if (req.body?.reminderKey != null) {
      const raw = String(req.body.reminderKey).trim().toLowerCase();
      if (!REMINDER_KEYS.has(raw)) throw badRequest('Некорректное напоминание', 'reminderKey');
      reminderKey = raw;
    }
    const relatedLink = parseRelatedLink(req.body?.relatedLink);

    const note = await prisma.staffNote.create({
      data: {
        tenantId,
        authorUserId: userId,
        visibility,
        title,
        body,
        color: req.body?.color ? String(req.body.color).trim() : '#2F6BFF',
        categoryKey,
        reminderKey,
        pinned: Boolean(req.body?.pinned),
        tags: tags ? JSON.stringify(tags) : null,
        relatedTaskIds: related ? JSON.stringify(related) : null,
        relatedLink,
      },
      include: noteInclude,
    });

    res.status(201).json({
      success: true,
      data: await enrichRelatedTasks(tenantId, note),
    });
  }
);

export const updateStaffNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const existing = await prisma.staffNote.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Заметка не найдена');
    assertCanEdit(existing, userId, role);

    const data: Record<string, unknown> = {};
    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) throw badRequest('Укажите заголовок', 'title');
      data.title = title;
    }
    if (req.body?.body != null) data.body = String(req.body.body);
    if (req.body?.visibility != null) {
      const visibility = String(req.body.visibility).toUpperCase();
      if (!VIS.has(visibility)) throw badRequest('visibility: PERSONAL или SHARED', 'visibility');
      if (existing.authorUserId !== userId) throw forbidden('Менять видимость может только автор');
      data.visibility = visibility;
    }
    if (req.body?.color !== undefined) {
      data.color = req.body.color ? String(req.body.color).trim() : null;
    }
    if (req.body?.pinned !== undefined) data.pinned = Boolean(req.body.pinned);
    if (req.body?.tags !== undefined) {
      const tags = parseJsonArray(req.body.tags);
      data.tags = tags ? JSON.stringify(tags) : null;
    }
    if (req.body?.relatedTaskIds !== undefined) {
      const related = parseJsonArray(req.body.relatedTaskIds);
      data.relatedTaskIds = related ? JSON.stringify(related) : null;
    }
    if (req.body?.categoryKey != null) {
      const raw = String(req.body.categoryKey).trim().toLowerCase();
      if (!CATEGORY_KEYS.has(raw)) throw badRequest('Некорректная категория', 'categoryKey');
      data.categoryKey = raw;
    }
    if (req.body?.reminderKey != null) {
      const raw = String(req.body.reminderKey).trim().toLowerCase();
      if (!REMINDER_KEYS.has(raw)) throw badRequest('Некорректное напоминание', 'reminderKey');
      data.reminderKey = raw;
    }
    if (req.body?.relatedLink !== undefined) {
      data.relatedLink = parseRelatedLink(req.body.relatedLink);
    }

    const note = await prisma.staffNote.update({
      where: { id },
      data,
      include: noteInclude,
    });

    res.json({ success: true, data: await enrichRelatedTasks(tenantId, note) });
  }
);

export const deleteStaffNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const existing = await prisma.staffNote.findFirst({
      where: { id, tenantId },
      include: { attachments: true },
    });
    if (!existing) throw notFound('Заметка не найдена');

    const isOwner = role === 'OWNER';
    const isAuthor = existing.authorUserId === userId;
    if (existing.visibility === 'PERSONAL' && !isAuthor) {
      throw forbidden('Личную заметку может удалить только автор');
    }
    if (existing.visibility === 'SHARED' && !isAuthor && !isOwner) {
      throw forbidden('Общую заметку может удалить автор или владелец');
    }

    for (const a of existing.attachments) safeUnlink(a.storagePath);
    await prisma.staffNote.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);

export const noteAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const tenantId = (req as AuthenticatedRequest).tenant?.id;
        if (!tenantId) return cb(new Error('No tenant'), '');
        cb(null, ensureUploadDir('staff-note-files', tenantId));
      } catch (e: any) {
        cb(e, '');
      }
    },
    filename: (_req, file, cb) => {
      cb(null, uniqueUploadFilename(decodeUploadOriginalName(file.originalname)));
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const uploadStaffNoteAttachment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;
    const existing = await prisma.staffNote.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Заметка не найдена');
    assertCanEdit(existing, userId, role);

    const file = req.file;
    if (!file) throw badRequest('Файл не загружен');
    const storagePath = path.join('staff-note-files', tenantId, file.filename).replace(/\\/g, '/');
    const att = await prisma.staffNoteAttachment.create({
      data: {
        noteId: id,
        originalName: decodeUploadOriginalName(file.originalname),
        storagePath,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        createdById: userId,
      },
    });
    res.status(201).json({ success: true, data: att });
  }
);

export const deleteStaffNoteAttachment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id, attachmentId } = req.params;
    const existing = await prisma.staffNote.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Заметка не найдена');
    assertCanEdit(existing, userId, role);

    const att = await prisma.staffNoteAttachment.findFirst({
      where: { id: attachmentId, noteId: id },
    });
    if (!att) throw notFound('Файл не найден');
    safeUnlink(att.storagePath);
    await prisma.staffNoteAttachment.delete({ where: { id: attachmentId } });
    res.json({ success: true, data: { id: attachmentId } });
  }
);

export const getStaffNoteAttachmentFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { tenantId, userId } = requireTenantUser(req);
    const { id, attachmentId } = req.params;
    const note = await prisma.staffNote.findFirst({ where: { id, tenantId } });
    if (!note) throw notFound('Заметка не найдена');
    if (note.visibility === 'PERSONAL' && note.authorUserId !== userId) {
      throw forbidden('Нет доступа');
    }
    const att = await prisma.staffNoteAttachment.findFirst({
      where: { id: attachmentId, noteId: id },
    });
    if (!att) throw notFound('Файл не найден');
    res.sendFile(absoluteUploadPath(att.storagePath));
  }
);

export const duplicateStaffNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireTenantUser(req);
    const { id } = req.params;
    const existing = await prisma.staffNote.findFirst({
      where: { id, tenantId },
      include: { attachments: true },
    });
    if (!existing) throw notFound('Заметка не найдена');
    if (existing.visibility === 'PERSONAL' && existing.authorUserId !== userId) {
      throw forbidden('Нет доступа');
    }

    const note = await prisma.staffNote.create({
      data: {
        tenantId,
        authorUserId: userId,
        visibility: 'PERSONAL',
        title: `${existing.title} (копия)`,
        body: existing.body,
        color: existing.color,
        pinned: false,
        tags: existing.tags,
        relatedTaskIds: existing.relatedTaskIds,
      },
      include: noteInclude,
    });

    res.status(201).json({
      success: true,
      data: await enrichRelatedTasks(tenantId, note),
    });
  }
);
