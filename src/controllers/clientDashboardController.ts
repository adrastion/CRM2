import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { ClientRequest } from '../middleware/clientAuth';
import { unauthorized } from '../utils/httpError';
import { getActiveMembershipSummary } from '../services/clientMembershipService';
import { applyPersonalDiscount } from '../utils/personalDiscount';

/** Начало недели (понедельник) для переданной даты. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = понедельник
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 7);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function fullName(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').trim();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

/** Спортсмены, доступные текущему аккаунту (один номер — несколько детей). */
async function findLinkedAthletes(
  tenantId: string,
  userType: string | undefined,
  clientAuthId: string | undefined,
  parentAuthId: string | undefined
): Promise<Array<{ id: string; firstName: string; lastName: string }>> {
  if (userType === 'parent' && parentAuthId) {
    const parent = await prisma.parent.findUnique({
      where: { id: parentAuthId },
      select: { phone: true, email: true },
    });
    if (!parent) return [];

    const phone = normalizePhone(parent.phone);
    const email = parent.email?.toLowerCase().trim() || null;
    const orConditions: Array<Record<string, unknown>> = [];
    if (phone) orConditions.push({ phone: { contains: phone } });
    if (email) orConditions.push({ email: { equals: email, mode: 'insensitive' } });
    if (orConditions.length === 0) return [];

    const parents = await prisma.parent.findMany({
      where: { tenantId, OR: orConditions },
      select: { clientId: true },
    });
    const clientIds = [...new Set(parents.map((p) => p.clientId))];
    if (clientIds.length === 0) return [];

    return prisma.client.findMany({
      where: { tenantId, id: { in: clientIds }, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  if (clientAuthId) {
    const authClient = await prisma.client.findUnique({
      where: { id: clientAuthId },
      select: { phone: true, email: true },
    });
    if (!authClient) return [];

    const phone = normalizePhone(authClient.phone);
    const email = authClient.email?.toLowerCase().trim() || null;
    const orConditions: Array<Record<string, unknown>> = [];
    if (phone) orConditions.push({ phone: { contains: phone } });
    if (email) orConditions.push({ email: { equals: email, mode: 'insensitive' } });
    if (orConditions.length === 0) {
      return prisma.client.findMany({
        where: { id: clientAuthId, tenantId, isActive: true },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    return prisma.client.findMany({
      where: { tenantId, isActive: true, OR: orConditions },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  return [];
}

/**
 * Данные для личного кабинета ученика/родителя.
 *
 * Если аккаунт ещё не подтверждён администратором школы, никакие данные школы
 * не отдаются: фронтенд рисует некликабельные заглушки и сообщение об ожидании.
 */
export const getClientDashboard = asyncHandler(
  async (req: ClientRequest, res: Response<ApiResponse>) => {
    const userType = req.userType;
    const clientAuthId = req.client?.id;
    const parentAuthId = req.parent?.id;

    if (!clientAuthId && !parentAuthId) {
      throw unauthorized('Требуется авторизация');
    }

    /* --- Определяем ученика, чьи данные показываем --- */
    let clientId: string;
    let tenantId: string;
    let isAccountApproved: boolean;
    let viewerName = '';
    let viewerEmail: string | null = null;
    let viewerEmailVerified = false;
    let parentInfo: {
      id: string;
      fullName: string;
      phone: string | null;
      email: string | null;
      emailVerified?: boolean;
    } | null = null;

    if (userType === 'parent' && parentAuthId) {
      const parent = await prisma.parent.findUnique({
        where: { id: parentAuthId },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          emailVerified: true,
          clientId: true,
          tenantId: true,
          isAccountApproved: true,
        },
      });
      if (!parent) throw unauthorized('Аккаунт не найден');

      clientId = parent.clientId;
      tenantId = parent.tenantId;
      isAccountApproved = parent.isAccountApproved;
      viewerName = parent.fullName;
      viewerEmail = parent.email;
      viewerEmailVerified = parent.emailVerified;
      parentInfo = {
        id: parent.id,
        fullName: parent.fullName,
        phone: parent.phone,
        email: parent.email,
        emailVerified: parent.emailVerified,
      };
    } else {
      const client = await prisma.client.findUnique({
        where: { id: clientAuthId as string },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          email: true,
          emailVerified: true,
          tenantId: true,
          isAccountApproved: true,
        },
      });
      if (!client) throw unauthorized('Аккаунт не найден');

      clientId = client.id;
      tenantId = client.tenantId;
      isAccountApproved = client.isAccountApproved;
      viewerName = fullName([client.lastName, client.firstName, client.middleName]);
      viewerEmail = client.email;
      viewerEmailVerified = client.emailVerified;
    }

    const linkedAthletes = await findLinkedAthletes(tenantId, userType, clientAuthId, parentAuthId);
    const requestedClientId =
      typeof req.query.clientId === 'string' && req.query.clientId.trim()
        ? req.query.clientId.trim()
        : null;

    if (requestedClientId) {
      const allowed = linkedAthletes.some((a) => a.id === requestedClientId);
      if (!allowed) throw unauthorized('Нет доступа к выбранному спортсмену');
      clientId = requestedClientId;
    }

    const activeClientId = clientId;

    /* --- Аккаунт не подтверждён: отдаём только имя, без данных школы --- */
    if (!isAccountApproved) {
      res.json({
        success: true,
        data: {
          isAccountApproved: false,
          userType: userType || 'client',
          viewerName,
          viewerEmail,
          emailVerified: viewerEmailVerified,
          parent: parentInfo,
          linkedAthletes,
          activeClientId,
          // Пустые структуры, чтобы фронтенд отрисовал заглушки
          tenant: null,
          balance: null,
          attendance: null,
          staff: [],
          upcomingTrainings: [],
          monthEvents: [],
          groups: [],
        },
      });
      return;
    }

    /* --- Подтверждённый аккаунт: собираем полные данные --- */
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [client, tenant, tenantSettings, memberships] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          email: true,
          emailVerified: true,
          phone: true,
          photo: true,
          balance: true,
          membershipFeePaid: true,
          personalDiscountType: true,
          personalDiscountValue: true,
        },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, subdomain: true, logo: true },
      }),
      prisma.tenantSettings.findUnique({
        where: { tenantId },
        // Берём только флаги видимости — остальные настройки кабинету не нужны.
        select: { clientCanViewAllTrainers: true, clientCanViewAllBranches: true },
      }),
      prisma.groupMembership.findMany({
        where: { clientId, isActive: true },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              color: true,
              branchId: true,
              trainerId: true,
              isMonthlyPayment: true,
              monthlyPaymentAmount: true,
              paymentDueDay: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    if (!client || !tenant) throw unauthorized('Аккаунт не найден');

    const groupIds = memberships.map((m) => m.groupId);
    const groupTrainerIds = memberships
      .map((m) => m.group?.trainerId)
      .filter((v): v is string => Boolean(v));
    const groupBranchIds = memberships
      .map((m) => m.group?.branchId)
      .filter((v): v is string => Boolean(v));

    /* --- Персонал: тренеры групп + администраторы школы --- */
    const showAllTrainers = tenantSettings?.clientCanViewAllTrainers ?? false;
    const [trainers, admins] = await Promise.all([
      prisma.trainer.findMany({
        where: {
          tenantId,
          isActive: true,
          ...(showAllTrainers ? {} : { id: { in: groupTrainerIds } }),
        },
        include: {
          user: {
            select: { firstName: true, lastName: true, middleName: true, phone: true, email: true },
          },
        },
        take: 20,
      }),
      prisma.user.findMany({
        where: { tenantId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          phone: true,
          email: true,
          role: true,
        },
        take: 10,
      }),
    ]);

    const staff = [
      ...trainers.map((t) => ({
        id: t.id,
        roleLabel: 'Тренер',
        name: fullName([t.user?.lastName, t.user?.firstName, t.user?.middleName]),
        phone: t.user?.phone || null,
        email: t.user?.email || null,
      })),
      ...admins.map((a) => ({
        id: a.id,
        roleLabel: a.role === 'OWNER' ? 'Владелец' : 'Администратор',
        name: fullName([a.lastName, a.firstName, a.middleName]),
        phone: a.phone || null,
        email: a.email || null,
      })),
    ];

    /* --- Посещаемость за текущий месяц --- */
    const [attendanceTotal, attendancePresent] = await Promise.all([
      prisma.attendance.count({
        where: { clientId, tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.attendance.count({
        where: {
          clientId,
          tenantId,
          status: 'PRESENT',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    /* --- Тренировки: текущая неделя (правая колонка) и месяц (календарь) --- */
    const individualAttendances = await prisma.attendance.findMany({
      where: { clientId, training: { groupId: null, tenantId, isCancelled: false } },
      select: { trainingId: true },
    });
    const individualIds = individualAttendances.map((a) => a.trainingId);

    const trainingFilter =
      groupIds.length > 0 || individualIds.length > 0
        ? {
            tenantId,
            isCancelled: false,
            OR: [
              ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
              ...(individualIds.length > 0 ? [{ id: { in: individualIds } }] : []),
            ],
          }
        : null;

    const trainingInclude = {
      group: { select: { id: true, name: true, color: true } },
      trainer: {
        include: { user: { select: { firstName: true, lastName: true, middleName: true } } },
      },
      branch: { select: { id: true, name: true } },
      hall: { select: { id: true, name: true } },
    };

    const [weekTrainings, monthTrainings] = trainingFilter
      ? await Promise.all([
          prisma.training.findMany({
            where: { ...trainingFilter, startTime: { gte: weekStart, lt: weekEnd } },
            include: trainingInclude,
            orderBy: { startTime: 'asc' },
            take: 100,
          }),
          prisma.training.findMany({
            where: { ...trainingFilter, startTime: { gte: monthStart, lt: monthEnd } },
            include: trainingInclude,
            orderBy: { startTime: 'asc' },
            take: 300,
          }),
        ])
      : [[], []];

    const showAllBranches = tenantSettings?.clientCanViewAllBranches ?? false;
    const visible = <T extends { branchId?: string | null; trainerId?: string | null }>(list: T[]) =>
      list.filter((t) => {
        if (!showAllTrainers && t.trainerId && !groupTrainerIds.includes(t.trainerId)) return false;
        if (!showAllBranches && t.branchId && !groupBranchIds.includes(t.branchId)) return false;
        return true;
      });

    const mapTraining = (t: (typeof weekTrainings)[number]) => ({
      id: t.id,
      title: t.title || t.group?.name || 'Тренировка',
      startTime: t.startTime,
      endTime: t.endTime,
      groupName: t.group?.name || null,
      color: t.group?.color || null,
      branchName: t.branch?.name || null,
      hallName: t.hall?.name || null,
      trainerName: t.trainer?.user
        ? fullName([t.trainer.user.lastName, t.trainer.user.firstName, t.trainer.user.middleName])
        : null,
    });

    /* --- Следующее списание по ежемесячной оплате --- */
    let nextCharge: { date: string; amount: number } | null = null;
    for (const m of memberships) {
      const g = m.group;
      if (!g?.isMonthlyPayment || !g.monthlyPaymentAmount) continue;
      const dueDay = g.paymentDueDay || 1;
      const candidate = new Date(now.getFullYear(), now.getMonth(), dueDay);
      if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
      const { amount } = applyPersonalDiscount(
        Number(g.monthlyPaymentAmount),
        client?.personalDiscountType,
        client?.personalDiscountValue != null ? Number(client.personalDiscountValue) : null
      );
      if (!nextCharge || candidate.toISOString() < nextCharge.date) {
        nextCharge = { date: candidate.toISOString(), amount };
      }
    }

    const activeMembership = await getActiveMembershipSummary(client.id, tenantId);
    const membershipPayload = activeMembership
      ? {
          ...activeMembership,
          endDate: activeMembership.endDate
            ? activeMembership.endDate.toISOString()
            : null,
        }
      : null;

    res.json({
      success: true,
      data: {
        isAccountApproved: true,
        userType: userType || 'client',
        viewerName,
        viewerEmail,
        emailVerified: viewerEmailVerified,
        parent: parentInfo,
        linkedAthletes,
        activeClientId,
        tenant,
        client: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          middleName: client.middleName,
          email: client.email,
          emailVerified: client.emailVerified,
          phone: client.phone,
          photo: client.photo,
          membershipFeePaid: client.membershipFeePaid,
        },
        membership: membershipPayload,
        balance: {
          amount: Number(client.balance),
          nextCharge,
        },
        attendance: {
          present: attendancePresent,
          total: attendanceTotal,
        },
        staff,
        groups: memberships.map((m) => ({
          id: m.group?.id,
          name: m.group?.name,
          color: m.group?.color,
          branchName: m.group?.branch?.name || null,
        })),
        weekRange: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
        upcomingTrainings: visible(weekTrainings).map(mapTraining),
        monthEvents: visible(monthTrainings).map(mapTraining),
      },
    });
  }
);
