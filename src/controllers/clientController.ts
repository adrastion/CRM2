import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, ApiResponse, SearchQuery, CreateClientData, UpdateClientData } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, validateQuery } from '../middleware/validation';
import { clientSchemas, commonSchemas } from '../middleware/validation';

const prisma = new PrismaClient();

/**
 * Get all clients with pagination and search
 */
export const getClients = asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
  const { tenantId } = req;
  const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query as SearchQuery;

  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
  const take = parseInt(limit.toString());

  // Build where clause
  const where: any = {
    tenantId,
    isActive: true
  };

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
                }
              }
            }
          }
        },
      }
    }),
    prisma.client.count({ where })
  ]);

  res.json({
    success: true,
    data: clients,
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

  const client = await prisma.client.findFirst({
    where: {
      id,
      tenantId
    },
    include: {
      achievements: {
        orderBy: { date: 'desc' }
      },
      groupMemberships: {
        include: {
          group: {
            include: {
              trainer: {
                include: { user: true }
              }
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

  res.json({
    success: true,
    data: client
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

  // Преобразуем dateOfBirth в правильный формат DateTime
  const processedData = {
    ...clientData,
    tenantId,
    dateOfBirth: clientData.dateOfBirth ? new Date(clientData.dateOfBirth) : undefined
  };

  const client = await prisma.client.create({
    data: processedData
  });

  res.status(201).json({
    success: true,
    data: client,
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

  // Преобразуем dateOfBirth в правильный формат DateTime
  const processedData = {
    ...updateData,
    dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined
  };

  const client = await prisma.client.update({
    where: { id },
    data: processedData
  });

  res.json({
    success: true,
    data: client,
    message: 'Client updated successfully'
  });
});

/**
 * Delete client (soft delete)
 */
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
    data: { isActive: false }
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

// Validation middleware
export const validateCreateClient = validate(clientSchemas.create);
export const validateUpdateClient = validate(clientSchemas.update);
export const validateClientQuery = validateQuery(commonSchemas.pagination.concat(commonSchemas.search));
