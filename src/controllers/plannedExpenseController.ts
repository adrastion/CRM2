import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

function saId(req: AuthenticatedRequest): string | null {
  return (req as any).superAdmin?.id || null;
}

function serialize(row: any) {
  return {
    ...row,
    amount: Number(row.amount),
    marketer: row.marketer
      ? { id: row.marketer.id, name: row.marketer.name }
      : null,
  };
}

export const listPlannedExpenses = asyncHandler(async (_req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const rows = await prisma.plannedExpense.findMany({
    include: { marketer: { select: { id: true, name: true } } },
    orderBy: { dueDate: 'asc' },
  });
  res.json({ success: true, data: rows.map(serialize) });
});

export const createPlannedExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const createdById = saId(req);
  if (!createdById) {
    res.status(401).json({ success: false, error: 'Super admin required' });
    return;
  }
  const title = String(req.body?.title || '').trim();
  const amount = Number(req.body?.amount);
  const dueDate = new Date(String(req.body?.dueDate || ''));
  const payeeKind = req.body?.payeeKind === 'MARKETER' ? 'MARKETER' : 'OTHER';
  if (!title || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(dueDate.getTime())) {
    res.status(400).json({ success: false, error: 'Укажите название, сумму и дату' });
    return;
  }
  const row = await prisma.plannedExpense.create({
    data: {
      title,
      amount,
      dueDate,
      payeeKind,
      payeeName: payeeKind === 'OTHER' ? String(req.body?.payeeName || '').trim() || null : null,
      marketerId: payeeKind === 'MARKETER' ? String(req.body?.marketerId || '') || null : null,
      comment: String(req.body?.comment || '').trim() || null,
      createdById,
    },
    include: { marketer: { select: { id: true, name: true } } },
  });
  res.status(201).json({ success: true, data: serialize(row) });
});

export const updatePlannedExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const existing = await prisma.plannedExpense.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Запись не найдена' });
    return;
  }
  const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.title;
  const amount = req.body?.amount !== undefined ? Number(req.body.amount) : Number(existing.amount);
  const dueDate = req.body?.dueDate ? new Date(String(req.body.dueDate)) : existing.dueDate;
  const payeeKind = req.body?.payeeKind === 'MARKETER' || req.body?.payeeKind === 'OTHER'
    ? req.body.payeeKind
    : existing.payeeKind;
  if (!title || !Number.isFinite(amount) || Number.isNaN(dueDate.getTime())) {
    res.status(400).json({ success: false, error: 'Проверьте поля' });
    return;
  }
  const row = await prisma.plannedExpense.update({
    where: { id },
    data: {
      title,
      amount,
      dueDate,
      payeeKind,
      payeeName: payeeKind === 'OTHER' ? String(req.body?.payeeName ?? existing.payeeName ?? '').trim() || null : null,
      marketerId: payeeKind === 'MARKETER' ? String(req.body?.marketerId ?? existing.marketerId ?? '') || null : null,
      comment: req.body?.comment !== undefined ? String(req.body.comment).trim() || null : existing.comment,
    },
    include: { marketer: { select: { id: true, name: true } } },
  });
  res.json({ success: true, data: serialize(row) });
});

export const deletePlannedExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  await prisma.plannedExpense.delete({ where: { id } });
  res.json({ success: true, data: { id } });
});
