import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    // Get current date range for monthly revenue
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get upcoming trainings (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Check if user is a trainer
    let trainer = null;
    let trainerGroupIds: string[] = [];
    
    if (req.user?.role === 'TRAINER') {
      trainer = await prisma.trainer.findFirst({
        where: {
          userId: req.user.id,
          tenantId
        },
        include: {
          groups: true
        }
      });

      if (trainer) {
        trainerGroupIds = trainer.groups.map(g => g.id);
      }
    }

    // Parallel queries for better performance
    const [
      totalClients,
      activeClients,
      totalTrainers,
      totalGroups,
      totalBranches,
      monthlyPayments,
      totalAttendances,
      presentAttendances,
      upcomingTrainings
    ] = await Promise.all([
      // Total clients - для тренера только клиенты его групп
      trainer && trainerGroupIds.length > 0
        ? prisma.client.count({
            where: {
              tenantId,
              groupMemberships: {
                some: {
                  groupId: { in: trainerGroupIds },
                  isActive: true
                }
              }
            }
          })
        : prisma.client.count({
            where: { tenantId }
          }),
      // Active clients - для тренера только активные клиенты его групп
      trainer && trainerGroupIds.length > 0
        ? prisma.client.count({
            where: {
              tenantId,
              isActive: true,
              groupMemberships: {
                some: {
                  groupId: { in: trainerGroupIds },
                  isActive: true
                }
              }
            }
          })
        : prisma.client.count({
            where: {
              tenantId,
              isActive: true
            }
          }),
      // Total trainers - для тренера не показываем
      req.user?.role === 'TRAINER' 
        ? Promise.resolve(0)
        : prisma.trainer.count({
            where: {
              tenantId,
              isActive: true
            }
          }),
      // Total groups - для тренера только его группы
      trainer && trainerGroupIds.length > 0
        ? prisma.group.count({
            where: {
              id: { in: trainerGroupIds },
              tenantId,
              isActive: true
            }
          })
        : prisma.group.count({
            where: {
              tenantId,
              isActive: true
            }
          }),
      // Total branches - для тренера не показываем
      req.user?.role === 'TRAINER'
        ? Promise.resolve(0)
        : prisma.branch.count({
            where: {
              tenantId,
              isActive: true
            }
          }),
      // Monthly revenue - для тренера не считаем
      req.user?.role === 'TRAINER'
        ? Promise.resolve({ _sum: { amount: null } })
        : prisma.payment.aggregate({
            where: {
              tenantId,
              status: 'paid',
              paidAt: {
                gte: startOfMonth,
                lte: endOfMonth
              }
            },
            _sum: {
              amount: true
            }
          }),
      // Total attendances - для тренера только его групп
      trainer && trainerGroupIds.length > 0
        ? prisma.attendance.count({
            where: {
              tenantId,
              training: {
                groupId: { in: trainerGroupIds }
              },
              createdAt: {
                gte: startOfMonth
              }
            }
          })
        : prisma.attendance.count({
            where: {
              tenantId,
              createdAt: {
                gte: startOfMonth
              }
            }
          }),
      // Present attendances - для тренера только его групп
      trainer && trainerGroupIds.length > 0
        ? prisma.attendance.count({
            where: {
              tenantId,
              status: 'PRESENT',
              training: {
                groupId: { in: trainerGroupIds }
              },
              createdAt: {
                gte: startOfMonth
              }
            }
          })
        : prisma.attendance.count({
            where: {
              tenantId,
              status: 'PRESENT',
              createdAt: {
                gte: startOfMonth
              }
            }
          }),
      // Upcoming trainings - для тренера только его тренировки
      trainer
        ? prisma.training.count({
            where: {
              trainerId: trainer.id,
              tenantId,
              startTime: {
                gte: now,
                lte: nextWeek
              }
            }
          })
        : prisma.training.count({
            where: {
              tenantId,
              startTime: {
                gte: now,
                lte: nextWeek
              }
            }
          })
    ]);

    // Calculate monthly revenue
    const monthlyRevenue = monthlyPayments._sum.amount 
      ? Number(monthlyPayments._sum.amount) 
      : 0;

    // Calculate attendance rate
    const attendanceRate = totalAttendances > 0
      ? Math.round((presentAttendances / totalAttendances) * 100)
      : 0;

    // Calculate trainer monthly earnings if user is a trainer
    let trainerMonthlyEarnings = 0;
    if (trainer) {
      const ledgerAgg = await prisma.trainerSalaryLedger.aggregate({
        where: {
          trainerId: trainer.id,
          tenantId,
          kind: { not: 'payout' },
          occurredAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      });
      trainerMonthlyEarnings = Number(ledgerAgg._sum.amount || 0);
    }

    res.json({
      success: true,
      data: {
        totalClients,
        activeClients,
        totalTrainers,
        totalGroups,
        totalBranches,
        monthlyRevenue,
        attendanceRate,
        upcomingTrainings,
        trainerMonthlyEarnings: trainer ? trainerMonthlyEarnings : undefined
      },
      message: 'Dashboard stats retrieved successfully'
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard stats'
    });
  }
};

export const getRecentActivity = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    const limit = parseInt(req.query.limit as string) || 10;
    /** Берём с запасом, чтобы после группировки хватило сводных карточек */
    const fetchLimit = Math.min(Math.max(limit * 15, 30), 200);

    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    let trainer = null;
    let trainerGroupIds: string[] = [];

    if (req.user?.role === 'TRAINER') {
      trainer = await prisma.trainer.findFirst({
        where: {
          userId: req.user.id,
          tenantId
        },
        include: {
          groups: true
        }
      });

      if (trainer) {
        trainerGroupIds = trainer.groups.map((g) => g.id);
      }
    }

    const [recentClients, recentPayments, recentTrainings, recentAttendances] = await Promise.all([
      trainer && trainerGroupIds.length > 0
        ? prisma.client.findMany({
            where: {
              tenantId,
              groupMemberships: {
                some: {
                  groupId: { in: trainerGroupIds },
                  isActive: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            include: {
              groupMemberships: {
                where: {
                  isActive: true,
                  groupId: { in: trainerGroupIds }
                },
                include: { group: true },
                take: 1
              }
            }
          })
        : prisma.client.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            include: {
              groupMemberships: {
                where: { isActive: true },
                include: { group: true },
                take: 1
              }
            }
          }),
      req.user?.role === 'TRAINER'
        ? Promise.resolve([])
        : prisma.payment.findMany({
            where: { tenantId, status: 'paid' },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            include: {
              client: true,
              membership: true
            }
          }),
      trainer
        ? prisma.training.findMany({
            where: {
              tenantId,
              trainerId: trainer.id,
              endTime: { lt: new Date() }
            },
            orderBy: { endTime: 'desc' },
            take: fetchLimit,
            include: {
              group: true,
              trainer: { include: { user: true } },
              substituteTrainer: { include: { user: true } }
            }
          })
        : prisma.training.findMany({
            where: {
              tenantId,
              endTime: { lt: new Date() }
            },
            orderBy: { endTime: 'desc' },
            take: fetchLimit,
            include: {
              group: true,
              trainer: { include: { user: true } },
              substituteTrainer: { include: { user: true } }
            }
          }),
      trainer && trainerGroupIds.length > 0
        ? prisma.attendance.findMany({
            where: {
              tenantId,
              training: { groupId: { in: trainerGroupIds } }
            },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            include: {
              client: true,
              training: { include: { group: true } }
            }
          })
        : prisma.attendance.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit,
            include: {
              client: true,
              training: { include: { group: true } }
            }
          })
    ]);

    const dayKey = (d: Date) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };

    const attendanceStatusLabel = (status: string) => {
      switch (status) {
        case 'PRESENT':
          return 'присутствовал';
        case 'ABSENT':
          return 'отсутствовал';
        case 'EXCUSED':
          return 'уважительная причина';
        case 'LATE':
          return 'опоздал';
        default:
          return status.toLowerCase();
      }
    };

    type ActivityItem = {
      label: string;
      detail?: string;
      timestamp: Date;
      amount?: number;
    };

    type RawActivity = {
      type: string;
      groupKey: string;
      title: string;
      icon: string;
      timestamp: Date;
      item: ActivityItem;
      amount?: number;
      meta?: { trainingId?: string; groupName?: string };
    };

    const raw: RawActivity[] = [];

    for (const client of recentClients) {
      const group = client.groupMemberships?.[0]?.group;
      const name = `${client.firstName} ${client.lastName}`.trim();
      raw.push({
        type: 'client_created',
        groupKey: `client_created:${dayKey(client.createdAt)}`,
        title: 'Новые клиенты',
        icon: 'People',
        timestamp: client.createdAt,
        item: {
          label: name,
          detail: group ? `группа ${group.name}` : undefined,
          timestamp: client.createdAt,
        },
      });
    }

    for (const payment of recentPayments) {
      const ts = payment.paidAt || payment.createdAt;
      const name = `${payment.client.firstName} ${payment.client.lastName}`.trim();
      const kind = payment.type === 'membership' ? 'абонемент' : 'платёж';
      raw.push({
        type: 'payment_received',
        groupKey: `payment_received:${dayKey(ts)}`,
        title: 'Получены платежи',
        icon: 'AttachMoney',
        timestamp: ts,
        amount: Number(payment.amount),
        item: {
          label: name,
          detail: kind,
          timestamp: ts,
          amount: Number(payment.amount),
        },
      });
    }

    for (const training of recentTrainings) {
      const trainerUser =
        training.substituteTrainer?.user || training.trainer?.user;
      const trainerName = trainerUser
        ? `${trainerUser.firstName || ''} ${trainerUser.lastName || ''}`.trim()
        : '';
      const label = training.group?.name || training.title || 'Тренировка';
      raw.push({
        type: 'training_completed',
        groupKey: `training_completed:${dayKey(training.endTime)}`,
        title: 'Завершённые тренировки',
        icon: 'CheckCircle',
        timestamp: training.endTime,
        item: {
          label,
          detail: trainerName || undefined,
          timestamp: training.endTime,
        },
      });
    }

    for (const attendance of recentAttendances) {
      const name = `${attendance.client.firstName} ${attendance.client.lastName}`.trim();
      const groupName = attendance.training?.group?.name || attendance.training?.title || 'Тренировка';
      const ts = attendance.updatedAt || attendance.createdAt;
      raw.push({
        type: 'attendance_marked',
        groupKey: `attendance_marked:${attendance.trainingId}`,
        title: 'Отмечена посещаемость',
        icon: 'CheckCircle',
        timestamp: ts,
        meta: { trainingId: attendance.trainingId, groupName },
        item: {
          label: name,
          detail: attendanceStatusLabel(attendance.status),
          timestamp: ts,
        },
      });
    }

    // Группировка по groupKey
    const groups = new Map<string, RawActivity[]>();
    for (const event of raw) {
      const list = groups.get(event.groupKey) || [];
      list.push(event);
      groups.set(event.groupKey, list);
    }

    const activities = Array.from(groups.values()).map((events) => {
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const head = events[0];
      const items = events.map((e) => ({
        label: e.item.label,
        detail: e.item.detail || null,
        timestamp: e.item.timestamp,
        amount: e.item.amount != null ? Number(e.item.amount) : undefined,
      }));
      const count = items.length;
      const totalAmount =
        head.type === 'payment_received'
          ? events.reduce((s, e) => s + (Number(e.amount) || 0), 0)
          : undefined;

      let description: string;
      if (head.type === 'attendance_marked') {
        const gName = head.meta?.groupName || 'тренировка';
        description =
          count === 1
            ? `${items[0].label} — ${items[0].detail || 'отмечен'} · ${gName}`
            : `${count} клиентов — ${gName}`;
      } else if (head.type === 'payment_received') {
        description =
          count === 1
            ? `${items[0].detail || 'Платёж'} от ${items[0].label}`
            : `${count} платежей на ${Number(totalAmount || 0).toLocaleString('ru-RU')} ₽`;
      } else if (head.type === 'client_created') {
        description =
          count === 1
            ? `${items[0].label}${items[0].detail ? ` · ${items[0].detail}` : ''}`
            : `${count} новых клиентов`;
      } else if (head.type === 'training_completed') {
        description =
          count === 1
            ? `${items[0].label}${items[0].detail ? ` — ${items[0].detail}` : ''}`
            : `${count} тренировок`;
      } else {
        description = count === 1 ? items[0].label : `${count} событий`;
      }

      const singularTitle: Record<string, string> = {
        client_created: 'Новый клиент зарегистрирован',
        payment_received: 'Получен платеж',
        training_completed: 'Тренировка завершена',
        attendance_marked: 'Отмечена посещаемость',
      };

      return {
        type: head.type,
        title: count === 1 ? singularTitle[head.type] || head.title : head.title,
        description,
        timestamp: head.timestamp,
        icon: head.icon,
        amount: totalAmount,
        count,
        trainingId: head.meta?.trainingId,
        groupName: head.meta?.groupName,
        items,
      };
    });

    activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const limitedActivities = activities.slice(0, limit);

    res.json({
      success: true,
      data: limitedActivities,
      message: 'Recent activity retrieved successfully'
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent activity'
    });
  }
};

export const getUpcomingTrainings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const days = parseInt(req.query.days as string) || 7;

    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    // Check if user is a trainer
    let trainerId: string | undefined;
    
    if (req.user?.role === 'TRAINER') {
      const trainer = await prisma.trainer.findFirst({
        where: {
          userId: req.user.id,
          tenantId
        }
      });
      if (trainer) {
        trainerId = trainer.id;
      }
    }

    const trainings = await prisma.training.findMany({
      where: {
        tenantId,
        ...(trainerId && { trainerId }),
        startTime: {
          gte: now,
          lte: futureDate
        }
      },
      include: {
        group: {
          include: {
            memberships: {
              where: { isActive: true },
              include: {
                client: true
              }
            }
          }
        },
        trainer: {
          include: {
            user: true
          }
        },
        substituteTrainer: {
          include: {
            user: true
          }
        },
        branch: true
      },
      orderBy: {
        startTime: 'asc'
      },
      take: limit
    });

    // Format trainings with member count
    const formattedTrainings = trainings.map(training => ({
      id: training.id,
      title: training.title || training.group?.name || 'Тренировка',
      description: training.description,
      startTime: training.startTime,
      endTime: training.endTime,
      group: training.group,
      trainer: training.trainer,
      branch: training.branch,
      memberCount: training.group?.memberships?.length || 0
    }));

    res.json({
      success: true,
      data: formattedTrainings,
      message: 'Upcoming trainings retrieved successfully'
    });
  } catch (error) {
    console.error('Get upcoming trainings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve upcoming trainings'
    });
  }
};

