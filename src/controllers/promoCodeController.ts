import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Get all promo codes with pagination
 */
export const getPromoCodes = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
  const { page = 1, limit = 10, search, marketerId } = req.query as any;
  
  // If marketer is authenticated, filter by their ID
  const finalMarketerId = authenticatedMarketerId || marketerId;

  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
  const take = parseInt(limit.toString());

  const where: any = {
    tenantId,
  };

  if (search) {
    where.OR = [
      { code: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (finalMarketerId) {
    where.marketerId = finalMarketerId;
  }

  const [promoCodes, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        marketer: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true,
          },
        },
        _count: {
          select: {
            usages: true,
          },
        },
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

/**
 * Get single promo code by ID
 */
export const getPromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
  const { id } = req.params;

  const promoCode = await prisma.promoCode.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      marketer: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
        },
      },
      usages: {
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { usedAt: 'desc' },
        take: 50,
      },
      _count: {
        select: {
          usages: true,
        },
      },
    },
  });

  if (!promoCode) {
    res.status(404).json({
      success: false,
      error: 'Промокод не найден',
    });
    return;
  }

  res.json({
    success: true,
    data: promoCode,
  });
});

/**
 * Create new promo code
 */
export const createPromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
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
  
  // Use authenticated marketer's ID if not provided
  const marketerId = providedMarketerId || authenticatedMarketerId;

  // Check if code already exists for this tenant
  const existing = await prisma.promoCode.findFirst({
    where: {
      code,
      tenantId,
    },
  });

  if (existing) {
    res.status(400).json({
      success: false,
      error: 'Промокод с таким кодом уже существует',
    });
    return;
  }

  // Validate marketer if provided
  if (marketerId) {
    const marketer = await prisma.marketer.findFirst({
      where: {
        id: marketerId,
        tenantId,
      },
    });

    if (!marketer) {
      res.status(400).json({
        success: false,
        error: 'Маркетолог не найден',
      });
      return;
    }
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  const promoCode = await prisma.promoCode.create({
    data: {
      code,
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
      tenantId,
    },
    include: {
      marketer: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: promoCode,
  });
});

/**
 * Update promo code
 */
export const updatePromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
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

  // Check if promo code exists
  const existing = await prisma.promoCode.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Промокод не найден',
    });
    return;
  }

  // If marketer is authenticated, ensure they can only update their own promo codes
  if (authenticatedMarketerId && existing.marketerId !== authenticatedMarketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете редактировать только свои промокоды.',
    });
    return;
  }

  // Check if code already exists for another promo code
  if (code && code !== existing.code) {
    const codeExists = await prisma.promoCode.findFirst({
      where: {
        code,
        tenantId,
        NOT: { id },
      },
    });

    if (codeExists) {
      res.status(400).json({
        success: false,
        error: 'Промокод с таким кодом уже существует',
      });
      return;
    }
  }

  // Validate marketer if provided
  if (marketerId) {
    const marketer = await prisma.marketer.findFirst({
      where: {
        id: marketerId,
        tenantId,
      },
    });

    if (!marketer) {
      res.status(400).json({
        success: false,
        error: 'Маркетолог не найден',
      });
      return;
    }
  }

  const updateData: any = {};
  if (code !== undefined) updateData.code = code;
  if (description !== undefined) updateData.description = description;
  if (discountType !== undefined) updateData.discountType = discountType;
  if (discountValue !== undefined) updateData.discountValue = discountValue;
  if (minPurchase !== undefined) updateData.minPurchase = minPurchase;
  if (maxDiscount !== undefined) updateData.maxDiscount = maxDiscount;
  if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
  if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
  if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
  if (marketerId !== undefined) updateData.marketerId = marketerId;
  if (isActive !== undefined) updateData.isActive = isActive;

  const promoCode = await prisma.promoCode.update({
    where: { id },
    data: updateData,
    include: {
      marketer: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: promoCode,
  });
});

/**
 * Delete promo code
 */
export const deletePromoCode = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
  const { id } = req.params;

  const promoCode = await prisma.promoCode.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!promoCode) {
    res.status(404).json({
      success: false,
      error: 'Промокод не найден',
    });
    return;
  }

  // If marketer is authenticated, ensure they can only delete their own promo codes
  if (authenticatedMarketerId && promoCode.marketerId !== authenticatedMarketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете удалять только свои промокоды.',
    });
    return;
  }

  await prisma.promoCode.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Промокод удален',
  });
});

/**
 * Get promo code statistics
 */
export const getPromoCodeStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).marketerTenantId || req.tenantId;
  const { id } = req.params;

  const promoCode = await prisma.promoCode.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      usages: {
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!promoCode) {
    res.status(404).json({
      success: false,
      error: 'Промокод не найден',
    });
    return;
  }

  const totalDiscount = promoCode.usages.reduce(
    (sum, usage) => sum + Number(usage.discountAmount),
    0
  );

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

