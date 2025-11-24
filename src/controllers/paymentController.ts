import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const getPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search, branchId, status, type, clientId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id
    };

    if (branchId) {
      where.branchId = branchId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (type) {
      where.type = type as string;
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    if (search) {
      where.OR = [
        { client: { firstName: { contains: search as string } } },
        { client: { lastName: { contains: search as string } } },
        { client: { email: { contains: search as string } } },
        { notes: { contains: search as string } }
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          client: true,
          membership: true,
          branch: true
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Payments retrieved successfully'
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payments'
    });
  }
};

export const getPaymentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        client: true,
        membership: true,
        branch: true
      }
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
      return;
    }

    res.json({
      success: true,
      data: payment,
      message: 'Payment retrieved successfully'
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment'
    });
  }
};

export const createPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paymentData = {
      ...req.body,
      tenantId: req.tenant?.id,
      paidAt: req.body.status === 'paid' ? new Date() : null
    };

    const payment = await prisma.payment.create({
      data: paymentData,
      include: {
        client: true,
        membership: true,
        branch: true
      }
    });

    // Если платеж за абонемент и статус "paid", создаем ClientMembership
    if (payment.type === 'membership' && payment.status === 'paid' && payment.membershipId) {
      const membership = await prisma.membership.findFirst({
        where: {
          id: payment.membershipId,
          tenantId: req.tenant?.id
        }
      });

      if (membership) {
        // Calculate end date for monthly memberships
        let endDate: Date | null = null;
        if (membership.type === 'monthly' && membership.duration) {
          endDate = new Date();
          endDate.setDate(endDate.getDate() + membership.duration);
        }

        await prisma.clientMembership.create({
          data: {
            clientId: payment.clientId,
            membershipId: payment.membershipId,
            startDate: new Date(),
            endDate,
            visitsTotal: membership.visits || null,
            visitsUsed: 0,
            isActive: true,
            tenantId: req.tenant?.id || ''
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment created successfully'
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
};

export const updatePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
      return;
    }

    // If status changed to 'paid' and paidAt is not set, set it to now
    const updateData: any = { ...req.body };
    if (req.body.status === 'paid' && !payment.paidAt) {
      updateData.paidAt = new Date();
    } else if (req.body.status !== 'paid' && payment.paidAt) {
      updateData.paidAt = null;
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        membership: true,
        branch: true
      }
    });

    res.json({
      success: true,
      data: updatedPayment,
      message: 'Payment updated successfully'
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment'
    });
  }
};

export const deletePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
      return;
    }

    await prisma.payment.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete payment'
    });
  }
};

