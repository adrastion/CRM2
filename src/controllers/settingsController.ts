import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

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
  const { defaultTrainingDuration, membershipFeeResetDate, clientCanViewAllTrainers, clientCanViewAllBranches, salaryPayoutDay } = req.body;

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

  if (salaryPayoutDay !== undefined && salaryPayoutDay !== null) {
    const day = Number(salaryPayoutDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      res.status(400).json({
        success: false,
        error: 'Salary payout day must be an integer between 1 and 28'
      });
      return;
    }
  }

  // Валидация даты сброса (формат MM-DD)
  if (membershipFeeResetDate !== undefined && membershipFeeResetDate !== null && membershipFeeResetDate !== '') {
    const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
    if (!dateRegex.test(membershipFeeResetDate)) {
      res.status(400).json({
        success: false,
        error: 'Membership fee reset date must be in format MM-DD (e.g., 12-01 for December 1st)'
      });
      return;
    }
  }

  // Обновляем или создаем настройки
  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: {
      defaultTrainingDuration: defaultTrainingDuration !== undefined ? defaultTrainingDuration : undefined,
      membershipFeeResetDate: membershipFeeResetDate !== undefined ? membershipFeeResetDate : undefined,
      clientCanViewAllTrainers: clientCanViewAllTrainers !== undefined ? clientCanViewAllTrainers : undefined,
      clientCanViewAllBranches: clientCanViewAllBranches !== undefined ? clientCanViewAllBranches : undefined,
      salaryPayoutDay: salaryPayoutDay !== undefined ? Number(salaryPayoutDay) : undefined,
    },
    create: {
      tenantId,
      defaultTrainingDuration: defaultTrainingDuration || 60,
      membershipFeeResetDate: membershipFeeResetDate || null,
      clientCanViewAllTrainers: clientCanViewAllTrainers !== undefined ? clientCanViewAllTrainers : false,
      clientCanViewAllBranches: clientCanViewAllBranches !== undefined ? clientCanViewAllBranches : false,
      salaryPayoutDay: salaryPayoutDay !== undefined ? Number(salaryPayoutDay) : 25,
    }
  });

  res.json({
    success: true,
    data: settings,
    message: 'Settings updated successfully'
  });
});

/**
 * Update onboarding status
 */
export const updateOnboardingStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { hasCompletedOnboarding, onboardingDeclined } = req.body;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  // Обновляем или создаем настройки
  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: {
      hasCompletedOnboarding: hasCompletedOnboarding !== undefined ? hasCompletedOnboarding : undefined,
      onboardingDeclined: onboardingDeclined !== undefined ? onboardingDeclined : undefined
    },
    create: {
      tenantId,
      hasCompletedOnboarding: hasCompletedOnboarding || false,
      onboardingDeclined: onboardingDeclined || false
    }
  });

  res.json({
    success: true,
    data: settings,
    message: 'Onboarding status updated successfully'
  });
});

/**
 * Reset membership fee status for all clients (automatic reset based on date)
 */
export const resetMembershipFees = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  // Получаем настройки
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId }
  });

  if (!settings || !settings.membershipFeeResetDate) {
    res.json({
      success: true,
      data: { resetCount: 0 },
      message: 'Membership fee reset date is not configured'
    });
    return;
  }

  // Парсим дату сброса (формат MM-DD)
  const [resetMonth, resetDay] = settings.membershipFeeResetDate.split('-').map(Number);
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // getMonth() возвращает 0-11
  const currentDay = today.getDate();

  // Проверяем, нужно ли сбрасывать сегодня
  if (currentMonth !== resetMonth || currentDay !== resetDay) {
    res.json({
      success: true,
      data: { resetCount: 0 },
      message: `Reset date is ${settings.membershipFeeResetDate}, today is ${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`
    });
    return;
  }

  // Сбрасываем все отметки членского взноса
  const result = await prisma.client.updateMany({
    where: {
      tenantId,
      membershipFeePaid: true
    },
    data: {
      membershipFeePaid: false,
      membershipFeePaidAt: null,
      membershipFeePaidBy: null
    }
  });

  res.json({
    success: true,
    data: { resetCount: result.count },
    message: `Сброшено ${result.count} отметок о членском взносе`
  });
});

