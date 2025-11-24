import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * Get all client categories
 */
export const getClientCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  const categories = await prisma.clientCategory.findMany({
    where: {
      tenantId,
      isActive: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  res.json({
    success: true,
    data: categories,
    message: 'Client categories retrieved successfully'
  });
});

/**
 * Get client category by ID
 */
export const getClientCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  const category = await prisma.clientCategory.findFirst({
    where: {
      id,
      tenantId
    }
  });

  if (!category) {
    res.status(404).json({
      success: false,
      error: 'Client category not found'
    });
    return;
  }

  res.json({
    success: true,
    data: category,
    message: 'Client category retrieved successfully'
  });
});

/**
 * Create client category
 */
export const createClientCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { name, description, color } = req.body;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  if (!name || !name.trim()) {
    res.status(400).json({
      success: false,
      error: 'Category name is required'
    });
    return;
  }

  const category = await prisma.clientCategory.create({
    data: {
      name: name.trim(),
      description: description?.trim() || undefined,
      color: color || undefined,
      tenantId
    }
  });

  res.status(201).json({
    success: true,
    data: category,
    message: 'Client category created successfully'
  });
});

/**
 * Update client category
 */
export const updateClientCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { name, description, color, isActive } = req.body;

  const category = await prisma.clientCategory.findFirst({
    where: {
      id,
      tenantId
    }
  });

  if (!category) {
    res.status(404).json({
      success: false,
      error: 'Client category not found'
    });
    return;
  }

  const updatedCategory = await prisma.clientCategory.update({
    where: { id },
    data: {
      name: name !== undefined ? name.trim() : undefined,
      description: description !== undefined ? (description.trim() || null) : undefined,
      color: color !== undefined ? color : undefined,
      isActive: isActive !== undefined ? isActive : undefined
    }
  });

  res.json({
    success: true,
    data: updatedCategory,
    message: 'Client category updated successfully'
  });
});

/**
 * Delete client category
 */
export const deleteClientCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  const category = await prisma.clientCategory.findFirst({
    where: {
      id,
      tenantId
    },
    include: {
      clients: {
        take: 1
      }
    }
  });

  if (!category) {
    res.status(404).json({
      success: false,
      error: 'Client category not found'
    });
    return;
  }

  // Если есть клиенты с этой категорией, не удаляем, а деактивируем
  if (category.clients.length > 0) {
    await prisma.clientCategory.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Client category deactivated (has associated clients)'
    });
  } else {
    await prisma.clientCategory.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Client category deleted successfully'
    });
  }
});

