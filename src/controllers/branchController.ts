import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';

export const getBranches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isActive: true
    };

    if (search) {
      // PostgreSQL supports case-insensitive search
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.branch.count({ where })
    ]);

    res.json({
      success: true,
      data: branches,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Branches retrieved successfully'
    });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve branches'
    });
  }
};

export const getBranchById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
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

    res.json({
      success: true,
      data: branch,
      message: 'Branch retrieved successfully'
    });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve branch'
    });
  }
};

export const createBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branchData = {
      ...req.body,
      tenantId: req.tenant?.id
    };

    const branch = await prisma.branch.create({
      data: branchData
    });

    res.status(201).json({
      success: true,
      data: branch,
      message: 'Branch created successfully'
    });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create branch'
    });
  }
};

export const updateBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
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

    const updatedBranch = await prisma.branch.update({
      where: { id },
      data: req.body
    });

    res.json({
      success: true,
      data: updatedBranch,
      message: 'Branch updated successfully'
    });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update branch'
    });
  }
};

export const deleteBranch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
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

    await prisma.branch.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete branch'
    });
  }
};
