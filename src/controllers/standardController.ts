import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * Get all standards for tenant
 */
export const getStandards = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { search, isActive } = req.query;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  const where: any = { tenantId };

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
      { category: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const standards = await prisma.standard.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          clientStandards: true
        }
      }
    }
  });

  res.json({
    success: true,
    data: standards
  });
});

/**
 * Get standard by ID
 */
export const getStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  const standard = await prisma.standard.findFirst({
    where: {
      id,
      tenantId
    },
    include: {
      clientStandards: {
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { completedAt: 'desc' },
        take: 10
      }
    }
  });

  if (!standard) {
    res.status(404).json({
      success: false,
      error: 'Standard not found'
    });
    return;
  }

  res.json({
    success: true,
    data: standard
  });
});

/**
 * Create new standard
 */
export const createStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { name, description, unit, targetValue, category, isActive } = req.body;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  if (!name) {
    res.status(400).json({
      success: false,
      error: 'Name is required'
    });
    return;
  }

  const standard = await prisma.standard.create({
    data: {
      name,
      description,
      unit,
      targetValue: targetValue ? parseFloat(targetValue) : null,
      category,
      isActive: isActive !== undefined ? isActive : true,
      tenantId
    }
  });

  res.status(201).json({
    success: true,
    data: standard,
    message: 'Standard created successfully'
  });
});

/**
 * Update standard
 */
export const updateStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { name, description, unit, targetValue, category, isActive } = req.body;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  // Check if standard exists and belongs to tenant
  const existingStandard = await prisma.standard.findFirst({
    where: { id, tenantId }
  });

  if (!existingStandard) {
    res.status(404).json({
      success: false,
      error: 'Standard not found'
    });
    return;
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (unit !== undefined) updateData.unit = unit;
  if (targetValue !== undefined) updateData.targetValue = targetValue ? parseFloat(targetValue) : null;
  if (category !== undefined) updateData.category = category;
  if (isActive !== undefined) updateData.isActive = isActive;

  const standard = await prisma.standard.update({
    where: { id },
    data: updateData
  });

  res.json({
    success: true,
    data: standard,
    message: 'Standard updated successfully'
  });
});

/**
 * Delete standard
 */
export const deleteStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  // Check if standard exists and belongs to tenant
  const standard = await prisma.standard.findFirst({
    where: { id, tenantId }
  });

  if (!standard) {
    res.status(404).json({
      success: false,
      error: 'Standard not found'
    });
    return;
  }

  // Delete all client standards related to this standard
  await prisma.clientStandard.deleteMany({
    where: { standardId: id }
  });

  // Delete standard
  await prisma.standard.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Standard deleted successfully'
  });
});

/**
 * Get client standards (выполнения нормативов клиентом)
 */
export const getClientStandards = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { clientId } = req.params;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  // Verify client belongs to tenant
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId }
  });

  if (!client) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  const clientStandards = await prisma.clientStandard.findMany({
    where: { clientId },
    include: {
      standard: true
    },
    orderBy: { completedAt: 'desc' }
  });

  res.json({
    success: true,
    data: clientStandards
  });
});

/**
 * Add client standard (записать выполнение норматива)
 */
export const addClientStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { clientId } = req.params;
  const { standardId, completedAt, result, resultText, status, notes } = req.body;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  // Verify client belongs to tenant
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId }
  });

  if (!client) {
    res.status(404).json({
      success: false,
      error: 'Client not found'
    });
    return;
  }

  // Verify standard belongs to tenant
  const standard = await prisma.standard.findFirst({
    where: { id: standardId, tenantId }
  });

  if (!standard) {
    res.status(404).json({
      success: false,
      error: 'Standard not found'
    });
    return;
  }

  const clientStandard = await prisma.clientStandard.create({
    data: {
      clientId,
      standardId,
      completedAt: completedAt ? new Date(completedAt) : new Date(),
      result: result ? parseFloat(result) : null,
      resultText,
      status: status || 'completed',
      notes
    },
    include: {
      standard: true
    }
  });

  res.status(201).json({
    success: true,
    data: clientStandard,
    message: 'Client standard added successfully'
  });
});

/**
 * Update client standard
 */
export const updateClientStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { clientId, clientStandardId } = req.params;
  const { completedAt, result, resultText, status, notes } = req.body;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  // Verify client standard exists and belongs to client/tenant
  const clientStandard = await prisma.clientStandard.findFirst({
    where: {
      id: clientStandardId,
      clientId
    },
    include: {
      client: true,
      standard: true
    }
  });

  if (!clientStandard || clientStandard.client.tenantId !== tenantId) {
    res.status(404).json({
      success: false,
      error: 'Client standard not found'
    });
    return;
  }

  const updateData: any = {};
  if (completedAt !== undefined) updateData.completedAt = new Date(completedAt);
  if (result !== undefined) updateData.result = result ? parseFloat(result) : null;
  if (resultText !== undefined) updateData.resultText = resultText;
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;

  const updated = await prisma.clientStandard.update({
    where: { id: clientStandardId },
    data: updateData,
    include: {
      standard: true
    }
  });

  res.json({
    success: true,
    data: updated,
    message: 'Client standard updated successfully'
  });
});

/**
 * Delete client standard
 */
export const deleteClientStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { clientId, clientStandardId } = req.params;

  if (!tenantId) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
    return;
  }

  // Verify client standard exists and belongs to client/tenant
  const clientStandard = await prisma.clientStandard.findFirst({
    where: {
      id: clientStandardId,
      clientId
    },
    include: {
      client: true
    }
  });

  if (!clientStandard || clientStandard.client.tenantId !== tenantId) {
    res.status(404).json({
      success: false,
      error: 'Client standard not found'
    });
    return;
  }

  await prisma.clientStandard.delete({
    where: { id: clientStandardId }
  });

  res.json({
    success: true,
    message: 'Client standard deleted successfully'
  });
});

