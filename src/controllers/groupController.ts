import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

export const getGroups = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id,
      isActive: true
    };

    if (search) {
      // PostgreSQL supports case-insensitive search
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        include: {
          branch: true,
          trainer: {
            include: {
              user: true
            }
          },
          memberships: {
            where: { isActive: true },
            include: {
              client: true
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.group.count({ where })
    ]);

    res.json({
      success: true,
      data: groups,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Groups retrieved successfully'
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve groups'
    });
  }
};

export const getGroupById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        branch: true,
        trainer: {
          include: {
            user: true
          }
        },
        memberships: {
          where: { isActive: true },
          include: {
            client: true
          }
        }
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    res.json({
      success: true,
      data: group,
      message: 'Group retrieved successfully'
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve group'
    });
  }
};

export const createGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupData = {
      ...req.body,
      tenantId: req.tenant?.id
    };

    const group = await prisma.group.create({
      data: groupData,
      include: {
        branch: true,
        trainer: {
          include: {
            user: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: group,
      message: 'Group created successfully'
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create group'
    });
  }
};

export const updateGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: req.body,
      include: {
        branch: true,
        trainer: {
          include: {
            user: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedGroup,
      message: 'Group updated successfully'
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update group'
    });
  }
};

export const deleteGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    await prisma.group.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete group'
    });
  }
};

export const addClientToGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // group id
    const { clientId } = req.body;

    if (!clientId) {
      res.status(400).json({
        success: false,
        error: 'Client ID is required'
      });
      return;
    }

    // Verify group exists and belongs to tenant
    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    // Verify client exists and belongs to tenant
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: req.tenant?.id
      }
    });

    if (!client) {
      res.status(404).json({
        success: false,
        error: 'Client not found'
      });
      return;
    }

    // Check if client is already in group
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        clientId_groupId: {
          clientId,
          groupId: id
        }
      }
    });

    if (existingMembership) {
      // If membership exists but is inactive, reactivate it
      if (!existingMembership.isActive) {
        const updated = await prisma.groupMembership.update({
          where: {
            clientId_groupId: {
              clientId,
              groupId: id
            }
          },
          data: {
            isActive: true,
            leftAt: null
          },
          include: {
            client: true
          }
        });

        res.json({
          success: true,
          data: updated,
          message: 'Client re-added to group successfully'
        });
        return;
      } else {
        res.status(400).json({
          success: false,
          error: 'Client is already in this group'
        });
        return;
      }
    }

    // Check max members limit
    if (group.maxMembers) {
      const activeMembersCount = await prisma.groupMembership.count({
        where: {
          groupId: id,
          isActive: true
        }
      });

      if (activeMembersCount >= group.maxMembers) {
        res.status(400).json({
          success: false,
          error: `Group has reached maximum capacity of ${group.maxMembers} members`
        });
        return;
      }
    }

    // Create new membership
    const membership = await prisma.groupMembership.create({
      data: {
        clientId,
        groupId: id
      },
      include: {
        client: true
      }
    });

    res.status(201).json({
      success: true,
      data: membership,
      message: 'Client added to group successfully'
    });
  } catch (error: any) {
    console.error('Add client to group error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'Client is already in this group'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to add client to group'
      });
    }
  }
};

export const removeClientFromGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // group id
    const { clientId } = req.params; // client id from route

    // Verify group exists and belongs to tenant
    const group = await prisma.group.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found'
      });
      return;
    }

    // Find membership
    const membership = await prisma.groupMembership.findUnique({
      where: {
        clientId_groupId: {
          clientId,
          groupId: id
        }
      }
    });

    if (!membership) {
      res.status(404).json({
        success: false,
        error: 'Client is not a member of this group'
      });
      return;
    }

    // Soft delete - mark as inactive
    await prisma.groupMembership.update({
      where: {
        clientId_groupId: {
          clientId,
          groupId: id
        }
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Client removed from group successfully'
    });
  } catch (error) {
    console.error('Remove client from group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove client from group'
    });
  }
};
