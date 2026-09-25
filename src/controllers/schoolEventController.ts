import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types';

const EVENT_TYPES = ['parent_meeting', 'other'] as const;

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

/** Поддержка и groupIds[], и legacy groupId. */
function resolveGroupIds(body: any): string[] {
  if (body.groupIds !== undefined) return asIdArray(body.groupIds);
  if (body.groupId) return asIdArray([body.groupId]);
  return [];
}

const schoolEventInclude = {
  branch: { select: { id: true, name: true } },
  groups: {
    include: {
      group: { select: { id: true, name: true, color: true } },
    },
  },
  participants: {
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
    },
  },
  parents: {
    include: {
      parent: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          relationType: true,
          clientId: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
            },
          },
        },
      },
    },
  },
  trainers: {
    include: {
      trainer: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
            },
          },
        },
      },
    },
  },
} as const;

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
      include: schoolEventInclude,
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
      include: schoolEventInclude,
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

    const groupIds = resolveGroupIds(req.body);
    const participantIds = asIdArray(req.body.participantIds);
    const parentIds = asIdArray(req.body.parentIds);
    const trainerIds = asIdArray(req.body.trainerIds);

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
        groups: {
          create: groupIds.map((groupId) => ({ groupId, tenantId })),
        },
        participants: {
          create: participantIds.map((clientId) => ({ clientId, tenantId })),
        },
        parents: {
          create: parentIds.map((parentId) => ({ parentId, tenantId })),
        },
        trainers: {
          create: trainerIds.map((trainerId) => ({ trainerId, tenantId })),
        },
      },
      include: schoolEventInclude,
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

    const start = data.startTime || existing.startTime;
    const end = data.endTime || existing.endTime;
    if (end <= start) {
      res.status(400).json({ success: false, error: 'Время окончания должно быть позже начала' });
      return;
    }

    const replaceGroups =
      req.body.groupIds !== undefined || req.body.groupId !== undefined;

    const event = await prisma.$transaction(async (tx) => {
      if (replaceGroups) {
        const groupIds = resolveGroupIds(req.body);
        await tx.schoolEventGroup.deleteMany({ where: { schoolEventId: existing.id } });
        if (groupIds.length > 0) {
          await tx.schoolEventGroup.createMany({
            data: groupIds.map((groupId) => ({
              schoolEventId: existing.id,
              groupId,
              tenantId,
            })),
          });
        }
      }

      if (req.body.participantIds !== undefined) {
        const participantIds = asIdArray(req.body.participantIds);
        await tx.schoolEventParticipant.deleteMany({ where: { schoolEventId: existing.id } });
        if (participantIds.length > 0) {
          await tx.schoolEventParticipant.createMany({
            data: participantIds.map((clientId) => ({
              schoolEventId: existing.id,
              clientId,
              tenantId,
            })),
          });
        }
      }

      if (req.body.parentIds !== undefined) {
        const parentIds = asIdArray(req.body.parentIds);
        await tx.schoolEventParent.deleteMany({ where: { schoolEventId: existing.id } });
        if (parentIds.length > 0) {
          await tx.schoolEventParent.createMany({
            data: parentIds.map((parentId) => ({
              schoolEventId: existing.id,
              parentId,
              tenantId,
            })),
          });
        }
      }

      if (req.body.trainerIds !== undefined) {
        const trainerIds = asIdArray(req.body.trainerIds);
        await tx.schoolEventTrainer.deleteMany({ where: { schoolEventId: existing.id } });
        if (trainerIds.length > 0) {
          await tx.schoolEventTrainer.createMany({
            data: trainerIds.map((trainerId) => ({
              schoolEventId: existing.id,
              trainerId,
              tenantId,
            })),
          });
        }
      }

      return tx.schoolEvent.update({
        where: { id: existing.id },
        data,
        include: schoolEventInclude,
      });
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
