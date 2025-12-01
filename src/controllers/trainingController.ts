import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const getTrainings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isCancelled: false // Исключаем отмененные тренировки
    };

    // Если пользователь - тренер, проверяем права на просмотр всех групп
    if (req.user?.role === 'TRAINER') {
      const trainer = await prisma.trainer.findFirst({
        where: {
          userId: req.user.id,
          tenantId: req.tenant?.id
        }
      });

      // Если тренер не может видеть все группы, показываем только его группы
      if (trainer && !trainer.canViewAllGroups) {
        where.trainerId = trainer.id;
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
    if (!validData.groupId) {
      res.status(400).json({
        success: false,
        error: 'Group ID is required'
      });
      return;
    }
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

    const trainingData = {
      ...validData,
      tenantId,
      startTime: new Date(validData.startTime),
      endTime: new Date(validData.endTime)
    };

    const training = await prisma.training.create({
      data: trainingData,
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
      const updatePromises = seriesTrainings.map(t => 
        prisma.training.update({
          where: { id: t.id },
          data: {
            title: validData.title || t.title,
            description: validData.description !== undefined ? validData.description : t.description,
            groupId: validData.groupId || t.groupId,
            trainerId: validData.trainerId || t.trainerId,
            branchId: validData.branchId || t.branchId,
            hallId: validData.hallId !== undefined ? validData.hallId : t.hallId,
            recurrence: validData.recurrence || t.recurrence
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
    const updatedTraining = await prisma.training.update({
      where: { id },
      data: validData,
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
      message: 'Training updated successfully'
    });
    }
  } catch (error) {
    console.error('Update training error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update training'
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
