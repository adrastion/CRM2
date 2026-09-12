import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { ensureStaffTaskThread } from '../services/chatService';
import { resolveStaffActor } from '../services/chatService';

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

const taskInclude = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true, middleName: true, role: true },
  },
  assignees: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, middleName: true, role: true },
      },
    },
  },
  chatThread: { select: { id: true, threadKey: true, type: true } },
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

    const tasks = await prisma.staffTask.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(role === 'OWNER' && !mine
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
    const { tenantId, userId } = requireOwner(req);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!title) throw badRequest('Укажите заголовок', 'title');

    const assigneeIds: string[] = Array.isArray(req.body?.assigneeIds)
      ? [...new Set((req.body.assigneeIds as unknown[]).map(String).filter(Boolean))]
      : [];
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

    let dueAt: Date | null = null;
    if (req.body?.dueAt) {
      dueAt = new Date(req.body.dueAt);
      if (Number.isNaN(dueAt.getTime())) throw badRequest('Некорректный дедлайн', 'dueAt');
    }

    const createChat = req.body?.createChat === true;

    const task = await prisma.staffTask.create({
      data: {
        tenantId,
        createdByUserId: userId,
        title,
        body,
        dueAt,
        status: 'OPEN',
        assignees: {
          create: assigneeIds.map((id) => ({ userId: id })),
        },
      },
      include: taskInclude,
    });

    if (createChat) {
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
    const { tenantId, userId } = requireOwner(req);
    const { id } = req.params;

    const existing = await prisma.staffTask.findFirst({
      where: { id, tenantId },
      include: { assignees: true },
    });
    if (!existing) throw notFound('Задача не найдена');

    const data: {
      title?: string;
      body?: string;
      dueAt?: Date | null;
      status?: string;
      remindBeforeSentAt?: Date | null;
      overdueNotifiedAt?: Date | null;
    } = {};

    if (req.body?.title != null) {
      const title = String(req.body.title).trim();
      if (!title) throw badRequest('Укажите заголовок', 'title');
      data.title = title;
    }
    if (req.body?.body != null) data.body = String(req.body.body);
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
      if (!['OPEN', 'DONE', 'CANCELLED'].includes(status)) {
        throw badRequest('status: OPEN | DONE | CANCELLED', 'status');
      }
      data.status = status;
    }

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

    await prisma.staffTask.update({ where: { id }, data });

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
      throw badRequest('status: OPEN | DONE | CANCELLED', 'status');
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
    const { tenantId } = requireOwner(req);
    const { id } = req.params;
    const existing = await prisma.staffTask.findFirst({ where: { id, tenantId } });
    if (!existing) throw notFound('Задача не найдена');
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
