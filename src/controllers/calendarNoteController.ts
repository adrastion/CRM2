import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, forbidden, notFound } from '../utils/httpError';

function requireTenantUser(req: AuthenticatedRequest) {
  if (!req.tenant?.id || !req.user?.id) {
    throw badRequest('Требуется авторизация сотрудника школы');
  }
  return { tenantId: req.tenant.id, userId: req.user.id, role: req.user.role };
}

const noteInclude = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true, middleName: true, role: true },
  },
} as const;

export const listCalendarNotes = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireTenantUser(req);
    const trainingId = req.query.trainingId ? String(req.query.trainingId) : undefined;
    const schoolEventId = req.query.schoolEventId ? String(req.query.schoolEventId) : undefined;
    const competitionId = req.query.competitionId ? String(req.query.competitionId) : undefined;

    if (!trainingId && !schoolEventId && !competitionId) {
      throw badRequest('Укажите trainingId, schoolEventId или competitionId');
    }

    const notes = await prisma.calendarNote.findMany({
      where: {
        tenantId,
        ...(trainingId ? { trainingId } : {}),
        ...(schoolEventId ? { schoolEventId } : {}),
        ...(competitionId ? { competitionId } : {}),
      },
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: notes });
  }
);

export const createCalendarNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireTenantUser(req);
    const body = String(req.body?.body || '').trim();
    if (!body) throw badRequest('Укажите текст заметки', 'body');

    const trainingId = req.body?.trainingId ? String(req.body.trainingId) : null;
    const schoolEventId = req.body?.schoolEventId ? String(req.body.schoolEventId) : null;
    const competitionId = req.body?.competitionId ? String(req.body.competitionId) : null;

    const links = [trainingId, schoolEventId, competitionId].filter(Boolean);
    if (links.length !== 1) {
      throw badRequest('Укажите ровно одну связь: trainingId, schoolEventId или competitionId');
    }

    if (trainingId) {
      const t = await prisma.training.findFirst({ where: { id: trainingId, tenantId }, select: { id: true } });
      if (!t) throw badRequest('Тренировка не найдена', 'trainingId');
    }
    if (schoolEventId) {
      const e = await prisma.schoolEvent.findFirst({
        where: { id: schoolEventId, tenantId },
        select: { id: true },
      });
      if (!e) throw badRequest('Событие не найдено', 'schoolEventId');
    }
    if (competitionId) {
      const c = await prisma.competition.findFirst({
        where: { id: competitionId, tenantId },
        select: { id: true },
      });
      if (!c) throw badRequest('Соревнование не найдено', 'competitionId');
    }

    const note = await prisma.calendarNote.create({
      data: {
        tenantId,
        body,
        trainingId,
        schoolEventId,
        competitionId,
        createdByUserId: userId,
      },
      include: noteInclude,
    });

    res.status(201).json({ success: true, data: note });
  }
);

export const updateCalendarNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const existing = await prisma.calendarNote.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Заметка не найдена');
    if (role !== 'OWNER' && existing.createdByUserId !== userId) {
      throw forbidden('Редактировать заметку может владелец или автор');
    }

    const body = String(req.body?.body || '').trim();
    if (!body) throw badRequest('Укажите текст заметки', 'body');

    const note = await prisma.calendarNote.update({
      where: { id },
      data: { body },
      include: noteInclude,
    });

    res.json({ success: true, data: note });
  }
);

export const deleteCalendarNote = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const existing = await prisma.calendarNote.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Заметка не найдена');
    if (role !== 'OWNER' && existing.createdByUserId !== userId) {
      throw forbidden('Удалить заметку может владелец или автор');
    }

    await prisma.calendarNote.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);
