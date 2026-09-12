import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, forbidden, notFound } from '../utils/httpError';

const VIS = new Set(['PERSONAL', 'SHARED']);

function requireTenantUser(req: AuthenticatedRequest) {
  if (!req.tenant?.id || !req.user?.id) {
    throw badRequest('Требуется авторизация сотрудника школы');
  }
  return { tenantId: req.tenant.id, userId: req.user.id, role: req.user.role };
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
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, middleName: true, role: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ success: true, data: notes });
  }
);

export const createStaffNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireTenantUser(req);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const visibility = String(req.body?.visibility || 'PERSONAL').toUpperCase();

    if (!title) throw badRequest('Укажите заголовок', 'title');
    if (!VIS.has(visibility)) throw badRequest('visibility: PERSONAL или SHARED', 'visibility');

    const note = await prisma.staffNote.create({
      data: {
        tenantId,
        authorUserId: userId,
        visibility,
        title,
        body,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, middleName: true, role: true },
        },
      },
    });

    res.status(201).json({ success: true, data: note });
  }
);

export const updateStaffNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const existing = await prisma.staffNote.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Заметка не найдена');

    const isOwner = role === 'OWNER';
    const isAuthor = existing.authorUserId === userId;
    if (existing.visibility === 'PERSONAL' && !isAuthor) {
      throw forbidden('Личную заметку может править только автор');
    }
    if (existing.visibility === 'SHARED' && !isAuthor && !isOwner) {
      throw forbidden('Общую заметку может править автор или владелец');
    }

    const data: { title?: string; body?: string; visibility?: string } = {};
    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) throw badRequest('Укажите заголовок', 'title');
      data.title = title;
    }
    if (req.body?.body != null) data.body = String(req.body.body);
    if (req.body?.visibility != null) {
      const visibility = String(req.body.visibility).toUpperCase();
      if (!VIS.has(visibility)) throw badRequest('visibility: PERSONAL или SHARED', 'visibility');
      if (!isAuthor) throw forbidden('Менять видимость может только автор');
      data.visibility = visibility;
    }

    const note = await prisma.staffNote.update({
      where: { id },
      data,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, middleName: true, role: true },
        },
      },
    });

    res.json({ success: true, data: note });
  }
);

export const deleteStaffNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const existing = await prisma.staffNote.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Заметка не найдена');

    const isOwner = role === 'OWNER';
    const isAuthor = existing.authorUserId === userId;
    if (existing.visibility === 'PERSONAL' && !isAuthor) {
      throw forbidden('Личную заметку может удалить только автор');
    }
    if (existing.visibility === 'SHARED' && !isAuthor && !isOwner) {
      throw forbidden('Общую заметку может удалить автор или владелец');
    }

    await prisma.staffNote.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);
