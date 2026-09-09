import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { PlatformEventIntervalUnit } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const INTERVAL_UNITS: PlatformEventIntervalUnit[] = ['NONE', 'DAY', 'WEEK', 'MONTH', 'YEAR'];

function getSuperAdminId(req: AuthenticatedRequest): string | null {
  return (req as any).superAdmin?.id || null;
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addInterval(date: Date, unit: PlatformEventIntervalUnit, count: number): Date {
  const next = new Date(date.getTime());
  switch (unit) {
    case 'DAY':
      next.setUTCDate(next.getUTCDate() + count);
      break;
    case 'WEEK':
      next.setUTCDate(next.getUTCDate() + count * 7);
      break;
    case 'MONTH': {
      const day = next.getUTCDate();
      next.setUTCMonth(next.getUTCMonth() + count);
      // clamp day overflow (e.g. Jan 31 + 1 month)
      if (next.getUTCDate() < day) {
        next.setUTCDate(0);
      }
      break;
    }
    case 'YEAR': {
      const day = next.getUTCDate();
      next.setUTCFullYear(next.getUTCFullYear() + count);
      if (next.getUTCDate() < day) {
        next.setUTCDate(0);
      }
      break;
    }
    default:
      break;
  }
  return next;
}

export type PlannerOccurrence = {
  occurrenceAt: string;
  event: {
    id: string;
    title: string;
    notes: string | null;
    startAt: string;
    allDay: boolean;
    intervalUnit: PlatformEventIntervalUnit;
    intervalCount: number;
    seriesEndAt: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: { id: string; firstName: string; lastName: string; email: string };
  };
};

/**
 * Разворачивает серию событий в вхождения внутри [rangeFrom, rangeTo].
 */
export function expandOccurrences(
  event: {
    id: string;
    title: string;
    notes: string | null;
    startAt: Date;
    allDay: boolean;
    intervalUnit: PlatformEventIntervalUnit;
    intervalCount: number;
    seriesEndAt: Date | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { id: string; firstName: string; lastName: string; email: string };
  },
  rangeFrom: Date,
  rangeTo: Date
): PlannerOccurrence[] {
  const result: PlannerOccurrence[] = [];
  const serialize = (occurrenceAt: Date): PlannerOccurrence => ({
    occurrenceAt: occurrenceAt.toISOString(),
    event: {
      id: event.id,
      title: event.title,
      notes: event.notes,
      startAt: event.startAt.toISOString(),
      allDay: event.allDay,
      intervalUnit: event.intervalUnit,
      intervalCount: event.intervalCount,
      seriesEndAt: event.seriesEndAt ? event.seriesEndAt.toISOString() : null,
      createdById: event.createdById,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      createdBy: event.createdBy,
    },
  });

  const hardEnd =
    event.seriesEndAt && event.seriesEndAt.getTime() < rangeTo.getTime()
      ? event.seriesEndAt
      : rangeTo;

  if (event.intervalUnit === 'NONE' || event.intervalCount < 1) {
    if (event.startAt >= rangeFrom && event.startAt <= rangeTo) {
      result.push(serialize(event.startAt));
    }
    return result;
  }

  let cursor = new Date(event.startAt.getTime());
  // skip forward until near range (cap iterations)
  let guard = 0;
  while (cursor < rangeFrom && guard < 5000) {
    cursor = addInterval(cursor, event.intervalUnit, event.intervalCount);
    guard += 1;
    if (event.seriesEndAt && cursor > event.seriesEndAt) {
      return result;
    }
  }

  guard = 0;
  while (cursor <= hardEnd && guard < 2000) {
    if (cursor >= rangeFrom) {
      result.push(serialize(cursor));
    }
    cursor = addInterval(cursor, event.intervalUnit, event.intervalCount);
    guard += 1;
    if (event.seriesEndAt && cursor > event.seriesEndAt) break;
  }

  return result;
}

/**
 * GET /admin-dashboard/planner/events?from=&to=
 */
export const listPlannerEvents = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const rangeFrom = parseDate(req.query.from) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rangeTo =
      parseDate(req.query.to) ||
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    if (rangeFrom > rangeTo) {
      res.status(400).json({ success: false, error: 'from должен быть раньше to' });
      return;
    }

    // Берём разовые в окне + все повторяющиеся, которые могли начаться до окна
    const events = await prisma.platformCalendarEvent.findMany({
      where: {
        OR: [
          {
            intervalUnit: 'NONE',
            startAt: { gte: rangeFrom, lte: rangeTo },
          },
          {
            intervalUnit: { not: 'NONE' },
            startAt: { lte: rangeTo },
            OR: [{ seriesEndAt: null }, { seriesEndAt: { gte: rangeFrom } }],
          },
        ],
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    const occurrences = events
      .flatMap((ev) => expandOccurrences(ev, rangeFrom, rangeTo))
      .sort((a, b) => a.occurrenceAt.localeCompare(b.occurrenceAt));

    res.json({
      success: true,
      data: {
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
        occurrences,
        series: events,
      },
    });
  }
);

/**
 * POST /admin-dashboard/planner/events
 */
export const createPlannerEvent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const superAdminId = getSuperAdminId(req);
    if (!superAdminId) {
      res.status(401).json({ success: false, error: 'Super admin required' });
      return;
    }

    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ success: false, error: 'Укажите заголовок' });
      return;
    }

    const startAt = parseDate(req.body?.startAt);
    if (!startAt) {
      res.status(400).json({ success: false, error: 'Укажите корректную дату' });
      return;
    }

    const notes =
      req.body?.notes != null ? String(req.body.notes).trim() || null : null;
    const allDay = req.body?.allDay !== false;
    const unitRaw = String(req.body?.intervalUnit || 'NONE').toUpperCase();
    const intervalUnit = INTERVAL_UNITS.includes(unitRaw as PlatformEventIntervalUnit)
      ? (unitRaw as PlatformEventIntervalUnit)
      : 'NONE';
    let intervalCount = Math.max(1, parseInt(String(req.body?.intervalCount || 1), 10) || 1);
    if (intervalUnit === 'NONE') intervalCount = 1;

    const seriesEndAt =
      intervalUnit === 'NONE' ? null : parseDate(req.body?.seriesEndAt);

    if (seriesEndAt && seriesEndAt < startAt) {
      res.status(400).json({ success: false, error: 'Конец серии не может быть раньше начала' });
      return;
    }

    const event = await prisma.platformCalendarEvent.create({
      data: {
        title,
        notes,
        startAt,
        allDay,
        intervalUnit,
        intervalCount,
        seriesEndAt,
        createdById: superAdminId,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.status(201).json({ success: true, data: event });
  }
);

/**
 * PUT /admin-dashboard/planner/events/:id
 */
export const updatePlannerEvent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const id = String(req.params.id);
    const existing = await prisma.platformCalendarEvent.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Событие не найдено' });
      return;
    }

    const data: Record<string, unknown> = {};

    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) {
        res.status(400).json({ success: false, error: 'Укажите заголовок' });
        return;
      }
      data.title = title;
    }
    if (req.body?.notes !== undefined) {
      data.notes =
        req.body.notes == null ? null : String(req.body.notes).trim() || null;
    }
    if (req.body?.startAt != null) {
      const startAt = parseDate(req.body.startAt);
      if (!startAt) {
        res.status(400).json({ success: false, error: 'Укажите корректную дату' });
        return;
      }
      data.startAt = startAt;
    }
    if (req.body?.allDay !== undefined) {
      data.allDay = Boolean(req.body.allDay);
    }
    if (req.body?.intervalUnit != null) {
      const unitRaw = String(req.body.intervalUnit).toUpperCase();
      if (!INTERVAL_UNITS.includes(unitRaw as PlatformEventIntervalUnit)) {
        res.status(400).json({ success: false, error: 'Некорректный интервал' });
        return;
      }
      data.intervalUnit = unitRaw;
      if (unitRaw === 'NONE') {
        data.intervalCount = 1;
        data.seriesEndAt = null;
      }
    }
    if (req.body?.intervalCount != null) {
      const unitForCount =
        (data.intervalUnit as PlatformEventIntervalUnit | undefined) || existing.intervalUnit;
      if (unitForCount !== 'NONE') {
        data.intervalCount = Math.max(1, parseInt(String(req.body.intervalCount), 10) || 1);
      }
    }
    if (req.body?.seriesEndAt !== undefined) {
      const unit = (data.intervalUnit as PlatformEventIntervalUnit) || existing.intervalUnit;
      if (unit === 'NONE' || req.body.seriesEndAt == null || req.body.seriesEndAt === '') {
        data.seriesEndAt = null;
      } else {
        const seriesEndAt = parseDate(req.body.seriesEndAt);
        if (!seriesEndAt) {
          res.status(400).json({ success: false, error: 'Некорректная дата конца серии' });
          return;
        }
        data.seriesEndAt = seriesEndAt;
      }
    }

    const startAt = (data.startAt as Date) || existing.startAt;
    const seriesEndAt =
      data.seriesEndAt !== undefined
        ? (data.seriesEndAt as Date | null)
        : existing.seriesEndAt;
    if (seriesEndAt && seriesEndAt < startAt) {
      res.status(400).json({ success: false, error: 'Конец серии не может быть раньше начала' });
      return;
    }

    const event = await prisma.platformCalendarEvent.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json({ success: true, data: event });
  }
);

/**
 * DELETE /admin-dashboard/planner/events/:id
 */
export const deletePlannerEvent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const id = String(req.params.id);
    const existing = await prisma.platformCalendarEvent.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Событие не найдено' });
      return;
    }
    await prisma.platformCalendarEvent.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);
