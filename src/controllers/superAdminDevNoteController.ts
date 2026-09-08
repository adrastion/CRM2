import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { DevNoteStatus } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const STATUS_ORDER: DevNoteStatus[] = ['IDEA', 'IN_PROGRESS', 'DONE'];

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
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });

  // IDEA → IN_PROGRESS → DONE (Prisma enum order may not match)
  notes.sort((a, b) => {
    const sa = STATUS_ORDER.indexOf(a.status);
    const sb = STATUS_ORDER.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  res.json({ success: true, data: notes });
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
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
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
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  res.json({ success: true, data: note });
});

/**
 * DELETE /admin-dashboard/dev-notes/:id
 */
export const deleteDevNote = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const existing = await prisma.superAdminDevNote.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Заметка не найдена' });
    return;
  }

  await prisma.superAdminDevNote.delete({ where: { id } });
  res.json({ success: true, data: { id } });
});
