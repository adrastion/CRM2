import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { issueClientMembership, toMembershipSummary, setClientMembershipRemaining } from '../services/clientMembershipService';
import { FinanceService } from '../services/financeService';

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
      data: memberships.map((m) => ({
        ...m,
        remaining: m.visitsTotal != null ? m.visitsTotal - m.visitsUsed : null,
        summary: toMembershipSummary(m),
      })),
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
 * Create client membership (с переносом долга по посещениям)
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

    if (!clientId || !membershipId) {
      res.status(400).json({
        success: false,
        error: 'clientId and membershipId are required',
      });
      return;
    }

    const clientMembership = await issueClientMembership({
      tenantId,
      clientId,
      membershipId,
    });

    const price = Number(clientMembership.membership?.price || 0);
    if (price > 0) {
      const clientName = `${clientMembership.client.lastName} ${clientMembership.client.firstName}`.trim();
      await FinanceService.recordMembershipIssue({
        tenantId,
        clientId,
        clientMembershipId: clientMembership.id,
        amount: price,
        title: `${clientName} — ${clientMembership.membership.name}`,
        membershipCatalogId: membershipId,
      }).catch((err) => console.error('Finance membership issue record failed:', err));
    }

    res.status(201).json({
      success: true,
      data: {
        ...clientMembership,
        remaining:
          clientMembership.visitsTotal != null
            ? clientMembership.visitsTotal - clientMembership.visitsUsed
            : null,
        summary: toMembershipSummary(clientMembership),
      },
      message: 'Client membership created successfully'
    });
  } catch (error: any) {
    console.error('Create client membership error:', error);
    if (error?.statusCode === 404) {
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create client membership'
    });
  }
};

/**
 * Update client membership
 * Body: visitsUsed? | remaining? | isActive?
 * remaining — правка остатка (visitsTotal - visitsUsed); при <= 0 пак деактивируется
 */
export const updateClientMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { visitsUsed, isActive, remaining } = req.body;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    if (remaining !== undefined && remaining !== null && remaining !== '') {
      try {
        const updated = await setClientMembershipRemaining({
          tenantId,
          clientMembershipId: id,
          remaining: Number(remaining),
        });
        res.json({
          success: true,
          data: updated,
          message: 'Остаток посещений обновлён',
        });
        return;
      } catch (err: any) {
        const status = err?.statusCode || 500;
        res.status(status).json({
          success: false,
          error: err?.message || 'Failed to update remaining visits',
        });
        return;
      }
    }

    const clientMembership = await prisma.clientMembership.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!clientMembership) {
      res.status(404).json({
        success: false,
        error: 'Client membership not found'
      });
      return;
    }

    let shouldDeactivate = false;
    if (clientMembership.endDate && new Date() > new Date(clientMembership.endDate)) {
      shouldDeactivate = true;
    }

    const nextUsed =
      visitsUsed !== undefined ? Number(visitsUsed) : clientMembership.visitsUsed;
    if (
      clientMembership.visitsTotal != null &&
      nextUsed >= clientMembership.visitsTotal
    ) {
      shouldDeactivate = true;
    }

    const updated = await prisma.clientMembership.update({
      where: { id },
      data: {
        visitsUsed: nextUsed,
        isActive:
          isActive !== undefined
            ? isActive
            : shouldDeactivate
              ? false
              : clientMembership.isActive,
      },
      include: {
        client: true,
        membership: true
      }
    });

    res.json({
      success: true,
      data: {
        ...updated,
        remaining: updated.visitsTotal != null ? updated.visitsTotal - updated.visitsUsed : null,
        summary: toMembershipSummary(updated),
      },
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
 * Mark visit used for client membership.
 * При исчерпании посещений абонемент деактивируется.
 */
export const markVisitUsed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

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

    const visitsUsed = clientMembership.visitsUsed + 1;
    const exhausted =
      clientMembership.visitsTotal != null && visitsUsed >= clientMembership.visitsTotal;

    const updated = await prisma.clientMembership.update({
      where: { id },
      data: {
        visitsUsed,
        isActive: !exhausted,
      },
      include: {
        client: true,
        membership: true
      }
    });

    res.json({
      success: true,
      data: {
        ...updated,
        remaining: updated.visitsTotal != null ? updated.visitsTotal - updated.visitsUsed : null,
        summary: toMembershipSummary(updated),
      },
      message: exhausted ? 'Visit marked as used; membership closed' : 'Visit marked as used'
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
