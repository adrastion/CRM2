import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { DevNoteStatus } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';
import { absoluteUploadPath, safeUnlink, decodeUploadOriginalName, contentDispositionAttachment } from '../utils/fileStorage';

const STATUS_ORDER: DevNoteStatus[] = ['IDEA', 'IN_PROGRESS', 'DONE'];

const noteInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
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
};

function getSuperAdminId(req: AuthenticatedRequest): string | null {
  return (req as any).superAdmin?.id || null;
}

/**
 * GET /admin-dashboard/dev-notes
 */
export const listDevNotes = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const statusFilter = req.query.status ? String(req.query.status) : null;
  const where =
    statusFilter && STATUS_ORDER.includes(statusFilter as DevNoteStatus)
      ? { status: statusFilter as DevNoteStatus }
      : {};

  const notes = await prisma.superAdminDevNote.findMany({
    where,
    include: noteInclude,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });

  notes.sort((a, b) => {
    const sa = STATUS_ORDER.indexOf(a.status);
    const sb = STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const withFixedNames = notes.map((n) => ({
    ...n,
    attachments: (n.attachments || []).map((a) => ({
      ...a,
      originalName: decodeUploadOriginalName(a.originalName),
    })),
  }));

  res.json({ success: true, data: withFixedNames });
});

/**
 * POST /admin-dashboard/dev-notes
 */
export const createDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const superAdminId = getSuperAdminId(req);
  if (!superAdminId) {
    res.status(401).json({ success: false, error: 'Super admin required' });
    return;
  }

  const title = String(req.body?.title || '').trim();
  const description =
    req.body?.description != null ? String(req.body.description).trim() || null : null;
  const statusRaw = String(req.body?.status || 'IDEA');
  const status = STATUS_ORDER.includes(statusRaw as DevNoteStatus)
    ? (statusRaw as DevNoteStatus)
    : 'IDEA';

  if (!title) {
    res.status(400).json({ success: false, error: 'Укажите заголовок' });
    return;
  }

  const note = await prisma.superAdminDevNote.create({
    data: {
      title,
      description,
      status,
      createdById: superAdminId,
    },
    include: noteInclude,
  });

  res.status(201).json({ success: true, data: note });
});

/**
 * PUT /admin-dashboard/dev-notes/:id
 */
export const updateDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const existing = await prisma.superAdminDevNote.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }

  const data: {
    title?: string;
    description?: string | null;
    status?: DevNoteStatus;
  } = {};

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
  if (req.body?.status !== undefined) {
    const statusRaw = String(req.body.status);
    if (!STATUS_ORDER.includes(statusRaw as DevNoteStatus)) {
      res.status(400).json({ success: false, error: 'Некорректный статус' });
      return;
    }
    data.status = statusRaw as DevNoteStatus;
  }

  const note = await prisma.superAdminDevNote.update({
    where: { id },
    data,
    include: noteInclude,
  });

  res.json({ success: true, data: note });
});

/**
 * DELETE /admin-dashboard/dev-notes/:id
 */
export const deleteDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const existing = await prisma.superAdminDevNote.findUnique({
    where: { id },
    include: { attachments: { select: { storagePath: true } } },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }

  for (const a of existing.attachments) {
    safeUnlink(a.storagePath);
  }

  await prisma.superAdminDevNote.delete({ where: { id } });
  res.json({ success: true, data: { id } });
});

/**
 * POST /admin-dashboard/dev-notes/:id/attachments
 */
export const uploadDevNoteAttachments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const superAdminId = getSuperAdminId(req);
    if (!superAdminId) {
      res.status(401).json({ success: false, error: 'Super admin required' });
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
