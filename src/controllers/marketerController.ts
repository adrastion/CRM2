import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { BCRYPT_ROUNDS } from '../constants/security';

function parseCommission(raw: unknown, fallback = 10): number {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    const err: any = new Error('commissionPercentage: 0–100');
    err.statusCode = 400;
    throw err;
  }
  return n;
}

function marketerSelect() {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    type: true,
    isActive: true,
    tenantId: true,
    balance: true,
    commissionPercentage: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

/**
 * Get all marketers (platform-wide; PCA and SA)
 */
export const getMarketers = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { page = 1, limit = 50, search, type } = req.query as any;
  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
  const take = parseInt(limit.toString());

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (type) where.type = type;

  const [marketers, total] = await Promise.all([
    prisma.marketer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        ...marketerSelect(),
        _count: { select: { promoCodes: true, referralLinks: true, referredTenants: true } },
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

export const getMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const marketer = await prisma.marketer.findUnique({
    where: { id },
    include: {
      promoCodes: {
        include: { _count: { select: { usages: true } } },
      },
      referralLinks: {
        include: { _count: { select: { clicks: true } } },
      },
    },
  });
  if (!marketer) {
    res.status(404).json({ success: false, error: 'Маркетолог не найден' });
    return;
  }
  const { password: _, ...safe } = marketer as any;
  res.json({ success: true, data: safe });
});

export const createMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { name, email, password, phone, type, isActive = true, commissionPercentage } = req.body;
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  if (!name?.trim() || !normalizedEmail || !password) {
    res.status(400).json({ success: false, error: 'Укажите имя, email и пароль' });
    return;
  }
  const marketerType = ['MARKETER', 'MEDIA_PARTNER'].includes(String(type))
    ? String(type)
    : 'MARKETER';

  const existing = await prisma.marketer.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.status(400).json({ success: false, error: 'Маркетолог с таким email уже существует' });
    return;
  }

  let commission = 10;
  try {
    commission = parseCommission(commissionPercentage, 10);
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const marketer = await prisma.marketer.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone || null,
      type: marketerType,
      isActive: isActive !== false,
      tenantId: null,
      commissionPercentage: commission,
    },
    select: marketerSelect(),
  });

  res.status(201).json({ success: true, data: marketer });
});

export const updateMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const { name, email, phone, type, isActive, commissionPercentage, password } = req.body;

  const existing = await prisma.marketer.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Маркетолог не найден' });
    return;
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = String(name).trim();
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail !== existing.email) {
      const emailExists = await prisma.marketer.findUnique({ where: { email: normalizedEmail } });
      if (emailExists) {
        res.status(400).json({ success: false, error: 'Маркетолог с таким email уже существует' });
        return;
      }
      updateData.email = normalizedEmail;
    }
  }
  if (phone !== undefined) updateData.phone = phone;
  if (type !== undefined) updateData.type = type;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (commissionPercentage !== undefined) {
    try {
      updateData.commissionPercentage = parseCommission(commissionPercentage, Number(existing.commissionPercentage));
    } catch (e: any) {
      res.status(400).json({ success: false, error: e.message });
      return;
    }
  }
  if (password) {
    updateData.password = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  }

  const marketer = await prisma.marketer.update({
    where: { id },
    data: updateData,
    select: marketerSelect(),
  });
  res.json({ success: true, data: marketer });
});

export const deleteMarketer = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const marketer = await prisma.marketer.findUnique({ where: { id } });
  if (!marketer) {
    res.status(404).json({ success: false, error: 'Маркетолог не найден' });
    return;
  }
  await prisma.marketer.delete({ where: { id } });
  res.json({ success: true, message: 'Маркетолог удален' });
});

export const getMarketerStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { id } = req.params;
  const marketerId = (req as any).marketer?.id || id;
  const authenticatedMarketerId = (req as any).marketer?.id;
  if (authenticatedMarketerId && marketerId !== authenticatedMarketerId) {
    res.status(403).json({
      success: false,
      error: 'Доступ запрещен. Вы можете просматривать только свою статистику.',
    });
    return;
  }

  const marketer = await prisma.marketer.findUnique({
    where: { id: marketerId },
    include: {
      promoCodes: { include: { usages: true } },
      referralLinks: { include: { clicks: true } },
    },
  });
  if (!marketer) {
    res.status(404).json({ success: false, error: 'Маркетолог не найден' });
    return;
  }

  const totalPromoCodes = marketer.promoCodes?.length || 0;
  const activePromoCodes = marketer.promoCodes?.filter((pc) => pc.isActive).length || 0;
  const totalPromoUsages = marketer.promoCodes?.reduce((sum, pc) => sum + (pc.usages?.length || 0), 0) || 0;
  const totalDiscountGiven =
    marketer.promoCodes?.reduce(
      (sum, pc) => sum + (pc.usages?.reduce((s, u) => s + Number(u.discountAmount), 0) || 0),
      0
    ) || 0;
  const totalReferralLinks = marketer.referralLinks?.length || 0;
  const activeReferralLinks = marketer.referralLinks?.filter((rl) => rl.isActive).length || 0;
  const totalClicks = marketer.referralLinks?.reduce((sum, rl) => sum + (rl.clicks?.length || 0), 0) || 0;
  const totalConversions =
    marketer.referralLinks?.reduce(
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
        balance: Number(marketer.balance),
        commissionPercentage: Number(marketer.commissionPercentage),
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

/** Публичная саморегистрация маркетолога (платформа). */
export const registerMarketer = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  const { name, email, password, phone, type } = req.body || {};
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  if (!name?.trim() || !normalizedEmail || !password || String(password).length < 6) {
    res.status(400).json({ success: false, error: 'Укажите имя, email и пароль (мин. 6 символов)' });
    return;
  }
  const marketerType = String(type) === 'MEDIA_PARTNER' ? 'MEDIA_PARTNER' : 'MARKETER';
  const existing = await prisma.marketer.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.status(400).json({ success: false, error: 'Маркетолог с таким email уже существует' });
    return;
  }

  const hashedPassword = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  const marketer = await prisma.marketer.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone ? String(phone).trim() : null,
      type: marketerType,
      isActive: true,
      tenantId: null,
      commissionPercentage: 10,
    },
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ success: false, error: 'JWT_SECRET is not configured' });
    return;
  }
  const token = jwt.sign(
    {
      userId: marketer.id,
      email: marketer.email,
      type: 'MARKETER',
      tenantId: null,
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  res.status(201).json({
    success: true,
    data: {
      marketer: {
        id: marketer.id,
        email: marketer.email,
        name: marketer.name,
        type: marketer.type,
        tenantId: null,
        commissionPercentage: Number(marketer.commissionPercentage),
      },
      tenant: null,
      token,
    },
  });
});
