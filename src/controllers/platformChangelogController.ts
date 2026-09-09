import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

export const listPlatformChangelog = asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
  const entries = await prisma.platformChangelogEntry.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 200,
  });
  res.json({ success: true, data: entries });
});

export const createPlatformChangelog = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const superAdmin = (req as any).superAdmin;
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!title || !body) {
    res.status(400).json({ success: false, error: 'Укажите заголовок и текст' });
    return;
  }
  const entry = await prisma.platformChangelogEntry.create({
    data: {
      title,
      body,
      createdById: superAdmin.id,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  res.json({ success: true, data: entry });
});

export const updatePlatformChangelog = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const id = req.params.id;
  const title = req.body?.title != null ? String(req.body.title).trim() : undefined;
  const body = req.body?.body != null ? String(req.body.body).trim() : undefined;
  if (title !== undefined && !title) {
    res.status(400).json({ success: false, error: 'Пустой заголовок' });
    return;
  }
  if (body !== undefined && !body) {
    res.status(400).json({ success: false, error: 'Пустой текст' });
    return;
  }
  const existing = await prisma.platformChangelogEntry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Запись не найдена' });
    return;
  }
  const entry = await prisma.platformChangelogEntry.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(body !== undefined ? { body } : {}),
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  res.json({ success: true, data: entry });
});

export const deletePlatformChangelog = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const id = req.params.id;
  const existing = await prisma.platformChangelogEntry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Запись не найдена' });
    return;
  }
  await prisma.platformChangelogEntry.delete({ where: { id } });
  res.json({ success: true, data: { ok: true } });
});
