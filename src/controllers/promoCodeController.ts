import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

type ActorScope =
  | { kind: 'sa' }
  | { kind: 'marketer'; marketerId: string }
  | { kind: 'pca'; schoolTenantId: string };

function getActorScope(req: any): ActorScope {
  if (req.superAdmin) return { kind: 'sa' };
  if (req.marketer?.id) return { kind: 'marketer', marketerId: req.marketer.id };
  const schoolTenantId = req.promoCodeAdminTenantId || req.tenantId;
  if (!schoolTenantId) {
    const err: any = new Error('Tenant ID is required');
    err.statusCode = 400;
    throw err;
  }
  return { kind: 'pca', schoolTenantId };
}

function listWhere(scope: ActorScope, extra: Record<string, unknown> = {}) {
  const where: any = { ...extra };
  if (scope.kind === 'marketer') {
    where.marketerId = scope.marketerId;
  } else if (scope.kind === 'pca') {
    where.tenantId = scope.schoolTenantId;
  } else {
    where.tenantId = null;
  }
  return where;
}

function createTenantId(scope: ActorScope): string | null {
  if (scope.kind === 'pca') return scope.schoolTenantId;
  return null;
}

async function assertMarketerExists(marketerId: string) {
  const marketer = await prisma.marketer.findUnique({ where: { id: marketerId } });
  if (!marketer) {
    const err: any = new Error('Маркетолог не найден');
    err.statusCode = 400;
    throw err;
  }
  return marketer;
}

export const getPromoCodes = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { page = 1, limit = 10, search, marketerId } = req.query as any;
  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
  const take = parseInt(limit.toString());

  const where = listWhere(scope);
  if (search) {
    where.OR = [{ code: { contains: search } }, { description: { contains: search } }];
  }
  if (scope.kind !== 'marketer' && marketerId) {
    where.marketerId = marketerId;
  }

  const [promoCodes, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        marketer: { select: { id: true, name: true, email: true, type: true } },
        _count: { select: { usages: true } },
      },
    }),
    prisma.promoCode.count({ where }),
  ]);

  res.json({
    success: true,
    data: promoCodes,
    pagination: {
      page: parseInt(page.toString()),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  });
});

export const getPromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;
  const where = listWhere(scope, { id });

  const promoCode = await prisma.promoCode.findFirst({
    where,
    include: {
      marketer: { select: { id: true, name: true, email: true, type: true } },
      usages: {
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
          payment: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { usedAt: 'desc' },
        take: 50,
      },
      _count: { select: { usages: true } },
    },
  });

  if (!promoCode) {
    res.status(404).json({ success: false, error: 'Промокод не найден' });
    return;
  }
  res.json({ success: true, data: promoCode });
});

export const createPromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const {
    code,
    description,
    discountType,
    discountValue,
    minPurchase,
    maxDiscount,
    usageLimit,
    validFrom,
    validUntil,
    marketerId: providedMarketerId,
    isActive = true,
  } = req.body;

  const marketerId =
    scope.kind === 'marketer' ? scope.marketerId : providedMarketerId || null;

  const normalizedCode = String(code || '')
    .trim()
    .toUpperCase();
  if (!normalizedCode || !discountType || discountValue == null || !validFrom) {
    res.status(400).json({ success: false, error: 'Заполните обязательные поля промокода' });
    return;
  }

  const existing = await prisma.promoCode.findUnique({ where: { code: normalizedCode } });
  if (existing) {
    res.status(400).json({ success: false, error: 'Промокод с таким кодом уже существует' });
    return;
  }

  if (marketerId) {
    try {
      await assertMarketerExists(marketerId);
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message });
      return;
    }
  }

  const promoCode = await prisma.promoCode.create({
    data: {
      code: normalizedCode,
      description,
      discountType,
      discountValue,
      minPurchase,
      maxDiscount,
      usageLimit,
      validFrom: new Date(validFrom),
      validUntil: validUntil ? new Date(validUntil) : null,
      marketerId: marketerId || null,
      isActive,
      tenantId: createTenantId(scope),
    },
    include: {
      marketer: { select: { id: true, name: true, email: true, type: true } },
    },
  });

  res.status(201).json({ success: true, data: promoCode });
});

export const updatePromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;
  const {
    code,
    description,
    discountType,
    discountValue,
    minPurchase,
    maxDiscount,
    usageLimit,
    validFrom,
    validUntil,
    marketerId,
    isActive,
  } = req.body;

  const existing = await prisma.promoCode.findFirst({ where: listWhere(scope, { id }) });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Промокод не найден' });
    return;
  }

  if (scope.kind === 'marketer' && existing.marketerId !== scope.marketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете редактировать только свои промокоды.',
    });
    return;
  }

  if (code && String(code).trim().toUpperCase() !== existing.code) {
    const normalizedCode = String(code).trim().toUpperCase();
    const codeExists = await prisma.promoCode.findFirst({
      where: { code: normalizedCode, NOT: { id } },
    });
    if (codeExists) {
      res.status(400).json({ success: false, error: 'Промокод с таким кодом уже существует' });
      return;
    }
  }

  if (marketerId) {
    try {
      await assertMarketerExists(marketerId);
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message });
      return;
    }
  }

  const updateData: any = {};
  if (code !== undefined) updateData.code = String(code).trim().toUpperCase();
  if (description !== undefined) updateData.description = description;
  if (discountType !== undefined) updateData.discountType = discountType;
  if (discountValue !== undefined) updateData.discountValue = discountValue;
  if (minPurchase !== undefined) updateData.minPurchase = minPurchase;
  if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount;
  if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
  if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
  if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
  if (marketerId !== undefined && scope.kind !== 'marketer') updateData.marketerId = marketerId || null;
  if (isActive !== undefined) updateData.isActive = isActive;

  const promoCode = await prisma.promoCode.update({
    where: { id },
    data: updateData,
    include: {
      marketer: { select: { id: true, name: true, email: true, type: true } },
    },
  });

  res.json({ success: true, data: promoCode });
});

export const deletePromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;

  const promoCode = await prisma.promoCode.findFirst({ where: listWhere(scope, { id }) });
  if (!promoCode) {
    res.status(404).json({ success: false, error: 'Промокод не найден' });
    return;
  }

  if (scope.kind === 'marketer' && promoCode.marketerId !== scope.marketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете удалять только свои промокоды.',
    });
    return;
  }

  await prisma.promoCode.delete({ where: { id } });
  res.json({ success: true, message: 'Промокод удален' });
});

export const getPromoCodeStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;

  const promoCode = await prisma.promoCode.findFirst({
    where: listWhere(scope, { id }),
    include: {
      usages: {
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!promoCode) {
    res.status(404).json({ success: false, error: 'Промокод не найден' });
    return;
  }

  const totalDiscount = promoCode.usages.reduce((sum, usage) => sum + Number(usage.discountAmount), 0);

  res.json({
    success: true,
    data: {
      totalUsages: promoCode.usages.length,
      totalDiscount,
      remainingUsages: promoCode.usageLimit ? promoCode.usageLimit - promoCode.usedCount : null,
      isExpired: promoCode.validUntil ? new Date(promoCode.validUntil) < new Date() : false,
      isActive: promoCode.isActive,
    },
  });
});
