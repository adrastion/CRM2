import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

/**
 * Get client memberships
 */
export const getClientMemberships = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query;
    const where: any = {
      tenantId: req.tenant?.id
    };

    if (clientId) {
      where.clientId = clientId as string;
    }

    const memberships = await prisma.clientMembership.findMany({
      where,
      include: {
        client: true,
        membership: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: memberships
    });
  } catch (error) {
    console.error('Get client memberships error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve client memberships'
    });
  }
};

/**
 * Create client membership
 */
export const createClientMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, membershipId } = req.body;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    // Get membership details
    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        tenantId
      }
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        error: 'Membership not found'
      });
      return;
    }

    // Calculate end date for monthly memberships
    let endDate: Date | null = null;
    if (membership.type === 'monthly' && membership.duration) {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + membership.duration);
    }

    // Create client membership
    const clientMembership = await prisma.clientMembership.create({
      data: {
        clientId,
        membershipId,
        startDate: new Date(),
        endDate,
        visitsTotal: membership.visits || null,
        visitsUsed: 0,
        isActive: true,
        tenantId
      },
      include: {
        client: true,
        membership: true
      }
    });

    res.status(201).json({
      success: true,
      data: clientMembership,
      message: 'Client membership created successfully'
    });
  } catch (error: any) {
    console.error('Create client membership error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create client membership'
    });
  }
};

/**
 * Update client membership (e.g., mark visit used)
 */
export const updateClientMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { visitsUsed, isActive } = req.body;

    const clientMembership = await prisma.clientMembership.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!clientMembership) {
      res.status(404).json({
        success: false,
        error: 'Client membership not found'
      });
      return;
    }

    // Check if membership is expired (for monthly)
    let shouldDeactivate = false;
    if (clientMembership.endDate && new Date() > new Date(clientMembership.endDate)) {
      shouldDeactivate = true;
    }

    // Check if all visits used (for visit-based)
    if (clientMembership.visitsTotal && visitsUsed !== undefined) {
      if (visitsUsed >= clientMembership.visitsTotal) {
        shouldDeactivate = true;
      }
    }

    const updated = await prisma.clientMembership.update({
      where: { id },
      data: {
        visitsUsed: visitsUsed !== undefined ? visitsUsed : clientMembership.visitsUsed,
        isActive: isActive !== undefined ? isActive : (shouldDeactivate ? false : clientMembership.isActive)
      },
      include: {
        client: true,
        membership: true
      }
    });

    res.json({
      success: true,
      data: updated,
      message: 'Client membership updated successfully'
    });
  } catch (error) {
    console.error('Update client membership error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client membership'
    });
  }
};

/**
 * Mark visit used for client membership
 */
export const markVisitUsed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // clientMembership id

    const clientMembership = await prisma.clientMembership.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id,
        isActive: true
      },
      include: {
        membership: true
      }
    });

    if (!clientMembership) {
      res.status(404).json({
        success: false,
        error: 'Active client membership not found'
      });
      return;
    }

    // For visit-based memberships, check if limit reached
    if (clientMembership.visitsTotal) {
      if (clientMembership.visitsUsed >= clientMembership.visitsTotal) {
        res.status(400).json({
          success: false,
          error: 'All visits have been used'
        });
        return;
      }
    }

    const updated = await prisma.clientMembership.update({
      where: { id },
      data: {
        visitsUsed: clientMembership.visitsUsed + 1,
        isActive: clientMembership.visitsTotal 
          ? (clientMembership.visitsUsed + 1 < clientMembership.visitsTotal)
          : clientMembership.isActive
      },
      include: {
        client: true,
        membership: true
      }
    });

    res.json({
      success: true,
      data: updated,
      message: 'Visit marked as used'
    });
  } catch (error) {
    console.error('Mark visit used error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark visit as used'
    });
  }
};

/**
 * Delete client membership
 */
export const deleteClientMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const clientMembership = await prisma.clientMembership.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!clientMembership) {
      res.status(404).json({
        success: false,
        error: 'Client membership not found'
      });
      return;
    }

    await prisma.clientMembership.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Client membership deleted successfully'
    });
  } catch (error) {
    console.error('Delete client membership error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete client membership'
    });
  }
};

