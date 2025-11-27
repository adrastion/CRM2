import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import {
  deductFromClientBalance,
  calculateTrainerEarningsForAttendance,
  addToTrainerBalance
} from '../utils/finance';

const prisma = new PrismaClient();

export const getAttendances = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, trainingId, clientId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id
    };

    if (trainingId) {
      where.trainingId = trainingId as string;
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          client: true,
          training: {
            include: {
              group: true,
              trainer: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.attendance.count({ where })
    ]);

    res.json({
      success: true,
      data: attendances,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Attendances retrieved successfully'
    });
  } catch (error) {
    console.error('Get attendances error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve attendances'
    });
  }
};

export const getAttendanceById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attendance = await prisma.attendance.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        client: true,
        training: {
          include: {
            group: true,
            trainer: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!attendance) {
      res.status(404).json({
        success: false,
        error: 'Attendance not found'
      });
      return;
    }

    res.json({
      success: true,
      data: attendance,
      message: 'Attendance retrieved successfully'
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve attendance'
    });
  }
};

export const getAttendancesByTraining = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { trainingId } = req.params;

    // Verify training exists and belongs to tenant
    const training = await prisma.training.findFirst({
      where: {
        id: trainingId,
        tenantId: req.tenant?.id
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
        }
      }
    });

    if (!training) {
      res.status(404).json({
        success: false,
        error: 'Training not found'
      });
      return;
    }

    // Get existing attendances for this training
    const attendances = await prisma.attendance.findMany({
      where: {
        trainingId,
        tenantId: req.tenant?.id
      },
      include: {
        client: true
      }
    });

    // Create a map of clientId -> attendance for quick lookup
    const attendanceMap = new Map(attendances.map(a => [a.clientId, a]));

    // Get all clients from the group
    if (!training.group) {
      res.status(400).json({
        success: false,
        error: 'Training does not have an associated group'
      });
      return;
    }

    const groupClients = training.group.memberships
      .map(m => m.client)
      .filter(client => client && client.isActive);

    // Combine group clients with their attendance status
    const result = groupClients.map(client => {
      const attendance = attendanceMap.get(client.id);
      return {
        client,
        attendance: attendance || null
      };
    });

    res.json({
      success: true,
      data: {
        training,
        clients: result
      },
      message: 'Training attendance retrieved successfully'
    });
  } catch (error) {
    console.error('Get training attendances error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve training attendances'
    });
  }
};

export const createAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    const { clientId, trainingId, status, notes } = req.body;

    if (!clientId || !trainingId || !status) {
      res.status(400).json({
        success: false,
        error: 'Client ID, Training ID, and status are required'
      });
      return;
    }

    // Verify training exists and belongs to tenant
    const training = await prisma.training.findFirst({
      where: {
        id: trainingId,
        tenantId
      }
    });

    if (!training) {
      res.status(404).json({
        success: false,
        error: 'Training not found'
      });
      return;
    }

    // Verify client exists and belongs to tenant
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId
      }
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found'
      });
      return;
    }

    // Check if attendance already exists
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        clientId_trainingId: {
          clientId,
          trainingId
        }
      }
    });

    if (existingAttendance) {
      res.status(400).json({
        success: false,
        error: 'Attendance already exists for this client and training'
      });
      return;
    }

    // Create attendance
    const attendance = await prisma.attendance.create({
      data: {
        clientId,
        trainingId,
        status,
        notes,
        tenantId
      },
      include: {
        client: true,
        training: true
      }
    });

    // Если посещение со статусом PRESENT, обрабатываем оплату и абонемент
    if (status === 'PRESENT') {
      // Получаем информацию о тренировке с группой и тренером
      const trainingWithDetails = await prisma.training.findFirst({
        where: { id: trainingId, tenantId },
        include: {
          group: true,
          trainer: true
        }
      });

      // Находим активный абонемент клиента (приоритет: абонемент на посещения)
      const activeMembership = await prisma.clientMembership.findFirst({
        where: {
          clientId,
          tenantId,
          isActive: true,
          OR: [
            // Абонемент на посещения (проверка на оставшиеся посещения будет в коде)
            {
              visitsTotal: { not: null }
            },
            // Месячный абонемент, который еще не истек
            {
              visitsTotal: null,
              endDate: { gte: new Date() }
            },
            // Месячный абонемент без даты окончания (бессрочный)
            {
              visitsTotal: null,
              endDate: null
            }
          ]
        },
        orderBy: [
          // Приоритет абонементам на посещения
          { visitsTotal: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      let shouldChargeClient = true; // Флаг, нужно ли списывать деньги с баланса

      if (activeMembership) {
        // Если это абонемент на посещения
        if (activeMembership.visitsTotal) {
          const newVisitsUsed = activeMembership.visitsUsed + 1;
          const isExhausted = newVisitsUsed >= activeMembership.visitsTotal;

          await prisma.clientMembership.update({
            where: { id: activeMembership.id },
            data: {
              visitsUsed: newVisitsUsed,
              isActive: !isExhausted
            }
          });
          
          // Если есть активный абонемент на посещения, не списываем с баланса
          shouldChargeClient = false;
        } else {
          // Для месячных абонементов просто отмечаем посещение (не списываем с баланса)
          shouldChargeClient = false;
        }
      }

      // Если нет активного абонемента, списываем деньги с баланса клиента
      if (shouldChargeClient && trainingWithDetails) {
        const trainingPrice = trainingWithDetails.group.trainingPrice 
          ? Number(trainingWithDetails.group.trainingPrice) 
          : 0;

        if (trainingPrice > 0) {
          // Проверяем баланс клиента
          const currentClient = await prisma.client.findFirst({
            where: { id: clientId, tenantId }
          });

          if (currentClient) {
            const clientBalance = Number(currentClient.balance || 0);
            
            if (clientBalance >= trainingPrice) {
              // Снимаем деньги с баланса клиента
              await deductFromClientBalance(
                clientId,
                trainingPrice,
                trainingId,
                attendance.id,
                tenantId,
                `Оплата тренировки: ${trainingWithDetails.title}`
              );

              // Рассчитываем и начисляем заработок тренеру
              const trainerEarnings = await calculateTrainerEarningsForAttendance(
                trainingWithDetails.trainerId,
                trainingId,
                attendance.id,
                tenantId
              );

              if (trainerEarnings > 0) {
                await addToTrainerBalance(
                  trainingWithDetails.trainerId,
                  trainerEarnings,
                  trainingId,
                  attendance.id,
                  tenantId,
                  `Заработок за тренировку: ${trainingWithDetails.title}`
                );
              }
            } else {
              // Недостаточно средств - можно создать запись о задолженности
              // Пока просто создаем посещение без списания, но логируем проблему
              console.warn(`Insufficient balance for client ${clientId}. Balance: ${clientBalance}, Required: ${trainingPrice}`);
            }
          }
        }
      } else if (trainingWithDetails && activeMembership) {
        // Если есть абонемент, все равно начисляем тренеру (но не списываем с клиента)
        const trainerEarnings = await calculateTrainerEarningsForAttendance(
          trainingWithDetails.trainerId,
          trainingId,
          attendance.id,
          tenantId
        );

        if (trainerEarnings > 0) {
          await addToTrainerBalance(
            trainingWithDetails.trainerId,
            trainerEarnings,
            trainingId,
            attendance.id,
            tenantId,
            `Заработок за тренировку: ${trainingWithDetails.title}`
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: attendance,
      message: 'Attendance created successfully'
    });
  } catch (error: any) {
    console.error('Create attendance error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'Attendance already exists for this client and training'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create attendance'
      });
    }
  }
};

export const updateAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const attendance = await prisma.attendance.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!attendance) {
      res.status(404).json({
        success: false,
        error: 'Attendance not found'
      });
      return;
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data: {
        status,
        notes
      },
      include: {
        client: true,
        training: true
      }
    });

    res.json({
      success: true,
      data: updatedAttendance,
      message: 'Attendance updated successfully'
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update attendance'
    });
  }
};

export const deleteAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attendance = await prisma.attendance.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!attendance) {
      res.status(404).json({
        success: false,
        error: 'Attendance not found'
      });
      return;
    }

    await prisma.attendance.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Attendance deleted successfully'
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete attendance'
    });
  }
};

export const bulkUpdateAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }

    const { trainingId, attendances } = req.body;

    if (!trainingId || !Array.isArray(attendances)) {
      res.status(400).json({
        success: false,
        error: 'Training ID and attendances array are required'
      });
      return;
    }

    // Verify training exists and belongs to tenant
    const training = await prisma.training.findFirst({
      where: {
        id: trainingId,
        tenantId
      }
    });

    if (!training) {
      res.status(404).json({
        success: false,
        error: 'Training not found'
      });
      return;
    }

    const results = [];

    for (const att of attendances) {
      const { clientId, status, notes } = att;

      if (!clientId || !status) {
        continue;
      }

      try {
        // Check if attendance exists
        const existing = await prisma.attendance.findUnique({
          where: {
            clientId_trainingId: {
              clientId,
              trainingId
            }
          }
        });

        if (existing) {
          // Update existing
          const updated = await prisma.attendance.update({
            where: { id: existing.id },
            data: { status, notes },
            include: { client: true }
          });
          results.push(updated);
        } else {
          // Create new
          const created = await prisma.attendance.create({
            data: {
              clientId,
              trainingId,
              status,
              notes,
              tenantId
            },
            include: { client: true }
          });
          results.push(created);
        }
      } catch (error: any) {
        console.error(`Error processing attendance for client ${clientId}:`, error);
      }
    }

    res.json({
      success: true,
      data: results,
      message: 'Attendances updated successfully'
    });
  } catch (error) {
    console.error('Bulk update attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update attendances'
    });
  }
};

