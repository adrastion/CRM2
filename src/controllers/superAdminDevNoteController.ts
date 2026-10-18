import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { DevNotePriority, DevNoteStatus } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';
import { absoluteUploadPath, safeUnlink, decodeUploadOriginalName, contentDispositionAttachment } from '../utils/fileStorage';

export const DEV_NOTE_STATUS_ORDER: DevNoteStatus[] = [
  'REQUIRED',
  'IDEA',
  'NEEDS_DISCUSSION',
  'AWAITING_FEEDBACK',
  'AWAITING_DESIGN',
  'IN_PROGRESS',
  'SHELVED',
  'DONE',
  'LIKE_OTHERS',
];

const PRIORITIES: DevNotePriority[] = ['URGENT', 'IMPORTANT'];

const saName = { select: { id: true, firstName: true, lastName: true, email: true } };

const noteInclude = {
  createdBy: saName,
  lastEditedBy: saName,
  attachments: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      createdById: true,
    },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: saName },
  },
  reads: {
    include: { superAdmin: saName },
  },
};

function getSuperAdminId(req: AuthenticatedRequest): string | null {
  return (req as any).superAdmin?.id || null;
}

function person(u?: { lastName?: string | null; firstName?: string | null } | null) {
  if (!u) return '';
  return `${u.lastName || ''} ${u.firstName || ''}`.trim();
}

async function notifyOthers(actorId: string, type: string, title: string, body: string) {
  const others = await prisma.superAdmin.findMany({
    where: { isActive: true, id: { not: actorId } },
    select: { id: true },
  });
  if (!others.length) return;
  await prisma.superAdminNotification.createMany({
    data: others.map((o) => ({
      recipientId: o.id,
      type,
      title,
      body,
      link: '/admin/dashboard?section=development',
    })),
  });
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function serializeNote(note: any, viewerId: string | null) {
  const activity = new Date(note.activityAt || note.updatedAt).getTime();
  const myRead = (note.reads || []).find((r: any) => r.superAdminId === viewerId);
  const unread = !myRead || new Date(myRead.readAt).getTime() < activity;
  return {
    ...note,
    attachments: (note.attachments || []).map((a: any) => ({
      ...a,
      originalName: decodeUploadOriginalName(a.originalName),
    })),
    unread,
    readers: (note.reads || []).map((r: any) => ({
      id: r.superAdminId,
      name: person(r.superAdmin) || r.superAdmin?.email || 'Супер-админ',
      readAt: r.readAt,
      current: new Date(r.readAt).getTime() >= activity,
    })),
    commentCount: (note.comments || []).length,
  };
}

export async function sweepDevNotes() {
  const border = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.superAdminDevNote.updateMany({
    where: {
      status: 'DONE',
      doneAt: { lte: border },
      archivedAt: null,
      deletedAt: null,
    },
    data: { archivedAt: new Date() },
  });
  const doomed = await prisma.superAdminDevNote.findMany({
    where: { deletedAt: { lte: border } },
    include: { attachments: { select: { storagePath: true } } },
  });
  for (const note of doomed) {
    for (const a of note.attachments) safeUnlink(a.storagePath);
    await prisma.superAdminDevNote.delete({ where: { id: note.id } });
  }
}

/**
 * GET /admin-dashboard/dev-notes?bucket=active|archive|trash
 */
export const listDevNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const viewerId = getSuperAdminId(req);
  const bucket = String(req.query.bucket || 'active');
  const statusFilter = req.query.status ? String(req.query.status) : null;
  const where: any = {};
  if (bucket === 'archive') {
    where.archivedAt = { not: null };
    where.deletedAt = null;
  } else if (bucket === 'trash') {
    where.deletedAt = { not: null };
  } else {
    where.archivedAt = null;
    where.deletedAt = null;
  }
  if (statusFilter && DEV_NOTE_STATUS_ORDER.includes(statusFilter as DevNoteStatus)) {
    where.status = statusFilter;
  }

  const notes = await prisma.superAdminDevNote.findMany({
    where,
    include: noteInclude,
    orderBy: { activityAt: 'desc' },
  });

  notes.sort((a, b) => {
    const pa = a.priority === 'URGENT' ? 0 : a.priority === 'IMPORTANT' ? 1 : 2;
    const pb = b.priority === 'URGENT' ? 0 : b.priority === 'IMPORTANT' ? 1 : 2;
    if (pa !== pb) return pa - pb;
    const sa = DEV_NOTE_STATUS_ORDER.indexOf(a.status);
    const sb = DEV_NOTE_STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    return b.activityAt.getTime() - a.activityAt.getTime();
  });

  res.json({ success: true, data: notes.map((n) => serializeNote(n, viewerId)) });
});

export const devNotesUnreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const viewerId = getSuperAdminId(req);
  if (!viewerId) {
    res.json({ success: true, data: { count: 0 } });
    return;
  }
  const notes = await prisma.superAdminDevNote.findMany({
    where: { deletedAt: null, archivedAt: null },
    select: {
      activityAt: true,
      reads: { where: { superAdminId: viewerId }, select: { readAt: true } },
    },
  });
  const count = notes.filter((n) => {
    const read = n.reads[0];
    return !read || read.readAt.getTime() < n.activityAt.getTime();
  }).length;
  res.json({ success: true, data: { count } });
});

export const createDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }

  const title = String(req.body?.title || '').trim();
  const description =
    req.body?.description != null ? String(req.body.description).trim() || null : null;
  const statusRaw = String(req.body?.status || 'IDEA');
  const status = DEV_NOTE_STATUS_ORDER.includes(statusRaw as DevNoteStatus)
    ? (statusRaw as DevNoteStatus)
    : 'IDEA';
  const priorityRaw = req.body?.priority;
  const priority =
    priorityRaw && PRIORITIES.includes(priorityRaw as DevNotePriority)
      ? (priorityRaw as DevNotePriority)
      : null;
  const dueFrom = parseDate(req.body?.dueFrom);
  const dueTo = parseDate(req.body?.dueTo);

  if (!title) {
    res.status(400).json({ success: false, error: 'Укажите заголовок' });
    return;
  }

  const now = new Date();
  const note = await prisma.superAdminDevNote.create({
    data: {
      title,
      description,
      status,
      priority,
      dueFrom: dueFrom ?? null,
      dueTo: dueTo ?? null,
      createdById: superAdminId,
      lastEditedById: superAdminId,
      activityAt: now,
      doneAt: status === 'DONE' ? now : null,
    },
    include: noteInclude,
  });
  await notifyOthers(superAdminId, 'DEV_NOTE_CREATED', 'Новая заметка', title);
  res.status(201).json({ success: true, data: serializeNote(note, superAdminId) });
});

export const updateDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  const { id } = req.params;
  const existing = await prisma.superAdminDevNote.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }

  const data: any = { activityAt: new Date() };
  if (superAdminId) data.lastEditedById = superAdminId;

  if (req.body?.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) {
      res.status(400).json({ success: false, error: 'Укажите заголовок' });
      return;
    }
    data.title = title;
  }
  if (req.body?.description !== undefined) {
    data.description = String(req.body.description).trim() || null;
  }
  let statusChanged = false;
  if (req.body?.status !== undefined) {
    const statusRaw = String(req.body.status);
    if (!DEV_NOTE_STATUS_ORDER.includes(statusRaw as DevNoteStatus)) {
      res.status(400).json({ success: false, error: 'Некорректный статус' });
      return;
    }
    data.status = statusRaw as DevNoteStatus;
    statusChanged = data.status !== existing.status;
    if (data.status === 'DONE' && existing.status !== 'DONE') data.doneAt = new Date();
    if (data.status !== 'DONE') {
      data.doneAt = null;
      data.archivedAt = null;
    }
  }
  if (req.body?.priority !== undefined) {
    const priorityRaw = req.body.priority;
    if (priorityRaw === null || priorityRaw === '' || priorityRaw === 'NONE') data.priority = null;
    else if (PRIORITIES.includes(priorityRaw as DevNotePriority)) data.priority = priorityRaw;
    else {
      res.status(400).json({ success: false, error: 'Некорректная важность' });
      return;
    }
  }
  const dueFrom = parseDate(req.body?.dueFrom);
  const dueTo = parseDate(req.body?.dueTo);
  if (dueFrom !== undefined) data.dueFrom = dueFrom;
  if (dueTo !== undefined) data.dueTo = dueTo;

  const note = await prisma.superAdminDevNote.update({
    where: { id },
    data,
    include: noteInclude,
  });
  if (superAdminId) {
    await notifyOthers(
      superAdminId,
      statusChanged ? 'DEV_NOTE_STATUS' : 'DEV_NOTE_UPDATED',
      statusChanged ? 'Статус заметки изменён' : 'Заметка обновлена',
      note.title
    );
  }
  res.json({ success: true, data: serializeNote(note, superAdminId) });
});

export const deleteDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  const { id } = req.params;
  const existing = await prisma.superAdminDevNote.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }
  if (existing.deletedAt) {
    const full = await prisma.superAdminDevNote.findUnique({
      where: { id },
      include: { attachments: { select: { storagePath: true } } },
    });
    for (const a of full?.attachments || []) safeUnlink(a.storagePath);
    await prisma.superAdminDevNote.delete({ where: { id } });
    res.json({ success: true, data: { id, purged: true } });
    return;
  }
  const note = await prisma.superAdminDevNote.update({
    where: { id },
    data: { deletedAt: new Date(), activityAt: new Date(), lastEditedById: superAdminId },
    include: noteInclude,
  });
  res.json({ success: true, data: serializeNote(note, superAdminId) });
});

export const restoreDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  const { id } = req.params;
  const existing = await prisma.superAdminDevNote.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }
  const note = await prisma.superAdminDevNote.update({
    where: { id },
    data: { deletedAt: null, activityAt: new Date(), lastEditedById: superAdminId },
    include: noteInclude,
  });
  res.json({ success: true, data: serializeNote(note, superAdminId) });
});

export const markDevNoteRead = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }
  const { id } = req.params;
  const existing = await prisma.superAdminDevNote.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }
  await prisma.superAdminDevNoteRead.upsert({
    where: { noteId_superAdminId: { noteId: id, superAdminId } },
    create: { noteId: id, superAdminId, readAt: new Date() },
    update: { readAt: new Date() },
  });
  const note = await prisma.superAdminDevNote.findUnique({ where: { id }, include: noteInclude });
  res.json({ success: true, data: serializeNote(note, superAdminId) });
});

export const addDevNoteComment = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }
  const { id } = req.params;
  const body = String(req.body?.body || '').trim();
  if (!body) {
    res.status(400).json({ success: false, error: 'Введите сообщение' });
    return;
  }
  const existing = await prisma.superAdminDevNote.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }
  await prisma.superAdminDevNoteComment.create({
    data: { noteId: id, authorId: superAdminId, body },
  });
  const note = await prisma.superAdminDevNote.update({
    where: { id },
    data: { activityAt: new Date(), lastEditedById: superAdminId },
    include: noteInclude,
  });
  await notifyOthers(superAdminId, 'DEV_NOTE_COMMENT', 'Новое сообщение в обсуждении', existing.title);
  res.status(201).json({ success: true, data: serializeNote(note, superAdminId) });
});

export const listSaNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.json({ success: true, data: [] });
    return;
  }
  const rows = await prisma.superAdminNotification.findMany({
    where: { recipientId: superAdminId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json({ success: true, data: rows });
});

export const markSaNotificationsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
    return;
  }
  await prisma.superAdminNotification.updateMany({
    where: { recipientId: superAdminId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ success: true, data: { ok: true } });
});

/**
 * POST /admin-dashboard/dev-notes/:id/attachments
 */
export const uploadDevNoteAttachments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const superAdminId = getSuperAdminId(req);
    if (!superAdminId) {
      res.status(401).json({ success: false, error: 'Требуются права супер-администратора' });
      return;
    }

    const noteId = String(req.params.id);
    const note = await prisma.superAdminDevNote.findUnique({ where: { id: noteId } });
    if (!note) {
      res.status(404).json({ success: false, error: 'Заметка не найдена' });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      res.status(400).json({ success: false, error: 'Файлы не загружены' });
      return;
    }

    const created = [];
    for (const file of files) {
      const storagePath = path.join('dev-notes', file.filename).replace(/\\/g, '/');
      const row = await prisma.superAdminDevNoteAttachment.create({
        data: {
          noteId,
          originalName: decodeUploadOriginalName(file.originalname),
          storagePath,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
          createdById: superAdminId,
        },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          createdById: true,
        },
      });
      created.push({
        ...row,
        originalName: decodeUploadOriginalName(row.originalName),
      });
    }

    await prisma.superAdminDevNote.update({
      where: { id: noteId },
      data: { activityAt: new Date(), lastEditedById: superAdminId },
    });

    res.status(201).json({ success: true, data: created });
  }
);

/**
 * GET /admin-dashboard/dev-notes/:id/attachments/:attachmentId/download
 */
export const downloadDevNoteAttachment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const noteId = String(req.params.id);
    const attachmentId = String(req.params.attachmentId);
    const attachment = await prisma.superAdminDevNoteAttachment.findFirst({
      where: { id: attachmentId, noteId },
    });
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Файл не найден' });
      return;
    }

    const abs = absoluteUploadPath(attachment.storagePath);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
      return;
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', contentDispositionAttachment(attachment.originalName));
    fs.createReadStream(abs).pipe(res);
  }
);

/**
 * DELETE /admin-dashboard/dev-notes/:id/attachments/:attachmentId
 */
export const deleteDevNoteAttachment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const noteId = String(req.params.id);
    const attachmentId = String(req.params.attachmentId);
    const attachment = await prisma.superAdminDevNoteAttachment.findFirst({
      where: { id: attachmentId, noteId },
    });
    if (!attachment) {
      res.status(404).json({ success: false, error: 'Файл не найден' });
      return;
    }

    safeUnlink(attachment.storagePath);
    await prisma.superAdminDevNoteAttachment.delete({ where: { id: attachmentId } });
    res.json({ success: true, data: { id: attachmentId } });
  }
);
