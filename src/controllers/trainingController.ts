import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { notifyTrainingScheduleChange } from '../services/notificationDomainHooks';

export const getTrainings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isCancelled: false // Исключаем отмененные тренировки
    };

    // Если пользователь - тренер: старший — тренировки своих филиалов; иначе — свои / canViewAllGroups
    if (req.user?.role === 'TRAINER') {
      const { getSeniorBranchIds } = await import('../utils/branchAccess');
      const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
      if (seniorIds.length > 0) {
        where.branchId = { in: seniorIds };
      } else {
        const trainer = await prisma.trainer.findFirst({
          where: {
            userId: req.user.id,
            tenantId: req.tenant?.id
          }
        });

        if (trainer && !trainer.canViewAllGroups) {
          where.trainerId = trainer.id;
        }
      }
    }

    if (search) {
      // PostgreSQL supports case-insensitive search
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    const [trainings, total] = await Promise.all([
      prisma.training.findMany({
        where,
        include: {
          branch: true,
          hall: true,
          group: true,
          trainer: {
            include: {
              user: true
            }
          },
          substituteTrainer: {
            include: {
              user: true
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { startTime: 'asc' }
      }),
      prisma.training.count({ where })
    ]);

    res.json({
      success: true,
      data: trainings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Trainings retrieved successfully'
    });
  } catch (error) {
    console.error('Get trainings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainings'
    });
  }
};

export const getTrainingById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const training = await prisma.training.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        branch: true,
        group: true,
        trainer: {
          include: {
            user: true
          }
        }
      }
    });

    if (!training) {
      res.status(404).json({
        success: false,
        error: 'Training not found'
      });
      return;
    }

    res.json({
      success: true,
      data: training,
      message: 'Training retrieved successfully'
    });
  } catch (error) {
    console.error('Get training error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve training'
    });
  }
};

export const createTraining = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    
    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    // Extract only valid fields for Training model
    const { daysOfWeek, recurrenceStartDate, recurrenceEndDate, ...validData } = req.body;
    
    // Validate required fields
    if (!validData.title) {
      res.status(400).json({
        success: false,
        error: 'Title is required'
      });
      return;
    }
    // groupId is optional for individual trainings
    // if (!validData.groupId) {
    //   res.status(400).json({
    //     success: false,
    //     error: 'Group ID is required'
    //   });
    //   return;
    // }
    if (!validData.trainerId) {
      res.status(400).json({
        success: false,
        error: 'Trainer ID is required'
      });
      return;
    }
    if (!validData.branchId) {
      res.status(400).json({
        success: false,
        error: 'Branch ID is required'
      });
      return;
    }

    if (req.user?.role === 'TRAINER') {
      const { canManageBranch, getSeniorBranchIds } = await import('../utils/branchAccess');
      const seniorIds = await getSeniorBranchIds(req.user.id, tenantId);
      if (seniorIds.length > 0 && !(await canManageBranch(req.user, validData.branchId, tenantId))) {
        res.status(403).json({
          success: false,
          error: 'Можно создавать тренировки только в своём филиале',
        });
        return;
      }
    }

    if (!validData.startTime) {
      res.status(400).json({
        success: false,
        error: 'Start time is required'
      });
      return;
    }
    if (!validData.endTime) {
      res.status(400).json({
        success: false,
        error: 'End time is required'
      });
      return;
    }

    const startTime = new Date(validData.startTime);
    const endTime = new Date(validData.endTime);

    // Проверка прав доступа для выставления замены
    if (validData.substituteTrainerId) {
      const user = req.user;
      const trainer = await prisma.trainer.findFirst({
        where: { userId: user?.id, tenantId }
      });
      
      const canSetSubstitute = 
        user?.role === 'OWNER' || 
        user?.role === 'ADMIN' || 
        (user?.role === 'TRAINER' && trainer?.canViewAllGroups) ||
        (user?.role === 'TRAINER' && validData.branchId
          ? await (await import('../utils/branchAccess')).canManageBranch(user, validData.branchId, tenantId)
          : false);
      
      if (!canSetSubstitute) {
        res.status(403).json({
          success: false,
          error: 'Недостаточно прав для выставления замены тренера. Только владелец, администратор или тренер с доступом ко всем группам могут выставлять замену.'
        });
        return;
      }
    }

    // Проверка конфликтов с соревнованиями для оригинального тренера
    if (validData.trainerId) {
      const trainerCompetitions = await prisma.competition.findMany({
        where: {
          tenantId,
          trainers: {
            some: {
              trainerId: validData.trainerId
            }
          },
          startDate: {
            lte: endTime
          },
          endDate: {
            gte: startTime
          }
        },
        include: {
          trainers: {
            include: {
              trainer: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

      if (trainerCompetitions.length > 0) {
        // Если есть конфликт, но не указана замена, возвращаем информацию о конфликте
        if (!validData.substituteTrainerId) {
          res.status(400).json({
            success: false,
            error: 'У тренера есть соревнование в указанные даты',
            conflicts: trainerCompetitions.map(comp => ({
              id: comp.id,
              name: comp.name,
              startDate: comp.startDate,
              endDate: comp.endDate
            })),
            requiresSubstitute: true
          });
          return;
        }
      }
    }

    // Проверка на существование дубликата тренировки
    // Для индивидуальных тренировок (без groupId) проверяем только по времени и тренеру
    const whereClause: any = {
      tenantId,
      title: validData.title,
      trainerId: validData.trainerId,
      branchId: validData.branchId,
      startTime: startTime,
      endTime: endTime,
      isCancelled: false
    };
    
    // Добавляем groupId в условие только если он указан
    // Для индивидуальных тренировок (без groupId) не включаем groupId в условие,
    // так как для них groupId всегда null, и мы проверяем по другим полям
    if (validData.groupId) {
      whereClause.groupId = validData.groupId;
    }
    // Для индивидуальных тренировок не добавляем groupId в условие,
    // чтобы избежать проблем с проверкой на null в Prisma
    
    const existingTraining = await prisma.training.findFirst({
      where: whereClause,
      include: {
        branch: true,
        group: true,
        trainer: {
          include: {
            user: true
          }
        }
      }
    });

    // Если дубликат существует, возвращаем существующую тренировку
    if (existingTraining) {
      console.log(`Duplicate training detected, returning existing training ${existingTraining.id}`);
      res.status(200).json({
        success: true,
        data: existingTraining,
        message: 'Training already exists',
        duplicate: true
      });
      return;
    }

    // Обрабатываем замену тренера
    let substituteTrainerId: string | null = null;
    let originalTrainerId: string | null = null;
    let actualTrainerId = validData.trainerId;

    if (validData.substituteTrainerId !== undefined && validData.substituteTrainerId) {
      // Преобразуем пустую строку в null
      const substituteId = validData.substituteTrainerId.trim() !== '' 
        ? validData.substituteTrainerId.trim() 
        : null;

      if (substituteId) {
        // Проверяем, что тренер-замена существует
        const substituteTrainer = await prisma.trainer.findFirst({
          where: { id: substituteId, tenantId }
        });

        if (!substituteTrainer) {
          res.status(400).json({
            success: false,
            error: 'Тренер-замена не найден'
          });
          return;
        }

        substituteTrainerId = substituteId;
        originalTrainerId = validData.trainerId;
        actualTrainerId = substituteId; // Тренер-замена будет проводить тренировку
      }
    }

    const trainingData: any = {
      title: validData.title,
      description: validData.description || null,
      trainerId: actualTrainerId, // Тренер, который будет проводить тренировку
      branchId: validData.branchId,
      hallId: validData.hallId || null,
      isRecurring: validData.isRecurring || false,
      recurrence: (validData.isRecurring && validData.recurrence) ? validData.recurrence : null,
      tenantId: String(tenantId), // Явно преобразуем в строку
      startTime,
      endTime,
      substituteTrainerId: substituteTrainerId,
      originalTrainerId: originalTrainerId
    };
    
    // Добавляем groupId только если он указан (для групповых тренировок)
    if (validData.groupId) {
      trainingData.groupId = String(validData.groupId);
    }
    // Для индивидуальных тренировок groupId не добавляем (будет null в БД)
    
    // Добавляем поля для индивидуальных тренировок
    if (validData.price !== undefined) {
      trainingData.price = validData.price;
    }
    if (validData.trainerEarningType) {
      trainingData.trainerEarningType = validData.trainerEarningType;
    }
    if (validData.trainerEarningValue !== undefined) {
      trainingData.trainerEarningValue = validData.trainerEarningValue;
    }

    console.log('Creating training with data:', JSON.stringify(trainingData, null, 2));

    const training = await prisma.training.create({
      data: trainingData,
      include: {
        branch: true,
        group: true,
        trainer: {
          include: {
            user: true
          }
        },
        substituteTrainer: {
          include: {
            user: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: training,
      message: 'Training created successfully'
    });
  } catch (error: any) {
    console.error('Create training error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create training',
      details: error?.meta || error
    });
  }
};

// Batch создание тренировок для быстрого создания множества тренировок
export const createTrainingsBatch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    
    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    const { trainings } = req.body;

    if (!Array.isArray(trainings) || trainings.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Trainings array is required and must not be empty'
      });
      return;
    }

    if (trainings.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Maximum 50 trainings can be created in one batch'
      });
      return;
    }

    // Проверяем лимит подписки перед созданием
    const { SubscriptionService } = await import('../services/subscriptionService');
    const hasAccess = await SubscriptionService.checkLimit(tenantId, 'trainings');
    if (!hasAccess) {
      const subscription = await SubscriptionService.getSubscription(tenantId);
      const limits = await SubscriptionService.getLimits(tenantId);
      const limit = limits.trainings;
      res.status(403).json({
        success: false,
        error: `Лимит тренировок превышен для тарифа ${subscription?.planType || 'unknown'}. Текущий лимит: ${limit === 'unlimited' ? 'безлимит' : limit}`
      });
      return;
    }

    const createdTrainings = [];
    const failedTrainings = [];

    // Создаем тренировки последовательно, но без задержек между отдельными запросами
    // так как все выполняется в одном HTTP запросе
    for (const trainingData of trainings) {
      try {
        // Extract only valid fields for Training model
        const { daysOfWeek, recurrenceStartDate, recurrenceEndDate, ...validData } = trainingData;
        
        // Validate required fields (groupId is optional for individual trainings)
        if (!validData.title || !validData.trainerId || !validData.branchId || !validData.startTime || !validData.endTime) {
          failedTrainings.push({
            training: trainingData,
            error: 'Missing required fields'
          });
          continue;
        }

        const startTime = new Date(validData.startTime);
        const endTime = new Date(validData.endTime);

        // Проверка на существование дубликата тренировки
        // Для индивидуальных тренировок (без groupId) проверяем только по времени и тренеру
        const whereClause: any = {
          tenantId,
          title: validData.title,
          trainerId: validData.trainerId,
          branchId: validData.branchId,
          startTime: startTime,
          endTime: endTime,
          isCancelled: false
        };
        
        // Добавляем groupId в условие только если он указан
        // Для индивидуальных тренировок (без groupId) не включаем groupId в условие,
        // так как для них groupId всегда null, и мы проверяем по другим полям
        if (validData.groupId) {
          whereClause.groupId = validData.groupId;
        }
        // Для индивидуальных тренировок не добавляем groupId в условие,
        // чтобы избежать проблем с проверкой на null в Prisma
        
        const existingTraining = await prisma.training.findFirst({
          where: whereClause,
          include: {
            branch: true,
            group: true,
            trainer: {
              include: {
                user: true
              }
            }
          }
        });

        // Если дубликат существует, добавляем существующую тренировку
        if (existingTraining) {
          createdTrainings.push(existingTraining);
          continue;
        }

        const trainingDataBatch: any = {
          title: validData.title,
          description: validData.description || null,
          trainerId: validData.trainerId,
          branchId: validData.branchId,
          hallId: validData.hallId || null,
          isRecurring: validData.isRecurring || false,
          recurrence: (validData.isRecurring && validData.recurrence) ? validData.recurrence : null,
          tenantId: String(tenantId), // Явно преобразуем в строку
          startTime,
          endTime
        };
        
        // Добавляем groupId только если он указан (для групповых тренировок)
        if (validData.groupId) {
          trainingDataBatch.groupId = String(validData.groupId);
        }
        // Для индивидуальных тренировок groupId не добавляем (будет null в БД)
        
        const training = await prisma.training.create({
          data: trainingDataBatch,
          include: {
            branch: true,
            group: true,
            trainer: {
              include: {
                user: true
              }
            }
          }
        });

        createdTrainings.push(training);
      } catch (error: any) {
        failedTrainings.push({
          training: trainingData,
          error: error?.message || 'Failed to create training'
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        created: createdTrainings,
        failed: failedTrainings,
        createdCount: createdTrainings.length,
        failedCount: failedTrainings.length
      },
      message: `Created ${createdTrainings.length} trainings, ${failedTrainings.length} failed`
    });
  } catch (error: any) {
    console.error('Create trainings batch error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create trainings batch',
      details: error
    });
  }
};

export const updateTraining = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { updateSeries, ...updateData } = req.body;

    const training = await prisma.training.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!training) {
      res.status(404).json({
        success: false,
        error: 'Training not found'
      });
      return;
    }

    // Extract only valid fields for Training model
    const { daysOfWeek, recurrenceStartDate, recurrenceEndDate, ...validData } = updateData;

    // If updating a recurring training series
    if (updateSeries && training.isRecurring && validData.isRecurring !== false) {
      // Проверка прав доступа для выставления замены при обновлении серии
      if (validData.substituteTrainerId !== undefined) {
        const user = req.user;
        const trainer = await prisma.trainer.findFirst({
          where: { userId: user?.id, tenantId: req.tenant?.id }
        });
        
        const branchForAccess = validData.branchId || training.branchId;
        const canSetSubstitute = 
          user?.role === 'OWNER' || 
          user?.role === 'ADMIN' || 
          (user?.role === 'TRAINER' && trainer?.canViewAllGroups) ||
          (user?.role === 'TRAINER' && branchForAccess
            ? await (await import('../utils/branchAccess')).canManageBranch(user, branchForAccess, req.tenant?.id)
            : false);
        
        if (!canSetSubstitute) {
          res.status(403).json({
            success: false,
            error: 'Недостаточно прав для выставления замены тренера. Только владелец, администратор или тренер с доступом ко всем группам могут выставлять замену.'
          });
          return;
        }
      }

      // Find all trainings in the same series (same title, group, trainer, branch, and created around the same time)
      const seriesStartTime = new Date(training.createdAt);
      seriesStartTime.setHours(seriesStartTime.getHours() - 1);
      const seriesEndTime = new Date(training.createdAt);
      seriesEndTime.setHours(seriesEndTime.getHours() + 1);

      const seriesTrainings = await prisma.training.findMany({
        where: {
          tenantId: req.tenant?.id,
          title: training.title,
          groupId: training.groupId,
          trainerId: training.trainerId,
          branchId: training.branchId,
          isRecurring: true,
          createdAt: {
            gte: seriesStartTime,
            lte: seriesEndTime
          },
          isCancelled: false
        }
      });

      // Update all trainings in the series
      // Обрабатываем замену тренера для серии
      let substituteTrainerId: string | null = null;
      let originalTrainerId: string | null = null;
      let actualTrainerId = validData.trainerId || training.trainerId;

      if (validData.substituteTrainerId !== undefined) {
        const substituteId = validData.substituteTrainerId && typeof validData.substituteTrainerId === 'string' && validData.substituteTrainerId.trim() !== '' 
          ? validData.substituteTrainerId.trim() 
          : null;

        if (substituteId) {
          const originalTrainerIdFromTraining = training.originalTrainerId || training.trainerId;
          const mainTrainerId = validData.trainerId || originalTrainerIdFromTraining;
          
          if (substituteId !== mainTrainerId) {
            // Проверяем, что тренер-замена существует
            const substituteTrainer = await prisma.trainer.findFirst({
              where: { id: substituteId, tenantId: req.tenant?.id }
            });

            if (!substituteTrainer) {
              res.status(400).json({
                success: false,
                error: 'Тренер-замена не найден'
              });
              return;
            }

            substituteTrainerId = substituteId;
            originalTrainerId = mainTrainerId;
            actualTrainerId = substituteId;
          }
        }
      }

      const updatePromises = seriesTrainings.map(t => 
        prisma.training.update({
          where: { id: t.id },
          data: {
            title: validData.title || t.title,
            description: validData.description !== undefined ? validData.description : t.description,
            groupId: validData.groupId || t.groupId,
            trainerId: actualTrainerId || t.trainerId,
            branchId: validData.branchId || t.branchId,
            hallId: validData.hallId !== undefined ? validData.hallId : t.hallId,
            recurrence: validData.recurrence || t.recurrence,
            substituteTrainerId: substituteTrainerId || null,
            originalTrainerId: originalTrainerId || null
          }
        })
      );

      await Promise.all(updatePromises);

      const updatedTraining = await prisma.training.findFirst({
        where: { id },
        include: {
          branch: true,
          group: true,
          trainer: {
            include: {
              user: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: updatedTraining,
        message: `Updated ${seriesTrainings.length} trainings in series successfully`
      });
    } else {
      // Regular update for single training
      // Проверка прав доступа для выставления замены
      if (validData.substituteTrainerId !== undefined) {
        const user = req.user;
        const trainer = await prisma.trainer.findFirst({
          where: { userId: user?.id, tenantId: req.tenant?.id }
        });
        
        const branchForAccess = validData.branchId || training.branchId;
        const canSetSubstitute = 
          user?.role === 'OWNER' || 
          user?.role === 'ADMIN' || 
          (user?.role === 'TRAINER' && trainer?.canViewAllGroups) ||
          (user?.role === 'TRAINER' && branchForAccess
            ? await (await import('../utils/branchAccess')).canManageBranch(user, branchForAccess, req.tenant?.id)
            : false);
        
        if (!canSetSubstitute) {
          res.status(403).json({
            success: false,
            error: 'Недостаточно прав для выставления замены тренера. Только владелец, администратор или тренер с доступом ко всем группам могут выставлять замену.'
          });
          return;
        }
      }

      // Обрабатываем замену тренера
      let substituteTrainerId: string | null = null;
      let originalTrainerId: string | null = null;
      let actualTrainerId = validData.trainerId || training.trainerId;

      // Если есть существующая замена, сохраняем оригинального тренера
      const existingOriginalTrainerId = training.originalTrainerId || training.trainerId;

      if (validData.substituteTrainerId !== undefined) {
        // Преобразуем пустую строку в null
        const substituteId = validData.substituteTrainerId && typeof validData.substituteTrainerId === 'string' && validData.substituteTrainerId.trim() !== '' 
          ? validData.substituteTrainerId.trim() 
          : null;

        if (substituteId) {
          // Определяем оригинального тренера
          // Если тренировка уже имеет замену, то training.trainerId - это тренер-замена,
          // а training.originalTrainerId - это оригинальный тренер
          // Если замены нет, то training.trainerId - это оригинальный тренер
          const originalTrainerIdFromTraining = training.originalTrainerId || training.trainerId;
          // Новый основной тренер из запроса или текущий оригинальный тренер
          const mainTrainerId = validData.trainerId || originalTrainerIdFromTraining;
          
          // Проверяем, что тренер-замена не совпадает с основным тренером
          if (substituteId === mainTrainerId) {
            res.status(400).json({
              success: false,
              error: 'Тренер-замена не может совпадать с основным тренером'
            });
            return;
          }

          // Проверяем, что тренер-замена существует
          const substituteTrainer = await prisma.trainer.findFirst({
            where: { id: substituteId, tenantId: req.tenant?.id }
          });

          if (!substituteTrainer) {
            res.status(400).json({
              success: false,
              error: 'Тренер-замена не найден'
            });
            return;
          }

          // Проверяем, что оригинальный тренер существует
          const mainTrainer = await prisma.trainer.findFirst({
            where: { id: mainTrainerId, tenantId: req.tenant?.id }
          });

          if (!mainTrainer) {
            res.status(400).json({
              success: false,
              error: 'Основной тренер не найден'
            });
            return;
          }

          substituteTrainerId = substituteId;
          // Оригинальный тренер - это либо указанный в запросе, либо текущий оригинальный тренер тренировки
          originalTrainerId = mainTrainerId;
          actualTrainerId = substituteId; // Тренер-замена будет проводить тренировку
          
          // Дополнительная проверка: убеждаемся, что originalTrainerId существует
          if (originalTrainerId) {
            const originalTrainerCheck = await prisma.trainer.findFirst({
              where: { id: originalTrainerId, tenantId: req.tenant?.id }
            });
            
            if (!originalTrainerCheck) {
              res.status(400).json({
                success: false,
                error: 'Оригинальный тренер не найден'
              });
              return;
            }
          }
        } else {
          // Убираем замену - возвращаемся к оригинальному тренеру
          substituteTrainerId = null;
          originalTrainerId = null;
          // Возвращаемся к оригинальному тренеру, если он был сохранен
          if (existingOriginalTrainerId) {
            actualTrainerId = existingOriginalTrainerId;
          } else {
            actualTrainerId = validData.trainerId || training.trainerId;
          }
        }
      } else {
        // Если замена не указана в запросе, но была раньше, сохраняем ее
        if (training.substituteTrainerId) {
          substituteTrainerId = training.substituteTrainerId;
          originalTrainerId = training.originalTrainerId || training.trainerId;
          actualTrainerId = training.trainerId; // Текущий тренер (замена)
        }
      }

      // Проверяем, что actualTrainerId указывает на существующего тренера
      if (actualTrainerId) {
        const trainerExists = await prisma.trainer.findFirst({
          where: { id: actualTrainerId, tenantId: req.tenant?.id }
        });

        if (!trainerExists) {
          res.status(400).json({
            success: false,
            error: 'Указанный тренер не найден'
          });
          return;
        }
      }

      // Создаем чистый объект updateData только с нужными полями
      const updateData: any = {};
      
      // Добавляем только те поля, которые были переданы и не undefined
      if (validData.title !== undefined) updateData.title = validData.title;
      if (validData.description !== undefined) updateData.description = validData.description;
      if (validData.startTime !== undefined) updateData.startTime = validData.startTime instanceof Date ? validData.startTime : new Date(validData.startTime);
      if (validData.endTime !== undefined) updateData.endTime = validData.endTime instanceof Date ? validData.endTime : new Date(validData.endTime);
      if (validData.branchId !== undefined) updateData.branchId = validData.branchId;
      if (validData.hallId !== undefined) updateData.hallId = validData.hallId || null;
      if (validData.groupId !== undefined) updateData.groupId = validData.groupId || null;
      if (validData.isRecurring !== undefined) updateData.isRecurring = validData.isRecurring;
      if (validData.recurrence !== undefined) updateData.recurrence = validData.recurrence || null;
      if (validData.price !== undefined) updateData.price = validData.price !== null && validData.price !== '' ? validData.price : null;
      if (validData.trainerEarningType !== undefined) updateData.trainerEarningType = validData.trainerEarningType || null;
      if (validData.trainerEarningValue !== undefined) updateData.trainerEarningValue = validData.trainerEarningValue !== null && validData.trainerEarningValue !== '' ? validData.trainerEarningValue : null;
      
      // Удаляем undefined значения
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      // Устанавливаем поля замены
      // Важно: trainerId должен быть тренером, который будет проводить тренировку (замена или оригинальный)
      updateData.trainerId = actualTrainerId;
      
      // Явно устанавливаем null для пустых значений (Prisma требует явного null, не пустую строку)
      // Если есть замена, substituteTrainerId должен быть установлен, иначе null
      if (substituteTrainerId && originalTrainerId) {
        // Есть замена - проверяем, что все ID разные
        if (substituteTrainerId === originalTrainerId) {
          res.status(400).json({
            success: false,
            error: 'Тренер-замена не может совпадать с оригинальным тренером'
          });
          return;
        }
        
        if (substituteTrainerId === actualTrainerId && originalTrainerId === actualTrainerId) {
          res.status(400).json({
            success: false,
            error: 'Все тренеры не могут быть одинаковыми'
          });
          return;
        }
        
        // Есть замена
        updateData.substituteTrainerId = substituteTrainerId;
        updateData.originalTrainerId = originalTrainerId;
      } else {
        // Нет замены
        updateData.substituteTrainerId = null;
        updateData.originalTrainerId = null;
      }
      
      // Финальная проверка: убеждаемся, что все ID тренеров существуют
      if (updateData.trainerId) {
        const finalTrainerCheck = await prisma.trainer.findFirst({
          where: { id: updateData.trainerId, tenantId: req.tenant?.id }
        });
        if (!finalTrainerCheck) {
          res.status(400).json({
            success: false,
            error: `Тренер с ID ${updateData.trainerId} не найден`
          });
          return;
        }
      }
      
      if (updateData.substituteTrainerId) {
        const finalSubstituteCheck = await prisma.trainer.findFirst({
          where: { id: updateData.substituteTrainerId, tenantId: req.tenant?.id }
        });
        if (!finalSubstituteCheck) {
          res.status(400).json({
            success: false,
            error: `Тренер-замена с ID ${updateData.substituteTrainerId} не найден`
          });
          return;
        }
      }
      
      if (updateData.originalTrainerId) {
        const finalOriginalCheck = await prisma.trainer.findFirst({
          where: { id: updateData.originalTrainerId, tenantId: req.tenant?.id }
        });
        if (!finalOriginalCheck) {
          res.status(400).json({
            success: false,
            error: `Оригинальный тренер с ID ${updateData.originalTrainerId} не найден`
          });
          return;
        }
      }
      
      // Удаляем undefined значения, чтобы Prisma не пытался их обновить
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // Логируем для отладки
      console.log('Updating training with data:', {
        id: training.id,
        trainerId: updateData.trainerId,
        substituteTrainerId: updateData.substituteTrainerId,
        originalTrainerId: updateData.originalTrainerId,
        beforeProcessing: {
          substituteTrainerId,
          originalTrainerId,
          actualTrainerId,
          validDataTrainerId: validData.trainerId,
          trainingTrainerId: training.trainerId,
          trainingOriginalTrainerId: training.originalTrainerId
        }
      });

      // Финальная проверка перед обновлением
      console.log('Final update data before Prisma:', JSON.stringify(updateData, null, 2));
      
      try {
        const timeChanged =
          (updateData.startTime &&
            new Date(updateData.startTime).getTime() !== new Date(training.startTime).getTime()) ||
          (updateData.endTime &&
            new Date(updateData.endTime).getTime() !== new Date(training.endTime).getTime());

        const updatedTraining = await prisma.training.update({
          where: { id },
          data: updateData,
          include: {
            branch: true,
            group: true,
            trainer: {
              include: {
                user: true
              }
            },
            substituteTrainer: {
              include: {
                user: true
              }
            }
          }
        });

        if (timeChanged && req.tenant?.id) {
          const whenLabel = format(updatedTraining.startTime, 'd MMMM, HH:mm', { locale: ru });
          void notifyTrainingScheduleChange({
            tenantId: req.tenant.id,
            trainingId: updatedTraining.id,
            groupId: updatedTraining.groupId,
            kind: 'rescheduled',
            whenLabel,
            groupName: updatedTraining.group?.name,
          }).catch((err) => console.error('[Notifications] reschedule:', err));
        }
        
        res.json({
          success: true,
          data: updatedTraining,
          message: 'Training updated successfully'
        });
      } catch (prismaError: any) {
        console.error('Prisma update error details:', {
          code: prismaError.code,
          meta: prismaError.meta,
          message: prismaError.message,
          updateData: updateData
        });
        throw prismaError;
      }
    }
  } catch (error) {
    console.error('Update training error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update training'
    });
  }
};

// Batch удаление тренировок
export const deleteTrainingsBatch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    
    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    const { trainingIds } = req.body;

    if (!Array.isArray(trainingIds) || trainingIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Training IDs array is required and must not be empty'
      });
      return;
    }

    if (trainingIds.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Maximum 50 trainings can be deleted in one batch'
      });
      return;
    }

    // Мягкое удаление всех тренировок одним запросом
    const result = await prisma.training.updateMany({
      where: {
        id: { in: trainingIds },
        tenantId,
        isCancelled: false
      },
      data: {
        isCancelled: true
      }
    });

    res.json({
      success: true,
      message: `Deleted ${result.count} trainings successfully`,
      deletedCount: result.count
    });
  } catch (error: any) {
    console.error('Delete trainings batch error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete trainings batch',
      details: error
    });
  }
};

export const deleteTraining = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const training = await prisma.training.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!training) {
      res.status(404).json({
        success: false,
        error: 'Training not found'
      });
      return;
    }

    await prisma.training.update({
      where: { id },
      data: { isCancelled: true }
    });

    if (req.tenant?.id) {
      const whenLabel = format(training.startTime, 'd MMMM, HH:mm', { locale: ru });
      void notifyTrainingScheduleChange({
        tenantId: req.tenant.id,
        trainingId: training.id,
        groupId: training.groupId,
        kind: 'cancelled',
        whenLabel,
      }).catch((err) => console.error('[Notifications] cancel:', err));
    }

    res.json({
      success: true,
      message: 'Training deleted successfully'
    });
  } catch (error) {
    console.error('Delete training error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete training'
    });
  }
};

// Функция для удаления дубликатов тренировок и тренировок без группы
export const removeDuplicateTrainings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    // Получаем все активные тренировки
    const allTrainings = await prisma.training.findMany({
      where: {
        tenantId,
        isCancelled: false
      },
      include: {
        group: true
      },
      orderBy: { createdAt: 'asc' } // Сохраняем самую раннюю созданную
    });

    // 1. Проверяем тренировки без активной группы
    // ВАЖНО: Не удаляем индивидуальные тренировки (где groupId === null)
    // Удаляем только групповые тренировки, у которых группа не существует или неактивна
    const trainingsWithoutGroup: string[] = [];
    for (const training of allTrainings) {
      // Если у тренировки указан groupId (это групповая тренировка),
      // но группа не существует или неактивна - помечаем на удаление
      if (training.groupId && (!training.group || !training.group.isActive)) {
        trainingsWithoutGroup.push(training.id);
      }
      // Если groupId === null (индивидуальная тренировка) - не удаляем
    }

    // 2. Группируем по ключевым полям для определения дубликатов
    const trainingMap = new Map<string, string[]>();
    
    for (const training of allTrainings) {
      // Пропускаем тренировки без группы
      if (trainingsWithoutGroup.includes(training.id)) {
        continue;
      }
      
      // Создаем уникальный ключ на основе параметров тренировки
      const key = `${training.title}|${training.groupId}|${training.trainerId}|${training.branchId}|${training.startTime.toISOString()}|${training.endTime.toISOString()}`;
      
      if (!trainingMap.has(key)) {
        trainingMap.set(key, []);
      }
      trainingMap.get(key)!.push(training.id);
    }

    // 3. Находим и удаляем дубликаты (оставляем первый, удаляем остальные)
    const duplicateIds: string[] = [];
    
    for (const [key, ids] of trainingMap.entries()) {
      if (ids.length > 1) {
        // Пропускаем первый (оригинал), добавляем остальные в список на удаление
        duplicateIds.push(...ids.slice(1));
      }
    }

    // 4. Объединяем все ID для удаления (тренировки без группы + дубликаты)
    const allIdsToRemove = [...trainingsWithoutGroup, ...duplicateIds];

    if (allIdsToRemove.length > 0) {
      // Мягкое удаление (помечаем как отмененные)
      await prisma.training.updateMany({
        where: {
          id: { in: allIdsToRemove }
        },
        data: { isCancelled: true }
      });

      console.log(`Removed ${trainingsWithoutGroup.length} trainings without active group and ${duplicateIds.length} duplicate trainings for tenant ${tenantId}`);
    }

    res.json({
      success: true,
      message: `Удалено ${trainingsWithoutGroup.length} тренировок без группы и ${duplicateIds.length} дублирующихся тренировок`,
      removedCount: allIdsToRemove.length,
      removedIds: allIdsToRemove,
      withoutGroupCount: trainingsWithoutGroup.length,
      duplicateCount: duplicateIds.length
    });
  } catch (error) {
    console.error('Remove duplicate trainings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove duplicate trainings'
    });
  }
};
