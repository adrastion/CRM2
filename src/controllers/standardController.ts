import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * Get all standards for tenant
 * Optional: filter by groupIds to get standards for specific groups
 */
export const getStandards = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { search, isActive, groupIds } = req.query;

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

  // Filter by groups if groupIds provided
  if (groupIds) {
    const groupIdArray = Array.isArray(groupIds) ? groupIds : [groupIds];
    where.groups = {
      some: {
        groupId: {
          in: groupIdArray
        }
      }
    };
  }

  const standards = await prisma.standard.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      groups: {
        include: {
          group: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
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
 * Optional: attach to groups via groupIds array
 */
export const createStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { name, description, unit, targetValue, category, isActive, groupIds } = req.body;

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

  // Prepare standard data
  const standardData: any = {
      name,
      description,
      unit,
      targetValue: targetValue ? parseFloat(targetValue) : null,
      category,
      isActive: isActive !== undefined ? isActive : true,
      tenantId
  };

  // If groupIds provided, create StandardGroup relations
  if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
    standardData.groups = {
      create: groupIds.map((groupId: string) => ({
        groupId
      }))
    };
  }

  const standard = await prisma.standard.create({
    data: standardData,
    include: {
      groups: {
        include: {
          group: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
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
 * Optional: update group associations via groupIds array
 */
export const updateStandard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req;
  const { id } = req.params;
  const { name, description, unit, targetValue, category, isActive, groupIds } = req.body;

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

  // Update group associations if groupIds provided
  if (groupIds !== undefined) {
    // Delete existing group associations
    await prisma.standardGroup.deleteMany({
      where: { standardId: id }
    });

    // Create new group associations
    if (Array.isArray(groupIds) && groupIds.length > 0) {
      updateData.groups = {
        create: groupIds.map((groupId: string) => ({
          groupId
        }))
      };
    }
  }

  const standard = await prisma.standard.update({
    where: { id },
    data: updateData,
    include: {
      groups: {
        include: {
          group: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
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
 * Returns standards filtered by client's groups
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

  // Verify client belongs to tenant and get client's groups
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    include: {
      groupMemberships: {
        where: { isActive: true },
        include: {
          group: {
            select: {
              id: true
            }
          }
        }
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

  // Get client's active group IDs
  const clientGroupIds = client.groupMemberships.map(gm => gm.group.id);

  // Get all standards that are either:
  // 1. Not attached to any group (global standards)
  // 2. Attached to one of client's groups
  const standardsWhere: any = {
    tenantId,
    OR: [
      { groups: { none: {} } }, // Global standards (not attached to any group)
      ...(clientGroupIds.length > 0 ? [{
        groups: {
          some: {
            groupId: { in: clientGroupIds }
          }
        }
      }] : [])
    ]
  };

  const availableStandards = await prisma.standard.findMany({
    where: standardsWhere,
    select: { id: true }
  });

  const availableStandardIds = availableStandards.map(s => s.id);

  const clientStandards = await prisma.clientStandard.findMany({
    where: {
      clientId,
      standardId: { in: availableStandardIds }
    },
    include: {
      standard: {
        include: {
          groups: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: { updatedAt: 'desc' } // Sort by last update date
  });

  res.json({
    success: true,
    data: clientStandards
  });
});

/**
 * Add client standard (записать выполнение норматива)
 * Verifies that standard is available for client's groups
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

  // Verify client belongs to tenant and get client's groups
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    include: {
      groupMemberships: {
        where: { isActive: true },
        include: {
          group: {
            select: {
              id: true
            }
          }
        }
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

  // Get client's active group IDs
  const clientGroupIds = client.groupMemberships.map(gm => gm.group.id);

  // Verify standard belongs to tenant and is available for client's groups
  const standard = await prisma.standard.findFirst({
    where: {
      id: standardId,
      tenantId,
      OR: [
        { groups: { none: {} } }, // Global standards (not attached to any group)
        ...(clientGroupIds.length > 0 ? [{
          groups: {
            some: {
              groupId: { in: clientGroupIds }
            }
          }
        }] : [])
      ]
    }
  });

  if (!standard) {
    res.status(404).json({
      success: false,
      error: 'Standard not found or not available for this client\'s groups'
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
      standard: {
        include: {
          groups: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
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
  
  // updatedAt will be automatically updated by Prisma @updatedAt

  const updated = await prisma.clientStandard.update({
    where: { id: clientStandardId },
    data: updateData,
    include: {
      standard: {
        include: {
          groups: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
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

