import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const getGroups = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isActive: true
    };

    // Если пользователь - тренер, проверяем права на просмотр всех групп
    if (req.user?.role === 'TRAINER') {
      const trainer = await prisma.trainer.findFirst({
        where: {
          userId: req.user.id,
          tenantId: req.tenant?.id
        }
      });

      // Если тренер не может видеть все группы, показываем только его группы
      if (trainer && !trainer.canViewAllGroups) {
        where.trainerId = trainer.id;
      }
    }

    if (search) {
      // PostgreSQL supports case-insensitive search
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        include: {
          branch: true,
          trainer: {
            include: {
              user: true
            }
          },
          memberships: {
            where: { isActive: true },
            include: {
              client: true
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.group.count({ where })
    ]);

    // Парсим schedule для каждой группы
    const groupsWithParsedSchedule = groups.map(group => {
      if (group.schedule) {
        try {
          return { ...group, schedule: JSON.parse(group.schedule) };
        } catch (e) {
          return group;
        }
      }
      return group;
    });

    res.json({
      success: true,
      data: groupsWithParsedSchedule,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Groups retrieved successfully'
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve groups'
    });
  }
};

export const getGroupById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        branch: true,
        trainer: {
          include: {
            user: true
          }
        },
        memberships: {
          where: { isActive: true },
          include: {
            client: true
          }
        }
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    // Парсим schedule обратно в массив для ответа
    if (group.schedule) {
      try {
        (group as any).schedule = JSON.parse(group.schedule);
      } catch (e) {
        // Если не удалось распарсить, оставляем как есть
      }
    }

    res.json({
      success: true,
      data: group,
      message: 'Group retrieved successfully'
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve group'
    });
  }
};

export const createGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupData: any = {
      ...req.body,
      tenantId: req.tenant?.id
    };

    // Преобразуем schedule в JSON строку, если это массив
    if (groupData.schedule && Array.isArray(groupData.schedule)) {
      groupData.schedule = JSON.stringify(groupData.schedule);
    } else if (groupData.schedule === undefined || groupData.schedule === null) {
      groupData.schedule = null;
    }

    // Преобразуем trainingPrice: пустые строки в null/undefined
    if (groupData.trainingPrice === '' || groupData.trainingPrice === null || groupData.trainingPrice === undefined) {
      delete groupData.trainingPrice;
    } else if (typeof groupData.trainingPrice === 'string') {
      const price = parseFloat(groupData.trainingPrice);
      if (isNaN(price)) {
        delete groupData.trainingPrice;
      } else {
        groupData.trainingPrice = price;
      }
    }

    // Обработка полей ежемесячной оплаты
    if (groupData.isMonthlyPayment === undefined || groupData.isMonthlyPayment === null) {
      groupData.isMonthlyPayment = false;
    }
    if (groupData.monthlyPaymentAmount === '' || groupData.monthlyPaymentAmount === null || groupData.monthlyPaymentAmount === undefined) {
      delete groupData.monthlyPaymentAmount;
    } else if (typeof groupData.monthlyPaymentAmount === 'string') {
      const amount = parseFloat(groupData.monthlyPaymentAmount);
      if (isNaN(amount)) {
        delete groupData.monthlyPaymentAmount;
      } else {
        groupData.monthlyPaymentAmount = amount;
      }
    }
    if (groupData.paymentDueDay === '' || groupData.paymentDueDay === null || groupData.paymentDueDay === undefined) {
      delete groupData.paymentDueDay;
    } else if (typeof groupData.paymentDueDay === 'string') {
      const day = parseInt(groupData.paymentDueDay);
      if (isNaN(day) || day < 1 || day > 31) {
        delete groupData.paymentDueDay;
      } else {
        groupData.paymentDueDay = day;
      }
    }

    // Обработка полей зарплаты тренера
    if (groupData.trainerSalaryType === '' || groupData.trainerSalaryType === null || groupData.trainerSalaryType === undefined) {
      delete groupData.trainerSalaryType;
    }
    if (groupData.trainerMonthlyPercentage === '' || groupData.trainerMonthlyPercentage === null || groupData.trainerMonthlyPercentage === undefined) {
      delete groupData.trainerMonthlyPercentage;
    } else if (typeof groupData.trainerMonthlyPercentage === 'string') {
      const percentage = parseFloat(groupData.trainerMonthlyPercentage);
      if (isNaN(percentage)) {
        delete groupData.trainerMonthlyPercentage;
      } else {
        groupData.trainerMonthlyPercentage = percentage;
      }
    }
    if (groupData.trainerPerVisitPercentage === '' || groupData.trainerPerVisitPercentage === null || groupData.trainerPerVisitPercentage === undefined) {
      delete groupData.trainerPerVisitPercentage;
    } else if (typeof groupData.trainerPerVisitPercentage === 'string') {
      const percentage = parseFloat(groupData.trainerPerVisitPercentage);
      if (isNaN(percentage)) {
        delete groupData.trainerPerVisitPercentage;
      } else {
        groupData.trainerPerVisitPercentage = percentage;
      }
    }
    if (groupData.trainerPerVisitAmount === '' || groupData.trainerPerVisitAmount === null || groupData.trainerPerVisitAmount === undefined) {
      delete groupData.trainerPerVisitAmount;
    } else if (typeof groupData.trainerPerVisitAmount === 'string') {
      const amount = parseFloat(groupData.trainerPerVisitAmount);
      if (isNaN(amount)) {
        delete groupData.trainerPerVisitAmount;
      } else {
        groupData.trainerPerVisitAmount = amount;
      }
    }

    // Удаляем поле createPaymentsImmediately, так как оно используется только на фронтенде
    delete groupData.createPaymentsImmediately;

    const group = await prisma.group.create({
      data: groupData,
      include: {
        branch: true,
        trainer: {
          include: {
            user: true
          }
        }
      }
    });

    // Парсим schedule обратно в массив для ответа
    if (group.schedule) {
      try {
        (group as any).schedule = JSON.parse(group.schedule);
      } catch (e) {
        // Если не удалось распарсить, оставляем как есть
      }
    }

    res.status(201).json({
      success: true,
      data: group,
      message: 'Group created successfully'
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create group'
    });
  }
};

export const updateGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    const updateData: any = { ...req.body };
    
    // Преобразуем schedule в JSON строку, если это массив
    if (updateData.schedule !== undefined) {
      if (Array.isArray(updateData.schedule)) {
        updateData.schedule = JSON.stringify(updateData.schedule);
      } else if (updateData.schedule === null) {
        updateData.schedule = null;
      }
    }

    // Преобразуем trainingPrice: пустые строки в null/undefined
    if (updateData.trainingPrice !== undefined) {
      if (updateData.trainingPrice === '' || updateData.trainingPrice === null) {
        delete updateData.trainingPrice;
      } else if (typeof updateData.trainingPrice === 'string') {
        const price = parseFloat(updateData.trainingPrice);
        if (isNaN(price)) {
          delete updateData.trainingPrice;
        } else {
          updateData.trainingPrice = price;
        }
      }
    }

    // Обработка полей ежемесячной оплаты
    if (updateData.isMonthlyPayment !== undefined) {
      if (updateData.isMonthlyPayment === null) {
        updateData.isMonthlyPayment = false;
      }
    }
    if (updateData.monthlyPaymentAmount !== undefined) {
      if (updateData.monthlyPaymentAmount === '' || updateData.monthlyPaymentAmount === null) {
        delete updateData.monthlyPaymentAmount;
      } else if (typeof updateData.monthlyPaymentAmount === 'string') {
        const amount = parseFloat(updateData.monthlyPaymentAmount);
        if (isNaN(amount)) {
          delete updateData.monthlyPaymentAmount;
        } else {
          updateData.monthlyPaymentAmount = amount;
        }
      }
    }
    if (updateData.paymentDueDay !== undefined) {
      if (updateData.paymentDueDay === '' || updateData.paymentDueDay === null) {
        delete updateData.paymentDueDay;
      } else if (typeof updateData.paymentDueDay === 'string') {
        const day = parseInt(updateData.paymentDueDay);
        if (isNaN(day) || day < 1 || day > 31) {
          delete updateData.paymentDueDay;
        } else {
          updateData.paymentDueDay = day;
        }
      }
    }

    // Обработка полей зарплаты тренера
    if (updateData.trainerSalaryType !== undefined) {
      if (updateData.trainerSalaryType === '' || updateData.trainerSalaryType === null) {
        delete updateData.trainerSalaryType;
      }
    }
    if (updateData.trainerMonthlyPercentage !== undefined) {
      if (updateData.trainerMonthlyPercentage === '' || updateData.trainerMonthlyPercentage === null) {
        delete updateData.trainerMonthlyPercentage;
      } else if (typeof updateData.trainerMonthlyPercentage === 'string') {
        const percentage = parseFloat(updateData.trainerMonthlyPercentage);
        if (isNaN(percentage)) {
          delete updateData.trainerMonthlyPercentage;
        } else {
          updateData.trainerMonthlyPercentage = percentage;
        }
      }
    }
    if (updateData.trainerPerVisitPercentage !== undefined) {
      if (updateData.trainerPerVisitPercentage === '' || updateData.trainerPerVisitPercentage === null) {
        delete updateData.trainerPerVisitPercentage;
      } else if (typeof updateData.trainerPerVisitPercentage === 'string') {
        const percentage = parseFloat(updateData.trainerPerVisitPercentage);
        if (isNaN(percentage)) {
          delete updateData.trainerPerVisitPercentage;
        } else {
          updateData.trainerPerVisitPercentage = percentage;
        }
      }
    }
    if (updateData.trainerPerVisitAmount !== undefined) {
      if (updateData.trainerPerVisitAmount === '' || updateData.trainerPerVisitAmount === null) {
        delete updateData.trainerPerVisitAmount;
      } else if (typeof updateData.trainerPerVisitAmount === 'string') {
        const amount = parseFloat(updateData.trainerPerVisitAmount);
        if (isNaN(amount)) {
          delete updateData.trainerPerVisitAmount;
        } else {
          updateData.trainerPerVisitAmount = amount;
        }
      }
    }

    // Удаляем поле createPaymentsImmediately, так как оно используется только на фронтенде
    delete updateData.createPaymentsImmediately;

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: updateData,
      include: {
        branch: true,
        trainer: {
          include: {
            user: true
          }
        }
      }
    });

    // Парсим schedule обратно в массив для ответа
    if (updatedGroup.schedule) {
      try {
        (updatedGroup as any).schedule = JSON.parse(updatedGroup.schedule);
      } catch (e) {
        // Если не удалось распарсить, оставляем как есть
      }
    }

    res.json({
      success: true,
      data: updatedGroup,
      message: 'Group updated successfully'
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update group'
    });
  }
};

export const deleteGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    // Удаляем все тренировки этой группы (мягкое удаление - помечаем как отмененные)
    await prisma.training.updateMany({
      where: {
        groupId: id,
        tenantId: req.tenant?.id,
        isCancelled: false
      },
      data: {
        isCancelled: true
      }
    });

    // Удаляем группу (мягкое удаление)
    await prisma.group.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete group'
    });
  }
};

export const addClientToGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // group id
    const { clientId } = req.body;

    if (!clientId) {
      res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
      return;
    }

    // Verify group exists and belongs to tenant
    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    // Verify client exists and belongs to tenant
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: req.tenant?.id
      }
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found'
      });
      return;
    }

    // Check if client is already in group
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        clientId_groupId: {
          clientId,
          groupId: id
        }
      }
    });

    if (existingMembership) {
      // If membership exists but is inactive, reactivate it
      if (!existingMembership.isActive) {
        const updated = await prisma.groupMembership.update({
          where: {
            clientId_groupId: {
              clientId,
              groupId: id
            }
          },
          data: {
            isActive: true,
            leftAt: null
          },
          include: {
            client: true
          }
        });

        res.json({
          success: true,
          data: updated,
          message: 'Client re-added to group successfully'
        });
        return;
      } else {
        res.status(400).json({
          success: false,
          error: 'Client is already in this group'
        });
        return;
      }
    }

    // Check max members limit
    if (group.maxMembers) {
      const activeMembersCount = await prisma.groupMembership.count({
        where: {
          groupId: id,
          isActive: true
        }
      });

      if (activeMembersCount >= group.maxMembers) {
        res.status(400).json({
          success: false,
          error: `Group has reached maximum capacity of ${group.maxMembers} members`
        });
        return;
      }
    }

    // Create new membership
    const membership = await prisma.groupMembership.create({
      data: {
        clientId,
        groupId: id
      },
      include: {
        client: true
      }
    });

    res.status(201).json({
      success: true,
      data: membership,
      message: 'Client added to group successfully'
    });
  } catch (error: any) {
    console.error('Add client to group error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'Client is already in this group'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to add client to group'
      });
    }
  }
};

export const removeClientFromGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // group id
    const { clientId } = req.params; // client id from route

    // Verify group exists and belongs to tenant
    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    // Find membership
    const membership = await prisma.groupMembership.findUnique({
      where: {
        clientId_groupId: {
          clientId,
          groupId: id
        }
      }
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        error: 'Client is not a member of this group'
      });
      return;
    }

    // Soft delete - mark as inactive
    await prisma.groupMembership.update({
      where: {
        clientId_groupId: {
          clientId,
          groupId: id
        }
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Client removed from group successfully'
    });
  } catch (error) {
    console.error('Remove client from group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove client from group'
    });
  }
};
