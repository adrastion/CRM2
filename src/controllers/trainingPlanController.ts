import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
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
import {
  assertGroupsAccessible,
  resolveAccessibleGroupIdsForTrainingPlan,
} from '../services/trainingPlanAccess';

function requireCtx(req: AuthenticatedRequest) {
  if (!req.tenant?.id || !req.user?.id) throw badRequest('Требуется авторизация');
  return { tenantId: req.tenant.id, userId: req.user.id, user: req.user };
}

const exerciseInclude = {
  media: { orderBy: { sortOrder: 'asc' as const } },
  createdBy: {
    select: { id: true, firstName: true, lastName: true, middleName: true },
  },
};

const templateInclude = {
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      exercise: {
        select: { id: true, title: true, description: true },
      },
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
};

const planInclude = {
  items: {
    orderBy: [{ section: 'asc' as const }, { sortOrder: 'asc' as const }],
    include: {
      exercise: {
        select: {
          id: true,
          title: true,
          description: true,
          media: { orderBy: { sortOrder: 'asc' as const }, take: 3 },
        },
      },
    },
  },
};

// ——— Exercises ———

export const listExercises = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const q = req.query.q ? String(req.query.q).trim() : '';
    const rows = await prisma.exercise.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: exerciseInclude,
      orderBy: { title: 'asc' },
    });
    res.json({ success: true, data: rows });
  }
);

export const createExercise = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireCtx(req);
    const title = String(req.body?.title || '').trim();
    if (!title) throw badRequest('Укажите название', 'title');
    const description = String(req.body?.description || '');
    const row = await prisma.exercise.create({
      data: { tenantId, createdByUserId: userId, title, description },
      include: exerciseInclude,
    });
    res.status(201).json({ success: true, data: row });
  }
);

export const updateExercise = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { id } = req.params;
    const existing = await prisma.exercise.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Упражнение не найдено');
    const data: { title?: string; description?: string } = {};
    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) throw badRequest('Укажите название', 'title');
      data.title = title;
    }
    if (req.body?.description != null) data.description = String(req.body.description);
    const row = await prisma.exercise.update({
      where: { id },
      data,
      include: exerciseInclude,
    });
    res.json({ success: true, data: row });
  }
);

export const deleteExercise = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { id } = req.params;
    const existing = await prisma.exercise.findFirst({
      where: { id, tenantId },
      include: { media: true },
    });
    if (!existing) throw notFound('Упражнение не найдено');
    for (const m of existing.media) safeUnlink(m.storagePath);
    await prisma.exercise.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm']);

export const exerciseMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const tenantId = (req as AuthenticatedRequest).tenant?.id;
        if (!tenantId) return cb(new Error('No tenant'), '');
        cb(null, ensureUploadDir('exercise-media', tenantId));
      } catch (e: any) {
        cb(e, '');
      }
    },
    filename: (_req, file, cb) => {
      cb(null, uniqueUploadFilename(decodeUploadOriginalName(file.originalname)));
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.has(file.mimetype) || VIDEO_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Допустимы изображения и видео (mp4/webm)'));
  },
});

export const uploadExerciseMedia = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { id } = req.params;
    const exercise = await prisma.exercise.findFirst({ where: { id, tenantId } });
    if (!exercise) throw notFound('Упражнение не найдено');
    const file = req.file;
    if (!file) throw badRequest('Файл не загружен');
    if (IMAGE_MIME.has(file.mimetype) && file.size > 10 * 1024 * 1024) {
      safeUnlink(path.join('exercise-media', tenantId, file.filename).replace(/\\/g, '/'));
      throw badRequest('Картинка не больше 10 МБ');
    }
    const kind = VIDEO_MIME.has(file.mimetype) ? 'video' : 'image';
    const storagePath = path.join('exercise-media', tenantId, file.filename).replace(/\\/g, '/');
    const maxOrder = await prisma.exerciseMedia.aggregate({
      where: { exerciseId: id },
      _max: { sortOrder: true },
    });
    const media = await prisma.exerciseMedia.create({
      data: {
        exerciseId: id,
        kind,
        storagePath,
        mimeType: file.mimetype,
        originalName: decodeUploadOriginalName(file.originalname),
        sizeBytes: file.size,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    res.status(201).json({ success: true, data: media });
  }
);

export const deleteExerciseMedia = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { id, mediaId } = req.params;
    const media = await prisma.exerciseMedia.findFirst({
      where: { id: mediaId, exercise: { id, tenantId } },
    });
    if (!media) throw notFound('Файл не найден');
    safeUnlink(media.storagePath);
    await prisma.exerciseMedia.delete({ where: { id: mediaId } });
    res.json({ success: true, data: { id: mediaId } });
  }
);

export const getExerciseMediaFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { tenantId } = requireCtx(req);
    const { mediaId } = req.params;
    const media = await prisma.exerciseMedia.findFirst({
      where: { id: mediaId, exercise: { tenantId } },
    });
    if (!media) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    const abs = absoluteUploadPath(media.storagePath);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ success: false, error: 'File missing' });
      return;
    }
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(media.originalName)}`
    );
    fs.createReadStream(abs).pipe(res);
  }
);

// ——— Templates ———

export const listTemplates = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    const rows = await prisma.workoutTemplate.findMany({
      where: {
        tenantId,
        ...(kind ? { kind } : {}),
      },
      include: templateInclude,
      orderBy: [{ kind: 'asc' }, { title: 'asc' }],
    });
    res.json({ success: true, data: rows });
  }
);

export const createTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireCtx(req);
    const title = String(req.body?.title || '').trim();
    const kind = String(req.body?.kind || '').toUpperCase();
    if (!title) throw badRequest('Укажите название', 'title');
    if (!['WARMUP', 'WORKOUT'].includes(kind)) {
      throw badRequest('kind: WARMUP | WORKOUT', 'kind');
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const row = await prisma.workoutTemplate.create({
      data: {
        tenantId,
        createdByUserId: userId,
        title,
        kind,
        items: {
          create: items.map((it: any, idx: number) => ({
            exerciseId: String(it.exerciseId),
            sortOrder: it.sortOrder ?? idx,
            durationSec: it.durationSec != null ? Number(it.durationSec) : null,
            sets: it.sets != null ? Number(it.sets) : null,
            reps: it.reps != null ? Number(it.reps) : null,
            notes: it.notes != null ? String(it.notes) : null,
          })),
        },
      },
      include: templateInclude,
    });
    res.status(201).json({ success: true, data: row });
  }
);

export const updateTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { id } = req.params;
    const existing = await prisma.workoutTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Шаблон не найден');

    const data: { title?: string; kind?: string } = {};
    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) throw badRequest('Укажите название', 'title');
      data.title = title;
    }
    if (req.body?.kind != null) {
      const kind = String(req.body.kind).toUpperCase();
      if (!['WARMUP', 'WORKOUT'].includes(kind)) throw badRequest('kind: WARMUP | WORKOUT');
      data.kind = kind;
    }

    if (Array.isArray(req.body?.items)) {
      await prisma.workoutTemplateItem.deleteMany({ where: { templateId: id } });
      await prisma.workoutTemplateItem.createMany({
        data: req.body.items.map((it: any, idx: number) => ({
          templateId: id,
          exerciseId: String(it.exerciseId),
          sortOrder: it.sortOrder ?? idx,
          durationSec: it.durationSec != null ? Number(it.durationSec) : null,
          sets: it.sets != null ? Number(it.sets) : null,
          reps: it.reps != null ? Number(it.reps) : null,
          notes: it.notes != null ? String(it.notes) : null,
        })),
      });
    }

    const row = await prisma.workoutTemplate.update({
      where: { id },
      data,
      include: templateInclude,
    });
    res.json({ success: true, data: row });
  }
);

export const deleteTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { id } = req.params;
    const existing = await prisma.workoutTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Шаблон не найден');
    await prisma.workoutTemplate.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);

// ——— Groups for cycle ———

export const listAccessibleGroups = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, user } = requireCtx(req);
    const access = await resolveAccessibleGroupIdsForTrainingPlan(user, tenantId);
    const groups = await prisma.group.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(access === 'all' ? {} : { id: { in: access } }),
      },
      select: {
        id: true,
        name: true,
        branchId: true,
        trainerId: true,
        color: true,
        branch: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: groups });
  }
);

// ——— Cycles ———

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function buildCyclePreview(tenantId: string, groupIds: string[], dateFrom: Date, dateTo: Date) {
  const from = startOfDay(dateFrom);
  const to = endOfDay(dateTo);
  const trainings = await prisma.training.findMany({
    where: {
      tenantId,
      isCancelled: false,
      groupId: { in: groupIds },
      startTime: { gte: from, lte: to },
    },
    include: {
      group: { select: { id: true, name: true, color: true } },
      sessionPlan: { select: { id: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  const byMonth: Record<string, number> = {};
  const byWeek: Record<string, number> = {};
  for (const t of trainings) {
    const d = t.startTime;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const weekStart = new Date(d);
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    const weekKey = weekStart.toISOString().slice(0, 10);
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
    byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;
  }

  return {
    total: trainings.length,
    byMonth,
    byWeek,
    trainings: trainings.map((t) => ({
      id: t.id,
      title: t.title,
      startTime: t.startTime,
      endTime: t.endTime,
      group: t.group,
      hasPlan: Boolean(t.sessionPlan),
    })),
  };
}

export const listCycles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, user } = requireCtx(req);
    const access = await resolveAccessibleGroupIdsForTrainingPlan(user, tenantId);
    const cycles = await prisma.trainingCycle.findMany({
      where: {
        tenantId,
        ...(access === 'all'
          ? {}
          : { groups: { some: { groupId: { in: access as string[] } } } }),
      },
      include: {
        groups: { include: { group: { select: { id: true, name: true, color: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { sessionPlans: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: cycles });
  }
);

export const createCycle = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, user } = requireCtx(req);
    const groupIds: string[] = Array.isArray(req.body?.groupIds)
      ? [...new Set((req.body.groupIds as unknown[]).map(String).filter(Boolean))]
      : [];
    if (!groupIds.length) throw badRequest('Выберите группы', 'groupIds');
    await assertGroupsAccessible(user, tenantId, groupIds).catch((e) => {
      throw forbidden(e.message || 'Нет доступа к группе');
    });

    const dateFrom = new Date(req.body?.dateFrom);
    const dateTo = new Date(req.body?.dateTo);
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      throw badRequest('Укажите корректный диапазон дат');
    }
    if (dateTo < dateFrom) throw badRequest('dateTo раньше dateFrom');

    const title = req.body?.title ? String(req.body.title).trim() : null;
    const cycle = await prisma.trainingCycle.create({
      data: {
        tenantId,
        createdByUserId: userId,
        title,
        dateFrom: startOfDay(dateFrom),
        dateTo: endOfDay(dateTo),
        groups: { create: groupIds.map((groupId) => ({ groupId })) },
      },
      include: {
        groups: { include: { group: { select: { id: true, name: true, color: true } } } },
      },
    });
    res.status(201).json({ success: true, data: cycle });
  }
);

export const getCycle = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, user } = requireCtx(req);
    const { id } = req.params;
    const cycle = await prisma.trainingCycle.findFirst({
      where: { id, tenantId },
      include: {
        groups: { include: { group: { select: { id: true, name: true, color: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!cycle) throw notFound('Цикл не найден');
    const groupIds = cycle.groups.map((g) => g.groupId);
    await assertGroupsAccessible(user, tenantId, groupIds).catch(() => {
      throw forbidden('Нет доступа');
    });
    const preview = await buildCyclePreview(tenantId, groupIds, cycle.dateFrom, cycle.dateTo);
    res.json({ success: true, data: { ...cycle, preview } });
  }
);

export const previewCycleDraft = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, user } = requireCtx(req);
    const groupIds: string[] = Array.isArray(req.body?.groupIds)
      ? [...new Set((req.body.groupIds as unknown[]).map(String).filter(Boolean))]
      : [];
    if (!groupIds.length) throw badRequest('Выберите группы');
    await assertGroupsAccessible(user, tenantId, groupIds).catch((e) => {
      throw forbidden(e.message || 'Нет доступа');
    });
    const dateFrom = new Date(req.body?.dateFrom);
    const dateTo = new Date(req.body?.dateTo);
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      throw badRequest('Укажите корректный диапазон дат');
    }
    const preview = await buildCyclePreview(tenantId, groupIds, dateFrom, dateTo);
    res.json({ success: true, data: preview });
  }
);

export const deleteCycle = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { id } = req.params;
    const existing = await prisma.trainingCycle.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Цикл не найден');
    await prisma.trainingCycle.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);

// ——— Session plans ———

export const getSessionPlanByTraining = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { trainingId } = req.params;
    const training = await prisma.training.findFirst({
      where: { id: trainingId, tenantId },
      select: { id: true },
    });
    if (!training) throw notFound('Тренировка не найдена');
    const plan = await prisma.trainingSessionPlan.findUnique({
      where: { trainingId },
      include: planInclude,
    });
    res.json({ success: true, data: plan });
  }
);

export const upsertSessionPlan = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { trainingId } = req.params;
    const training = await prisma.training.findFirst({
      where: { id: trainingId, tenantId },
      select: { id: true },
    });
    if (!training) throw notFound('Тренировка не найдена');

    const cycleId = req.body?.cycleId ? String(req.body.cycleId) : null;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    const plan = await prisma.$transaction(async (tx) => {
      const existing = await tx.trainingSessionPlan.findUnique({ where: { trainingId } });
      let planId: string;
      if (existing) {
        planId = existing.id;
        await tx.trainingSessionPlan.update({
          where: { id: planId },
          data: { cycleId },
        });
        await tx.trainingSessionPlanItem.deleteMany({ where: { planId } });
      } else {
        const created = await tx.trainingSessionPlan.create({
          data: { trainingId, cycleId },
        });
        planId = created.id;
      }
      if (items.length) {
        await tx.trainingSessionPlanItem.createMany({
          data: items.map((it: any, idx: number) => {
            const section = String(it.section || 'MAIN').toUpperCase();
            if (!['WARMUP', 'MAIN'].includes(section)) {
              throw badRequest('section: WARMUP | MAIN');
            }
            return {
              planId,
              section,
              exerciseId: String(it.exerciseId),
              sortOrder: it.sortOrder ?? idx,
              durationSec: it.durationSec != null ? Number(it.durationSec) : null,
              sets: it.sets != null ? Number(it.sets) : null,
              reps: it.reps != null ? Number(it.reps) : null,
              notes: it.notes != null ? String(it.notes) : null,
            };
          }),
        });
      }
      return tx.trainingSessionPlan.findUnique({
        where: { id: planId },
        include: planInclude,
      });
    });

    res.json({ success: true, data: plan });
  }
);

export const applyTemplateToSession = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireCtx(req);
    const { trainingId } = req.params;
    const templateId = String(req.body?.templateId || '');
    const sectionRaw = String(req.body?.section || '').toUpperCase();
    const replace = req.body?.replace !== false;

    if (!templateId) throw badRequest('templateId обязателен');
    const section =
      sectionRaw === 'WARMUP' || sectionRaw === 'MAIN'
        ? sectionRaw
        : null;
    if (!section) throw badRequest('section: WARMUP | MAIN');

    const training = await prisma.training.findFirst({
      where: { id: trainingId, tenantId },
    });
    if (!training) throw notFound('Тренировка не найдена');

    const template = await prisma.workoutTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) throw notFound('Шаблон не найден');

    const plan = await prisma.$transaction(async (tx) => {
      let existing = await tx.trainingSessionPlan.findUnique({ where: { trainingId } });
      if (!existing) {
        existing = await tx.trainingSessionPlan.create({
          data: {
            trainingId,
            cycleId: req.body?.cycleId ? String(req.body.cycleId) : null,
          },
        });
      }
      if (replace) {
        await tx.trainingSessionPlanItem.deleteMany({
          where: { planId: existing.id, section },
        });
      }
      const maxOrder = await tx.trainingSessionPlanItem.aggregate({
        where: { planId: existing.id, section },
        _max: { sortOrder: true },
      });
      let order = replace ? 0 : (maxOrder._max.sortOrder ?? -1) + 1;
      if (template.items.length) {
        await tx.trainingSessionPlanItem.createMany({
          data: template.items.map((it) => ({
            planId: existing!.id,
            section,
            exerciseId: it.exerciseId,
            sortOrder: order++,
            durationSec: it.durationSec,
            sets: it.sets,
            reps: it.reps,
            notes: it.notes,
          })),
        });
      }
      return tx.trainingSessionPlan.findUnique({
        where: { id: existing.id },
        include: planInclude,
      });
    });

    res.json({ success: true, data: plan });
  }
);
