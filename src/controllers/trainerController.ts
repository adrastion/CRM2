import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { AuthService } from '../services/authService';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const getTrainers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 1000, search, includeAdmins } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Получаем тренеров
    const trainerWhere: any = {
      tenantId: req.tenant?.id,
      isActive: true
    };

    if (search) {
      trainerWhere.user = {
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { middleName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ]
      };
    }

    const [trainers, trainersTotal] = await Promise.all([
      prisma.trainer.findMany({
        where: trainerWhere,
        include: {
          user: true,
          branches: {
            include: {
              branch: true
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: {
          user: {
            firstName: 'asc'
          }
        }
      }),
      prisma.trainer.count({ where: trainerWhere })
    ]);

    // Если нужно включить администраторов
    let admins: any[] = [];
    let adminsTotal = 0;
    
    // Безопасная проверка параметра includeAdmins
    let shouldIncludeAdmins = false;
    if (typeof includeAdmins === 'string') {
      shouldIncludeAdmins = includeAdmins === 'true' || includeAdmins === '1';
    } else if (typeof includeAdmins === 'boolean') {
      shouldIncludeAdmins = includeAdmins === true;
    }
    
    if (shouldIncludeAdmins) {
      const adminWhere: any = {
        tenantId: req.tenant?.id,
        role: 'ADMIN'
      };

      if (search) {
        adminWhere.OR = [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { middleName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      [admins, adminsTotal] = await Promise.all([
        prisma.user.findMany({
          where: adminWhere,
          skip,
          take: Number(limit),
          orderBy: {
            firstName: 'asc'
          }
        }),
        prisma.user.count({ where: adminWhere })
      ]);
    }

    // Объединяем тренеров и администраторов
    const allEmployees = [
      ...trainers.map(t => ({ ...t, employeeType: 'trainer' })),
      ...admins.map(a => ({ ...a, employeeType: 'admin', user: a }))
    ];

    res.json({
      success: true,
      data: allEmployees,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: trainersTotal + adminsTotal,
        totalPages: Math.ceil((trainersTotal + adminsTotal) / Number(limit))
      },
      message: 'Employees retrieved successfully'
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve employees'
    });
  }
};

export const getTrainerById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true,
        branches: {
          include: {
            branch: true
          }
        }
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    res.json({
      success: true,
      data: trainer,
      message: 'Trainer retrieved successfully'
    });
  } catch (error) {
    console.error('Get trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainer'
    });
  }
};

export const createTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.tenant?.id) {
      res.status(400).json({
        success: false,
        error: 'Требуется ID тенанта'
      });
      return;
    }

    const { email, password, firstName, lastName, middleName, phone, qualification, experience, specialization, salaryType, salaryAmount, salaryPercentage, canViewAllGroups } = req.body;

    // Создаем пользователя напрямую
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        middleName,
        phone,
        role: 'TRAINER',
        tenantId: req.tenant.id
      }
    });

    // Создаем тренера с нужными данными
    const trainer = await prisma.trainer.create({
      data: {
        userId: user.id,
        qualification,
        experience: experience ? parseInt(experience) : undefined,
        specialization,
        salaryType,
        salaryAmount: salaryAmount ? parseFloat(salaryAmount) : undefined,
        salaryPercentage: salaryPercentage ? parseFloat(salaryPercentage) : undefined,
        canViewAllGroups: canViewAllGroups === true || canViewAllGroups === 'true',
        tenantId: req.tenant.id
      },
      include: {
        user: true
      }
    });

    res.status(201).json({
      success: true,
      data: trainer,
      message: 'Trainer created successfully'
    });
    return;
  } catch (error) {
    console.error('Create trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trainer'
    });
    return;
  }
};

export const updateTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, middleName, email, phone, password, qualification, experience, specialization, salaryType, salaryAmount, salaryPercentage, canViewAllGroups } = req.body;

    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    // Обновляем данные пользователя
    const userUpdateData: any = {
      firstName,
      lastName,
      middleName,
      email,
      phone
    };

    // Если указан новый пароль, хешируем его
    if (password && password.trim() !== '') {
      userUpdateData.password = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id: trainer.userId },
      data: userUpdateData
    });

    // Обновляем данные тренера
    const trainerUpdateData: any = {
      qualification,
      experience: experience ? parseInt(experience) : undefined,
      specialization,
      salaryType,
      salaryAmount: salaryAmount ? parseFloat(salaryAmount) : undefined,
      salaryPercentage: salaryPercentage !== undefined ? (salaryPercentage ? parseFloat(salaryPercentage) : null) : undefined,
      canViewAllGroups: canViewAllGroups !== undefined ? (canViewAllGroups === true || canViewAllGroups === 'true') : undefined
    };

    // Удаляем undefined значения
    Object.keys(trainerUpdateData).forEach(key => {
      if (trainerUpdateData[key] === undefined) {
        delete trainerUpdateData[key];
      }
    });

    const updatedTrainer = await prisma.trainer.update({
      where: { id },
      data: trainerUpdateData,
      include: {
        user: true
      }
    });

    res.json({
      success: true,
      data: updatedTrainer,
      message: 'Trainer updated successfully'
    });
  } catch (error) {
    console.error('Update trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trainer'
    });
  }
};

export const deleteTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    await prisma.trainer.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Trainer deleted successfully'
    });
  } catch (error) {
    console.error('Delete trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trainer'
    });
  }
};

export const addBranchToTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // trainer id
    const { branchId } = req.body;

    if (!branchId) {
      res.status(400).json({
        success: false,
        error: 'Branch ID is required'
      });
      return;
    }

    // Verify trainer exists and belongs to tenant
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    // Verify branch exists and belongs to tenant
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId: req.tenant?.id
      }
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
      return;
    }

    // Check if trainer is already assigned to this branch
    const existingAssignment = await prisma.trainerBranch.findUnique({
      where: {
        trainerId_branchId: {
          trainerId: id,
          branchId: branchId
        }
      }
    });

    if (existingAssignment) {
      res.status(400).json({
        success: false,
        error: 'Trainer is already assigned to this branch'
      });
      return;
    }

    // Create assignment
    const assignment = await prisma.trainerBranch.create({
      data: {
        trainerId: id,
        branchId: branchId
      },
      include: {
        branch: true,
        trainer: {
          include: {
            user: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Trainer assigned to branch successfully'
    });
  } catch (error: any) {
    console.error('Add branch to trainer error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'Trainer is already assigned to this branch'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to assign trainer to branch'
      });
    }
  }
};

export const removeBranchFromTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // trainer id
    const { branchId } = req.params; // branch id from route

    // Verify trainer exists and belongs to tenant
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    // Find assignment
    const assignment = await prisma.trainerBranch.findUnique({
      where: {
        trainerId_branchId: {
          trainerId: id,
          branchId: branchId
        }
      }
    });

    if (!assignment) {
      res.status(404).json({
        success: false,
        error: 'Trainer is not assigned to this branch'
      });
      return;
    }

    // Delete assignment
    await prisma.trainerBranch.delete({
      where: {
        trainerId_branchId: {
          trainerId: id,
          branchId: branchId
        }
      }
    });

    res.json({
      success: true,
      message: 'Trainer removed from branch successfully'
    });
  } catch (error) {
    console.error('Remove branch from trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove trainer from branch'
    });
  }
};

/**
 * Get trainer earnings based on attendance
 */
export const getTrainerEarnings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // trainer id
    const { startDate, endDate } = req.query;

    // Verify trainer exists and belongs to tenant
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    // If user is trainer, they can only see their own earnings
    if (req.user?.role === 'TRAINER' && trainer.userId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    // Get all trainings for this trainer
    const trainings = await prisma.training.findMany({
      where: {
        trainerId: id,
        tenantId: req.tenant?.id,
        isCancelled: false,
        ...(Object.keys(dateFilter).length > 0 && { startTime: dateFilter })
      },
      include: {
        group: {
          include: {
            branch: true
          }
        },
        attendances: {
          where: {
            status: 'PRESENT'
          },
          include: {
            client: true
          }
        }
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    // Calculate earnings for each training
    let totalEarnings = 0;
    const trainingEarnings = trainings.map(training => {
      const presentCount = training.attendances.length;
      const trainingPrice = training.group?.trainingPrice ? Number(training.group.trainingPrice) : 0;
      const totalRevenue = presentCount * trainingPrice;

      let earnings = 0;
      if (trainer.salaryType === 'percentage' && trainer.salaryAmount) {
        // Percentage-based salary
        const percentage = Number(trainer.salaryAmount);
        earnings = (totalRevenue * percentage) / 100;
      } else if (trainer.salaryType === 'fixed' && trainer.salaryAmount) {
        // Fixed salary per present client
        const fixedAmount = Number(trainer.salaryAmount);
        earnings = presentCount * fixedAmount;
      }

      totalEarnings += earnings;

      return {
        trainingId: training.id,
        trainingTitle: training.title,
        trainingDate: training.startTime,
        groupName: training.group?.name || 'Индивидуальная тренировка',
        branchName: training.group?.branch?.name || (training as any).branch?.name || '',
        presentCount,
        trainingPrice,
        totalRevenue,
        earnings
      };
    });

    res.json({
      success: true,
      data: {
        trainer: {
          id: trainer.id,
          name: `${trainer.user?.firstName} ${trainer.user?.lastName}`,
          salaryType: trainer.salaryType,
          salaryAmount: trainer.salaryAmount ? Number(trainer.salaryAmount) : null
        },
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        totalEarnings,
        trainingCount: trainings.length,
        trainingEarnings
      }
    });
  } catch (error) {
    console.error('Get trainer earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainer earnings'
    });
  }
};

/**
 * Get all trainers earnings (for admin/owner)
 */
// Get notification settings for a trainer
export const getTrainerNotificationSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Find trainer
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
    }

    // Check permissions: trainer can only see their own settings, admin/owner can see any
    if (req.user?.role === 'TRAINER' && trainer.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get or create notification settings
    let settings = await prisma.trainerNotificationSettings.findUnique({
      where: { trainerId: id }
    });

    if (!settings) {
      settings = await prisma.trainerNotificationSettings.create({
        data: {
          trainerId: id,
          allTrainingsEnabled: false,
          reminderEnabled: false,
          timezone: 'UTC'
        }
      });
    }

    return res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get notification settings'
    });
  }
};

// Update notification settings for a trainer
export const updateTrainerNotificationSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { allTrainingsTime, allTrainingsEnabled, notificationPeriod, reminderBeforeMinutes, reminderEnabled, timezone } = req.body;
    const userId = req.user?.id;

    // Find trainer
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
    }

    // Check permissions: trainer can only update their own settings, admin/owner can update any
    if (req.user?.role === 'TRAINER' && trainer.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate allTrainingsTime (0-1439 minutes)
    if (allTrainingsTime !== undefined && allTrainingsTime !== null) {
      const time = parseInt(allTrainingsTime);
      if (isNaN(time) || time < 0 || time > 1439) {
        return res.status(400).json({
          success: false,
          error: 'Invalid allTrainingsTime. Must be between 0 and 1439 minutes'
        });
      }
    }

    // Validate notificationPeriod
    if (notificationPeriod !== undefined && notificationPeriod !== null) {
      const validPeriods = ['tomorrow', 'week', 'month'];
      if (!validPeriods.includes(notificationPeriod)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid notificationPeriod. Must be one of: tomorrow, week, month'
        });
      }
    }

    // Validate reminderBeforeMinutes (positive number)
    if (reminderBeforeMinutes !== undefined && reminderBeforeMinutes !== null) {
      const minutes = parseInt(reminderBeforeMinutes);
      if (isNaN(minutes) || minutes < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid reminderBeforeMinutes. Must be a positive number'
        });
      }
    }

    // Validate timezone (IANA timezone identifier)
    if (timezone !== undefined && timezone !== null && timezone !== '') {
      try {
        // Проверяем валидность часового пояса, пытаясь создать дату с этим часовым поясом
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timezone. Must be a valid IANA timezone identifier (e.g., Europe/Moscow, UTC, America/New_York)'
        });
      }
    }

    // Update or create settings
    const settings = await prisma.trainerNotificationSettings.upsert({
      where: { trainerId: id },
      update: {
        allTrainingsTime: allTrainingsTime !== undefined && allTrainingsTime !== null ? parseInt(allTrainingsTime) : undefined,
        allTrainingsEnabled: allTrainingsEnabled !== undefined ? Boolean(allTrainingsEnabled) : undefined,
        notificationPeriod: notificationPeriod !== undefined ? notificationPeriod : undefined,
        reminderBeforeMinutes: reminderBeforeMinutes !== undefined && reminderBeforeMinutes !== null ? parseInt(reminderBeforeMinutes) : undefined,
        reminderEnabled: reminderEnabled !== undefined ? Boolean(reminderEnabled) : undefined,
        timezone: timezone !== undefined ? (timezone || 'UTC') : undefined
      },
      create: {
        trainerId: id,
        allTrainingsTime: allTrainingsTime !== undefined && allTrainingsTime !== null ? parseInt(allTrainingsTime) : undefined,
        allTrainingsEnabled: allTrainingsEnabled !== undefined ? Boolean(allTrainingsEnabled) : false,
        notificationPeriod: notificationPeriod || 'tomorrow',
        reminderBeforeMinutes: reminderBeforeMinutes !== undefined && reminderBeforeMinutes !== null ? parseInt(reminderBeforeMinutes) : undefined,
        reminderEnabled: reminderEnabled !== undefined ? Boolean(reminderEnabled) : false,
        timezone: timezone || 'UTC'
      }
    });

    return res.json({
      success: true,
      data: settings,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
};

export const getAllTrainersEarnings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only admin and owner can access this
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    // Get all trainers
    const trainers = await prisma.trainer.findMany({
      where: {
        tenantId: req.tenant?.id,
        isActive: true
      },
      include: {
        user: true
      }
    });

    const trainersEarnings = await Promise.all(
      trainers.map(async (trainer) => {
        // Get all trainings for this trainer
        const trainings = await prisma.training.findMany({
          where: {
            trainerId: trainer.id,
            tenantId: req.tenant?.id,
            isCancelled: false,
            ...(Object.keys(dateFilter).length > 0 && { startTime: dateFilter })
          },
          include: {
            group: true,
            attendances: {
              where: {
                status: 'PRESENT'
              }
            }
          }
        });

        let totalEarnings = 0;
        trainings.forEach(training => {
          const presentCount = training.attendances.length;
          const trainingPrice = training.group?.trainingPrice ? Number(training.group.trainingPrice) : 0;
          const totalRevenue = presentCount * trainingPrice;

          if (trainer.salaryType === 'percentage' && trainer.salaryAmount) {
            const percentage = Number(trainer.salaryAmount);
            totalEarnings += (totalRevenue * percentage) / 100;
          } else if (trainer.salaryType === 'fixed' && trainer.salaryAmount) {
            const fixedAmount = Number(trainer.salaryAmount);
            totalEarnings += presentCount * fixedAmount;
          }
        });

        return {
          trainerId: trainer.id,
          trainerName: `${trainer.user?.lastName} ${trainer.user?.firstName} ${trainer.user?.middleName || ''}`.trim(),
          salaryType: trainer.salaryType,
          salaryAmount: trainer.salaryAmount ? Number(trainer.salaryAmount) : null,
          trainingCount: trainings.length,
          totalEarnings
        };
      })
    );

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        trainers: trainersEarnings,
        totalEarnings: trainersEarnings.reduce((sum, t) => sum + t.totalEarnings, 0)
      }
    });
  } catch (error) {
    console.error('Get all trainers earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainers earnings'
    });
  }
};
