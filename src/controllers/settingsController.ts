import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * Get tenant settings
 */
export const getSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  let settings = await prisma.tenantSettings.findUnique({
    where: { tenantId }
  });

  // Если настроек нет, создаем с дефолтными значениями
  if (!settings) {
    settings = await prisma.tenantSettings.create({
      data: {
        tenantId,
        defaultTrainingDuration: 60
      }
    });
  }

  res.json({
    success: true,
    data: settings,
    message: 'Settings retrieved successfully'
  });
});

/**
 * Update tenant settings
 */
export const updateSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { defaultTrainingDuration } = req.body;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  // Валидация
  if (defaultTrainingDuration !== undefined) {
    if (typeof defaultTrainingDuration !== 'number' || defaultTrainingDuration < 15 || defaultTrainingDuration > 480) {
      res.status(400).json({
        success: false,
        error: 'Default training duration must be between 15 and 480 minutes'
      });
      return;
    }
  }

  // Обновляем или создаем настройки
  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: {
      defaultTrainingDuration: defaultTrainingDuration !== undefined ? defaultTrainingDuration : undefined
    },
    create: {
      tenantId,
      defaultTrainingDuration: defaultTrainingDuration || 60
    }
  });

  res.json({
    success: true,
    data: settings,
    message: 'Settings updated successfully'
  });
});

