import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';

const prisma = new PrismaClient();

/**
 * Поиск клиентов по телефону или email для регистрации
 */
export const findClientsForRegistration = async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { phone, email } = req.body;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        error: 'Phone or email is required'
      });
    }

    // Нормализуем данные для поиска
    const searchPhone = phone ? phone.replace(/\D/g, '') : null;
    const searchEmail = email ? email.toLowerCase().trim() : null;

    // Ищем клиентов по телефону или email
    const whereClause: any = {
      isActive: true
    };

    const orConditions: any[] = [];
    if (searchPhone) {
      orConditions.push({ phone: { contains: searchPhone } });
    }
    if (searchEmail) {
      orConditions.push({ email: { equals: searchEmail, mode: 'insensitive' as const } });
    }

    if (orConditions.length > 0) {
      whereClause.OR = orConditions;
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true
          }
        }
      }
    });

    // Группируем по тенантам (школам)
    const tenantsMap = new Map();
    clients.forEach(client => {
      const tenant = client.tenant;
      if (tenant) {
        if (!tenantsMap.has(tenant.id)) {
          tenantsMap.set(tenant.id, {
            tenant: tenant,
            clients: []
          });
        }
        tenantsMap.get(tenant.id).clients.push({
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          middleName: client.middleName,
          phone: client.phone,
          email: client.email
        });
      }
    });

    const tenants = Array.from(tenantsMap.values());

    return res.json({
      success: true,
      data: tenants,
      message: tenants.length > 0 ? 'Clients found' : 'No clients found'
    });
  } catch (error: any) {
    console.error('Find clients for registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to find clients'
    });
  }
};

/**
 * Регистрация клиента
 */
export const registerClient = async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { clientId, tenantId, password } = req.body;

    if (!clientId || !tenantId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Client ID, tenant ID, and password are required'
      });
    }

    // Проверяем, что клиент существует и принадлежит указанному тенанту
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: tenantId,
        isActive: true
      },
      include: {
        tenant: true
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // Проверяем, не зарегистрирован ли уже клиент
    if (client.password) {
      // Если клиент уже зарегистрирован, но не подтвержден
      if (!client.isAccountApproved) {
        return res.status(400).json({
          success: false,
          error: 'Ваш аккаунт уже зарегистрирован и ожидает подтверждения администратором'
        });
      }
      // Если клиент уже зарегистрирован и подтвержден
      return res.status(400).json({
        success: false,
        error: 'Клиент уже зарегистрирован'
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Обновляем клиента: добавляем пароль, но не подтверждаем аккаунт
    await prisma.client.update({
      where: { id: clientId },
      data: {
        password: hashedPassword,
        isAccountApproved: false // Администратор должен подтвердить
      }
    });

    return res.json({
      success: true,
      message: 'Registration successful. Please wait for administrator approval.'
    });
  } catch (error: any) {
    console.error('Register client error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register client'
    });
  }
};

/**
 * Авторизация клиента
 */
export const loginClient = async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { phone, email, password, tenantId } = req.body;

    if ((!phone && !email) || !password || !tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Phone or email, password, and tenant ID are required'
      });
    }

    // Нормализуем данные для поиска
    const searchPhone = phone ? phone.replace(/\D/g, '') : null;
    const searchEmail = email ? email.toLowerCase().trim() : null;

    // Ищем клиента
    const whereClause: any = {
      tenantId: tenantId,
      isActive: true
    };

    const orConditions: any[] = [];
    if (searchPhone) {
      orConditions.push({ phone: { contains: searchPhone } });
    }
    if (searchEmail) {
      orConditions.push({ email: { equals: searchEmail, mode: 'insensitive' as const } });
    }

    if (orConditions.length > 0) {
      whereClause.OR = orConditions;
    }

    const client = await prisma.client.findFirst({
      where: whereClause,
      include: {
        tenant: true
      }
    });

    if (!client) {
      return res.status(401).json({
        success: false,
        error: 'Клиент не найден'
      });
    }

    if (!client.password) {
      return res.status(401).json({
        success: false,
        error: 'Клиент не зарегистрирован'
      });
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, client.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Неверный пароль'
      });
    }

    // Проверяем, подтвержден ли аккаунт
    if (!client.isAccountApproved) {
      return res.status(403).json({
        success: false,
        error: 'Ваш аккаунт ожидает подтверждения администратором'
      });
    }

    // Обновляем lastLogin
    await prisma.client.update({
      where: { id: client.id },
      data: { lastLogin: new Date() }
    });

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        clientId: client.id,
        tenantId: client.tenantId,
        type: 'client'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    if (!client.tenant) {
      return res.status(500).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    return res.json({
      success: true,
      data: {
        client: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          middleName: client.middleName,
          email: client.email,
          phone: client.phone,
          tenantId: client.tenantId
        },
        tenant: {
          id: client.tenant.id,
          name: client.tenant.name,
          subdomain: client.tenant.subdomain
        },
        token
      },
      message: 'Login successful'
    });
  } catch (error: any) {
    console.error('Login client error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to login client'
    });
  }
};

/**
 * Получение профиля клиента
 */
export const getClientProfile = async (req: Request, res: Response<ApiResponse>) => {
  try {
    // В middleware будет установлен req.client
    const clientId = (req as any).client?.id;
    const tenantId = (req as any).client?.tenantId;

    if (!clientId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        tenant: {
          include: {
            tenantSettings: true,
            subscription: true
          }
        },
        groupMemberships: {
          where: { isActive: true },
          include: {
            group: {
              include: {
                trainer: {
                  include: {
                    user: true
                  }
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
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        clientStandards: {
          include: {
            standard: true
          },
          orderBy: { completedAt: 'desc' }
        },
        competitionParticipants: {
          include: {
            competition: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    return res.json({
      success: true,
      data: client
    });
  } catch (error: any) {
    console.error('Get client profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get client profile'
    });
  }
};

/**
 * Получение расписания тренировок клиента
 */
export const getClientTrainings = async (req: Request, res: Response<ApiResponse>) => {
  try {
    const clientId = (req as any).client?.id;
    const tenantId = (req as any).client?.tenantId;

    if (!clientId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { startDate, endDate } = req.query;

    // Получаем группы клиента
    const groupMemberships = await prisma.groupMembership.findMany({
      where: {
        clientId,
        isActive: true
      },
      include: {
        group: {
          include: {
            trainer: {
              include: {
                user: true
              }
            },
            branch: true
          }
        }
      }
    });

    const groupIds = groupMemberships.map(gm => gm.groupId);

    // Получаем индивидуальные тренировки клиента через attendances
    const individualAttendances = await prisma.attendance.findMany({
      where: {
        clientId,
        training: {
          groupId: null,
          tenantId,
          isCancelled: false
        }
      },
      include: {
        training: {
          include: {
            trainer: {
              include: {
                user: true
              }
            },
            branch: true
          }
        }
      }
    });

    const individualTrainingIds = individualAttendances.map(a => a.trainingId);

    // Формируем условие для поиска тренировок
    const where: any = {
      tenantId,
      isCancelled: false,
      OR: [
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
        ...(individualTrainingIds.length > 0 ? [{ id: { in: individualTrainingIds } }] : [])
      ]
    };

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    } else {
      // По умолчанию показываем будущие тренировки
      where.startTime = {
        gte: new Date()
      };
    }

    const trainings = await prisma.training.findMany({
      where,
      include: {
        group: {
          include: {
            trainer: {
              include: {
                user: true
              }
            },
            branch: true
          }
        },
        trainer: {
          include: {
            user: true
          }
        },
        branch: true,
        hall: true,
        attendances: {
          where: { clientId },
          take: 1
        }
      },
      orderBy: { startTime: 'asc' },
      take: 100
    });

    // Получаем настройки тенанта для фильтрации тренеров/филиалов
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    // Фильтруем данные согласно настройкам
    let filteredTrainings = trainings;
    
    if (tenantSettings && !tenantSettings.clientCanViewAllTrainers) {
      // Показываем только тренера из групп клиента
      const clientTrainerIds = groupMemberships
        .map(gm => gm.group?.trainer?.id)
        .filter(Boolean) as string[];
      
      filteredTrainings = filteredTrainings.filter(t => 
        !t.trainerId || clientTrainerIds.includes(t.trainerId)
      );
    }

    if (tenantSettings && !tenantSettings.clientCanViewAllBranches) {
      // Показываем только филиалы из групп клиента
      const clientBranchIds = groupMemberships
        .map(gm => gm.group?.branchId)
        .filter(Boolean) as string[];
      
      filteredTrainings = filteredTrainings.filter(t => 
        !t.branchId || clientBranchIds.includes(t.branchId)
      );
    }

    return res.json({
      success: true,
      data: filteredTrainings
    });
  } catch (error: any) {
    console.error('Get client trainings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get client trainings'
    });
  }
};

