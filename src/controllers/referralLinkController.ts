import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { randomBytes } from 'crypto';

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

function generateReferralCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

export const getReferralLinks = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { page = 1, limit = 10, search, marketerId } = req.query as any;
  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
  const take = parseInt(limit.toString());

  const where = listWhere(scope);
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }
  if (scope.kind !== 'marketer' && marketerId) {
    where.marketerId = marketerId;
  }

  const [referralLinks, total] = await Promise.all([
    prisma.referralLink.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        marketer: { select: { id: true, name: true, email: true, type: true } },
        _count: { select: { clicks: true } },
      },
    }),
    prisma.referralLink.count({ where }),
  ]);

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

export const getReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;

  const referralLink = await prisma.referralLink.findFirst({
    where: listWhere(scope, { id }),
    include: {
      marketer: { select: { id: true, name: true, email: true, type: true } },
      clicks: {
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { clickedAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!referralLink) {
    res.status(404).json({ success: false, error: 'Реферальная ссылка не найдена' });
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

export const createReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { name, description, url, marketerId: providedMarketerId, isActive = true } = req.body;
  const marketerId =
    scope.kind === 'marketer' ? scope.marketerId : providedMarketerId || null;

  if (!name?.trim() || !url?.trim()) {
    res.status(400).json({ success: false, error: 'Укажите название и URL' });
    return;
  }

  let code: string | undefined;
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    code = generateReferralCode();
    const existing = await prisma.referralLink.findUnique({ where: { code } });
    if (!existing) isUnique = true;
    attempts++;
  }
  if (!isUnique || !code) {
    res.status(500).json({ success: false, error: 'Не удалось создать уникальный код' });
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

  const referralLink = await prisma.referralLink.create({
    data: {
      code,
      name: String(name).trim(),
      description,
      url: String(url).trim(),
      marketerId: marketerId || null,
      isActive,
      tenantId: createTenantId(scope),
    },
    include: {
      marketer: { select: { id: true, name: true, email: true, type: true } },
    },
  });

  res.status(201).json({ success: true, data: referralLink });
});

export const updateReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;
  const { name, description, url, marketerId, isActive } = req.body;

  const existing = await prisma.referralLink.findFirst({ where: listWhere(scope, { id }) });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Реферальная ссылка не найдена' });
    return;
  }

  if (scope.kind === 'marketer' && existing.marketerId !== scope.marketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете редактировать только свои реферальные ссылки.',
    });
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

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (url !== undefined) updateData.url = url;
  if (marketerId !== undefined && scope.kind !== 'marketer') updateData.marketerId = marketerId || null;
  if (isActive !== undefined) updateData.isActive = isActive;

  const referralLink = await prisma.referralLink.update({
    where: { id },
    data: updateData,
    include: {
      marketer: { select: { id: true, name: true, email: true, type: true } },
    },
  });

  res.json({ success: true, data: referralLink });
});

export const deleteReferralLink = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;

  const referralLink = await prisma.referralLink.findFirst({ where: listWhere(scope, { id }) });
  if (!referralLink) {
    res.status(404).json({ success: false, error: 'Реферальная ссылка не найдена' });
    return;
  }

  if (scope.kind === 'marketer' && referralLink.marketerId !== scope.marketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете удалять только свои реферальные ссылки.',
    });
    return;
  }

  await prisma.referralLink.delete({ where: { id } });
  res.json({ success: true, message: 'Реферальная ссылка удалена' });
});

export const trackReferralClick = asyncHandler(async (req: any, res: Response<ApiResponse>) => {
  const { code } = req.params;
  const { clientId } = req.body || {};
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const referralLink = await prisma.referralLink.findUnique({
    where: { code: String(code || '').toUpperCase() },
  });

  if (!referralLink || !referralLink.isActive) {
    // also try exact case
    const byExact = await prisma.referralLink.findUnique({ where: { code: String(code || '') } });
    if (!byExact || !byExact.isActive) {
      res.status(404).json({ success: false, error: 'Реферальная ссылка не найдена или неактивна' });
      return;
    }
    const click = await prisma.referralClick.create({
      data: {
        referralLinkId: byExact.id,
        clientId: clientId || null,
        ipAddress:
          typeof ipAddress === 'string'
            ? ipAddress
            : Array.isArray(ipAddress)
              ? ipAddress[0]
              : ipAddress || null,
        userAgent: userAgent || null,
        tenantId: byExact.tenantId,
      },
    });
    res.json({
      success: true,
      data: { click, url: byExact.url, code: byExact.code },
    });
    return;
  }

  const click = await prisma.referralClick.create({
    data: {
      referralLinkId: referralLink.id,
      clientId: clientId || null,
      ipAddress:
        typeof ipAddress === 'string'
          ? ipAddress
          : Array.isArray(ipAddress)
            ? ipAddress[0]
            : ipAddress || null,
      userAgent: userAgent || null,
      tenantId: referralLink.tenantId,
    },
  });

  res.json({
    success: true,
    data: { click, url: referralLink.url, code: referralLink.code },
  });
});

export const getReferralLinkStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const scope = getActorScope(req);
  const { id } = req.params;

  const referralLink = await prisma.referralLink.findFirst({
    where: listWhere(scope, { id }),
    include: { clicks: true },
  });

  if (!referralLink) {
    res.status(404).json({ success: false, error: 'Реферальная ссылка не найдена' });
    return;
  }

  const clicks = referralLink.clicks;
  const totalClicks = clicks.length;
  const conversions = clicks.filter((c) => c.converted).length;
  const conversionRate = totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

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
