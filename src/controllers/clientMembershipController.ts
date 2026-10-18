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
      error: 'Не удалось получить абонементы клиента'
    });
  }
};

/**
 * Create client membership (с переносом долга по посещениям)
 */
export const createClientMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId, membershipId, startDate } = req.body;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Требуется ID организации'
      });
      return;
    }

    if (!clientId || !membershipId) {
      res.status(400).json({
        success: false,
        error: 'Требуются clientId и membershipId',
      });
      return;
    }

    if (!startDate) {
      res.status(400).json({
        success: false,
        error: 'Укажите дату начала действия абонемента',
        field: 'startDate',
      });
      return;
    }

    const clientMembership = await issueClientMembership({
      tenantId,
      clientId,
      membershipId,
      startDate,
    });

    const price = Number(clientMembership.membership?.price || 0);
    if (price > 0) {
      const clientName = `${clientMembership.client.lastName} ${clientMembership.client.firstName}`.trim();
      try {
        await FinanceService.recordMembershipIssue({
          tenantId,
          clientId,
          clientMembershipId: clientMembership.id,
          amount: price,
          title: `${clientName} — ${clientMembership.membership.name}`,
          membershipCatalogId: membershipId,
          occurredAt: clientMembership.startDate,
        });
      } catch (financeErr: any) {
        console.error('Finance membership issue record failed:', financeErr);
        res.status(500).json({
          success: false,
          error:
            financeErr?.message ||
            'Абонемент создан, но финансовая запись не сохранилась. Проверьте раздел Финансы.',
          data: {
            ...clientMembership,
            remaining:
              clientMembership.visitsTotal != null
                ? clientMembership.visitsTotal - clientMembership.visitsUsed
                : null,
            summary: toMembershipSummary(clientMembership),
          },
        });
        return;
      }
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
      message: 'Абонемент клиента успешно создан'
    });
  } catch (error: any) {
    console.error('Create client membership error:', error);
    if (error?.statusCode === 404) {
      res.status(404).json({ success: false, error: 'Абонемент не найден' });
      return;
    }
    if (error?.statusCode === 400) {
      res.status(400).json({ success: false, error: error.message || 'Некорректный запрос' });
      return;
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Не удалось создать абонемент клиента'
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
      res.status(400).json({ success: false, error: 'Требуется ID организации' });
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
          error: err?.message || 'Не удалось обновить оставшиеся посещения',
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
        error: 'Абонемент клиента не найден'
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
      message: 'Абонемент клиента успешно обновлён'
    });
  } catch (error) {
    console.error('Update client membership error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось обновить абонемент клиента'
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
        error: 'Активный абонемент клиента не найден'
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
      error: 'Не удалось отметить посещение'
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
        error: 'Абонемент клиента не найден'
      });
      return;
    }

    await prisma.clientMembership.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Абонемент клиента успешно удалён'
    });
  } catch (error) {
    console.error('Delete client membership error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось удалить абонемент клиента'
    });
  }
};
