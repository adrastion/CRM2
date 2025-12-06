import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

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
      const trainings = await prisma.training.findMany({
        where: {
          trainerId: trainer.id,
          tenantId,
          isCancelled: false,
          startTime: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        include: {
          group: true,
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
          attendances: {
            where: { status: 'PRESENT' },
            include: { client: true }
          }
        }
      });

      trainerMonthlyEarnings = trainings.reduce((total, training) => {
        const presentCount = training.attendances.length;
        const trainingPrice = training.group?.trainingPrice ? Number(training.group.trainingPrice) : 0;
        const totalRevenue = presentCount * trainingPrice;

        let earnings = 0;

        switch (trainer.salaryType) {
          case 'percentage':
            if (trainer.salaryAmount) {
              const percentage = Number(trainer.salaryAmount);
              earnings = (totalRevenue * percentage) / 100;
            }
            break;
          case 'per_student':
            if (trainer.salaryAmount) {
              const pricePerStudent = Number(trainer.salaryAmount);
              earnings = presentCount * pricePerStudent;
            }
            break;
          case 'fixed':
            if (trainer.salaryAmount) {
              earnings = Number(trainer.salaryAmount);
            }
            break;
          case 'per_training':
            if (trainer.salaryAmount) {
              earnings = Number(trainer.salaryAmount);
            }
            break;
          case 'individual':
            if (presentCount === 1 && trainer.salaryAmount && trainer.salaryPercentage) {
              const trainerPercentage = Number(trainer.salaryPercentage);
              earnings = (trainingPrice * trainerPercentage) / 100;
            }
            break;
        }

        return total + earnings;
      }, 0);
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

    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

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

    // Get recent activities from different sources
    const [recentClients, recentPayments, recentTrainings, recentAttendances] = await Promise.all([
      // Recent clients - для тренера только клиенты его групп
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
            take: limit,
            include: {
              groupMemberships: {
                where: { 
                  isActive: true,
                  groupId: { in: trainerGroupIds }
                },
                include: {
                  group: true
                },
                take: 1
              }
            }
          })
        : prisma.client.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
              groupMemberships: {
                where: { isActive: true },
                include: {
                  group: true
                },
                take: 1
              }
            }
          }),
      // Recent payments - для тренера не показываем
      req.user?.role === 'TRAINER'
        ? Promise.resolve([])
        : prisma.payment.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
              client: true,
              membership: true
            }
          }),
      // Recent trainings - для тренера только его тренировки
      trainer
        ? prisma.training.findMany({
            where: {
              tenantId,
              trainerId: trainer.id
            },
            orderBy: { startTime: 'desc' },
            take: limit,
            include: {
              group: true,
              trainer: {
                include: {
                  user: true
                }
              },
              substituteTrainer: {
                include: {
                  user: true
                }
              }
            }
          })
        : prisma.training.findMany({
            where: { tenantId },
            orderBy: { startTime: 'desc' },
            take: limit,
            include: {
              group: true,
              trainer: {
                include: {
                  user: true
                }
              },
              substituteTrainer: {
                include: {
                  user: true
                }
              }
            }
          }),
      // Recent attendances - для тренера только его групп
      trainer && trainerGroupIds.length > 0
        ? prisma.attendance.findMany({
            where: {
              tenantId,
              training: {
                groupId: { in: trainerGroupIds }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
              client: true,
              training: {
                include: {
                  group: true
                }
              }
            }
          })
        : prisma.attendance.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
              client: true,
              training: {
                include: {
                  group: true
                }
              }
            }
          })
    ]);

    // Combine and format activities
    const activities: any[] = [];

    // Add client activities
    recentClients.forEach(client => {
      const group = client.groupMemberships?.[0]?.group;
      activities.push({
        type: 'client_created',
        title: 'Новый клиент зарегистрирован',
        description: `${client.firstName} ${client.lastName}${group ? ` присоединился к группе ${group.name}` : ''}`,
        timestamp: client.createdAt,
        icon: 'People'
      });
    });

    // Add payment activities
    recentPayments.forEach(payment => {
      if (payment.status === 'paid') {
        activities.push({
          type: 'payment_received',
          title: 'Получен платеж',
          description: `${payment.type === 'membership' ? 'Ежемесячный платеж за членство' : 'Платеж'} от ${payment.client.firstName} ${payment.client.lastName}`,
          timestamp: payment.paidAt || payment.createdAt,
          icon: 'AttachMoney',
          amount: payment.amount
        });
      }
    });

    // Add training activities
    recentTrainings.forEach(training => {
      const now = new Date();
      if (new Date(training.endTime) < now) {
        // Completed training
        activities.push({
          type: 'training_completed',
          title: 'Тренировка завершена',
          description: `${training.group?.name || training.title || 'Тренировка'} - ${training.trainer?.user?.firstName} ${training.trainer?.user?.lastName}`,
          timestamp: training.endTime,
          icon: 'CheckCircle'
        });
      }
    });

    // Add attendance activities
    recentAttendances.forEach(attendance => {
      if (attendance.status === 'PRESENT') {
        activities.push({
          type: 'attendance_marked',
          title: 'Отмечена посещаемость',
          description: `${attendance.client.firstName} ${attendance.client.lastName} присутствовал на тренировке`,
          timestamp: attendance.createdAt,
          icon: 'CheckCircle'
        });
      }
    });

    // Sort by timestamp (most recent first) and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

