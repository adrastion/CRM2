import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/** JWT-секрет обязателен: fallback-константа сделала бы токены подделываемыми. */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

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
 * Авторизация клиента или родителя
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

    // Сначала ищем клиента
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

    let client = await prisma.client.findFirst({
      where: whereClause,
      include: {
        tenant: true
      }
    });

    let parent = null;
    let userType: 'client' | 'parent' = 'client';

    // Если клиент не найден, ищем родителя
    if (!client) {
      const parentWhereClause: any = {
        tenantId: tenantId
      };

      const parentOrConditions: any[] = [];
      if (searchPhone) {
        parentOrConditions.push({ phone: { contains: searchPhone } });
      }
      if (searchEmail) {
        parentOrConditions.push({ email: { equals: searchEmail, mode: 'insensitive' as const } });
      }

      if (parentOrConditions.length > 0) {
        parentWhereClause.OR = parentOrConditions;
      }

      parent = await prisma.parent.findFirst({
        where: {
          ...parentWhereClause,
          isApproved: true // Родитель должен быть подтвержден (автоматически при создании)
        },
        include: {
          tenant: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true
            }
          }
        }
      });

      if (!parent) {
        return res.status(401).json({
          success: false,
          error: 'Клиент или родитель не найден'
        });
      }

      userType = 'parent';
    }

    // Проверяем пароль и подтверждение для клиента
    if (client) {
      if (!client.password) {
        return res.status(401).json({
          success: false,
          error: 'Клиент не зарегистрирован'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, client.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Неверный пароль'
        });
      }

      if (!client.isAccountApproved) {
        // Не блокируем вход: кабинет сам показывает экран ожидания подтверждения
        // и не отдаёт данные школы, пока администратор не подтвердит аккаунт.
        console.info(`[clientAuth] Вход клиента ${client.id} до подтверждения администратором`);
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
        jwtSecret(),
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
            tenantId: client.tenantId,
            isAccountApproved: client.isAccountApproved
          },
          tenant: {
            id: client.tenant.id,
            name: client.tenant.name,
            subdomain: client.tenant.subdomain
          },
          token,
          userType: 'client',
          isAccountApproved: client.isAccountApproved
        },
        message: 'Login successful'
      });
    }

    // Проверяем пароль и подтверждение для родителя
    if (parent) {
      if (!parent.password) {
        return res.status(401).json({
          success: false,
          error: 'Родитель не зарегистрирован'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, parent.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Неверный пароль'
        });
      }

      if (!parent.isAccountApproved) {
        console.info(`[clientAuth] Вход родителя ${parent.id} до подтверждения администратором`);
      }

      // Обновляем lastLogin
      await prisma.parent.update({
        where: { id: parent.id },
        data: { lastLogin: new Date() }
      });

      // Генерируем JWT токен для родителя
      const token = jwt.sign(
        {
          parentId: parent.id,
          tenantId: parent.tenantId,
          type: 'parent'
        },
        jwtSecret(),
        { expiresIn: '30d' }
      );

      if (!parent.tenant) {
        return res.status(500).json({
          success: false,
          error: 'Tenant not found'
        });
      }

      return res.json({
        success: true,
        data: {
          parent: {
            id: parent.id,
            fullName: parent.fullName,
            email: parent.email,
            phone: parent.phone,
            tenantId: parent.tenantId,
            clientId: parent.clientId,
            client: parent.client ? {
              id: parent.client.id,
              firstName: parent.client.firstName,
              lastName: parent.client.lastName,
              middleName: parent.client.middleName
            } : null
          },
          tenant: {
            id: parent.tenant.id,
            name: parent.tenant.name,
            subdomain: parent.tenant.subdomain
          },
          token,
          userType: 'parent',
          isAccountApproved: parent.isAccountApproved
        },
        message: 'Login successful'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Пользователь не найден'
    });
  } catch (error: any) {
    console.error('Login client/parent error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
};

/**
 * Получение профиля клиента или родителя
 */
export const getClientProfile = async (req: Request, res: Response<ApiResponse>) => {
  try {
    // В middleware будет установлен req.client или req.parent
    const clientId = (req as any).client?.id;
    const parentId = (req as any).parent?.id;
    const tenantId = (req as any).client?.tenantId || (req as any).parent?.tenantId;
    const userType = (req as any).userType;

    if ((!clientId && !parentId) || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Если это клиент
    if (clientId && userType === 'client') {
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
        data: {
          ...client,
          userType: 'client'
        }
      });
    }

    // Если это родитель
    if (parentId && userType === 'parent') {
      const parent = await prisma.parent.findUnique({
        where: { id: parentId },
        include: {
          tenant: {
            include: {
              tenantSettings: true,
              subscription: true
            }
          },
          client: {
            include: {
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
          }
        }
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          error: 'Parent not found'
        });
      }

      // Возвращаем данные в формате, совместимом с клиентом
      return res.json({
        success: true,
        data: {
          ...parent.client,
          userType: 'parent',
          parent: {
            id: parent.id,
            fullName: parent.fullName,
            email: parent.email,
            phone: parent.phone
          }
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  } catch (error: any) {
    console.error('Get client/parent profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

/**
 * Получение расписания тренировок клиента
 */
export const getClientTrainings = async (req: Request, res: Response<ApiResponse>) => {
  try {
    let clientId = (req as any).client?.id;
    let tenantId = (req as any).client?.tenantId || (req as any).parent?.tenantId;

    // Если это родитель, получаем ID его ребенка
    if (!clientId && (req as any).parent?.id) {
      const parent = await prisma.parent.findUnique({
        where: { id: (req as any).parent.id },
        select: { clientId: true, tenantId: true }
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          error: 'Parent not found'
        });
      }

      clientId = parent.clientId;
      tenantId = parent.tenantId;
    }

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

/**
 * Подтверждение регистрации родителя по токену
 */

/**
 * Поиск родителей по телефону или email для регистрации
 */
export const findParentsForRegistration = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
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

    // Ищем родителей по телефону или email
    const whereClause: any = {};

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

    const parents = await prisma.parent.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true
          }
        },
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
    parents.forEach(parent => {
      const tenant = parent.tenant;
      const client = parent.client;
      if (tenant && client) {
        if (!tenantsMap.has(tenant.id)) {
          tenantsMap.set(tenant.id, {
            tenant: tenant,
            parents: []
          });
        }
        tenantsMap.get(tenant.id).parents.push({
          id: parent.id,
          fullName: parent.fullName,
          phone: parent.phone,
          email: parent.email,
          client: {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            middleName: client.middleName
          }
        });
      }
    });

    const tenants = Array.from(tenantsMap.values());

    return res.json({
      success: true,
      data: tenants,
      message: tenants.length > 0 ? 'Parents found' : 'No parents found'
    });
  } catch (error: any) {
    console.error('Find parents for registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to find parents'
    });
  }
});

/**
 * Регистрация родителя
 */
export const registerParent = asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { parentId, tenantId, password } = req.body;

    if (!parentId || !tenantId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Parent ID, tenant ID, and password are required'
      });
    }

    // Проверяем, что родитель существует и принадлежит указанному тенанту
    const parent = await prisma.parent.findFirst({
      where: {
        id: parentId,
        tenantId: tenantId,
        isApproved: true // Родитель должен быть подтвержден (автоматически при создании)
      },
      include: {
        tenant: true,
        client: true
      }
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Родитель не найден или не подтвержден'
      });
    }

    // Проверяем, не зарегистрирован ли уже родитель
    if (parent.password) {
      // Если родитель уже зарегистрирован, но не подтвержден
      if (!parent.isAccountApproved) {
        return res.status(400).json({
          success: false,
          error: 'Ваш аккаунт уже зарегистрирован и ожидает подтверждения администратором'
        });
      }
      // Если родитель уже зарегистрирован и подтвержден
      return res.status(400).json({
        success: false,
        error: 'Родитель уже зарегистрирован'
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Обновляем родителя: добавляем пароль, но не подтверждаем аккаунт
    await prisma.parent.update({
      where: { id: parentId },
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
    console.error('Register parent error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register parent'
    });
  }
});

