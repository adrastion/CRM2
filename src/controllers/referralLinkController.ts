import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate unique referral code
 */
function generateReferralCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Get all referral links with pagination
 */
export const getReferralLinks = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
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
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (finalMarketerId) {
    where.marketerId = finalMarketerId;
  }

  const [referralLinks, total] = await Promise.all([
    prisma.referralLink.findMany({
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
            clicks: true,
          },
        },
      },
    }),
    prisma.referralLink.count({ where }),
  ]);

  // Add stats to each link
  const linksWithStats = await Promise.all(
    referralLinks.map(async (link) => {
      const clicks = await prisma.referralClick.findMany({
        where: { referralLinkId: link.id },
      });
      const totalClicks = clicks.length;
      const conversions = clicks.filter((c) => c.converted).length;
      const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

      return {
        ...link,
        stats: {
          totalClicks,
          conversions,
          conversionRate: Math.round(conversionRate * 100) / 100,
        },
      };
    })
  );

  res.json({
    success: true,
    data: linksWithStats,
    pagination: {
      page: parseInt(page.toString()),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  });
});

/**
 * Get single referral link by ID
 */
export const getReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
  const { id } = req.params;

  const referralLink = await prisma.referralLink.findFirst({
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
      clicks: {
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { clickedAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!referralLink) {
    res.status(404).json({
      success: false,
      error: 'Реферальная ссылка не найдена',
    });
    return;
  }

  const clicks = referralLink.clicks;
  const totalClicks = clicks.length;
  const conversions = clicks.filter((c) => c.converted).length;
  const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

  res.json({
    success: true,
    data: {
      ...referralLink,
      stats: {
        totalClicks,
        conversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
    },
  });
});

/**
 * Create new referral link
 */
export const createReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
  const { name, description, url, marketerId: providedMarketerId, isActive = true } = req.body;
  
  // Use authenticated marketer's ID if not provided
  const marketerId = providedMarketerId || authenticatedMarketerId;

  // Generate unique code
  let code: string;
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    code = generateReferralCode();
    const existing = await prisma.referralLink.findUnique({
      where: { code },
    });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    res.status(500).json({
      success: false,
      error: 'Не удалось создать уникальный код',
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

  const referralLink = await prisma.referralLink.create({
    data: {
      code: code!,
      name,
      description,
      url,
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
    data: referralLink,
  });
});

/**
 * Update referral link
 */
export const updateReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
  const { id } = req.params;
  const { name, description, url, marketerId, isActive } = req.body;

  // Check if referral link exists
  const existing = await prisma.referralLink.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Реферальная ссылка не найдена',
    });
    return;
  }

  // If marketer is authenticated, ensure they can only update their own referral links
  if (authenticatedMarketerId && existing.marketerId !== authenticatedMarketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете редактировать только свои реферальные ссылки.',
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

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (url !== undefined) updateData.url = url;
  if (marketerId !== undefined) updateData.marketerId = marketerId;
  if (isActive !== undefined) updateData.isActive = isActive;

  const referralLink = await prisma.referralLink.update({
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
    data: referralLink,
  });
});

/**
 * Delete referral link
 */
export const deleteReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).promoCodeAdminTenantId || (req as any).marketerTenantId || req.tenantId;
  const authenticatedMarketerId = (req as any).marketer?.id;
  const { id } = req.params;

  const referralLink = await prisma.referralLink.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!referralLink) {
    res.status(404).json({
      success: false,
      error: 'Реферальная ссылка не найдена',
    });
    return;
  }

  // If marketer is authenticated, ensure they can only delete their own referral links
  if (authenticatedMarketerId && referralLink.marketerId !== authenticatedMarketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете удалять только свои реферальные ссылки.',
    });
    return;
  }

  await prisma.referralLink.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Реферальная ссылка удалена',
  });
});

/**
 * Track referral link click (public endpoint, can be called without auth)
 */
export const trackReferralClick = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { code } = req.params;
  const { clientId } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const referralLink = await prisma.referralLink.findUnique({
    where: { code },
    include: { tenant: true },
  });

  if (!referralLink || !referralLink.isActive) {
    res.status(404).json({
      success: false,
      error: 'Реферальная ссылка не найдена или неактивна',
    });
    return;
  }

  const click = await prisma.referralClick.create({
    data: {
      referralLinkId: referralLink.id,
      clientId: clientId || null,
      ipAddress: typeof ipAddress === 'string' ? ipAddress : (Array.isArray(ipAddress) ? ipAddress[0] : ipAddress) || null,
      userAgent: userAgent || null,
      tenantId: referralLink.tenantId,
    },
  });

  res.json({
    success: true,
    data: click,
  });
});

/**
 * Get referral link statistics
 */
export const getReferralLinkStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const tenantId = (req as any).marketerTenantId || req.tenantId;
  const { id } = req.params;

  const referralLink = await prisma.referralLink.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      clicks: true,
    },
  });

  if (!referralLink) {
    res.status(404).json({
      success: false,
      error: 'Реферальная ссылка не найдена',
    });
    return;
  }

  const clicks = referralLink.clicks;
  const totalClicks = clicks.length;
  const conversions = clicks.filter((c) => c.converted).length;
  const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

  // Group by date
  const clicksByDate: Record<string, number> = {};
  clicks.forEach((click) => {
    const date = click.clickedAt.toISOString().split('T')[0];
    clicksByDate[date] = (clicksByDate[date] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      totalClicks,
      conversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      clicksByDate,
    },
  });
});

