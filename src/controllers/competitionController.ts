import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';

// Get all competitions
export const getCompetitions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 100, search, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      tenantId: req.tenant?.id
    };

    const andConditions: any[] = [];

    // Фильтр по поисковому запросу
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { location: { contains: search as string, mode: 'insensitive' } }
        ]
      });
    }

    // Фильтр по датам - соревнование попадает в диапазон, если его период пересекается с заданным диапазоном
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Соревнование попадает в диапазон, если:
      // - startDate соревнования <= end (дата окончания диапазона)
      // И
      // - endDate соревнования >= start (дата начала диапазона)
      andConditions.push({
        startDate: {
          lte: end
        }
      });
      andConditions.push({
        endDate: {
          gte: start
        }
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [competitions, total] = await Promise.all([
      prisma.competition.findMany({
        where,
        include: {
          participants: {
            include: {
              client: true,
              attendance: true
            }
          },
          trainers: {
            include: {
              trainer: {
                include: {
                  user: true
                }
              }
            }
          },
          results: {
            include: {
              participant: {
                include: {
                  client: true
                }
              }
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: { startDate: 'asc' }
      }),
      prisma.competition.count({ where })
    ]);

    res.json({
      success: true,
      data: competitions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      message: 'Competitions retrieved successfully'
    });
  } catch (error: any) {
    console.error('Get competitions error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to retrieve competitions',
      details: error
    });
  }
};

// Get competition by ID
export const getCompetitionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const competition = await prisma.competition.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        participants: {
          include: {
            client: true,
            attendance: true,
            results: true
          }
        },
        trainers: {
          include: {
            trainer: {
              include: {
                user: true
              }
            }
          }
        },
        results: {
          include: {
            participant: {
              include: {
                client: true
              }
            }
          }
        }
      }
    });

    if (!competition) {
      res.status(404).json({
        success: false,
        error: 'Competition not found'
      });
      return;
    }

    res.json({
      success: true,
      data: competition,
      message: 'Competition retrieved successfully'
    });
  } catch (error) {
    console.error('Get competition error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve competition'
    });
  }
};

// Create competition
export const createCompetition = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      location,
      startDate,
      endDate,
      registrationDate,
      registrationTime,
      isElectronicRegistration,
      positionDocument,
      regulationsDocument,
      trainerIds = [],
      participantIds = []
    } = req.body;

    // Ensure arrays are arrays
    const trainerIdsArray = Array.isArray(trainerIds) ? trainerIds : [];
    const participantIdsArray = Array.isArray(participantIds) ? participantIds : [];

    // Create competition
    const competition = await prisma.competition.create({
      data: {
        name,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        registrationDate: new Date(registrationDate),
        registrationTime: registrationTime ? new Date(registrationTime) : null,
        isElectronicRegistration: isElectronicRegistration || false,
        positionDocument: positionDocument || null,
        regulationsDocument: regulationsDocument || null,
        tenantId: req.tenant!.id,
        trainers: {
          create: trainerIdsArray.map((trainerId: string) => ({
            trainerId,
            tenantId: req.tenant!.id
          }))
        },
        participants: {
          create: participantIdsArray.map((clientId: string) => ({
            clientId,
            tenantId: req.tenant!.id
          }))
        }
      },
    });

    // Automatically exclude participants from groups on competition dates
    if (participantIdsArray.length > 0) {
      const compStartDate = new Date(startDate);
      const compEndDate = new Date(endDate);
      
      // Find all active group memberships for participants
      const groupMemberships = await prisma.groupMembership.findMany({
        where: {
          clientId: { in: participantIdsArray },
          isActive: true
        }
      });

      // Temporarily deactivate memberships for competition dates
      // We'll use leftAt to mark when they left, but keep isActive true
      // This way we can track that they're away for competition
      for (const membership of groupMemberships) {
        // Check if there are trainings on competition dates
        const trainingsOnCompetitionDays = await prisma.training.findMany({
          where: {
            groupId: membership.groupId,
            isCancelled: false,
            startTime: {
              gte: compStartDate,
              lte: compEndDate
            }
          }
        });

        // If there are trainings, we mark the membership as temporarily inactive
        if (trainingsOnCompetitionDays.length > 0) {
          await prisma.groupMembership.update({
            where: {
              clientId_groupId: {
                clientId: membership.clientId,
                groupId: membership.groupId
              }
            },
            data: {
              isActive: false,
              leftAt: compStartDate
            }
          });
        }
      }
    }

    // Fetch competition with relations
    const competitionWithRelations = await prisma.competition.findFirst({
      where: { id: competition.id },
      include: {
        participants: {
          include: {
            client: true
          }
        },
        trainers: {
          include: {
            trainer: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: competitionWithRelations,
      message: 'Competition created successfully'
    });
  } catch (error: any) {
    console.error('Create competition error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create competition',
      details: error?.meta || error
    });
  }
};

// Update competition
export const updateCompetition = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      location,
      startDate,
      endDate,
      registrationDate,
      registrationTime,
      isElectronicRegistration,
      positionDocument,
      regulationsDocument,
      trainerIds,
      participantIds
    } = req.body;

    const competition = await prisma.competition.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!competition) {
      res.status(404).json({
        success: false,
        error: 'Competition not found'
      });
      return;
    }

    // Update competition data
    const updateData: any = {
      name,
      location,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      registrationDate: new Date(registrationDate),
      registrationTime: registrationTime ? new Date(registrationTime) : null,
      isElectronicRegistration: isElectronicRegistration || false
    };

    if (positionDocument !== undefined) {
      updateData.positionDocument = positionDocument || null;
    }
    if (regulationsDocument !== undefined) {
      updateData.regulationsDocument = regulationsDocument || null;
    }

    // Update trainers if provided
    if (trainerIds !== undefined) {
      // Delete existing trainers
      await prisma.competitionTrainer.deleteMany({
        where: { competitionId: id }
      });
      // Create new trainers
      if (trainerIds.length > 0) {
        await prisma.competitionTrainer.createMany({
          data: trainerIds.map((trainerId: string) => ({
            competitionId: id,
            trainerId,
            tenantId: req.tenant!.id
          }))
        });
      }
    }

    // Update participants if provided
    if (participantIds !== undefined) {
      // Delete existing participants (but keep results and attendance)
      const existingParticipants = await prisma.competitionParticipant.findMany({
        where: { competitionId: id }
      });
      const existingParticipantIds = existingParticipants.map(p => p.clientId);
      const toAdd = participantIds.filter((id: string) => !existingParticipantIds.includes(id));
      const toRemove = existingParticipantIds.filter((id: string) => !participantIds.includes(id));

      // Add new participants
      if (toAdd.length > 0) {
        await prisma.competitionParticipant.createMany({
          data: toAdd.map((clientId: string) => ({
            competitionId: id,
            clientId,
            tenantId: req.tenant!.id
          }))
        });
      }

      // Remove participants (this will cascade delete results and attendance)
      if (toRemove.length > 0) {
        await prisma.competitionParticipant.deleteMany({
          where: {
            competitionId: id,
            clientId: { in: toRemove }
          }
        });

        // Restore group memberships for removed participants
        const groupMemberships = await prisma.groupMembership.findMany({
          where: {
            clientId: { in: toRemove },
            isActive: false,
            leftAt: {
              gte: new Date(competition.startDate),
              lte: new Date(competition.endDate)
            }
          }
        });

        for (const membership of groupMemberships) {
          await prisma.groupMembership.update({
            where: {
              clientId_groupId: {
                clientId: membership.clientId,
                groupId: membership.groupId
              }
            },
            data: {
              isActive: true,
              leftAt: null
            }
          });
        }
      }

      // Exclude new participants from groups on competition dates
      if (toAdd.length > 0 && competition.startDate && competition.endDate) {
        const compStartDate = new Date(competition.startDate);
        const compEndDate = new Date(competition.endDate);
        
        const groupMemberships = await prisma.groupMembership.findMany({
          where: {
            clientId: { in: toAdd },
            isActive: true
          }
        });

        for (const membership of groupMemberships) {
          const trainingsOnCompetitionDays = await prisma.training.findMany({
            where: {
              groupId: membership.groupId,
              isCancelled: false,
              startTime: {
                gte: compStartDate,
                lte: compEndDate
              }
            }
          });

          if (trainingsOnCompetitionDays.length > 0) {
            await prisma.groupMembership.update({
              where: {
                clientId_groupId: {
                  clientId: membership.clientId,
                  groupId: membership.groupId
                }
              },
              data: {
                isActive: false,
                leftAt: compStartDate
              }
            });
          }
        }
      }
    }

    const updatedCompetition = await prisma.competition.findFirst({
      where: { id },
      include: {
        participants: {
          include: {
            client: true,
            attendance: true
          }
        },
        trainers: {
          include: {
            trainer: {
              include: {
                user: true
              }
            }
          }
        },
        results: {
          include: {
            participant: {
              include: {
                client: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedCompetition,
      message: 'Competition updated successfully'
    });
  } catch (error: any) {
    console.error('Update competition error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to update competition',
      details: error?.meta || error
    });
  }
};

// Delete competition
export const deleteCompetition = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const competition = await prisma.competition.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!competition) {
      res.status(404).json({
        success: false,
        error: 'Competition not found'
      });
      return;
    }

    await prisma.competition.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Competition deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete competition error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete competition'
    });
  }
};

// Add result to competition
export const addCompetitionResult = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { competitionId } = req.params;
    const { participantId, result, resultValue, category, performanceTime } = req.body;

    const competitionResult = await prisma.competitionResult.create({
      data: {
        competitionId,
        participantId,
        result: result || null,
        resultValue: resultValue ? parseFloat(resultValue) : null,
        category: category || null,
        performanceTime: performanceTime ? new Date(performanceTime) : null
      },
      include: {
        participant: {
          include: {
            client: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: competitionResult,
      message: 'Competition result added successfully'
    });
  } catch (error: any) {
    console.error('Add competition result error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to add competition result'
    });
  }
};

// Update competition result
export const updateCompetitionResult = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { result, resultValue, category, performanceTime } = req.body;

    const competitionResult = await prisma.competitionResult.findFirst({
      where: { id },
      include: {
        competition: true
      }
    });

    if (!competitionResult || competitionResult.competition.tenantId !== req.tenant?.id) {
      res.status(404).json({
        success: false,
        error: 'Competition result not found'
      });
      return;
    }

    const updatedResult = await prisma.competitionResult.update({
      where: { id },
      data: {
        result: result !== undefined ? result : null,
        resultValue: resultValue !== undefined ? (resultValue ? parseFloat(resultValue) : null) : undefined,
        category: category !== undefined ? category : null,
        performanceTime: performanceTime !== undefined ? (performanceTime ? new Date(performanceTime) : null) : undefined
      },
      include: {
        participant: {
          include: {
            client: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedResult,
      message: 'Competition result updated successfully'
    });
  } catch (error: any) {
    console.error('Update competition result error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to update competition result'
    });
  }
};

// Delete competition result
export const deleteCompetitionResult = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const competitionResult = await prisma.competitionResult.findFirst({
      where: { id },
      include: {
        competition: true
      }
    });

    if (!competitionResult || competitionResult.competition.tenantId !== req.tenant?.id) {
      res.status(404).json({
        success: false,
        error: 'Competition result not found'
      });
      return;
    }

    await prisma.competitionResult.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Competition result deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete competition result error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to delete competition result'
    });
  }
};

// Update competition attendance
export const updateCompetitionAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { competitionId, participantId } = req.params;
    const { status, notes } = req.body;

    const participant = await prisma.competitionParticipant.findFirst({
      where: {
        competitionId,
        id: participantId,
        tenantId: req.tenant?.id
      },
      include: {
        competition: true
      }
    });

    if (!participant) {
      res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
      return;
    }

    // Upsert attendance
    const attendance = await prisma.competitionAttendance.upsert({
      where: { participantId: participant.id },
      update: {
        status,
        notes: notes || null
      },
      create: {
        competitionId,
        participantId: participant.id,
        status,
        notes: notes || null,
        tenantId: req.tenant!.id
      },
      include: {
        participant: {
          include: {
            client: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: attendance,
      message: 'Competition attendance updated successfully'
    });
  } catch (error: any) {
    console.error('Update competition attendance error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to update competition attendance'
    });
  }
};

// Get trainers with conflicts (trainers assigned to competition who also have trainings on competition dates)
export const getTrainerConflicts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { competitionId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
      return;
    }

    const competition = await prisma.competition.findFirst({
      where: {
        id: competitionId,
        tenantId: req.tenant?.id
      },
      include: {
        trainers: true
      }
    });

    if (!competition) {
      res.status(404).json({
        success: false,
        error: 'Competition not found'
      });
      return;
    }

    const trainerIds = competition.trainers.map(t => t.trainerId);
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Find trainings that conflict with competition dates
    const conflictingTrainings = await prisma.training.findMany({
      where: {
        tenantId: req.tenant?.id,
        trainerId: { in: trainerIds },
        isCancelled: false,
        OR: [
          {
            startTime: {
              gte: start,
              lte: end
            }
          },
          {
            endTime: {
              gte: start,
              lte: end
            }
          },
          {
            AND: [
              { startTime: { lte: start } },
              { endTime: { gte: end } }
            ]
          }
        ]
      },
      include: {
        trainer: {
          include: {
            user: true
          }
        },
        group: true,
        branch: true
      }
    });

    res.json({
      success: true,
      data: conflictingTrainings,
      message: 'Trainer conflicts retrieved successfully'
    });
  } catch (error: any) {
    console.error('Get trainer conflicts error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to get trainer conflicts'
    });
  }
};

