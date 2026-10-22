import path from 'path';
import multer from 'multer';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { ensureStaffTaskThread } from '../services/chatService';
import { resolveStaffActor } from '../services/chatService';
import {
  absoluteUploadPath,
  decodeUploadOriginalName,
  ensureUploadDir,
  safeUnlink,
  uniqueUploadFilename,
} from '../utils/fileStorage';

const PROJECT_KEYS = new Set(['general', 'growth', 'meetings', 'ideas', 'personal']);
const RECURRENCE = new Set(['none', 'daily', 'weekly', 'monthly']);

function requireTenantUser(req: AuthenticatedRequest) {
  if (!req.tenant?.id || !req.user?.id) {
    throw badRequest('Требуется авторизация сотрудника школы');
  }
  return { tenantId: req.tenant.id, userId: req.user.id, role: req.user.role };
}

function requireOwner(req: AuthenticatedRequest) {
  const ctx = requireTenantUser(req);
  if (ctx.role !== 'OWNER') throw forbidden('Только владелец может управлять задачами');
  return ctx;
}

const userLite = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
  role: true,
} as const;

const taskInclude = {
  createdBy: { select: userLite },
  assignees: {
    include: { user: { select: userLite } },
  },
  chatThread: { select: { id: true, threadKey: true, type: true } },
  attachments: { orderBy: { createdAt: 'desc' as const } },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: userLite } },
  },
} as const;

export const listStaffUsers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId } = requireTenantUser(req);
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN', 'TRAINER'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        role: true,
        email: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    res.json({ success: true, data: users });
  }
);

export const listStaffTasks = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const status = req.query.status ? String(req.query.status) : undefined;
    const mine = req.query.mine === '1' || req.query.mine === 'true';
    const fromRaw = req.query.from ? String(req.query.from) : undefined;
    const toRaw = req.query.to ? String(req.query.to) : undefined;
    const relatedTrainingId = req.query.relatedTrainingId
      ? String(req.query.relatedTrainingId)
      : undefined;
    const relatedSchoolEventId = req.query.relatedSchoolEventId
      ? String(req.query.relatedSchoolEventId)
      : undefined;
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    const hasRange =
      (from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()));

    const archivedParam = req.query.archived;
    const archived =
      archivedParam === undefined
        ? undefined
        : archivedParam === '1' || archivedParam === 'true';
    const favorite = req.query.favorite === '1' || req.query.favorite === 'true';
    const projectKey = req.query.projectKey ? String(req.query.projectKey) : undefined;
    const assignedByMe = req.query.assignedByMe === '1' || req.query.assignedByMe === 'true';
    const assignedToMe = req.query.assignedToMe === '1' || req.query.assignedToMe === 'true';

    const tasks = await prisma.staffTask.findMany({
      where: {
        tenantId,
        ...(archived !== undefined ? { archived } : {}),
        ...(favorite ? { favorite: true } : {}),
        ...(projectKey && PROJECT_KEYS.has(projectKey) ? { projectKey } : {}),
        ...(status ? { status } : {}),
        ...(relatedTrainingId ? { relatedTrainingId } : {}),
        ...(relatedSchoolEventId ? { relatedSchoolEventId } : {}),
        ...(hasRange
          ? {
              dueAt: {
                ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
                ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
              },
            }
          : {}),
        ...(assignedByMe ? { createdByUserId: userId } : {}),
        ...(assignedToMe ? { assignees: { some: { userId } } } : {}),
        ...(mine
          ? {
              OR: [
                { createdByUserId: userId },
                { assignees: { some: { userId } } },
              ],
            }
          : role === 'OWNER' || assignedByMe || assignedToMe
            ? {}
            : {
                OR: [
                  { createdByUserId: userId },
                  { assignees: { some: { userId } } },
                ],
              }),
      },
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: tasks });
  }
);

export const createStaffTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId } = requireTenantUser(req);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!title) throw badRequest('Укажите заголовок', 'title');

    let status = 'OPEN';
    if (req.body?.status != null) {
      const raw = String(req.body.status).toUpperCase();
      if (!['OPEN', 'DONE', 'CANCELLED', 'DRAFT'].includes(raw)) {
        throw badRequest('status: OPEN, DONE, CANCELLED или DRAFT', 'status');
      }
      status = raw;
    }

    const assigneeIds: string[] = Array.isArray(req.body?.assigneeIds)
      ? [...new Set((req.body.assigneeIds as unknown[]).map(String).filter(Boolean))]
      : [];
    if (assigneeIds.length === 0) {
      if (status === 'DRAFT') {
        assigneeIds.push(userId);
      } else {
        throw badRequest('Укажите хотя бы одного исполнителя', 'assigneeIds');
      }
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId,
        id: { in: assigneeIds },
        isActive: true,
        role: { in: ['OWNER', 'ADMIN', 'TRAINER'] },
      },
      select: { id: true },
    });
    if (users.length !== assigneeIds.length) {
      throw badRequest('Некоторые исполнители не найдены', 'assigneeIds');
    }

    let dueAt: Date | null = null;
    if (req.body?.dueAt) {
      dueAt = new Date(req.body.dueAt);
      if (Number.isNaN(dueAt.getTime())) throw badRequest('Некорректный дедлайн', 'dueAt');
    }

    let relatedTrainingId: string | null = null;
    let relatedSchoolEventId: string | null = null;
    if (req.body?.relatedTrainingId) {
      const tid = String(req.body.relatedTrainingId);
      const training = await prisma.training.findFirst({
        where: { id: tid, tenantId },
        select: { id: true },
      });
      if (!training) throw badRequest('Тренировка не найдена', 'relatedTrainingId');
      relatedTrainingId = training.id;
    }
    if (req.body?.relatedSchoolEventId) {
      const eid = String(req.body.relatedSchoolEventId);
      const event = await prisma.schoolEvent.findFirst({
        where: { id: eid, tenantId },
        select: { id: true },
      });
      if (!event) throw badRequest('Событие не найдено', 'relatedSchoolEventId');
      relatedSchoolEventId = event.id;
    }

    const createChat = req.body?.createChat === true;
    const notifyAssignees = req.body?.notifyAssignees !== false;

    let priority = 'MEDIUM';
    if (req.body?.priority != null) {
      const raw = String(req.body.priority).toUpperCase();
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(raw)) {
        throw badRequest('priority: LOW, MEDIUM или HIGH', 'priority');
      }
      priority = raw;
    }

    let subtasks: unknown = undefined;
    if (req.body?.subtasks !== undefined) {
      if (!Array.isArray(req.body.subtasks)) {
        throw badRequest('subtasks должен быть массивом', 'subtasks');
      }
      subtasks = (req.body.subtasks as unknown[]).map((row: any, index: number) => ({
        id: String(row?.id || `st-${index}`),
        title: String(row?.title || '').trim(),
        done: Boolean(row?.done),
      })).filter((row) => row.title);
    }

    let projectKey = 'general';
    if (req.body?.projectKey != null) {
      const raw = String(req.body.projectKey).trim().toLowerCase();
      if (!PROJECT_KEYS.has(raw)) throw badRequest('Некорректный проект', 'projectKey');
      projectKey = raw;
    }
    let recurrence = 'none';
    if (req.body?.recurrence != null) {
      const raw = String(req.body.recurrence).trim().toLowerCase();
      if (!RECURRENCE.has(raw)) throw badRequest('Некорректный повтор', 'recurrence');
      recurrence = raw;
    }

    const task = await prisma.staffTask.create({
      data: {
        tenantId,
        createdByUserId: userId,
        title,
        body,
        dueAt,
        status,
        priority,
        projectKey,
        recurrence,
        favorite: Boolean(req.body?.favorite),
        archived: Boolean(req.body?.archived),
        notifyAssignees,
        ...(subtasks !== undefined ? { subtasks: subtasks as object } : {}),
        relatedTrainingId,
        relatedSchoolEventId,
        assignees: {
          create: assigneeIds.map((id) => ({ userId: id })),
        },
      },
      include: taskInclude,
    });

    if (createChat && status !== 'DRAFT') {
      const actor = await resolveStaffActor(userId, tenantId);
      await ensureStaffTaskThread(actor, task.id);
      const refreshed = await prisma.staffTask.findFirst({
        where: { id: task.id },
        include: taskInclude,
      });
      res.status(201).json({ success: true, data: refreshed });
      return;
    }

    res.status(201).json({ success: true, data: task });
  }
);

export const updateStaffTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const existing = await prisma.staffTask.findFirst({
      where: { id, tenantId },
      include: { assignees: true },
    });
    if (!existing) throw notFound('Задача не найдена');

    if (role !== 'OWNER' && existing.createdByUserId !== userId) {
      throw forbidden('Редактировать задачу может владелец или автор');
    }

    const data: {
      title?: string;
      body?: string;
      dueAt?: Date | null;
      status?: string;
      priority?: string;
      projectKey?: string;
      favorite?: boolean;
      archived?: boolean;
      recurrence?: string;
      subtasks?: object | null;
      notifyAssignees?: boolean;
      relatedTrainingId?: string | null;
      relatedSchoolEventId?: string | null;
      remindBeforeSentAt?: Date | null;
      overdueNotifiedAt?: Date | null;
    } = {};

    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) throw badRequest('Укажите заголовок', 'title');
      data.title = title;
    }
    if (req.body?.body != null) data.body = String(req.body.body);
    if (req.body?.priority != null) {
      const priority = String(req.body.priority).toUpperCase();
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
        throw badRequest('priority: LOW, MEDIUM или HIGH', 'priority');
      }
      data.priority = priority;
    }
    if (req.body?.notifyAssignees !== undefined) {
      data.notifyAssignees = Boolean(req.body.notifyAssignees);
    }
    if (req.body?.subtasks !== undefined) {
      if (req.body.subtasks === null) {
        data.subtasks = null;
      } else if (!Array.isArray(req.body.subtasks)) {
        throw badRequest('subtasks должен быть массивом', 'subtasks');
      } else {
        data.subtasks = (req.body.subtasks as unknown[]).map((row: any, index: number) => ({
          id: String(row?.id || `st-${index}`),
          title: String(row?.title || '').trim(),
          done: Boolean(row?.done),
        })).filter((row) => row.title);
      }
    }
    if (req.body?.relatedTrainingId !== undefined) {
      if (req.body.relatedTrainingId === null || req.body.relatedTrainingId === '') {
        data.relatedTrainingId = null;
      } else {
        const tid = String(req.body.relatedTrainingId);
        const training = await prisma.training.findFirst({
          where: { id: tid, tenantId },
          select: { id: true },
        });
        if (!training) throw badRequest('Тренировка не найдена', 'relatedTrainingId');
        data.relatedTrainingId = training.id;
      }
    }
    if (req.body?.relatedSchoolEventId !== undefined) {
      if (req.body.relatedSchoolEventId === null || req.body.relatedSchoolEventId === '') {
        data.relatedSchoolEventId = null;
      } else {
        const eid = String(req.body.relatedSchoolEventId);
        const event = await prisma.schoolEvent.findFirst({
          where: { id: eid, tenantId },
          select: { id: true },
        });
        if (!event) throw badRequest('Событие не найдено', 'relatedSchoolEventId');
        data.relatedSchoolEventId = event.id;
      }
    }
    if (req.body?.dueAt !== undefined) {
      if (req.body.dueAt === null || req.body.dueAt === '') {
        data.dueAt = null;
        data.remindBeforeSentAt = null;
        data.overdueNotifiedAt = null;
      } else {
        const dueAt = new Date(req.body.dueAt);
        if (Number.isNaN(dueAt.getTime())) throw badRequest('Некорректный дедлайн', 'dueAt');
        data.dueAt = dueAt;
        if (existing.dueAt?.getTime() !== dueAt.getTime()) {
          data.remindBeforeSentAt = null;
          data.overdueNotifiedAt = null;
        }
      }
    }
    if (req.body?.status != null) {
      const status = String(req.body.status).toUpperCase();
      if (!['OPEN', 'DONE', 'CANCELLED', 'DRAFT'].includes(status)) {
        throw badRequest('status: OPEN, DONE, CANCELLED или DRAFT', 'status');
      }
      data.status = status;
    }
    if (req.body?.projectKey != null) {
      const raw = String(req.body.projectKey).trim().toLowerCase();
      if (!PROJECT_KEYS.has(raw)) throw badRequest('Некорректный проект', 'projectKey');
      data.projectKey = raw;
    }
    if (req.body?.recurrence != null) {
      const raw = String(req.body.recurrence).trim().toLowerCase();
      if (!RECURRENCE.has(raw)) throw badRequest('Некорректный повтор', 'recurrence');
      data.recurrence = raw;
    }
    if (req.body?.favorite !== undefined) data.favorite = Boolean(req.body.favorite);
    if (req.body?.archived !== undefined) data.archived = Boolean(req.body.archived);

    if (Array.isArray(req.body?.assigneeIds)) {
      const assigneeIds: string[] = [
        ...new Set((req.body.assigneeIds as unknown[]).map(String).filter(Boolean)),
      ];
      if (assigneeIds.length === 0) {
        throw badRequest('Укажите хотя бы одного исполнителя', 'assigneeIds');
      }
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          id: { in: assigneeIds },
          isActive: true,
          role: { in: ['OWNER', 'ADMIN', 'TRAINER'] },
        },
        select: { id: true },
      });
      if (users.length !== assigneeIds.length) {
        throw badRequest('Некоторые исполнители не найдены', 'assigneeIds');
      }
      await prisma.staffTaskAssignee.deleteMany({ where: { taskId: id } });
      await prisma.staffTaskAssignee.createMany({
        data: assigneeIds.map((uid) => ({ taskId: id, userId: uid })),
      });
    }

    await prisma.staffTask.update({ where: { id }, data: data as any });

    if (req.body?.createChat === true) {
      const actor = await resolveStaffActor(userId, tenantId);
      await ensureStaffTaskThread(actor, id);
    }

    const task = await prisma.staffTask.findFirst({
      where: { id },
      include: taskInclude,
    });
    res.json({ success: true, data: task });
  }
);

export const updateStaffTaskStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;
    const status = String(req.body?.status || '').toUpperCase();
    if (!['OPEN', 'DONE', 'CANCELLED'].includes(status)) {
        throw badRequest('status: OPEN, DONE, CANCELLED или DRAFT', 'status');
    }

    const existing = await prisma.staffTask.findFirst({
      where: { id, tenantId },
      include: { assignees: true },
    });
    if (!existing) throw notFound('Задача не найдена');

    const isOwner = role === 'OWNER';
    const isAssignee = existing.assignees.some((a) => a.userId === userId);
    if (!isOwner && !isAssignee) throw forbidden('Нет доступа к задаче');
    if (!isOwner && status === 'CANCELLED') {
      throw forbidden('Отменить задачу может только владелец');
    }

    const task = await prisma.staffTask.update({
      where: { id },
      data: { status },
      include: taskInclude,
    });
    res.json({ success: true, data: task });
  }
);

export const deleteStaffTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;
    const existing = await prisma.staffTask.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Задача не найдена');
    if (role !== 'OWNER' && existing.createdByUserId !== userId) {
      throw forbidden('Удалить задачу может владелец или автор');
    }
    await prisma.staffTask.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  }
);

export const ensureStaffTaskChat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;

    const task = await prisma.staffTask.findFirst({
      where: { id, tenantId },
      include: { assignees: true },
    });
    if (!task) throw notFound('Задача не найдена');

    const isOwner = role === 'OWNER';
    const isAssignee = task.assignees.some((a) => a.userId === userId);
    if (!isOwner && !isAssignee && task.createdByUserId !== userId) {
      throw forbidden('Нет доступа к чату задачи');
    }

    const actor = await resolveStaffActor(userId, tenantId);
    const thread = await ensureStaffTaskThread(actor, id);
    res.json({ success: true, data: thread });
  }
);

async function loadTaskForAccess(id: string, tenantId: string) {
  const task = await prisma.staffTask.findFirst({
    where: { id, tenantId },
    include: { assignees: true },
  });
  if (!task) throw notFound('Задача не найдена');
  return task;
}

function assertTaskAccess(
  task: { createdByUserId: string; assignees: Array<{ userId: string }> },
  userId: string,
  role: string
) {
  const isOwner = role === 'OWNER';
  const isAssignee = task.assignees.some((a) => a.userId === userId);
  if (!isOwner && !isAssignee && task.createdByUserId !== userId) {
    throw forbidden('Нет доступа к задаче');
  }
}

export const taskAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const tenantId = (req as AuthenticatedRequest).tenant?.id;
        if (!tenantId) return cb(new Error('No tenant'), '');
        cb(null, ensureUploadDir('staff-task-files', tenantId));
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

export const uploadStaffTaskAttachment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;
    const task = await loadTaskForAccess(id, tenantId);
    assertTaskAccess(task, userId, role);

    const file = req.file;
    if (!file) throw badRequest('Файл не загружен');
    const storagePath = path.join('staff-task-files', tenantId, file.filename).replace(/\\/g, '/');
    const att = await prisma.staffTaskAttachment.create({
      data: {
        taskId: id,
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

export const deleteStaffTaskAttachment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id, attachmentId } = req.params;
    const task = await loadTaskForAccess(id, tenantId);
    assertTaskAccess(task, userId, role);

    const att = await prisma.staffTaskAttachment.findFirst({
      where: { id: attachmentId, taskId: id },
    });
    if (!att) throw notFound('Файл не найден');
    safeUnlink(att.storagePath);
    await prisma.staffTaskAttachment.delete({ where: { id: attachmentId } });
    res.json({ success: true, data: { id: attachmentId } });
  }
);

export const getStaffTaskAttachmentFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id, attachmentId } = req.params;
    const task = await loadTaskForAccess(id, tenantId);
    assertTaskAccess(task, userId, role);

    const att = await prisma.staffTaskAttachment.findFirst({
      where: { id: attachmentId, taskId: id },
    });
    if (!att) throw notFound('Файл не найден');
    res.sendFile(absoluteUploadPath(att.storagePath));
  }
);

export const createStaffTaskComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id } = req.params;
    const body = String(req.body?.body || '').trim();
    if (!body) throw badRequest('Комментарий пуст', 'body');

    const task = await loadTaskForAccess(id, tenantId);
    assertTaskAccess(task, userId, role);

    const comment = await prisma.staffTaskComment.create({
      data: { taskId: id, authorId: userId, body },
      include: { author: { select: userLite } },
    });
    res.status(201).json({ success: true, data: comment });
  }
);

export const deleteStaffTaskComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    const { tenantId, userId, role } = requireTenantUser(req);
    const { id, commentId } = req.params;
    const task = await loadTaskForAccess(id, tenantId);
    assertTaskAccess(task, userId, role);

    const comment = await prisma.staffTaskComment.findFirst({
      where: { id: commentId, taskId: id },
    });
    if (!comment) throw notFound('Комментарий не найден');
    if (role !== 'OWNER' && comment.authorId !== userId) {
      throw forbidden('Удалить комментарий может автор или владелец');
    }
    await prisma.staffTaskComment.delete({ where: { id: commentId } });
    res.json({ success: true, data: { id: commentId } });
  }
);
