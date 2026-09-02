import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * Get all memberships (tariffs)
 */
export const getMemberships = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 100, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.membership.count({ where })
    ]);

    res.json({
      success: true,
      data: memberships,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Memberships retrieved successfully'
    });
  } catch (error) {
    console.error('Get memberships error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve memberships'
    });
  }
};

/**
 * Get membership by ID
 */
export const getMembershipById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const membership = await prisma.membership.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        error: 'Membership not found'
      });
      return;
    }

    res.json({
      success: true,
      data: membership,
      message: 'Membership retrieved successfully'
    });
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve membership'
    });
  }
};

/**
 * Create membership (tariff)
 */
export const createMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, price, duration, visits, type } = req.body;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    if (!name || !price || !type) {
      res.status(400).json({
        success: false,
        error: 'Name, price and type are required'
      });
      return;
    }

    // Validate type-specific fields
    if (type === 'monthly' && !duration) {
      res.status(400).json({
        success: false,
        error: 'Duration is required for monthly memberships'
      });
      return;
    }

    if (type === 'visits' && !visits) {
      res.status(400).json({
        success: false,
        error: 'Visits count is required for visit-based memberships'
      });
      return;
    }

    const membership = await prisma.membership.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        duration: duration ? parseInt(duration) : null,
        visits: visits ? parseInt(visits) : null,
        type,
        tenantId
      }
    });

    res.status(201).json({
      success: true,
      data: membership,
      message: 'Membership created successfully'
    });
  } catch (error: any) {
    console.error('Create membership error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create membership'
    });
  }
};

/**
 * Update membership
 */
export const updateMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, visits, type, isActive } = req.body;

    const membership = await prisma.membership.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        error: 'Membership not found'
      });
      return;
    }

    // Validate type-specific fields if type is being changed
    if (type && type === 'monthly' && !duration && !membership.duration) {
      res.status(400).json({
        success: false,
        error: 'Duration is required for monthly memberships'
      });
      return;
    }

    if (type && type === 'visits' && !visits && !membership.visits) {
      res.status(400).json({
        success: false,
        error: 'Visits count is required for visit-based memberships'
      });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (duration !== undefined) updateData.duration = duration ? parseInt(duration) : null;
    if (visits !== undefined) updateData.visits = visits ? parseInt(visits) : null;
    if (type !== undefined) updateData.type = type;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.membership.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: updated,
      message: 'Membership updated successfully'
    });
  } catch (error: any) {
    console.error('Update membership error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update membership'
    });
  }
};

/**
 * Delete membership
 */
export const deleteMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const membership = await prisma.membership.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        clientMemberships: true,
        payments: true
      }
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        error: 'Membership not found'
      });
      return;
    }

    // Check if membership is in use
    if (membership.clientMemberships.length > 0 || membership.payments.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete membership that is in use. Deactivate it instead.'
      });
      return;
    }

    await prisma.membership.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Membership deleted successfully'
    });
  } catch (error) {
    console.error('Delete membership error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete membership'
    });
  }
};

