import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

const EVENT_TYPES = ['parent_meeting', 'other'] as const;

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const getSchoolEvents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const { startDate, endDate, type } = req.query;
    const where: any = { tenantId };

    if (startDate || endDate) {
      where.startTime = {
        ...(startDate ? { gte: new Date(startDate as string) } : {}),
        ...(endDate ? { lte: new Date(endDate as string) } : {}),
      };
    }

    if (type && typeof type === 'string') {
      where.type = type;
    }

    const events = await prisma.schoolEvent.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, color: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ success: true, data: events });
  } catch (err: any) {
    console.error('getSchoolEvents error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to get events' });
  }
};

export const getSchoolEventById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const event = await prisma.schoolEvent.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, color: true } },
      },
    });

    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    res.json({ success: true, data: event });
  } catch (err: any) {
    console.error('getSchoolEventById error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to get event' });
  }
};

export const createSchoolEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const title = String(req.body.title || '').trim();
    const startTime = parseDate(req.body.startTime);
    const endTime = parseDate(req.body.endTime);
    const type = EVENT_TYPES.includes(req.body.type) ? req.body.type : 'other';

    if (!title) {
      res.status(400).json({ success: false, error: 'Укажите название события', field: 'title' });
      return;
    }
    if (!startTime || !endTime) {
      res.status(400).json({ success: false, error: 'Укажите начало и конец события' });
      return;
    }
    if (endTime <= startTime) {
      res.status(400).json({ success: false, error: 'Время окончания должно быть позже начала' });
      return;
    }

    const event = await prisma.schoolEvent.create({
      data: {
        tenantId,
        title,
        description: req.body.description?.trim() || null,
        type,
        startTime,
        endTime,
        location: req.body.location?.trim() || null,
        branchId: req.body.branchId || null,
        groupId: req.body.groupId || null,
      },
      include: {
        branch: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, color: true } },
      },
    });

    res.status(201).json({ success: true, data: event });
  } catch (err: any) {
    console.error('createSchoolEvent error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to create event' });
  }
};

export const updateSchoolEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const existing = await prisma.schoolEvent.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    const data: any = {};
    if (req.body.title !== undefined) {
      const title = String(req.body.title || '').trim();
      if (!title) {
        res.status(400).json({ success: false, error: 'Укажите название события', field: 'title' });
        return;
      }
      data.title = title;
    }
    if (req.body.description !== undefined) {
      data.description = req.body.description?.trim() || null;
    }
    if (req.body.type !== undefined) {
      data.type = EVENT_TYPES.includes(req.body.type) ? req.body.type : existing.type;
    }
    if (req.body.startTime !== undefined) {
      const startTime = parseDate(req.body.startTime);
      if (!startTime) {
        res.status(400).json({ success: false, error: 'Некорректное время начала' });
        return;
      }
      data.startTime = startTime;
    }
    if (req.body.endTime !== undefined) {
      const endTime = parseDate(req.body.endTime);
      if (!endTime) {
        res.status(400).json({ success: false, error: 'Некорректное время окончания' });
        return;
      }
      data.endTime = endTime;
    }
    if (req.body.location !== undefined) {
      data.location = req.body.location?.trim() || null;
    }
    if (req.body.branchId !== undefined) {
      data.branchId = req.body.branchId || null;
    }
    if (req.body.groupId !== undefined) {
      data.groupId = req.body.groupId || null;
    }

    const start = data.startTime || existing.startTime;
    const end = data.endTime || existing.endTime;
    if (end <= start) {
      res.status(400).json({ success: false, error: 'Время окончания должно быть позже начала' });
      return;
    }

    const event = await prisma.schoolEvent.update({
      where: { id: existing.id },
      data,
      include: {
        branch: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, color: true } },
      },
    });

    res.json({ success: true, data: event });
  } catch (err: any) {
    console.error('updateSchoolEvent error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update event' });
  }
};

export const deleteSchoolEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const existing = await prisma.schoolEvent.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    await prisma.schoolEvent.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Event deleted' });
  } catch (err: any) {
    console.error('deleteSchoolEvent error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to delete event' });
  }
};
