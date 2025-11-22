import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * Get all promo code admins with pagination
 */
export const getPromoCodeAdmins = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { page = 1, limit = 10, search } = req.query as any;

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

  const [admins, total] = await Promise.all([
    prisma.promoCodeAdmin.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.promoCodeAdmin.count({ where }),
  ]);

  res.json({
    success: true,
    data: admins,
    pagination: {
      page: parseInt(page.toString()),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  });
});

/**
 * Get single promo code admin by ID
 */
export const getPromoCodeAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  const admin = await prisma.promoCodeAdmin.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!admin) {
    res.status(404).json({
      success: false,
      error: 'Администратор промокодов не найден',
    });
    return;
  }

  res.json({
    success: true,
    data: admin,
  });
});

/**
 * Create new promo code admin
 */
export const createPromoCodeAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { name, email, password, phone, isActive = true } = req.body;

  // Check if email already exists for this tenant
  const existing = await prisma.promoCodeAdmin.findFirst({
    where: {
      email,
      tenantId,
    },
  });

  if (existing) {
    res.status(400).json({
      success: false,
      error: 'Администратор с таким email уже существует',
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
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.promoCodeAdmin.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      isActive,
      tenantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(201).json({
    success: true,
    data: admin,
  });
});

/**
 * Update promo code admin
 */
export const updatePromoCodeAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { name, email, password, phone, isActive } = req.body;

  // Check if admin exists
  const existing = await prisma.promoCodeAdmin.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'Администратор промокодов не найден',
    });
    return;
  }

  // Check if email is being changed and if it conflicts
  if (email && email !== existing.email) {
    const emailConflict = await prisma.promoCodeAdmin.findFirst({
      where: {
        email,
        tenantId,
        NOT: { id },
      },
    });

    if (emailConflict) {
      res.status(400).json({
        success: false,
        error: 'Администратор с таким email уже существует',
      });
      return;
    }
  }

  // Prepare update data
  const updateData: any = {
    name,
    email,
    phone: phone !== undefined ? phone : null,
    isActive,
  };

  // Hash password if provided
  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const admin = await prisma.promoCodeAdmin.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({
    success: true,
    data: admin,
  });
});

/**
 * Delete promo code admin
 */
export const deletePromoCodeAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  const admin = await prisma.promoCodeAdmin.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!admin) {
    res.status(404).json({
      success: false,
      error: 'Администратор промокодов не найден',
    });
    return;
  }

  await prisma.promoCodeAdmin.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'Администратор промокодов удален',
  });
});

