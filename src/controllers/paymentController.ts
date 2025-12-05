import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

/**
 * Helper function to create ClientMembership from payment
 */
async function createClientMembershipFromPayment(
  payment: { type: string; status: string; membershipId: string | null; clientId: string },
  tenantId: string
): Promise<void> {
  // Если платеж за абонемент и статус "paid", создаем ClientMembership
  if (payment.type === 'membership' && payment.status === 'paid' && payment.membershipId) {
    // Проверяем, не существует ли уже активный абонемент для этого платежа
    const existingMembership = await prisma.clientMembership.findFirst({
      where: {
        clientId: payment.clientId,
        membershipId: payment.membershipId,
        isActive: true,
        tenantId
      }
    });

    // Если уже есть активный абонемент, не создаем новый
    if (existingMembership) {
      console.log('Active membership already exists for this payment');
      return;
    }

    const membership = await prisma.membership.findFirst({
      where: {
        id: payment.membershipId,
        tenantId
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
          tenantId
        }
      });
    }
  }
}

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
        branch: true,
        group: true
      }
    });

    // Если платеж за абонемент и статус "paid", создаем ClientMembership
    if (req.tenant?.id) {
      await createClientMembershipFromPayment(payment, req.tenant.id);
    }

    // Если платеж создан как оплаченный и это ежемесячный платеж группы, проверяем нужно ли начислить зарплату тренеру
    if (payment.status === 'paid' && payment.isMonthlyPayment && payment.groupId && req.tenant?.id) {
      await checkAndCalculateTrainerMonthlySalary(payment.groupId, req.tenant.id);
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
    const statusChangedToPaid = req.body.status === 'paid' && payment.status !== 'paid';
    
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
        branch: true,
        group: true
      }
    });

    // Если статус изменился на 'paid', создаем ClientMembership
    if (statusChangedToPaid && req.tenant?.id) {
      await createClientMembershipFromPayment(updatedPayment, req.tenant.id);
    }

    // Если платеж стал оплаченным и это ежемесячный платеж группы, проверяем нужно ли начислить зарплату тренеру
    if (statusChangedToPaid && updatedPayment.isMonthlyPayment && updatedPayment.groupId && req.tenant?.id) {
      await checkAndCalculateTrainerMonthlySalary(updatedPayment.groupId, req.tenant.id);
    }

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

/**
 * Проверяет и начисляет ежемесячную зарплату тренеру, если все клиенты группы оплатили
 */
async function checkAndCalculateTrainerMonthlySalary(groupId: string, tenantId: string): Promise<void> {
  try {
    const group = await prisma.group.findFirst({
      where: { id: groupId, tenantId },
      include: {
        trainer: true,
        memberships: {
          where: { isActive: true, leftAt: null },
          include: {
            client: true
          }
        }
      }
    });

    if (!group || !group.isMonthlyPayment || group.trainerSalaryType !== 'monthly_percentage' || !group.trainerMonthlyPercentage) {
      return; // Не ежемесячная оплата или не настроена зарплата тренера
    }

    if (!group.trainer) {
      return; // Нет тренера
    }

    const trainerId = group.trainer.id;
    const monthlyPercentage = Number(group.trainerMonthlyPercentage);
    const monthlyAmount = Number(group.monthlyPaymentAmount || 0);

    if (monthlyAmount <= 0) {
      return; // Нет суммы ежемесячной оплаты
    }

    // Получаем текущий месяц
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // Проверяем, не начислена ли уже зарплата за этот месяц
    const existingSalary = await prisma.transaction.findFirst({
      where: {
        tenantId,
        trainerId,
        type: 'trainer_monthly_salary',
        description: { contains: `Группа: ${group.name}` },
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    });

    if (existingSalary) {
      return; // Зарплата уже начислена за этот месяц
    }

    // Получаем всех активных клиентов группы
    const activeClients = group.memberships.map(m => m.client);

    if (activeClients.length === 0) {
      return; // Нет активных клиентов
    }

    // Проверяем, все ли клиенты оплатили ежемесячный платеж за текущий месяц
    const allPaymentsPaid = await Promise.all(
      activeClients.map(async (client) => {
        const payment = await prisma.payment.findFirst({
          where: {
            tenantId,
            clientId: client.id,
            groupId: group.id,
            isMonthlyPayment: true,
            status: 'paid',
            paidAt: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        });
        return !!payment;
      })
    );

    const allPaid = allPaymentsPaid.every(paid => paid === true);

    if (!allPaid) {
      return; // Не все клиенты оплатили
    }

    // Рассчитываем общую сумму оплаченных платежей
    const totalPaidAmount = activeClients.length * monthlyAmount;

    // Рассчитываем зарплату тренера (процент от общей суммы)
    const trainerSalary = (totalPaidAmount * monthlyPercentage) / 100;

    if (trainerSalary > 0) {
      // Начисляем зарплату тренеру
      const currentBalance = Number(group.trainer.balance || 0);
      const newBalance = currentBalance + trainerSalary;

      await prisma.trainer.update({
        where: { id: trainerId },
        data: { balance: newBalance }
      });

      // Создаем транзакцию
      await prisma.transaction.create({
        data: {
          type: 'trainer_monthly_salary',
          amount: trainerSalary,
          description: `Ежемесячная зарплата за группу "${group.name}" (${currentMonth + 1}/${currentYear})`,
          trainerId,
          tenantId
        }
      });

      console.log(`Начислена ежемесячная зарплата тренеру ${trainerId}: ${trainerSalary} руб. за группу ${group.name}`);
    }
  } catch (error) {
    console.error('Error calculating trainer monthly salary:', error);
    // Не пробрасываем ошибку, чтобы не нарушить основной процесс обновления платежа
  }
}

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

/**
 * Создает ежемесячные платежи для всех активных клиентов групп с ежемесячной оплатой
 */
export const createMonthlyPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
      return;
    }

    const today = new Date();
    const currentDay = today.getDate();

    // Находим все группы с ежемесячной оплатой, где paymentDueDay совпадает с текущим днем
    const groups = await prisma.group.findMany({
      where: {
        tenantId,
        isActive: true,
        isMonthlyPayment: true,
        paymentDueDay: currentDay,
        monthlyPaymentAmount: { not: null }
      },
      include: {
        memberships: {
          where: {
            isActive: true,
            leftAt: null
          },
          include: {
            client: true
          }
        }
      }
    });

    const createdPayments = [];
    const errors = [];

    for (const group of groups) {
      const monthlyAmount = Number(group.monthlyPaymentAmount || 0);
      if (monthlyAmount <= 0) continue;

      // Вычисляем дату оплаты (сегодня)
      const dueDate = new Date(today);
      dueDate.setHours(23, 59, 59, 999);

      // Проверяем, не создан ли уже платеж для этого месяца
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      for (const membership of group.memberships) {
        try {
          // Проверяем, не существует ли уже платеж для этого клиента и группы в текущем месяце
          const existingPayment = await prisma.payment.findFirst({
            where: {
              tenantId,
              clientId: membership.clientId,
              groupId: group.id,
              isMonthlyPayment: true,
              createdAt: {
                gte: new Date(currentYear, currentMonth, 1),
                lt: new Date(currentYear, currentMonth + 1, 1)
              }
            }
          });

          if (existingPayment) {
            console.log(`Payment already exists for client ${membership.clientId} and group ${group.id} for ${currentMonth}/${currentYear}`);
            continue;
          }

          // Создаем платеж
          const payment = await prisma.payment.create({
            data: {
              tenantId,
              clientId: membership.clientId,
              groupId: group.id,
              amount: monthlyAmount,
              originalAmount: monthlyAmount,
              type: 'monthly_payment',
              status: 'pending',
              dueDate,
              isMonthlyPayment: true,
              branchId: group.branchId
            },
            include: {
              client: true,
              group: true
            }
          });

          createdPayments.push(payment);
        } catch (error: any) {
          console.error(`Error creating payment for client ${membership.clientId} and group ${group.id}:`, error);
          errors.push({
            clientId: membership.clientId,
            groupId: group.id,
            error: error.message
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        created: createdPayments.length,
        errors: errors.length,
        payments: createdPayments,
        errorDetails: errors
      },
      message: `Created ${createdPayments.length} monthly payments${errors.length > 0 ? `, ${errors.length} errors` : ''}`
    });
  } catch (error) {
    console.error('Create monthly payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create monthly payments'
    });
  }
};

/**
 * Автоматическое создание ежемесячных платежей для всех тенантов
 * Используется в cron job
 */
export const createMonthlyPaymentsForAllTenants = async () => {
  try {
    console.log('[Cron] Starting automatic monthly payments creation...');
    
    // Получаем все активные тенанты
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true
      }
    });

    let totalCreated = 0;
    let totalErrors = 0;

    for (const tenant of tenants) {
      try {
        const today = new Date();
        const currentDay = today.getDate();

        // Находим все группы с ежемесячной оплатой, где paymentDueDay совпадает с текущим днем
        const groups = await prisma.group.findMany({
          where: {
            tenantId: tenant.id,
            isActive: true,
            isMonthlyPayment: true,
            paymentDueDay: currentDay,
            monthlyPaymentAmount: { not: null }
          },
          include: {
            memberships: {
              where: {
                isActive: true,
                leftAt: null
              },
              include: {
                client: true
              }
            }
          }
        });

        for (const group of groups) {
          const monthlyAmount = Number(group.monthlyPaymentAmount || 0);
          if (monthlyAmount <= 0) continue;

          // Вычисляем дату оплаты (сегодня)
          const dueDate = new Date(today);
          dueDate.setHours(23, 59, 59, 999);

          // Проверяем, не создан ли уже платеж для этого месяца
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();

          for (const membership of group.memberships) {
            try {
              // Проверяем, не существует ли уже платеж для этого клиента и группы в текущем месяце
              const existingPayment = await prisma.payment.findFirst({
                where: {
                  tenantId: tenant.id,
                  clientId: membership.clientId,
                  groupId: group.id,
                  isMonthlyPayment: true,
                  createdAt: {
                    gte: new Date(currentYear, currentMonth, 1),
                    lt: new Date(currentYear, currentMonth + 1, 1)
                  }
                }
              });

              if (existingPayment) {
                continue;
              }

              // Создаем платеж
              await prisma.payment.create({
                data: {
                  tenantId: tenant.id,
                  clientId: membership.clientId,
                  groupId: group.id,
                  amount: monthlyAmount,
                  originalAmount: monthlyAmount,
                  type: 'monthly_payment',
                  status: 'pending',
                  dueDate,
                  isMonthlyPayment: true,
                  branchId: group.branchId
                }
              });

              totalCreated++;
            } catch (error: any) {
              console.error(`[Cron] Error creating payment for tenant ${tenant.id}, client ${membership.clientId}, group ${group.id}:`, error);
              totalErrors++;
            }
          }
        }
      } catch (error: any) {
        console.error(`[Cron] Error processing tenant ${tenant.id}:`, error);
        totalErrors++;
      }
    }

    console.log(`[Cron] Monthly payments creation completed. Created: ${totalCreated}, Errors: ${totalErrors}`);
    return { created: totalCreated, errors: totalErrors };
  } catch (error) {
    console.error('[Cron] Create monthly payments error:', error);
    throw error;
  }
};

/**
 * Перерасчет ежемесячного платежа клиента
 */
export const recalculateMonthlyPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newAmount } = req.body;

    // Проверяем права доступа (только OWNER или ADMIN)
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Only owners and administrators can recalculate payments'
      });
      return;
    }

    if (!newAmount || isNaN(Number(newAmount)) || Number(newAmount) <= 0) {
      res.status(400).json({
        success: false,
        error: 'Valid newAmount is required'
      });
      return;
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id,
        isMonthlyPayment: true
      }
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        error: 'Monthly payment not found'
      });
      return;
    }

    // Сохраняем оригинальную сумму, если она еще не сохранена
    const originalAmount = payment.originalAmount || payment.amount;
    const newAmountDecimal = Number(newAmount);

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        amount: newAmountDecimal,
        originalAmount: originalAmount
      },
      include: {
        client: true,
        group: true
      }
    });

    res.json({
      success: true,
      data: updatedPayment,
      message: 'Payment recalculated successfully'
    });
  } catch (error) {
    console.error('Recalculate payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate payment'
    });
  }
};

