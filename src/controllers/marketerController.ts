import { prisma } from '../lib/prisma';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { BCRYPT_ROUNDS } from '../constants/security';

/**
 * Get all marketers with pagination
 */
export const getMarketers = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { page = 1, limit = 10, search, type } = req.query as any;

  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
  const take = parseInt(limit.toString());

  const where: any = {
    tenantId,
  };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  if (type) {
    where.type = type;
  }

  const [marketers, total] = await Promise.all([
    prisma.marketer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            promoCodes: true,
            referralLinks: true,
          },
        },
      },
    }),
    prisma.marketer.count({ where }),
  ]);

  res.json({
    success: true,
    data: marketers,
    pagination: {
      page: parseInt(page.toString()),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  });
});

/**
 * Get single marketer by ID
 */
export const getMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  const marketer = await prisma.marketer.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      promoCodes: {
        include: {
          _count: {
            select: {
              usages: true,
            },
          },
        },
      },
      referralLinks: {
        include: {
          _count: {
            select: {
              clicks: true,
            },
          },
        },
      },
    },
  });

  if (!marketer) {
    res.status(404).json({
      success: false,
      error: 'Маркетолог не найден',
    });
    return;
  }

  res.json({
    success: true,
    data: marketer,
  });
});

/**
 * Create new marketer
 */
export const createMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { name, email, password, phone, type, isActive = true } = req.body;

  // Check if email already exists for this tenant
  const existing = await prisma.marketer.findFirst({
    where: {
      email,
      tenantId,
    },
  });

  if (existing) {
    res.status(400).json({
      success: false,
      error: 'Маркетолог с таким email уже существует',
    });
    return;
  }

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required',
    });
    return;
  }

  if (!password) {
    res.status(400).json({
      success: false,
      error: 'Password is required',
    });
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const marketer = await prisma.marketer.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      type,
      isActive,
      tenantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      type: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(201).json({
    success: true,
    data: marketer,
  });
});

/**
 * Update marketer
 */
export const updateMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { name, email, phone, type, isActive } = req.body;

  // Check if marketer exists
  const existing = await prisma.marketer.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Маркетолог не найден',
    });
    return;
  }

  // Check if email already exists for another marketer
  if (email && email !== existing.email) {
    const emailExists = await prisma.marketer.findFirst({
      where: {
        email,
        tenantId,
        NOT: { id },
      },
    });

    if (emailExists) {
      res.status(400).json({
        success: false,
        error: 'Маркетолог с таким email уже существует',
      });
      return;
    }
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (type !== undefined) updateData.type = type;
  if (isActive !== undefined) updateData.isActive = isActive;

  const marketer = await prisma.marketer.update({
    where: { id },
    data: updateData,
  });

  res.json({
    success: true,
    data: marketer,
  });
});

/**
 * Delete marketer
 */
export const deleteMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  const marketer = await prisma.marketer.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!marketer) {
    res.status(404).json({
      success: false,
      error: 'Маркетолог не найден',
    });
  }

  await prisma.marketer.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Маркетолог удален',
  });
});

/**
 * Get marketer statistics (for marketer panel)
 */
export const getMarketerStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const { id } = req.params;
  
  // If marketer is accessing their own stats, use their ID
  const marketerId = (req as any).marketer?.id || id;
  
  // If marketer is authenticated, ensure they can only access their own stats
  const authenticatedMarketerId = (req as any).marketer?.id;
  if (authenticatedMarketerId && marketerId !== authenticatedMarketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете просматривать только свою статистику.',
    });
    return;
  }

  const marketer = await prisma.marketer.findFirst({
    where: {
      id: marketerId,
      tenantId,
    },
    include: {
      promoCodes: {
        include: {
          usages: true,
        },
      },
      referralLinks: {
        include: {
          clicks: true,
        },
      },
    },
  });

  if (!marketer) {
    res.status(404).json({
      success: false,
      error: 'Маркетолог не найден',
    });
    return;
  }

  // Calculate promo code stats
  const totalPromoCodes = marketer.promoCodes?.length || 0;
  const activePromoCodes = marketer.promoCodes?.filter((pc) => pc.isActive).length || 0;
  const totalPromoUsages = marketer.promoCodes?.reduce((sum, pc) => sum + (pc.usages?.length || 0), 0) || 0;
  const totalDiscountGiven = marketer.promoCodes?.reduce(
    (sum, pc) => sum + (pc.usages?.reduce((s, u) => s + Number(u.discountAmount), 0) || 0),
    0
  ) || 0;

  // Calculate referral link stats
  const totalReferralLinks = marketer.referralLinks?.length || 0;
  const activeReferralLinks = marketer.referralLinks?.filter((rl) => rl.isActive).length || 0;
  const totalClicks = marketer.referralLinks?.reduce((sum, rl) => sum + (rl.clicks?.length || 0), 0) || 0;
  const totalConversions = marketer.referralLinks?.reduce(
    (sum, rl) => sum + (rl.clicks?.filter((c) => c.converted).length || 0),
    0
  ) || 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  res.json({
    success: true,
    data: {
      marketer: {
        id: marketer.id,
        name: marketer.name,
        email: marketer.email,
        type: marketer.type,
      },
      promoCodes: {
        total: totalPromoCodes,
        active: activePromoCodes,
        totalUsages: totalPromoUsages,
        totalDiscountGiven: Number(totalDiscountGiven),
      },
      referralLinks: {
        total: totalReferralLinks,
        active: activeReferralLinks,
        totalClicks,
        totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
    },
  });
});

