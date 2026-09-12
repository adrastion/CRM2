import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { deductFromClientBalance } from '../utils/finance';
import { accrueForAttendance } from '../services/trainerSalaryService';
import {
  consumeVisitFromActivePack,
  getActiveMembershipSummary,
} from '../services/clientMembershipService';
import * as XLSX from 'xlsx';
import { notifyAttendanceMarked } from '../services/notificationDomainHooks';

async function applyClientBillingForPresent(params: {
  tenantId: string;
  clientId: string;
  trainingId: string;
  attendanceId: string;
}) {
  const { tenantId, clientId, trainingId, attendanceId } = params;

  const trainingWithDetails = await prisma.training.findFirst({
    where: { id: trainingId, tenantId },
    include: {
      group: true,
      trainer: true,
      substituteTrainer: {
        include: { user: true },
      },
    },
  });

  const { coveredByMembership } = await consumeVisitFromActivePack(clientId, tenantId);
  const shouldChargeClient = !coveredByMembership;

  if (shouldChargeClient && trainingWithDetails?.group) {
    const trainingPrice = trainingWithDetails.group.trainingPrice
      ? Number(trainingWithDetails.group.trainingPrice)
      : 0;

    if (trainingPrice > 0) {
      const currentClient = await prisma.client.findFirst({
        where: { id: clientId, tenantId },
      });

      if (currentClient) {
        const clientBalance = Number(currentClient.balance || 0);
        if (clientBalance >= trainingPrice) {
          await deductFromClientBalance(
            clientId,
            trainingPrice,
            trainingId,
            attendanceId,
            tenantId,
            `Оплата тренировки: ${trainingWithDetails.title}`
          );
        } else {
          console.warn(
            `Insufficient balance for client ${clientId}. Balance: ${clientBalance}, Required: ${trainingPrice}`
          );
        }
      }
    }
  }
}

/**
 * Начисление тренеру по схеме per_training_person.
 * Идемпотентно (уникальность attendanceId в реестре).
 * Не зависит от group.trainingPrice — ставка берётся из настроек тренера.
 */
async function accrueTrainerForAttendanceStatus(params: {
  tenantId: string;
  attendanceId: string;
  clientId: string;
  trainingId: string;
  status: string;
  /** true = не списывать с клиента (галочка «не брать плату») */
  shouldCharge: boolean;
}) {
  const isPresent = params.status === 'PRESENT';
  const isPaidMiss =
    (params.status === 'ABSENT' || params.status === 'EXCUSED') && !params.shouldCharge;

  if (!isPresent && !isPaidMiss) return;

  const training = await prisma.training.findFirst({
    where: { id: params.trainingId, tenantId: params.tenantId },
    select: {
      id: true,
      title: true,
      startTime: true,
      trainerId: true,
      substituteTrainerId: true,
    },
  });
  if (!training) return;

  const trainerId = training.substituteTrainerId || training.trainerId;
  await accrueForAttendance({
    tenantId: params.tenantId,
    trainerId,
    trainingId: params.trainingId,
    attendanceId: params.attendanceId,
    clientId: params.clientId,
    trainingTitle: training.title,
    trainingStart: training.startTime,
    isMissed: isPaidMiss,
  });
}

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

    let result: any[] = [];

    // Если тренировка групповые - получаем клиентов из группы
    if (training.group) {
    const groupClients = training.group.memberships
      .map(m => m.client)
      .filter(client => client && client.isActive);

    // Combine group clients with their attendance status
      result = groupClients.map(client => {
      const attendance = attendanceMap.get(client.id);
      return {
        client,
        attendance: attendance || null
      };
    });
    } else {
      // Если тренировка индивидуальная - получаем клиентов из записей посещаемости
      // Для индивидуальных тренировок клиенты выбираются при создании
      result = attendances.map(attendance => ({
        client: attendance.client,
        attendance: attendance
      }));

      // Если записей посещаемости еще нет, но тренировка индивидуальная,
      // можно вернуть пустой список или получить клиентов из других источников
      // В данном случае возвращаем только тех, для кого уже созданы записи
    }

    const tenantId = req.tenant?.id;
    if (tenantId && result.length > 0) {
      result = await Promise.all(
        result.map(async (row) => {
          const summary = await getActiveMembershipSummary(row.client.id, tenantId);
          return {
            ...row,
            client: {
              ...row.client,
              activeMembership: summary
                ? {
                    ...summary,
                    endDate: summary.endDate ? summary.endDate.toISOString() : null,
                  }
                : null,
            },
          };
        })
      );
    }

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

    const { clientId, trainingId, status, notes, shouldCharge } = req.body;

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

    // Определяем shouldCharge по умолчанию:
    // Логика: shouldCharge=true означает НЕ списывать средства (галочка стоит)
    // - Для PRESENT: не имеет значения (всегда false, но не используется)
    // - Для ABSENT: false (по умолчанию галочка не стоит, списываем)
    // - Для EXCUSED: true (по умолчанию галочка стоит, не списываем)
    let finalShouldCharge = false;
    if (status === 'EXCUSED') {
      finalShouldCharge = shouldCharge !== undefined ? shouldCharge : true; // По умолчанию галочка стоит
    } else if (status === 'ABSENT') {
      finalShouldCharge = shouldCharge !== undefined ? shouldCharge : false; // По умолчанию галочка не стоит
    }

    // Create attendance
    const attendance = await prisma.attendance.create({
      data: {
        clientId,
        trainingId,
        status,
        notes,
        shouldCharge: finalShouldCharge,
        tenantId
      },
      include: {
        client: true,
        training: true
      }
    });

    // Если посещение со статусом PRESENT, обрабатываем оплату и абонемент
    if (status === 'PRESENT') {
      await applyClientBillingForPresent({
        tenantId,
        clientId,
        trainingId,
        attendanceId: attendance.id,
      });

      // Зарплата тренеру — всегда при PRESENT (ставка из настроек тренера), независимо от trainingPrice
      await accrueTrainerForAttendanceStatus({
        tenantId,
        attendanceId: attendance.id,
        clientId,
        trainingId,
        status: 'PRESENT',
        shouldCharge: false,
      });
    } else if ((status === 'ABSENT' || status === 'EXCUSED') && !finalShouldCharge) {
      // Если пропуск с shouldCharge=false (галочка не стоит), списываем средства и начисляем тренеру
      const trainingWithDetails = await prisma.training.findFirst({
        where: { id: trainingId, tenantId },
        include: {
          group: true,
          trainer: true,
          substituteTrainer: {
            include: {
              user: true
            }
          }
        }
      });

      if (trainingWithDetails && trainingWithDetails.group) {
        const trainingPrice = trainingWithDetails.group.trainingPrice 
          ? Number(trainingWithDetails.group.trainingPrice) 
          : 0;

        if (trainingPrice > 0) {
          const currentClient = await prisma.client.findFirst({
            where: { id: clientId, tenantId }
          });

          if (currentClient) {
            const clientBalance = Number(currentClient.balance || 0);
            
            if (clientBalance >= trainingPrice) {
              // Снимаем деньги с баланса клиента за пропуск
              await deductFromClientBalance(
                clientId,
                trainingPrice,
                trainingId,
                attendance.id,
                tenantId,
                `Списание за пропуск тренировки: ${trainingWithDetails.title}`
              );
            } else {
              console.warn(`Insufficient balance for client ${clientId} for missed training. Balance: ${clientBalance}, Required: ${trainingPrice}`);
            }
          }
        }
      }

      await accrueTrainerForAttendanceStatus({
        tenantId,
        attendanceId: attendance.id,
        clientId,
        trainingId,
        status,
        shouldCharge: finalShouldCharge,
      });
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
    const { status, notes, shouldCharge } = req.body;

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

    // Определяем shouldCharge
    // Логика: shouldCharge=true означает НЕ списывать средства (галочка стоит)
    let finalShouldCharge = attendance.shouldCharge;
    if (shouldCharge !== undefined) {
      finalShouldCharge = shouldCharge;
    } else if (status === 'EXCUSED' && attendance.status !== 'EXCUSED') {
      // При изменении на EXCUSED по умолчанию галочка стоит (не списываем)
      finalShouldCharge = true;
    } else if (status === 'ABSENT' && attendance.status !== 'ABSENT') {
      // При изменении на ABSENT по умолчанию галочка не стоит (списываем)
      finalShouldCharge = false;
    }

    const previousStatus = attendance.status;

    const updatedAttendance = await prisma.attendance.update({
      where: { id },
      data: {
        status,
        notes,
        shouldCharge: finalShouldCharge
      },
      include: {
        client: true,
        training: true
      }
    });

    if (req.tenant?.id) {
      if (status === 'PRESENT' && previousStatus !== 'PRESENT') {
        // Как при создании: visit-pack → иначе баланс группы + начисление ЗП
        await applyClientBillingForPresent({
          tenantId: req.tenant.id,
          clientId: updatedAttendance.clientId,
          trainingId: updatedAttendance.trainingId,
          attendanceId: updatedAttendance.id,
        });
      }
      await accrueTrainerForAttendanceStatus({
        tenantId: req.tenant.id,
        attendanceId: updatedAttendance.id,
        clientId: updatedAttendance.clientId,
        trainingId: updatedAttendance.trainingId,
        status: updatedAttendance.status,
        shouldCharge: updatedAttendance.shouldCharge,
      });
    }

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
    const errors: any[] = [];

    console.log(`Processing ${attendances.length} attendance records for training ${trainingId}`);

    for (const att of attendances) {
      const { clientId, status, notes, shouldCharge } = att;

      if (!clientId || !status) {
        console.warn(`Skipping attendance record: missing clientId or status`, att);
        errors.push({ clientId, error: 'Missing clientId or status' });
        continue;
      }

      console.log(`Processing attendance for client ${clientId} with status ${status}`);

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

        // Определяем shouldCharge по умолчанию
        // Логика: shouldCharge=true означает НЕ списывать средства (галочка стоит)
        let finalShouldCharge = false;
        if (status === 'EXCUSED') {
          finalShouldCharge = shouldCharge !== undefined ? shouldCharge : true; // По умолчанию галочка стоит
        } else if (status === 'ABSENT') {
          finalShouldCharge = shouldCharge !== undefined ? shouldCharge : false; // По умолчанию галочка не стоит
        } else if (shouldCharge !== undefined) {
          finalShouldCharge = shouldCharge;
        } else if (existing) {
          finalShouldCharge = existing.shouldCharge;
        }

        if (existing) {
          const wasPresent = existing.status === 'PRESENT';
          const updated = await prisma.attendance.update({
            where: { id: existing.id },
            data: { status, notes, shouldCharge: finalShouldCharge },
            include: { client: true }
          });
          if (status === 'PRESENT' && !wasPresent) {
            await applyClientBillingForPresent({
              tenantId,
              clientId,
              trainingId,
              attendanceId: updated.id,
            });
          }
          await accrueTrainerForAttendanceStatus({
            tenantId,
            attendanceId: updated.id,
            clientId: updated.clientId,
            trainingId,
            status: updated.status,
            shouldCharge: updated.shouldCharge,
          });
          results.push(updated);
        } else {
          // Create new
          console.log(`Creating new attendance record for client ${clientId} in training ${trainingId}`);
          const created = await prisma.attendance.create({
            data: {
              clientId,
              trainingId,
              status,
              notes: notes || null,
              shouldCharge: finalShouldCharge,
              tenantId
            },
            include: { client: true }
          });
          console.log(`Successfully created attendance record ${created.id} for client ${created.client?.lastName} ${created.client?.firstName}`);
          if (status === 'PRESENT') {
            await applyClientBillingForPresent({
              tenantId,
              clientId,
              trainingId,
              attendanceId: created.id,
            });
          }
          await accrueTrainerForAttendanceStatus({
            tenantId,
            attendanceId: created.id,
            clientId: created.clientId,
            trainingId,
            status: created.status,
            shouldCharge: created.shouldCharge,
          });
          results.push(created);
        }
      } catch (error: any) {
        console.error(`Error processing attendance for client ${clientId}:`, error);
        console.error(`Error details:`, error.message, error.stack);
        // Не добавляем в results, но продолжаем обработку других записей
      }
    }

    console.log(`Bulk update attendance completed. Created/updated ${results.length} attendances for training ${trainingId}`);
    if (errors.length > 0) {
      console.warn(`Errors occurred for ${errors.length} attendance records:`, errors);
    }

    if (results.length > 0) {
      const marker = await prisma.user.findFirst({
        where: { id: req.user?.id },
        select: { firstName: true, lastName: true, middleName: true },
      });
      const trainerDisplayName =
        [marker?.lastName, marker?.firstName].filter(Boolean).join(' ').trim() ||
        'Тренер';
      void notifyAttendanceMarked({
        tenantId,
        trainingId,
        branchId: training.branchId,
        markedByUserId: req.user?.id,
        trainerDisplayName,
      }).catch((err) => console.error('[Notifications] attendance:', err));
    }

    res.json({
      success: true,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Attendances updated successfully. Created/updated: ${results.length}, Errors: ${errors.length}`
    });
  } catch (error) {
    console.error('Bulk update attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update attendances'
    });
  }
};

const ATTENDANCE_STATUS_RU: Record<string, string> = {
  PRESENT: 'Присутствовал',
  ABSENT: 'Отсутствовал',
  EXCUSED: 'Уважительная причина',
};

function defaultMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function personName(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').trim();
}

function formatDateRu(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Имя файла без запрещённых символов Windows/браузера. */
function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Выгрузка посещаемости в Excel по тренеру / клиенту / группе.
 * GET /attendances/export/excel?scope=trainer|client|group&id=...&from=&to=
 */
export const exportAttendanceExcel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
      return;
    }

    const scope = String(req.query.scope || '');
    const entityId = String(req.query.id || '');
    if (!['trainer', 'client', 'group'].includes(scope) || !entityId) {
      res.status(400).json({
        success: false,
        error: 'Укажите scope=trainer|client|group и id',
      });
      return;
    }

    let from: Date;
    let to: Date;
    if (req.query.from && req.query.to) {
      from = new Date(String(req.query.from));
      to = new Date(String(req.query.to));
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        res.status(400).json({ success: false, error: 'Некорректный период from/to' });
        return;
      }
      to.setHours(23, 59, 59, 999);
    } else {
      ({ from, to } = defaultMonthRange());
    }

    let entityLabel = scope;
    if (scope === 'trainer') {
      const trainer = await prisma.trainer.findFirst({
        where: { id: entityId, tenantId },
        include: { user: true },
      });
      entityLabel =
        personName([trainer?.user.lastName, trainer?.user.firstName, trainer?.user.middleName]) ||
        'trainer';
    } else if (scope === 'client') {
      const client = await prisma.client.findFirst({
        where: { id: entityId, tenantId },
        select: { lastName: true, firstName: true, middleName: true },
      });
      entityLabel =
        personName([client?.lastName, client?.firstName, client?.middleName]) || 'client';
    } else if (scope === 'group') {
      const group = await prisma.group.findFirst({
        where: { id: entityId, tenantId },
        select: { name: true },
      });
      entityLabel = group?.name || 'group';
    }

    // Тренер без canViewAllGroups — только свои данные
    if (req.user?.role === 'TRAINER') {
      const selfTrainer = await prisma.trainer.findFirst({
        where: { userId: req.user.id, tenantId },
        select: { id: true, canViewAllGroups: true },
      });
      if (!selfTrainer) {
        res.status(403).json({ success: false, error: 'Тренер не найден' });
        return;
      }
      if (!selfTrainer.canViewAllGroups) {
        if (scope === 'trainer' && entityId !== selfTrainer.id) {
          res.status(403).json({ success: false, error: 'Можно выгружать только свою посещаемость' });
          return;
        }
        if (scope === 'group') {
          const group = await prisma.group.findFirst({
            where: { id: entityId, tenantId, trainerId: selfTrainer.id },
          });
          if (!group) {
            res.status(403).json({ success: false, error: 'Нет доступа к этой группе' });
            return;
          }
        }
        if (scope === 'client') {
          const inMyGroup = await prisma.groupMembership.findFirst({
            where: {
              clientId: entityId,
              isActive: true,
              group: { tenantId, trainerId: selfTrainer.id },
            },
          });
          if (!inMyGroup) {
            res.status(403).json({ success: false, error: 'Нет доступа к этому клиенту' });
            return;
          }
        }
      }
    }

    const trainingWhere: any = {
      tenantId,
      startTime: { gte: from, lte: to },
      isCancelled: false,
    };

    if (scope === 'trainer') {
      trainingWhere.OR = [
        { trainerId: entityId },
        { substituteTrainerId: entityId },
      ];
    } else if (scope === 'group') {
      trainingWhere.groupId = entityId;
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        tenantId,
        ...(scope === 'client' ? { clientId: entityId } : {}),
        training: trainingWhere,
      },
      include: {
        client: true,
        training: {
          include: {
            group: true,
            trainer: { include: { user: true } },
            substituteTrainer: { include: { user: true } },
          },
        },
      },
      orderBy: [{ training: { startTime: 'asc' } }, { client: { lastName: 'asc' } }],
    });

    const rows = attendances.map((a) => {
      const start = new Date(a.training.startTime);
      const end = new Date(a.training.endTime);
      const activeTrainer = a.training.substituteTrainer || a.training.trainer;
      const trainerUser = activeTrainer?.user;
      return {
        Дата: start.toLocaleDateString('ru-RU'),
        Время: `${start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
        Тренировка: a.training.title,
        Группа: a.training.group?.name || '—',
        Клиент: personName([a.client.lastName, a.client.firstName, a.client.middleName]) || a.client.id,
        Статус: ATTENDANCE_STATUS_RU[a.status] || a.status,
        Тренер: trainerUser
          ? personName([trainerUser.lastName, trainerUser.firstName, trainerUser.middleName])
          : '—',
        Примечание: a.notes || '',
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [
            {
              Дата: '',
              Время: '',
              Тренировка: '',
              Группа: '',
              Клиент: '',
              Статус: '',
              Тренер: '',
              Примечание: 'Нет записей за выбранный период',
            },
          ]
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Посещаемость');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const periodLabel = `${formatDateRu(from)}-${formatDateRu(to)}`;
    const safeName = sanitizeFilenamePart(entityLabel) || scope;
    const filenameUtf8 = `Посещаемость ${safeName} ${periodLabel}.xlsx`;
    const filenameAscii = `attendance_${periodLabel.replace(/\./g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filenameAscii}"; filename*=UTF-8''${encodeURIComponent(filenameUtf8)}`
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error('Export attendance excel error:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось выгрузить посещаемость',
    });
  }
};

