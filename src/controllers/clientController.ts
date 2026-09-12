import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse, SearchQuery, CreateClientData, UpdateClientData } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, validateQuery } from '../middleware/validation';
import { clientSchemas, commonSchemas } from '../middleware/validation';
import Joi from 'joi';
import * as XLSX from 'xlsx';
import multer from 'multer';
import { pickActiveMembershipSummary } from '../services/clientMembershipService';
import {
  assignClientToTrial,
  cleanupExpiredTrialMemberships,
} from '../services/trialMembershipService';
import {
  resolveCertificateUpdate,
  sanitizeClientCertificateFields,
} from '../utils/clientCertificates';
import { notifyAthleteCreated } from '../services/notificationDomainHooks';

/**
 * Approve parent account registration
 * Only OWNER or ADMIN can approve
 */
export const approveParentAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { parentId } = req.params;
  const userId = req.user?.id;

  // Check if user has permission (OWNER or ADMIN only)
  if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Только владелец или администратор могут подтверждать регистрацию родителей'
    });
    return;
  }

  // Find parent
  const parent = await prisma.parent.findFirst({
    where: {
      id: parentId,
      tenantId: tenantId
    },
    include: {
      client: true
    }
  });

  if (!parent) {
    res.status(404).json({
      success: false,
      error: 'Родитель не найден'
    });
    return;
  }

  if (!parent.password) {
    res.status(400).json({
      success: false,
      error: 'Родитель еще не зарегистрирован (не установлен пароль)'
    });
    return;
  }

  if (parent.isAccountApproved) {
    res.status(400).json({
      success: false,
      error: 'Аккаунт родителя уже подтвержден'
    });
    return;
  }

  // Approve parent account
  await prisma.parent.update({
    where: { id: parentId },
    data: {
      isAccountApproved: true,
      accountApprovedAt: new Date(),
      accountApprovedBy: userId || null
    }
  });

  res.json({
    success: true,
    message: 'Регистрация родителя успешно подтверждена'
  });
});

/**
 * Update client membership fee status
 * Only OWNER or ADMIN can update this field
 */
export const updateMembershipFeeStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { membershipFeePaid } = req.body;
  const userId = req.user?.id;

  // Check if user has permission (OWNER or ADMIN only)
  if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Только владелец или администратор могут изменять статус членского взноса'
    });
    return;
  }

  // Check if client exists and belongs to tenant
  const existingClient = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!existingClient) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  // Update membership fee status
  const updatedClient = await prisma.client.update({
    where: { id },
    data: {
      membershipFeePaid: membershipFeePaid === true,
      membershipFeePaidAt: membershipFeePaid === true ? new Date() : null,
      membershipFeePaidBy: membershipFeePaid === true ? userId : null
    },
    include: {
      parents: true
    }
  });

  res.json({
    success: true,
    data: updatedClient,
    message: membershipFeePaid ? 'Членский взнос отмечен как оплаченный' : 'Отметка о членском взносе снята'
  });
});

/**
 * Get all clients with pagination and search
 */
export const getClients = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query as SearchQuery;

  if (tenantId) {
    await cleanupExpiredTrialMemberships(tenantId);
  }

  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
  const take = parseInt(limit.toString());

  // Build where clause
  const where: any = {
    tenantId,
    isActive: true
  };

  if (req.user?.role === 'TRAINER') {
    const { getSeniorBranchIds } = await import('../utils/branchAccess');
    const seniorIds = await getSeniorBranchIds(req.user.id, tenantId);
    if (seniorIds.length > 0) {
      where.groupMemberships = {
        some: {
          isActive: true,
          group: {
            branchId: { in: seniorIds },
            isActive: true,
          },
        },
      };
    }
  }

  if (search) {
    // PostgreSQL supports case-insensitive search
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Get clients with pagination
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        parents: true,
        achievements: {
          orderBy: { date: 'desc' },
          take: 5
        },
        groupMemberships: {
          where: { isActive: true },
          include: {
            group: {
              include: {
                trainer: {
                  include: { user: true }
                },
                branch: true
              }
            }
          }
        },
        clientMemberships: {
          where: { isActive: true },
          include: {
            membership: true
          },
          orderBy: { createdAt: 'desc' }
        },
      }
    }),
    prisma.client.count({ where })
  ]);

  // Calculate debt for each client (overdue payments) - оптимизировано: один запрос вместо N
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Загружаем все просроченные платежи одним запросом
  const clientIds = clients.map(c => c.id);
  const allOverduePayments = clientIds.length > 0 ? await prisma.payment.findMany({
    where: {
      clientId: { in: clientIds },
      tenantId,
      status: { not: 'paid' },
      dueDate: { lt: today }
    },
    select: {
      id: true,
      clientId: true,
      amount: true,
      group: {
        select: {
          id: true,
          name: true
        }
      }
    }
  }) : [];

  // Группируем платежи по clientId
  const paymentsByClient = allOverduePayments.reduce((acc, payment) => {
    if (!acc[payment.clientId]) {
      acc[payment.clientId] = [];
    }
    acc[payment.clientId].push(payment);
    return acc;
  }, {} as Record<string, typeof allOverduePayments>);

  const clientsWithDebt = clients.map((client) => {
    // Find overdue payments for this client
    const overduePayments = paymentsByClient[client.id] || [];

    const totalDebt = overduePayments.reduce((sum, payment) => {
      return sum + Number(payment.amount);
    }, 0);

    const { password, ...clientSafe } = client as typeof client & { password?: string | null };
    const parentsSafe = (client.parents || []).map((p: any) => {
      const { password: parentPassword, ...parentRest } = p;
      return {
        ...parentRest,
        hasPassword: Boolean(parentPassword),
      };
    });

    return {
      ...sanitizeClientCertificateFields(clientSafe as any),
      parents: parentsSafe,
      hasPassword: Boolean(password),
      password: undefined,
      debt: totalDebt,
      overduePaymentsCount: overduePayments.length,
      activeMembership: pickActiveMembershipSummary(client.clientMemberships || []),
    };
  });

  res.json({
    success: true,
    data: clientsWithDebt,
    pagination: {
      page: parseInt(page.toString()),
      limit: parseInt(limit.toString()),
      total,
      totalPages: Math.ceil(total / parseInt(limit.toString()))
    }
  });
});

/**
 * Get client by ID
 */
export const getClient = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  if (tenantId) {
    await cleanupExpiredTrialMemberships(tenantId);
  }

  const client = await prisma.client.findFirst({
    where: {
      id,
      tenantId
    },
    include: {
      parents: true,
      achievements: {
        orderBy: { date: 'desc' }
      },
      clientMemberships: {
        where: { isActive: true },
        include: {
          membership: true
        },
        orderBy: { createdAt: 'desc' }
      },
      groupMemberships: {
        include: {
          group: {
            include: {
              trainer: {
                include: { user: true }
              },
              branch: true
            }
          }
        }
      },
      attendances: {
        include: {
          training: {
            include: {
              group: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }
    }
  });

  if (!client) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  const { password, ...clientSafe } = client as typeof client & { password?: string | null };
  const parentsSafe = (client.parents || []).map((p: any) => {
    const { password: parentPassword, ...parentRest } = p;
    return { ...parentRest, hasPassword: Boolean(parentPassword) };
  });

  res.json({
    success: true,
    data: {
      ...sanitizeClientCertificateFields(clientSafe as any),
      parents: parentsSafe,
      hasPassword: Boolean(password),
      password: undefined,
      activeMembership: pickActiveMembershipSummary(client.clientMemberships || []),
    }
  });
});

/**
 * Create new client
 */
export const createClient = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const clientData: CreateClientData = req.body;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  // Извлекаем родителей и сертификаты (data URL → диск после create)
  const { parents, birthCertificate, medicalCertificate, ...clientFields } = clientData as any;

  // Преобразуем dateOfBirth в правильный формат DateTime
  const processedData = {
    ...clientFields,
    tenantId,
    dateOfBirth: clientData.dateOfBirth ? new Date(clientData.dateOfBirth) : undefined,
    birthCertificate: null as string | null,
    medicalCertificate: null as string | null,
  };

  // Создаем родителей без токенов подтверждения
  const parentsData = parents && parents.length > 0 ? parents.map((parent: any) => {
    return {
      ...parent,
      tenantId,
      isApproved: true // Автоматически подтверждаем без email
    };
  }) : undefined;

  // Создаем клиента вместе с родителями
  let client = await prisma.client.create({
    data: {
      ...processedData,
      parents: parentsData ? {
        create: parentsData
      } : undefined
    },
    include: {
      parents: true,
      tenant: true
    }
  });

  try {
    const birthPath = resolveCertificateUpdate(
      tenantId,
      client.id,
      'birth',
      birthCertificate,
      null
    );
    const medicalPath = resolveCertificateUpdate(
      tenantId,
      client.id,
      'medical',
      medicalCertificate,
      null
    );
    if (birthPath || medicalPath) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          ...(birthPath !== undefined ? { birthCertificate: birthPath } : {}),
          ...(medicalPath !== undefined ? { medicalCertificate: medicalPath } : {}),
        },
        include: { parents: true, tenant: true },
      });
    }
  } catch (e: any) {
    console.error('Certificate save on create failed:', e);
    res.status(400).json({
      success: false,
      error: e?.message || 'Не удалось сохранить файл документа',
    });
    return;
  }

  void notifyAthleteCreated({
    tenantId,
    clientId: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    middleName: (client as any).middleName,
    createdByUserId: req.user?.id,
    branchId: (client as any).branchId || null,
  }).catch((err) => console.error('[Notifications] athlete_created:', err));

  res.status(201).json({
    success: true,
    data: sanitizeClientCertificateFields(client as any),
    message: 'Client created successfully'
  });
});

/**
 * Update client
 */
export const updateClient = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const updateData: UpdateClientData = req.body;

  // Check if client exists and belongs to tenant
  const existingClient = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!existingClient) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  // Извлекаем родителей из данных обновления
  const { parents, birthCertificate, medicalCertificate, ...clientFields } = updateData as any;

  // Преобразуем dateOfBirth в правильный формат DateTime
  const processedData: any = {
    ...clientFields,
    dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined
  };

  if ('personalDiscountType' in clientFields) {
    const t = clientFields.personalDiscountType;
    processedData.personalDiscountType =
      t === 'percent' || t === 'fixed' ? t : null;
  }
  if ('personalDiscountValue' in clientFields) {
    const v = clientFields.personalDiscountValue;
    if (v === null || v === undefined || v === ('' as any)) {
      processedData.personalDiscountValue = null;
    } else {
      const num = Number(v);
      processedData.personalDiscountValue = Number.isFinite(num) ? num : null;
    }
  }
  if (!processedData.personalDiscountType) {
    processedData.personalDiscountValue = null;
  }

  try {
    if (birthCertificate !== undefined) {
      processedData.birthCertificate = resolveCertificateUpdate(
        tenantId!,
        id,
        'birth',
        birthCertificate,
        existingClient.birthCertificate
      );
      if (processedData.birthCertificate === undefined) {
        delete processedData.birthCertificate;
      }
    }
    if (medicalCertificate !== undefined) {
      processedData.medicalCertificate = resolveCertificateUpdate(
        tenantId!,
        id,
        'medical',
        medicalCertificate,
        existingClient.medicalCertificate
      );
      if (processedData.medicalCertificate === undefined) {
        delete processedData.medicalCertificate;
      }
    }
  } catch (e: any) {
    res.status(400).json({
      success: false,
      error: e?.message || 'Не удалось сохранить файл документа',
    });
    return;
  }

  // Если есть родители, обновляем их
  if (parents !== undefined) {
    // Удаляем всех существующих родителей
    await prisma.parent.deleteMany({
      where: { clientId: id, tenantId }
    });

    // Создаем новых родителей, если они есть
    if (parents.length > 0) {
      const parentsData = parents.map((parent: any) => {
        return {
          ...parent,
          tenantId,
          isApproved: true // Автоматически подтверждаем без email
        };
      });
      
      processedData.parents = {
        create: parentsData
      };
    }
  }

  const client = await prisma.client.update({
    where: { id },
    data: processedData,
    include: {
      parents: true,
      tenant: true
    }
  });

  res.json({
    success: true,
    data: sanitizeClientCertificateFields(client as any),
    message: 'Client updated successfully'
  });
});

/**
 * Delete client (soft delete)
 */
/**
 * Approve client account (for personal cabinet access)
 * Only OWNER, ADMIN, or TRAINER can approve
 */
export const approveClientAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const userId = req.user?.id;

  // Check if user has permission
  if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN' && req.user?.role !== 'TRAINER') {
    res.status(403).json({
      success: false,
      error: 'Только владелец, администратор или тренер могут подтверждать аккаунты клиентов'
    });
    return;
  }

  // Check if client exists and belongs to tenant
  const existingClient = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!existingClient) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  if (!existingClient.password) {
    res.status(400).json({
      success: false,
      error: 'Client has not registered yet'
    });
    return;
  }

  if (existingClient.isAccountApproved) {
    res.status(400).json({
      success: false,
      error: 'Client account is already approved'
    });
    return;
  }

  // Approve client account
  const updatedClient = await prisma.client.update({
    where: { id },
    data: {
      isAccountApproved: true,
      accountApprovedAt: new Date(),
      accountApprovedBy: userId || null
    }
  });

  res.json({
    success: true,
    data: updatedClient,
    message: 'Client account approved successfully'
  });
});

/**
 * Reject client account registration: clear password so they can register again.
 */
export const rejectClientAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN' && req.user?.role !== 'TRAINER') {
    res.status(403).json({
      success: false,
      error: 'Только владелец, администратор или тренер могут отклонять аккаунты клиентов'
    });
    return;
  }

  const existingClient = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!existingClient) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  if (!existingClient.password) {
    res.status(400).json({
      success: false,
      error: 'Client has not registered yet'
    });
    return;
  }

  if (existingClient.isAccountApproved) {
    res.status(400).json({
      success: false,
      error: 'Cannot reject an already approved account'
    });
    return;
  }

  const updatedClient = await prisma.client.update({
    where: { id },
    data: {
      password: null,
      isAccountApproved: false,
      accountApprovedAt: null,
      accountApprovedBy: null,
      sessionVersion: { increment: 1 },
    }
  });

  const { password: _pw, ...safe } = updatedClient as typeof updatedClient & { password?: string | null };

  res.json({
    success: true,
    data: { ...safe, hasPassword: false, password: undefined },
    message: 'Client registration rejected'
  });
});

export const deleteClient = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  // Check if client exists and belongs to tenant
  const existingClient = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!existingClient) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  await prisma.client.update({
    where: { id },
    data: { isActive: false, sessionVersion: { increment: 1 } }
  });

  res.json({
    success: true,
    message: 'Client deleted successfully'
  });
});

/**
 * Add achievement to client
 */
export const addAchievement = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { title, description, date, type } = req.body;

  // Check if client exists and belongs to tenant
  const client = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!client) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  const achievement = await prisma.achievement.create({
    data: {
      title,
      description,
      date: new Date(date),
      type,
      clientId: id
    }
  });

  res.status(201).json({
    success: true,
    data: achievement,
    message: 'Achievement added successfully'
  });
});

/**
 * Remove achievement from client
 */
export const removeAchievement = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id, achievementId } = req.params;

  // Check if client exists and belongs to tenant
  const client = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!client) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  // Check if achievement belongs to client
  const achievement = await prisma.achievement.findFirst({
    where: {
      id: achievementId,
      clientId: id
    }
  });

  if (!achievement) {
    res.status(404).json({
      success: false,
      error: 'Achievement not found'
    });
    return;
  }

  await prisma.achievement.delete({
    where: { id: achievementId }
  });

  res.json({
    success: true,
    message: 'Achievement removed successfully'
  });
});

/**
 * Get client statistics
 */
export const getClientStats = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;

  // Check if client exists and belongs to tenant
  const client = await prisma.client.findFirst({
    where: { id, tenantId }
  });

  if (!client) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  const [totalTrainings, presentCount, achievementsCount, activeMemberships] = await Promise.all([
    prisma.attendance.count({
      where: { clientId: id }
    }),
    prisma.attendance.count({
      where: { clientId: id, status: 'PRESENT' }
    }),
    prisma.achievement.count({
      where: { clientId: id }
    }),
    prisma.payment.count({
      where: {
        clientId: id,
        status: 'paid',
        type: 'membership'
      }
    })
  ]);

  const attendanceRate = totalTrainings > 0 ? (presentCount / totalTrainings) * 100 : 0;

  res.json({
    success: true,
    data: {
      totalTrainings,
      presentCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      achievementsCount,
      activeMemberships
    }
  });
});

/**
 * Download Excel template for importing clients
 */
export const downloadClientTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Create empty template with headers and example row
  const templateData = [
    {
      '№': 1,
      'Имя': 'Иван',
      'Фамилия': 'Иванов',
      'Отчество': 'Иванович',
      'Email ребенка': 'ivan@example.com',
      'Телефон ребенка': '+79001234567',
      'Дата рождения': '01.01.2010',
      'Пол': 'Мужской',
      'Адрес проживания': 'г. Москва, ул. Примерная, д. 1',
      'Номер свидетельства о рождении': 'I-МУ 123456',
      'Номер справки': 'СП-123456',
      'Место учебы/дет.сада': 'Школа №1',
      'Родитель 1 - ФИО': 'Иванова Мария Петровна',
      'Родитель 1 - Телефон': '+79007654321',
      'Родитель 1 - Email': 'maria@example.com',
      'Родитель 1 - Место работы': 'ООО "Компания"',
      'Родитель 1 - Контакт на работе': '+74951234567',
      'Родитель 2 - ФИО': '',
      'Родитель 2 - Телефон': '',
      'Родитель 2 - Email': '',
      'Родитель 2 - Место работы': '',
      'Родитель 2 - Контакт на работе': '',
      'Дата создания': ''
    }
  ];

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  const columnWidths = [
    { wch: 5 },   // №
    { wch: 15 },  // Имя
    { wch: 15 },  // Фамилия
    { wch: 15 },  // Отчество
    { wch: 25 },  // Email ребенка
    { wch: 18 },  // Телефон ребенка
    { wch: 15 },  // Дата рождения
    { wch: 12 },  // Пол
    { wch: 30 },  // Адрес
    { wch: 25 },  // Свидетельство
    { wch: 15 },  // Справка
    { wch: 25 },  // Место учебы
    { wch: 25 },  // Родитель 1 - ФИО
    { wch: 18 },  // Родитель 1 - Телефон
    { wch: 25 },  // Родитель 1 - Email
    { wch: 25 },  // Родитель 1 - Работа
    { wch: 25 },  // Родитель 1 - Контакт
    { wch: 25 },  // Родитель 2 - ФИО
    { wch: 18 },  // Родитель 2 - Телефон
    { wch: 25 },  // Родитель 2 - Email
    { wch: 25 },  // Родитель 2 - Работа
    { wch: 25 },  // Родитель 2 - Контакт
    { wch: 15 }   // Дата создания
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Шаблон');

  // Generate Excel file buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=template_import_clients.xlsx');

  res.send(excelBuffer);
});

/**
 * Export clients to Excel
 */
export const exportClients = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  // Get all clients with parents
  const clients = await prisma.client.findMany({
    where: {
      tenantId,
      isActive: true
    },
    include: {
      parents: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Prepare data for Excel
  const excelData = clients.map((client, index) => {
    const parents = client.parents || [];
    const parent1 = parents[0] || {};
    const parent2 = parents[1] || {};

    return {
      '№': index + 1,
      'Имя': client.firstName || '',
      'Фамилия': client.lastName || '',
      'Отчество': client.middleName || '',
      'Email ребенка': client.email || '',
      'Телефон ребенка': client.phone || '',
      'Дата рождения': client.dateOfBirth ? new Date(client.dateOfBirth).toLocaleDateString('ru-RU') : '',
      'Пол': client.gender === 'male' ? 'Мужской' : client.gender === 'female' ? 'Женский' : client.gender || '',
      'Адрес проживания': client.address || '',
      'Номер свидетельства о рождении': client.birthCertificateNumber || '',
      'Номер справки': client.medicalCertificateNumber || '',
      'Место учебы/дет.сада': client.schoolOrKindergarten || '',
      'Родитель 1 - ФИО': parent1.fullName || '',
      'Родитель 1 - Телефон': parent1.phone || '',
      'Родитель 1 - Email': parent1.email || '',
      'Родитель 1 - Место работы': parent1.workplace || '',
      'Родитель 1 - Контакт на работе': parent1.workplaceContact || '',
      'Родитель 2 - ФИО': parent2.fullName || '',
      'Родитель 2 - Телефон': parent2.phone || '',
      'Родитель 2 - Email': parent2.email || '',
      'Родитель 2 - Место работы': parent2.workplace || '',
      'Родитель 2 - Контакт на работе': parent2.workplaceContact || '',
      'Дата создания': new Date(client.createdAt).toLocaleDateString('ru-RU')
    };
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const columnWidths = [
    { wch: 5 },   // №
    { wch: 15 },  // Имя
    { wch: 15 },  // Фамилия
    { wch: 15 },  // Отчество
    { wch: 25 },  // Email ребенка
    { wch: 18 },  // Телефон ребенка
    { wch: 15 },  // Дата рождения
    { wch: 12 },  // Пол
    { wch: 30 },  // Адрес
    { wch: 25 },  // Свидетельство
    { wch: 15 },  // Справка
    { wch: 25 },  // Место учебы
    { wch: 25 },  // Родитель 1 - ФИО
    { wch: 18 },  // Родитель 1 - Телефон
    { wch: 25 },  // Родитель 1 - Email
    { wch: 25 },  // Родитель 1 - Работа
    { wch: 25 },  // Родитель 1 - Контакт
    { wch: 25 },  // Родитель 2 - ФИО
    { wch: 18 },  // Родитель 2 - Телефон
    { wch: 25 },  // Родитель 2 - Email
    { wch: 25 },  // Родитель 2 - Работа
    { wch: 25 },  // Родитель 2 - Контакт
    { wch: 15 }   // Дата создания
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Клиенты');

  // Generate Excel file buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=clients_${new Date().toISOString().split('T')[0]}.xlsx`);

  res.send(excelBuffer);
});

/**
 * Import clients from Excel
 */
export const importClients = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;

  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'Excel file is required'
    });
    return;
  }

  try {
    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results = {
      success: 0,
      errors: [] as Array<{ row: number; error: string }>,
      total: data.length
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      const rowNumber = i + 2; // +2 because Excel rows start from 1 and we have header

      try {
        // Map Excel columns to client data
        const clientData: CreateClientData = {
          firstName: row['Имя']?.toString().trim() || '',
          lastName: row['Фамилия']?.toString().trim() || '',
          middleName: row['Отчество']?.toString().trim() || undefined,
          email: row['Email ребенка']?.toString().trim() || undefined,
          phone: row['Телефон ребенка']?.toString().trim() || undefined,
          dateOfBirth: row['Дата рождения'] ? parseDate(row['Дата рождения']) : undefined,
          gender: parseGender(row['Пол']?.toString().trim()),
          address: row['Адрес проживания']?.toString().trim() || undefined,
          birthCertificateNumber: row['Номер свидетельства о рождении']?.toString().trim() || undefined,
          medicalCertificateNumber: row['Номер справки']?.toString().trim() || undefined,
          schoolOrKindergarten: row['Место учебы/дет.сада']?.toString().trim() || undefined,
          parents: []
        };

        // Validate required fields
        if (!clientData.firstName || !clientData.lastName) {
          results.errors.push({
            row: rowNumber,
            error: 'Имя и Фамилия обязательны'
          });
          continue;
        }

        // Add parents if provided
        const parents = [];
        if (row['Родитель 1 - ФИО']?.toString().trim()) {
          parents.push({
            fullName: row['Родитель 1 - ФИО'].toString().trim(),
            phone: row['Родитель 1 - Телефон']?.toString().trim() || undefined,
            email: row['Родитель 1 - Email']?.toString().trim() || undefined,
            workplace: row['Родитель 1 - Место работы']?.toString().trim() || undefined,
            workplaceContact: row['Родитель 1 - Контакт на работе']?.toString().trim() || undefined
          });
        }
        if (row['Родитель 2 - ФИО']?.toString().trim()) {
          parents.push({
            fullName: row['Родитель 2 - ФИО'].toString().trim(),
            phone: row['Родитель 2 - Телефон']?.toString().trim() || undefined,
            email: row['Родитель 2 - Email']?.toString().trim() || undefined,
            workplace: row['Родитель 2 - Место работы']?.toString().trim() || undefined,
            workplaceContact: row['Родитель 2 - Контакт на работе']?.toString().trim() || undefined
          });
        }
        clientData.parents = parents.length > 0 ? parents : undefined;

        // Create client
        const { parents: parentsData, ...clientFields } = clientData;
        const processedData = {
          ...clientFields,
          tenantId,
          dateOfBirth: clientData.dateOfBirth ? new Date(clientData.dateOfBirth) : undefined
        };

        await prisma.client.create({
          data: {
            ...processedData,
            parents: parentsData && parentsData.length > 0 ? {
              create: parentsData.map((parent: any) => ({
                ...parent,
                tenantId
              }))
            } : undefined
          }
        });

        results.success++;
      } catch (error: any) {
        results.errors.push({
          row: rowNumber,
          error: error?.message || 'Неизвестная ошибка'
        });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Импортировано ${results.success} из ${results.total} клиентов`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Ошибка при обработке Excel файла'
    });
  }
});

/**
 * Записать клиента на пробное занятие (временное членство в группе).
 */
export const assignClientTrial = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { trainingId } = req.body || {};

  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant ID is required' });
    return;
  }
  if (!trainingId || typeof trainingId !== 'string') {
    res.status(400).json({ success: false, error: 'Укажите тренировку для пробного занятия' });
    return;
  }

  try {
    const membership = await assignClientToTrial({
      tenantId,
      clientId: id,
      trainingId,
    });
    res.status(201).json({
      success: true,
      data: membership,
      message: 'Клиент записан на пробное занятие',
    });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({
      success: false,
      error: err?.message || 'Не удалось записать на пробное занятие',
    });
  }
});

// Helper functions
function parseDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  
  // Try different date formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // Try parsing Russian date format (DD.MM.YYYY)
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return undefined;
  }
  return date.toISOString().split('T')[0];
}

function parseGender(genderStr?: string): string | undefined {
  if (!genderStr) return undefined;
  const lower = genderStr.toLowerCase();
  if (lower.includes('муж') || lower === 'male' || lower === 'м') return 'male';
  if (lower.includes('жен') || lower === 'female' || lower === 'ж') return 'female';
  if (lower.includes('друг') || lower === 'other') return 'other';
  return undefined;
}

// Multer configuration for file upload
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Только файлы Excel (.xlsx, .xls) разрешены'));
    }
  }
});

// Validation middleware
export const validateCreateClient = validate(clientSchemas.create);
export const validateUpdateClient = validate(clientSchemas.update);
export const validateClientQuery = validateQuery(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(10000).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
    search: Joi.string().optional(),
    filter: Joi.string().optional()
  })
);
