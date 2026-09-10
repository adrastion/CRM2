import { prisma } from '../lib/prisma';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { AuthService } from '../services/authService';
import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../constants/security';
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
    
    if (shouldIncludeAdmins) {
      const adminWhere: any = {
        tenantId: req.tenant?.id,
        role: 'ADMIN'
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

    // Объединяем тренеров и администраторов
    const allEmployees = [
      ...trainers.map(t => ({ ...t, employeeType: 'trainer' })),
      ...admins.map(a => ({ ...a, employeeType: 'admin', user: a }))
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
        }
      }
    });

    if (!trainer) {
      res.status(404).json({
        success: false,
        error: 'Trainer not found'
      });
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

    const { email, password, firstName, lastName, middleName, phone, qualification, experience, specialization, canViewAllGroups } = req.body;
    const salary = parseSalaryFields(req.body);
    const normalizedEmail = String(email || '').trim().toLowerCase();

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
        salaryType: salary.salaryType,
        salaryAmount: salary.salaryAmount,
        salaryScheme: salary.salaryScheme,
        salaryRate: salary.salaryRate,
        canViewAllGroups: canViewAllGroups === true || canViewAllGroups === 'true',
        tenantId: req.tenant.id
      },
      include: {
        user: true
      }
    });

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
    const { firstName, lastName, middleName, email, phone, password, qualification, experience, specialization, canViewAllGroups } = req.body;
    const hasSalaryUpdate =
      req.body.salaryScheme !== undefined ||
      req.body.salaryType !== undefined ||
      req.body.salaryRate !== undefined ||
      req.body.salaryAmount !== undefined;
    const salary = hasSalaryUpdate ? parseSalaryFields(req.body) : null;

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

    const normalizedEmail =
      email !== undefined && email !== null
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

    // Обновляем данные пользователя
    const userUpdateData: any = {
      firstName,
      lastName,
      middleName,
      phone,
    };
    if (normalizedEmail) {
      userUpdateData.email = normalizedEmail;
    }

    // Если указан новый пароль, хешируем его и отзываем старые сессии
    if (password && password.trim() !== '') {
      userUpdateData.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
      userUpdateData.sessionVersion = { increment: 1 };
    }

    await prisma.user.update({
      where: { id: trainer.userId },
      data: userUpdateData
    });

    // Обновляем данные тренера
    const trainerUpdateData: any = {
      qualification,
      experience: experience ? parseInt(experience) : undefined,
      specialization,
      canViewAllGroups: canViewAllGroups !== undefined ? (canViewAllGroups === true || canViewAllGroups === 'true') : undefined
    };

    if (salary) {
      trainerUpdateData.salaryScheme = salary.salaryScheme;
      trainerUpdateData.salaryRate = salary.salaryRate;
      trainerUpdateData.salaryType = salary.salaryType;
      trainerUpdateData.salaryAmount = salary.salaryAmount;
    }

    // Удаляем undefined значения
    Object.keys(trainerUpdateData).forEach(key => {
      if (trainerUpdateData[key] === undefined) {
        delete trainerUpdateData[key];
      }
    });

    const updatedTrainer = await prisma.trainer.update({
      where: { id },
      data: trainerUpdateData,
      include: {
        user: true
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
        reminderBeforeMinutes: reminderBeforeMinutes !== undefined && reminderBeforeMinutes !== null ? parseInt(reminderBeforeMinutes) : undefined,
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
