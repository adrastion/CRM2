import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const LIMIT = 8;

/**
 * Глобальный поиск по клиентам, сотрудникам (тренерам) и группам текущего тенанта.
 */
export const globalSearch = asyncHandler(async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
) => {
  const tenantId = req.tenant?.id || (req as any).tenantId;
  const q = String(req.query.q || '').trim();

  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant required' });
    return;
  }

  if (q.length < 2) {
    res.json({
      success: true,
      data: { clients: [], trainers: [], groups: [] },
    });
    return;
  }

  const [clients, trainers, groups] = await Promise.all([
    prisma.client.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { middleName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: LIMIT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        email: true,
      },
    }),
    prisma.trainer.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { user: { firstName: { contains: q, mode: 'insensitive' } } },
          { user: { lastName: { contains: q, mode: 'insensitive' } } },
          { user: { middleName: { contains: q, mode: 'insensitive' } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { phone: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: LIMIT,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.group.findMany({
      where: {
        tenantId,
        isActive: true,
        name: { contains: q, mode: 'insensitive' },
      },
      take: LIMIT,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        branch: { select: { name: true } },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      clients: clients.map((c) => ({
        id: c.id,
        type: 'client' as const,
        title: [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' '),
        subtitle: c.phone || c.email || undefined,
      })),
      trainers: trainers.map((t) => ({
        id: t.id,
        type: 'trainer' as const,
        title: t.user
          ? [t.user.lastName, t.user.firstName, t.user.middleName].filter(Boolean).join(' ')
          : `Тренер #${t.id}`,
        subtitle: t.user?.phone || t.user?.email || undefined,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        type: 'group' as const,
        title: g.name,
        subtitle: g.branch?.name || undefined,
      })),
    },
  });
});
