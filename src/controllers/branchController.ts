import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import {
  canManageBranch,
  getSeniorBranchIds,
  isOwnerOrAdminRole,
} from '../utils/branchAccess';

const branchInclude = {
  seniorTrainer: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          email: true,
        },
      },
    },
  },
};

export const getBranches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isActive: true,
    };

    if (req.user?.role === 'TRAINER') {
      const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
      // Старший тренер видит только свои филиалы; обычный тренер — все (фильтры расписания)
      if (seniorIds.length > 0) {
        where.id = { in: seniorIds };
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        include: branchInclude,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.branch.count({ where }),
    ]);

    res.json({
      success: true,
      data: branches,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
      message: 'Branches retrieved successfully',
    });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve branches',
    });
  }
};

export const getBranchById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user && !(await canManageBranch(req.user, id, req.tenant?.id)) && !isOwnerOrAdminRole(req.user.role)) {
      // Trainers who are not senior of this branch: allow read if OWNER/ADMIN already covered;
      // regular trainers may still need branch list for schedule filters — getBranches already open for O/A/T historically.
      // For by-id used in management, require manage OR owner/admin OR any authenticated for same tenant.
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id,
      },
      include: branchInclude,
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'Branch not found',
      });
      return;
    }

    if (req.user?.role === 'TRAINER') {
      const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
      // Non-senior trainers historically could list branches for filters; keep by-id readable for tenant.
      // Senior-only restriction applies to mutating routes.
      void seniorIds;
    }

    res.json({
      success: true,
      data: branch,
      message: 'Branch retrieved successfully',
    });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve branch',
    });
  }
};

async function assertValidSeniorTrainer(
  seniorTrainerId: string | null | undefined,
  tenantId: string | undefined
): Promise<string | null | undefined> {
  if (seniorTrainerId === undefined) return undefined;
  if (seniorTrainerId === null || seniorTrainerId === '') return null;

  const trainer = await prisma.trainer.findFirst({
    where: {
      id: seniorTrainerId,
      tenantId,
      isActive: true,
    },
  });
  if (!trainer) {
    throw new Error('SENIOR_TRAINER_NOT_FOUND');
  }
  return trainer.id;
}

export const createBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !isOwnerOrAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Только владелец или администратор может создавать филиалы',
      });
      return;
    }

    let seniorTrainerId: string | null | undefined;
    try {
      seniorTrainerId = await assertValidSeniorTrainer(req.body.seniorTrainerId, req.tenant?.id);
    } catch {
      res.status(400).json({
        success: false,
        error: 'Указанный старший тренер не найден',
      });
      return;
    }

    const branch = await prisma.branch.create({
      data: {
        name: req.body.name,
        address: req.body.address,
        phone: req.body.phone,
        email: req.body.email,
        description: req.body.description,
        tenantId: req.tenant!.id,
        ...(seniorTrainerId !== undefined ? { seniorTrainerId } : {}),
      },
      include: branchInclude,
    });

    res.status(201).json({
      success: true,
      data: branch,
      message: 'Branch created successfully',
    });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create branch',
    });
  }
};

export const updateBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id,
      },
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'Branch not found',
      });
      return;
    }

    const isOwnerAdmin = req.user && isOwnerOrAdminRole(req.user.role);
    const isSeniorHere = req.user
      ? await canManageBranch(req.user, id, req.tenant?.id)
      : false;

    if (!isOwnerAdmin && !isSeniorHere) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    const data: Record<string, unknown> = {
      name: req.body.name,
      address: req.body.address,
      phone: req.body.phone,
      email: req.body.email,
      description: req.body.description,
    };

    if (isOwnerAdmin && req.body.isActive !== undefined) {
      data.isActive = req.body.isActive;
    }

    if (isOwnerAdmin && req.body.seniorTrainerId !== undefined) {
      try {
        data.seniorTrainerId = await assertValidSeniorTrainer(
          req.body.seniorTrainerId,
          req.tenant?.id
        );
      } catch {
        res.status(400).json({
          success: false,
          error: 'Указанный старший тренер не найден',
        });
        return;
      }
    }

    const updatedBranch = await prisma.branch.update({
      where: { id },
      data,
      include: branchInclude,
    });

    res.json({
      success: true,
      data: updatedBranch,
      message: 'Branch updated successfully',
    });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update branch',
    });
  }
};

export const deleteBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !isOwnerOrAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Только владелец или администратор может удалять филиалы',
      });
      return;
    }

    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id,
      },
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'Branch not found',
      });
      return;
    }

    await prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Branch deleted successfully',
    });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete branch',
    });
  }
};
