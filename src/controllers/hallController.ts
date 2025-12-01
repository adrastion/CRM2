import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const getHalls = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search, branchId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isActive: true
    };

    if (branchId) {
      where.branchId = branchId as string;
    }

    if (search) {
      // PostgreSQL supports case-insensitive search
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [halls, total] = await Promise.all([
      prisma.hall.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          branch: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.hall.count({ where })
    ]);

    res.json({
      success: true,
      data: halls,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Halls retrieved successfully'
    });
  } catch (error) {
    console.error('Get halls error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve halls'
    });
  }
};

export const getHallById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const hall = await prisma.hall.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!hall) {
      res.status(404).json({
        success: false,
        error: 'Hall not found'
      });
      return;
    }

    res.json({
      success: true,
      data: hall,
      message: 'Hall retrieved successfully'
    });
  } catch (error) {
    console.error('Get hall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve hall'
    });
  }
};

export const createHall = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { branchId, name, description, capacity } = req.body;

    if (!branchId) {
      res.status(400).json({
        success: false,
        error: 'Branch ID is required'
      });
      return;
    }

    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Hall name is required'
      });
      return;
    }

    // Verify branch belongs to tenant
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

    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    const hallData = {
      name,
      description: description || null,
      capacity: capacity ? parseInt(capacity) : null,
      branchId,
      tenantId
    };

    const hall = await prisma.hall.create({
      data: hallData,
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: hall,
      message: 'Hall created successfully'
    });
  } catch (error) {
    console.error('Create hall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create hall'
    });
  }
};

export const updateHall = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const hall = await prisma.hall.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!hall) {
      res.status(404).json({
        success: false,
        error: 'Hall not found'
      });
      return;
    }

    const updateData: any = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.capacity !== undefined) updateData.capacity = req.body.capacity ? parseInt(req.body.capacity) : null;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    // If branchId is being updated, verify it belongs to tenant
    if (req.body.branchId && req.body.branchId !== hall.branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: req.body.branchId,
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

      updateData.branchId = req.body.branchId;
    }

    const updatedHall = await prisma.hall.update({
      where: { id },
      data: updateData,
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedHall,
      message: 'Hall updated successfully'
    });
  } catch (error) {
    console.error('Update hall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update hall'
    });
  }
};

export const deleteHall = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const hall = await prisma.hall.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!hall) {
      res.status(404).json({
        success: false,
        error: 'Hall not found'
      });
      return;
    }

    await prisma.hall.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Hall deleted successfully'
    });
  } catch (error) {
    console.error('Delete hall error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete hall'
    });
  }
};

