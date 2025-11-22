import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { AuthService } from '../services/authService';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const getTrainers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isActive: true
    };

    if (search) {
      // PostgreSQL supports case-insensitive search
      where.user = {
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ]
      };
    }

    const [trainers, total] = await Promise.all([
      prisma.trainer.findMany({
        where,
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
      prisma.trainer.count({ where })
    ]);

    res.json({
      success: true,
      data: trainers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Trainers retrieved successfully'
    });
  } catch (error) {
    console.error('Get trainers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainers'
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

    const { email, password, firstName, lastName, phone, qualification, experience, specialization, salaryType, salaryAmount } = req.body;

    // Создаем пользователя напрямую
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
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
        experience: parseInt(experience),
        specialization,
        salaryType,
        salaryAmount: parseFloat(salaryAmount),
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
    const { firstName, lastName, email, phone, password, qualification, experience, specialization, salaryType, salaryAmount } = req.body;

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
      salaryAmount: salaryAmount ? parseFloat(salaryAmount) : undefined
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
