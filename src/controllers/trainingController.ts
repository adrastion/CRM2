import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const getTrainings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id
    };

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
    // Extract only valid fields for Training model
    const { daysOfWeek, ...validData } = req.body;
    const trainingData = {
      ...validData,
      tenantId: req.tenant?.id
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
  } catch (error) {
    console.error('Create training error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create training'
    });
  }
};

export const updateTraining = async (req: AuthenticatedRequest, res: Response) => {
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

    // Extract only valid fields for Training model
    const { daysOfWeek, ...validData } = req.body;
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
