import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { AuthService } from '../services/authService';
import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../constants/security';
import fs from 'fs';
import path from 'path';
import {
  absoluteUploadPath,
  contentDispositionAttachment,
  decodeUploadOriginalName,
  safeUnlink,
} from '../utils/fileStorage';
import {
  SALARY_SCHEMES,
  SalaryScheme,
  schemeToLegacyType,
  resolveScheme,
  resolveRate,
  getTrainerLedger,
  getSalaryLedgerSummary,
  addManualLedgerEntry,
  getPayoutReminder,
  accrueFixedMonthlyForTenant,
  backfillTrainingVisitAccruals,
  backfillPaymentAccruals,
  SCHEME_LABELS,
} from '../services/trainerSalaryService';

const TRAINER_DOC_KINDS = ['DIPLOMA', 'EDUCATION', 'CERTIFICATE', 'OTHER'] as const;
type TrainerDocKind = (typeof TRAINER_DOC_KINDS)[number];

function normalizeDocKind(raw: unknown): TrainerDocKind {
  const k = String(raw || 'OTHER').toUpperCase();
  return (TRAINER_DOC_KINDS as readonly string[]).includes(k) ? (k as TrainerDocKind) : 'OTHER';
}

/** full = admin/owner/senior; self = own profile whitelist only */
async function resolveTrainerEditAccess(
  req: AuthenticatedRequest,
  trainer: { id: string; userId: string; tenantId: string }
): Promise<'full' | 'self' | null> {
  const role = req.user?.role;
  if (!role || !req.user?.id) return null;
  if (role === 'OWNER' || role === 'ADMIN') return 'full';
  if (role !== 'TRAINER') return null;
  if (trainer.userId === req.user.id) return 'self';
  const { getSeniorBranchIds } = await import('../utils/branchAccess');
  const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
  if (seniorIds.length === 0) return null;
  const linked = await prisma.trainer.findFirst({
    where: {
      id: trainer.id,
      tenantId: trainer.tenantId,
      OR: [
        { branches: { some: { branchId: { in: seniorIds } } } },
        { groups: { some: { branchId: { in: seniorIds }, isActive: true } } },
        { seniorBranches: { some: { id: { in: seniorIds } } } },
      ],
    },
    select: { id: true },
  });
  return linked ? 'full' : null;
}

function parseSalaryFields(body: any): {
  salaryScheme: SalaryScheme;
  salaryRate: number | undefined;
  salaryType: string;
  salaryAmount: number | undefined;
} {
  const rawScheme = body.salaryScheme || body.salaryType;
  const scheme = (SALARY_SCHEMES as readonly string[]).includes(rawScheme)
    ? (rawScheme as SalaryScheme)
    : resolveScheme({ salaryScheme: body.salaryScheme, salaryType: body.salaryType });
  const rateRaw = body.salaryRate ?? body.salaryAmount;
  const salaryRate =
    rateRaw !== undefined && rateRaw !== null && rateRaw !== ''
      ? parseFloat(String(rateRaw))
      : undefined;
  return {
    salaryScheme: scheme,
    salaryRate,
    salaryType: schemeToLegacyType(scheme),
    salaryAmount: salaryRate,
  };
}

export const getTrainers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 1000, search, includeAdmins } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Получаем тренеров
    const trainerWhere: any = {
      tenantId: req.tenant?.id,
      isActive: true
    };

    if (req.user?.role === 'TRAINER') {
      const { getSeniorBranchIds } = await import('../utils/branchAccess');
      const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
      if (seniorIds.length > 0) {
        trainerWhere.OR = [
          { branches: { some: { branchId: { in: seniorIds } } } },
          { groups: { some: { branchId: { in: seniorIds }, isActive: true } } },
          { seniorBranches: { some: { id: { in: seniorIds } } } },
        ];
      }
    }

    if (search) {
      trainerWhere.user = {
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { middleName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ]
      };
    }

    const [trainers, trainersTotal] = await Promise.all([
      prisma.trainer.findMany({
        where: trainerWhere,
        include: {
          user: true,
          branches: {
            include: {
              branch: true
            }
          }
        },
        skip,
        take: Number(limit),
        orderBy: {
          user: {
            firstName: 'asc'
          }
        }
      }),
      prisma.trainer.count({ where: trainerWhere })
    ]);

    // Если нужно включить администраторов
    let admins: any[] = [];
    let adminsTotal = 0;
    
    // Безопасная проверка параметра includeAdmins
    let shouldIncludeAdmins = false;
    if (typeof includeAdmins === 'string') {
      shouldIncludeAdmins = includeAdmins === 'true' || includeAdmins === '1';
    } else if (typeof includeAdmins === 'boolean') {
      shouldIncludeAdmins = includeAdmins === true;
    }

    if (shouldIncludeAdmins && req.user?.role === 'TRAINER') {
      const { getSeniorBranchIds } = await import('../utils/branchAccess');
      const seniorIds = await getSeniorBranchIds(req.user.id, req.tenant?.id);
      // Старший тренер не управляет администраторами школы
      if (seniorIds.length > 0) {
        shouldIncludeAdmins = false;
      }
    }
    
    if (shouldIncludeAdmins) {
      const adminWhere: any = {
        tenantId: req.tenant?.id,
        role: { in: ['ADMIN', 'PROMOTER'] },
      };

      if (search) {
        adminWhere.OR = [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { middleName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      [admins, adminsTotal] = await Promise.all([
        prisma.user.findMany({
          where: adminWhere,
          skip,
          take: Number(limit),
          orderBy: {
            firstName: 'asc'
          }
        }),
        prisma.user.count({ where: adminWhere })
      ]);
    }

    // TRAINER не должен видеть чужие балансы и ставки ЗП
    const isPrivileged = req.user?.role === 'OWNER' || req.user?.role === 'ADMIN';
    let myTrainerId: string | null = null;
    if (!isPrivileged && req.user?.id) {
      const me = await prisma.trainer.findFirst({
        where: { userId: req.user.id, tenantId: req.tenant?.id, isActive: true },
        select: { id: true },
      });
      myTrainerId = me?.id || null;
    }
    const sanitizeTrainer = (t: (typeof trainers)[number]) => {
      const base = { ...t, employeeType: 'trainer' as const };
      if (isPrivileged || t.id === myTrainerId) return base;
      const {
        balance: _b,
        salaryRate: _sr,
        salaryAmount: _sa,
        salaryPercentage: _sp,
        salaryScheme: _ss,
        salaryType: _st,
        ...safe
      } = base as typeof base & {
        balance?: unknown;
        salaryRate?: unknown;
        salaryAmount?: unknown;
        salaryPercentage?: unknown;
        salaryScheme?: unknown;
        salaryType?: unknown;
      };
      return safe;
    };

    // Объединяем тренеров, администраторов и промоутеров
    const allEmployees = [
      ...trainers.map(sanitizeTrainer),
      ...admins.map(a => ({
        ...a,
        employeeType: a.role === 'PROMOTER' ? 'promoter' : 'admin',
        user: a,
      })),
    ];

    res.json({
      success: true,
      data: allEmployees,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: trainersTotal + adminsTotal,
        totalPages: Math.ceil((trainersTotal + adminsTotal) / Number(limit))
      },
      message: 'Employees retrieved successfully'
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve employees'
    });
  }
};

export const getTrainerById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true,
        branches: {
          include: {
            branch: true
          }
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    const access = await resolveTrainerEditAccess(req, trainer);
    if (!access && req.user?.role === 'TRAINER') {
      res.status(403).json({ success: false, error: 'Недостаточно прав' });
      return;
    }

    res.json({
      success: true,
      data: trainer,
      message: 'Trainer retrieved successfully'
    });
  } catch (error) {
    console.error('Get trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainer'
    });
  }
};

export const createTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.tenant?.id) {
      res.status(400).json({
        success: false,
        error: 'Требуется ID тенанта'
      });
      return;
    }

    const {
      email,
      password,
      firstName,
      lastName,
      middleName,
      phone,
      qualification,
      experience,
      specialization,
      coachCategory,
      judgeCategory,
      achievements,
      canViewAllGroups,
      branchId,
    } = req.body;
    const salary = parseSalaryFields(req.body);
    const normalizedEmail = String(email || '').trim().toLowerCase();

    let seniorBranchIds: string[] = [];
    if (req.user?.role === 'TRAINER') {
      const { getSeniorBranchIds } = await import('../utils/branchAccess');
      seniorBranchIds = await getSeniorBranchIds(req.user.id, req.tenant.id);
      if (seniorBranchIds.length === 0) {
        res.status(403).json({ success: false, error: 'Insufficient permissions' });
        return;
      }
      if (!branchId || !seniorBranchIds.includes(branchId)) {
        res.status(400).json({
          success: false,
          error: 'Укажите филиал, которым вы управляете',
        });
        return;
      }
    }

    if (!normalizedEmail) {
      res.status(400).json({ success: false, error: 'Укажите email' });
      return;
    }
    if (!password || String(password).length < 6) {
      res.status(400).json({ success: false, error: 'Пароль должен содержать минимум 6 символов' });
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: req.tenant.id },
      include: { trainer: true },
    });

    if (existingUser) {
      if (existingUser.trainer) {
        res.status(400).json({
          success: false,
          error: 'Тренер с таким email уже существует в этой школе',
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: `Email уже занят сотрудником (${existingUser.role}) в этой школе. Укажите другой email или измените роль существующего пользователя`,
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        middleName,
        phone,
        role: 'TRAINER',
        tenantId: req.tenant.id
      }
    });

    // Создаем тренера с нужными данными
    const trainer = await prisma.trainer.create({
      data: {
        userId: user.id,
        qualification,
        experience: experience ? parseInt(experience) : undefined,
        specialization,
        coachCategory: coachCategory != null ? String(coachCategory).trim() || null : null,
        judgeCategory: judgeCategory != null ? String(judgeCategory).trim() || null : null,
        achievements: achievements != null ? String(achievements).trim() || null : null,
        salaryType: salary.salaryType,
        salaryAmount: salary.salaryAmount,
        salaryScheme: salary.salaryScheme,
        salaryRate: salary.salaryRate,
        individualTrainingPrice:
          req.body.individualTrainingPrice !== undefined &&
          req.body.individualTrainingPrice !== null &&
          req.body.individualTrainingPrice !== ''
            ? parseFloat(String(req.body.individualTrainingPrice))
            : null,
        canViewAllGroups:
          seniorBranchIds.length > 0
            ? false
            : canViewAllGroups === true || canViewAllGroups === 'true',
        tenantId: req.tenant.id
      },
      include: {
        user: true
      }
    });

    if (seniorBranchIds.length > 0 && branchId) {
      await prisma.trainerBranch.create({
        data: {
          trainerId: trainer.id,
          branchId,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: trainer,
      message: 'Trainer created successfully'
    });
    return;
  } catch (error: any) {
    console.error('Create trainer error:', error);
    if (error?.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'Этот email уже занят в этой школе. Укажите другой адрес',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create trainer'
    });
    return;
  }
};

export const updateTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      middleName,
      email,
      phone,
      password,
      qualification,
      experience,
      specialization,
      coachCategory,
      judgeCategory,
      achievements,
      canViewAllGroups,
    } = req.body;

    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    const access = await resolveTrainerEditAccess(req, trainer);
    if (!access) {
      res.status(403).json({ success: false, error: 'Недостаточно прав для изменения профиля' });
      return;
    }

    const isSelfOnly = access === 'self';

    const hasSalaryUpdate =
      !isSelfOnly &&
      (req.body.salaryScheme !== undefined ||
        req.body.salaryType !== undefined ||
        req.body.salaryRate !== undefined ||
        req.body.salaryAmount !== undefined);
    const salary = hasSalaryUpdate ? parseSalaryFields(req.body) : null;

    const normalizedEmail =
      !isSelfOnly && email !== undefined && email !== null
        ? String(email).trim().toLowerCase()
        : undefined;

    if (normalizedEmail) {
      const emailTaken = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          tenantId: req.tenant!.id,
          NOT: { id: trainer.userId },
        },
      });
      if (emailTaken) {
        res.status(400).json({
          success: false,
          error: 'Этот email уже занят в этой школе. Укажите другой адрес',
        });
        return;
      }
    }

    const userUpdateData: any = {};
    if (firstName !== undefined) userUpdateData.firstName = firstName;
    if (lastName !== undefined) userUpdateData.lastName = lastName;
    if (middleName !== undefined) userUpdateData.middleName = middleName;
    if (phone !== undefined) userUpdateData.phone = phone;
    if (normalizedEmail) {
      userUpdateData.email = normalizedEmail;
    }

    if (!isSelfOnly && password && password.trim() !== '') {
      userUpdateData.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
      userUpdateData.sessionVersion = { increment: 1 };
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: trainer.userId },
        data: userUpdateData
      });
    }

    const trainerUpdateData: any = {};
    if (qualification !== undefined) trainerUpdateData.qualification = qualification;
    if (experience !== undefined) {
      trainerUpdateData.experience =
        experience === null || experience === '' ? null : parseInt(String(experience), 10);
    }
    if (specialization !== undefined) trainerUpdateData.specialization = specialization;
    if (coachCategory !== undefined) {
      trainerUpdateData.coachCategory = String(coachCategory || '').trim() || null;
    }
    if (judgeCategory !== undefined) {
      trainerUpdateData.judgeCategory = String(judgeCategory || '').trim() || null;
    }
    if (achievements !== undefined) {
      trainerUpdateData.achievements = String(achievements || '').trim() || null;
    }

    if (!isSelfOnly) {
      if (canViewAllGroups !== undefined) {
        trainerUpdateData.canViewAllGroups =
          canViewAllGroups === true || canViewAllGroups === 'true';
      }
      if (salary) {
        trainerUpdateData.salaryScheme = salary.salaryScheme;
        trainerUpdateData.salaryRate = salary.salaryRate;
        trainerUpdateData.salaryType = salary.salaryType;
        trainerUpdateData.salaryAmount = salary.salaryAmount;
      }
      if (req.body.individualTrainingPrice !== undefined) {
        const raw = req.body.individualTrainingPrice;
        trainerUpdateData.individualTrainingPrice =
          raw === null || raw === '' ? null : parseFloat(String(raw));
      }
    }

    Object.keys(trainerUpdateData).forEach(key => {
      if (trainerUpdateData[key] === undefined) {
        delete trainerUpdateData[key];
      }
    });

    const updatedTrainer = await prisma.trainer.update({
      where: { id },
      data: trainerUpdateData,
      include: {
        user: true,
        documents: { orderBy: { createdAt: 'desc' } },
      }
    });

    res.json({
      success: true,
      data: updatedTrainer,
      message: 'Trainer updated successfully'
    });
  } catch (error: any) {
    console.error('Update trainer error:', error);
    if (error?.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'Этот email уже занят в этой школе. Укажите другой адрес',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update trainer'
    });
  }
};

export const deleteTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    await prisma.trainer.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Trainer deleted successfully'
    });
  } catch (error) {
    console.error('Delete trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trainer'
    });
  }
};

export const addBranchToTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // trainer id
    const { branchId } = req.body;

    if (!branchId) {
      res.status(400).json({
        success: false,
        error: 'Branch ID is required'
      });
      return;
    }

    // Verify trainer exists and belongs to tenant
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    // Verify branch exists and belongs to tenant
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId: req.tenant?.id
      }
    });

    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'Branch not found'
      });
      return;
    }

    // Check if trainer is already assigned to this branch
    const existingAssignment = await prisma.trainerBranch.findUnique({
      where: {
        trainerId_branchId: {
          trainerId: id,
          branchId: branchId
        }
      }
    });

    if (existingAssignment) {
      res.status(400).json({
        success: false,
        error: 'Trainer is already assigned to this branch'
      });
      return;
    }

    // Create assignment
    const assignment = await prisma.trainerBranch.create({
      data: {
        trainerId: id,
        branchId: branchId
      },
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
      data: assignment,
      message: 'Trainer assigned to branch successfully'
    });
  } catch (error: any) {
    console.error('Add branch to trainer error:', error);
    if (error.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'Trainer is already assigned to this branch'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to assign trainer to branch'
      });
    }
  }
};

export const removeBranchFromTrainer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // trainer id
    const { branchId } = req.params; // branch id from route

    // Verify trainer exists and belongs to tenant
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    // Find assignment
    const assignment = await prisma.trainerBranch.findUnique({
      where: {
        trainerId_branchId: {
          trainerId: id,
          branchId: branchId
        }
      }
    });

    if (!assignment) {
      res.status(404).json({
        success: false,
        error: 'Trainer is not assigned to this branch'
      });
      return;
    }

    // Delete assignment
    await prisma.trainerBranch.delete({
      where: {
        trainerId_branchId: {
          trainerId: id,
          branchId: branchId
        }
      }
    });

    res.json({
      success: true,
      message: 'Trainer removed from branch successfully'
    });
  } catch (error) {
    console.error('Remove branch from trainer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove trainer from branch'
    });
  }
};

/**
 * Get trainer earnings from salary ledger
 */
export const getTrainerEarnings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params; // trainer id
    const { startDate, endDate } = req.query;

    // Verify trainer exists and belongs to tenant
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
      return;
    }

    // If user is trainer, they can only see their own earnings
    if (req.user?.role === 'TRAINER' && trainer.userId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    const from = startDate ? new Date(startDate as string) : undefined;
    const to = endDate ? new Date(endDate as string) : undefined;
    const ledger = await getTrainerLedger(req.tenant!.id, id, from, to);
    const scheme = resolveScheme(trainer);
    const rate = resolveRate(trainer);

    res.json({
      success: true,
      data: {
        trainer: {
          id: trainer.id,
          name: `${trainer.user?.firstName} ${trainer.user?.lastName}`,
          salaryScheme: scheme,
          salarySchemeLabel: SCHEME_LABELS[scheme],
          salaryRate: rate,
          salaryType: scheme,
          salaryAmount: rate,
          balance: Number(trainer.balance || 0),
        },
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        totalEarnings: ledger.totalEarnings,
        trainingCount: ledger.items.filter((i) => i.kind === 'training_visit').length,
        entryCount: ledger.entryCount,
        ledger: ledger.items,
        // legacy shape for older UI — map ledger to table rows
        trainingEarnings: ledger.items
          .filter((i) => i.kind !== 'payout')
          .map((i) => ({
            trainingId: i.trainingId,
            trainingTitle: i.title,
            trainingDate: i.occurredAt,
            groupName: i.personName || i.title,
            branchName: '',
            presentCount: 1,
            trainingPrice: null,
            totalRevenue: null,
            earnings: i.amount,
            comment: i.comment,
            kind: i.kind,
          })),
      }
    });
  } catch (error) {
    console.error('Get trainer earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainer earnings'
    });
  }
};

export const getTrainerSalaryLedger = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to, startDate, endDate } = req.query;
    const trainer = await prisma.trainer.findFirst({
      where: { id, tenantId: req.tenant?.id },
    });
    if (!trainer) {
      res.status(404).json({ success: false, error: 'Trainer not found' });
      return;
    }
    if (req.user?.role === 'TRAINER' && trainer.userId !== req.user.id) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    const fromDate = from || startDate ? new Date((from || startDate) as string) : undefined;
    const toDate = to || endDate ? new Date((to || endDate) as string) : undefined;
    const ledger = await getTrainerLedger(req.tenant!.id, id, fromDate, toDate);
    res.json({ success: true, data: ledger });
  } catch (error) {
    console.error('Get salary ledger error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve salary ledger' });
  }
};

export const postTrainerSalaryLedger = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    const { id } = req.params;
    const { amount, title, comment, kind, occurredAt, personName } = req.body;
    const result = await addManualLedgerEntry({
      tenantId: req.tenant!.id,
      trainerId: id,
      amount: Number(amount),
      title,
      comment,
      kind: kind === 'adjustment' ? 'adjustment' : 'bonus',
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      personName: personName ?? null,
    });
    res.status(201).json({ success: true, data: result, message: 'Ledger entry created' });
  } catch (error: any) {
    console.error('Post salary ledger error:', error);
    res.status(400).json({ success: false, error: error?.message || 'Failed to create ledger entry' });
  }
};

export const getSalaryPayoutReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.json({ success: true, data: { show: false } });
      return;
    }
    const reminder = await getPayoutReminder(req.tenant!.id);
    res.json({ success: true, data: reminder });
  } catch (error) {
    console.error('Payout reminder error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payout reminder' });
  }
};

export const accrueFixedMonthlySalaries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    const count = await accrueFixedMonthlyForTenant(req.tenant!.id, new Date());
    res.json({ success: true, data: { accruedCount: count }, message: `Начислено: ${count}` });
  } catch (error) {
    console.error('Accrue fixed monthly error:', error);
    res.status(500).json({ success: false, error: 'Failed to accrue fixed monthly salaries' });
  }
};

/** Доначислить зарплату за уже отмеченные PRESENT (схема «фикс за тренировку с человека»). */
export const backfillSalaryFromAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Требуется ID тенанта' });
      return;
    }
    const result = await backfillTrainingVisitAccruals(req.tenant.id);
    res.json({
      success: true,
      data: result,
      message: `Обработано посещений: ${result.processed}, новых начислений: ${result.accruedCount} на сумму ${result.accruedTotal}`,
    });
  } catch (error) {
    console.error('Backfill salary from attendance error:', error);
    res.status(500).json({ success: false, error: 'Failed to backfill salary accruals' });
  }
};

/** Доначислить зарплату по оплаченным платежам (фикс % / фикс с ученика). */
export const backfillSalaryFromPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    if (!req.tenant?.id) {
      res.status(400).json({ success: false, error: 'Требуется ID тенанта' });
      return;
    }
    const result = await backfillPaymentAccruals(req.tenant.id);
    res.json({
      success: true,
      data: result,
      message: `Обработано платежей: ${result.processed}, новых начислений: ${result.accruedCount} на сумму ${result.accruedTotal}`,
    });
  } catch (error) {
    console.error('Backfill salary from payments error:', error);
    res.status(500).json({ success: false, error: 'Failed to backfill payment salary accruals' });
  }
};

/**
 * Get all trainers earnings (for admin/owner)
 */
// Get notification settings for a trainer
export const getTrainerNotificationSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Find trainer
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
    }

    // Check permissions: trainer can only see their own settings, admin/owner can see any
    if (req.user?.role === 'TRAINER' && trainer.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get or create notification settings
    let settings = await prisma.trainerNotificationSettings.findUnique({
      where: { trainerId: id }
    });

    if (!settings) {
      settings = await prisma.trainerNotificationSettings.create({
        data: {
          trainerId: id,
          allTrainingsEnabled: false,
          reminderEnabled: false,
          reminderBeforeMinutes: 60,
          timezone: 'UTC'
        }
      });
    }

    return res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get notification settings'
    });
  }
};

// Update notification settings for a trainer
export const updateTrainerNotificationSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { allTrainingsTime, allTrainingsEnabled, notificationPeriod, reminderBeforeMinutes, reminderEnabled, timezone } = req.body;
    const userId = req.user?.id;

    // Find trainer
    const trainer = await prisma.trainer.findFirst({
      where: {
        id,
        tenantId: req.tenant?.id
      },
      include: {
        user: true
      }
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
    }

    // Check permissions: trainer can only update their own settings, admin/owner can update any
    if (req.user?.role === 'TRAINER' && trainer.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate allTrainingsTime (0-1439 minutes)
    if (allTrainingsTime !== undefined && allTrainingsTime !== null) {
      const time = parseInt(allTrainingsTime);
      if (isNaN(time) || time < 0 || time > 1439) {
        return res.status(400).json({
          success: false,
          error: 'Invalid allTrainingsTime. Must be between 0 and 1439 minutes'
        });
      }
    }

    // Validate notificationPeriod
    if (notificationPeriod !== undefined && notificationPeriod !== null) {
      const validPeriods = ['tomorrow', 'week', 'month'];
      if (!validPeriods.includes(notificationPeriod)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid notificationPeriod. Must be one of: tomorrow, week, month'
        });
      }
    }

    // Validate reminderBeforeMinutes (positive number)
    if (reminderBeforeMinutes !== undefined && reminderBeforeMinutes !== null) {
      const minutes = parseInt(reminderBeforeMinutes);
      if (isNaN(minutes) || minutes < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid reminderBeforeMinutes. Must be a positive number'
        });
      }
    }

    // Validate timezone (IANA timezone identifier)
    if (timezone !== undefined && timezone !== null && timezone !== '') {
      try {
        // Проверяем валидность часового пояса, пытаясь создать дату с этим часовым поясом
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid timezone. Must be a valid IANA timezone identifier (e.g., Europe/Moscow, UTC, America/New_York)'
        });
      }
    }

    // Update or create settings
    const settings = await prisma.trainerNotificationSettings.upsert({
      where: { trainerId: id },
      update: {
        allTrainingsTime: allTrainingsTime !== undefined && allTrainingsTime !== null ? parseInt(allTrainingsTime) : undefined,
        allTrainingsEnabled: allTrainingsEnabled !== undefined ? Boolean(allTrainingsEnabled) : undefined,
        notificationPeriod: notificationPeriod !== undefined ? notificationPeriod : undefined,
        reminderBeforeMinutes: reminderBeforeMinutes !== undefined && reminderBeforeMinutes !== null ? parseInt(reminderBeforeMinutes) : undefined,
        reminderEnabled: reminderEnabled !== undefined ? Boolean(reminderEnabled) : undefined,
        timezone: timezone !== undefined ? (timezone || 'UTC') : undefined
      },
      create: {
        trainerId: id,
        allTrainingsTime: allTrainingsTime !== undefined && allTrainingsTime !== null ? parseInt(allTrainingsTime) : undefined,
        allTrainingsEnabled: allTrainingsEnabled !== undefined ? Boolean(allTrainingsEnabled) : false,
        notificationPeriod: notificationPeriod || 'tomorrow',
        reminderBeforeMinutes: reminderBeforeMinutes !== undefined && reminderBeforeMinutes !== null ? parseInt(reminderBeforeMinutes) : 60,
        reminderEnabled: reminderEnabled !== undefined ? Boolean(reminderEnabled) : false,
        timezone: timezone || 'UTC'
      }
    });

    return res.json({
      success: true,
      data: settings,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
};

export const getAllTrainersEarnings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only admin and owner can access this
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      return;
    }

    const { startDate, endDate } = req.query;
    const from = startDate ? new Date(startDate as string) : undefined;
    const to = endDate ? new Date(endDate as string) : undefined;
    const summary = await getSalaryLedgerSummary(req.tenant!.id, from, to);

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        trainers: summary.trainers,
        totalEarnings: summary.totalEarnings
      }
    });
  } catch (error) {
    console.error('Get all trainers earnings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trainers earnings'
    });
  }
};

export const listTrainerDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trainer = await prisma.trainer.findFirst({
      where: { id, tenantId: req.tenant?.id },
    });
    if (!trainer) {
      res.status(404).json({ success: false, error: 'Trainer not found' });
      return;
    }
    const access = await resolveTrainerEditAccess(req, trainer);
    if (!access && req.user?.role === 'TRAINER') {
      res.status(403).json({ success: false, error: 'Недостаточно прав' });
      return;
    }
    const documents = await prisma.trainerDocument.findMany({
      where: { trainerId: id, tenantId: req.tenant!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('List trainer documents error:', error);
    res.status(500).json({ success: false, error: 'Failed to list documents' });
  }
};

export const uploadTrainerDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const trainer = await prisma.trainer.findFirst({
      where: { id, tenantId: req.tenant?.id },
    });
    if (!trainer) {
      res.status(404).json({ success: false, error: 'Trainer not found' });
      return;
    }
    const access = await resolveTrainerEditAccess(req, trainer);
    if (!access) {
      res.status(403).json({ success: false, error: 'Недостаточно прав' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'Файл не загружен' });
      return;
    }

    const originalName = decodeUploadOriginalName(file.originalname);
    const storagePath = path.join('trainer-docs', String(req.tenant!.id), file.filename).replace(/\\/g, '/');
    const title =
      String(req.body?.title || '').trim() ||
      originalName.replace(/\.[^.]+$/, '') ||
      'Документ';
    const kind = normalizeDocKind(req.body?.kind);

    const doc = await prisma.trainerDocument.create({
      data: {
        trainerId: id,
        tenantId: req.tenant!.id,
        kind,
        title,
        originalName,
        storagePath,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        uploadedById: req.user?.id || null,
      },
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('Upload trainer document error:', error);
    if (req.file?.filename && req.tenant?.id) {
      safeUnlink(path.join('trainer-docs', String(req.tenant.id), req.file.filename).replace(/\\/g, '/'));
    }
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
};

export const downloadTrainerDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, docId } = req.params;
    const trainer = await prisma.trainer.findFirst({
      where: { id, tenantId: req.tenant?.id },
    });
    if (!trainer) {
      res.status(404).json({ success: false, error: 'Trainer not found' });
      return;
    }
    const access = await resolveTrainerEditAccess(req, trainer);
    // Staff (owner/admin) can always download; trainers only own or managed
    if (!access && req.user?.role === 'TRAINER') {
      res.status(403).json({ success: false, error: 'Недостаточно прав' });
      return;
    }
    if (req.user?.role !== 'OWNER' && req.user?.role !== 'ADMIN' && !access) {
      res.status(403).json({ success: false, error: 'Недостаточно прав' });
      return;
    }

    const doc = await prisma.trainerDocument.findFirst({
      where: { id: docId, trainerId: id, tenantId: req.tenant!.id },
    });
    if (!doc) {
      res.status(404).json({ success: false, error: 'Документ не найден' });
      return;
    }
    const abs = absoluteUploadPath(doc.storagePath);
    if (!fs.existsSync(abs)) {
      res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
      return;
    }
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', contentDispositionAttachment(doc.originalName));
    fs.createReadStream(abs).pipe(res);
  } catch (error) {
    console.error('Download trainer document error:', error);
    res.status(500).json({ success: false, error: 'Failed to download document' });
  }
};

export const deleteTrainerDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, docId } = req.params;
    const trainer = await prisma.trainer.findFirst({
      where: { id, tenantId: req.tenant?.id },
    });
    if (!trainer) {
      res.status(404).json({ success: false, error: 'Trainer not found' });
      return;
    }
    const access = await resolveTrainerEditAccess(req, trainer);
    if (!access) {
      res.status(403).json({ success: false, error: 'Недостаточно прав' });
      return;
    }

    const doc = await prisma.trainerDocument.findFirst({
      where: { id: docId, trainerId: id, tenantId: req.tenant!.id },
    });
    if (!doc) {
      res.status(404).json({ success: false, error: 'Документ не найден' });
      return;
    }

    await prisma.trainerDocument.delete({ where: { id: doc.id } });
    safeUnlink(doc.storagePath);
    res.json({ success: true, message: 'Документ удалён' });
  } catch (error) {
    console.error('Delete trainer document error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
};
