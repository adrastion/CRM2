import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';

function membershipInclude() {
  return {
    membershipGroups: {
      include: {
        group: {
          select: {
            id: true,
            name: true,
            branchId: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
    },
    _count: { select: { clientMemberships: true } },
  } as const;
}

function normalizeMembershipCategory(value: unknown): 'CLIENT' | 'GROUP' | 'PERSONAL' {
  const category = String(value || 'CLIENT').toUpperCase();
  if (category === 'GROUP' || category === 'PERSONAL') return category;
  return 'CLIENT';
}

function percentageDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

async function decorateMemberships<T extends { id: string }>(memberships: T[], tenantId?: string) {
  if (!tenantId || memberships.length === 0) return memberships;
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const assignments = await prisma.clientMembership.findMany({
    where: { tenantId, membershipId: { in: memberships.map((membership) => membership.id) } },
    select: { membershipId: true, clientId: true, isActive: true, endDate: true },
  });
  const aggregates = new Map<
    string,
    { clients: Set<string>; activeAssignmentsCount: number; expiringSoonCount: number }
  >();
  for (const assignment of assignments) {
    const current = aggregates.get(assignment.membershipId) || {
      clients: new Set<string>(),
      activeAssignmentsCount: 0,
      expiringSoonCount: 0,
    };
    current.clients.add(assignment.clientId);
    if (assignment.isActive) {
      current.activeAssignmentsCount += 1;
      if (assignment.endDate && assignment.endDate >= now && assignment.endDate <= soon) {
        current.expiringSoonCount += 1;
      }
    }
    aggregates.set(assignment.membershipId, current);
  }
  return memberships.map((membership) => {
    const aggregate = aggregates.get(membership.id);
    return {
      ...membership,
      assignedClientsCount: aggregate?.clients.size || 0,
      activeAssignmentsCount: aggregate?.activeAssignmentsCount || 0,
      expiringSoonCount: aggregate?.expiringSoonCount || 0,
    };
  });
}

function parseOptionalInt(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalFloat(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Синхронизация legacy-флагов группы с GROUP-абонементом. */
async function syncGroupLegacyFlags(groupId: string, membership: { price: any; paymentWindowEndDay: number | null; isActive: boolean }) {
  await prisma.group.update({
    where: { id: groupId },
    data: {
      isMonthlyPayment: membership.isActive,
      monthlyPaymentAmount: membership.price,
      paymentDueDay: membership.paymentWindowEndDay ?? 6,
    },
  });
}

export const getMemberships = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 100,
      search,
      category,
      status,
      branchId,
      period,
      archived,
      isActive,
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { tenantId: req.tenant?.id };
    if (category) where.category = normalizeMembershipCategory(category);
    if (archived === 'true' || status === 'archived') where.archivedAt = { not: null };
    if (archived === 'false') where.archivedAt = null;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (status === 'active') {
      where.isActive = true;
      where.archivedAt = null;
    }
    if (status === 'inactive') {
      where.isActive = false;
      where.archivedAt = null;
    }
    if (status === 'expiring') {
      const now = new Date();
      where.archivedAt = null;
      where.clientMemberships = {
        some: {
          isActive: true,
          endDate: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
      };
    }
    if (branchId) {
      where.membershipGroups = { some: { group: { branchId: String(branchId) } } };
    }
    if (period === 'short') where.validityDays = { lte: 14 };
    if (period === 'month') {
      where.OR = [{ periodMonths: 1 }, { validityDays: { gte: 15, lte: 31 } }];
    }
    if (period === 'long') {
      where.OR = [{ periodMonths: { gt: 1 } }, { validityDays: { gt: 31 } }];
    }
    if (period === 'unlimited') {
      where.visits = null;
      where.validityDays = null;
      where.periodMonths = null;
    }
    if (search) {
      const searchFilter = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
      if (where.OR) where.AND = [{ OR: where.OR }, { OR: searchFilter }];
      else where.OR = searchFilter;
    }

    const [memberships, total] = await Promise.all([
      prisma.membership.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: membershipInclude(),
      }),
      prisma.membership.count({ where }),
    ]);

    const decorated = await decorateMemberships(memberships, req.tenant?.id);
    res.json({
      success: true,
      data: decorated,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get memberships error:', error);
    res.status(500).json({ success: false, error: 'Не удалось получить список абонементов' });
  }
};

export const getMembershipStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Требуется ID организации' });
      return;
    }
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const priorWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      total,
      active,
      expiringSoon,
      assignedRows,
      createdCurrent,
      createdPrevious,
      activeCreatedCurrent,
      activeCreatedPrevious,
      expiringPrevious,
      assignedCurrentRows,
      assignedPreviousRows,
    ] = await Promise.all([
      prisma.membership.count({ where: { tenantId } }),
      prisma.membership.count({ where: { tenantId, isActive: true, archivedAt: null } }),
      prisma.clientMembership.count({
        where: { tenantId, isActive: true, endDate: { gte: now, lte: soon } },
      }),
      prisma.clientMembership.findMany({
        where: { tenantId, isActive: true },
        distinct: ['clientId'],
        select: { clientId: true },
      }),
      prisma.membership.count({ where: { tenantId, createdAt: { gte: monthAgo } } }),
      prisma.membership.count({
        where: { tenantId, createdAt: { gte: twoMonthsAgo, lt: monthAgo } },
      }),
      prisma.membership.count({
        where: { tenantId, isActive: true, archivedAt: null, createdAt: { gte: monthAgo } },
      }),
      prisma.membership.count({
        where: {
          tenantId,
          isActive: true,
          archivedAt: null,
          createdAt: { gte: twoMonthsAgo, lt: monthAgo },
        },
      }),
      prisma.clientMembership.count({
        where: { tenantId, endDate: { gte: priorWeekStart, lt: now } },
      }),
      prisma.clientMembership.findMany({
        where: { tenantId, createdAt: { gte: monthAgo } },
        distinct: ['clientId'],
        select: { clientId: true },
      }),
      prisma.clientMembership.findMany({
        where: { tenantId, createdAt: { gte: twoMonthsAgo, lt: monthAgo } },
        distinct: ['clientId'],
        select: { clientId: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        expiringSoon,
        assignedClients: assignedRows.length,
        deltas: {
          total: percentageDelta(createdCurrent, createdPrevious),
          active: percentageDelta(activeCreatedCurrent, activeCreatedPrevious),
          expiringSoon: percentageDelta(expiringSoon, expiringPrevious),
          assignedClients: percentageDelta(assignedCurrentRows.length, assignedPreviousRows.length),
        },
      },
    });
  } catch (error) {
    console.error('Get membership stats error:', error);
    res.status(500).json({ success: false, error: 'Не удалось получить статистику абонементов' });
  }
};

export const getMembershipById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await prisma.membership.findFirst({
      where: { id, tenantId: req.tenant?.id },
      include: membershipInclude(),
    });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Абонемент не найден' });
      return;
    }
    const [decorated] = await decorateMemberships([membership], req.tenant?.id);
    res.json({ success: true, data: decorated });
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ success: false, error: 'Не удалось получить абонемент' });
  }
};

export const createMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Требуется ID организации' });
      return;
    }

    const {
      name,
      description,
      price,
      duration,
      visits,
      type,
      category = 'CLIENT',
      paymentWindowStartDay,
      paymentWindowEndDay,
      recalcMode,
      missThresholdPercent,
      validityDays,
      periodType,
      periodMonths,
      groupIds,
      groupBindings,
      effectiveFrom,
    } = req.body;

    const cat = normalizeMembershipCategory(category);

    if (!name || price == null || price === '') {
      res.status(400).json({ success: false, error: 'Укажите название и цену' });
      return;
    }

    let resolvedType = type;
    let resolvedPeriodType = periodType;
    if (cat === 'GROUP') {
      resolvedType = 'group_monthly';
      resolvedPeriodType = null;
    } else {
      if (!resolvedPeriodType) {
        resolvedPeriodType =
          visits != null && visits !== ''
            ? 'VISITS'
            : periodMonths
              ? 'CALENDAR_PERIOD'
              : 'FIXED_DAYS';
      }
      if (!resolvedType) {
        resolvedType = resolvedPeriodType === 'VISITS' ? 'visits' : 'monthly';
      }
    }

    const membership = await prisma.membership.create({
      data: {
        name: String(name).trim(),
        description: description || null,
        price: parseFloat(price),
        duration: parseOptionalInt(duration) ?? parseOptionalInt(validityDays),
        visits: parseOptionalInt(visits),
        type: resolvedType,
        category: cat,
        paymentWindowStartDay: cat === 'GROUP' ? parseOptionalInt(paymentWindowStartDay) ?? 1 : null,
        paymentWindowEndDay: cat === 'GROUP' ? parseOptionalInt(paymentWindowEndDay) ?? 6 : null,
        recalcMode: cat === 'GROUP' ? recalcMode || 'MISS_THRESHOLD' : null,
        missThresholdPercent: cat === 'GROUP' ? parseOptionalFloat(missThresholdPercent) ?? 50 : null,
        validityDays: cat !== 'GROUP' ? parseOptionalInt(validityDays) ?? parseOptionalInt(duration) : null,
        periodType: cat !== 'GROUP' ? resolvedPeriodType : null,
        periodMonths: cat !== 'GROUP' ? parseOptionalInt(periodMonths) : null,
        tenantId,
      },
      include: membershipInclude(),
    });

    // Привязка групп
    const bindings: Array<{ groupId: string; effectiveFrom?: string }> = Array.isArray(groupBindings)
      ? groupBindings
      : Array.isArray(groupIds)
        ? groupIds.map((gid: string) => ({ groupId: gid, effectiveFrom }))
        : [];

    if (cat === 'GROUP' && bindings.length > 0) {
      for (const b of bindings) {
        if (!b.groupId) continue;
        const group = await prisma.group.findFirst({ where: { id: b.groupId, tenantId } });
        if (!group) continue;
        await prisma.membershipGroup.upsert({
          where: { groupId: b.groupId },
          create: {
            membershipId: membership.id,
            groupId: b.groupId,
            effectiveFrom: b.effectiveFrom ? new Date(b.effectiveFrom) : new Date(),
          },
          update: {
            membershipId: membership.id,
            effectiveFrom: b.effectiveFrom ? new Date(b.effectiveFrom) : undefined,
          },
        });
        await syncGroupLegacyFlags(b.groupId, membership);
        const { backfillGroupMonthlyCharges } = await import('./paymentController');
        await backfillGroupMonthlyCharges({ tenantId, groupId: b.groupId }).catch((err) =>
          console.error('Backfill group monthly charges failed:', err)
        );
      }
    }

    const full = await prisma.membership.findUnique({
      where: { id: membership.id },
      include: membershipInclude(),
    });

    res.status(201).json({ success: true, data: full });
  } catch (error: any) {
    console.error('Create membership error:', error);
    res.status(500).json({ success: false, error: error.message || 'Не удалось создать абонемент' });
  }
};

export const updateMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    const membership = await prisma.membership.findFirst({ where: { id, tenantId } });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Абонемент не найден' });
      return;
    }

    const {
      name,
      description,
      price,
      duration,
      visits,
      type,
      isActive,
      category,
      paymentWindowStartDay,
      paymentWindowEndDay,
      recalcMode,
      missThresholdPercent,
      validityDays,
      periodType,
      periodMonths,
      groupBindings,
      groupIds,
      effectiveFrom,
    } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (duration !== undefined) updateData.duration = parseOptionalInt(duration);
    if (visits !== undefined) updateData.visits = parseOptionalInt(visits);
    if (type !== undefined) updateData.type = type;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (category !== undefined) updateData.category = normalizeMembershipCategory(category);
    if (paymentWindowStartDay !== undefined) updateData.paymentWindowStartDay = parseOptionalInt(paymentWindowStartDay);
    if (paymentWindowEndDay !== undefined) updateData.paymentWindowEndDay = parseOptionalInt(paymentWindowEndDay);
    if (recalcMode !== undefined) updateData.recalcMode = recalcMode;
    if (missThresholdPercent !== undefined) updateData.missThresholdPercent = parseOptionalFloat(missThresholdPercent);
    if (validityDays !== undefined) updateData.validityDays = parseOptionalInt(validityDays);
    if (periodType !== undefined) updateData.periodType = periodType;
    if (periodMonths !== undefined) updateData.periodMonths = parseOptionalInt(periodMonths);

    const updated = await prisma.membership.update({ where: { id }, data: updateData });

    const cat = updateData.category || membership.category;
    if (cat !== 'GROUP' && membership.category === 'GROUP') {
      const oldLinks = await prisma.membershipGroup.findMany({ where: { membershipId: id } });
      for (const link of oldLinks) {
        await prisma.membershipGroup.delete({ where: { id: link.id } });
        await prisma.group.update({
          where: { id: link.groupId },
          data: { isMonthlyPayment: false, monthlyPaymentAmount: null, paymentDueDay: null },
        });
      }
    }
    if (cat === 'GROUP' && (groupBindings !== undefined || groupIds !== undefined)) {
      const bindings: Array<{ groupId: string; effectiveFrom?: string }> = Array.isArray(groupBindings)
        ? groupBindings
        : Array.isArray(groupIds)
          ? groupIds.map((gid: string) => ({ groupId: gid, effectiveFrom }))
          : [];

      const keep = new Set(bindings.map((b) => b.groupId).filter(Boolean));
      const existing = await prisma.membershipGroup.findMany({ where: { membershipId: id } });
      for (const ex of existing) {
        if (!keep.has(ex.groupId)) {
          await prisma.membershipGroup.delete({ where: { id: ex.id } });
          await prisma.group.update({
            where: { id: ex.groupId },
            data: { isMonthlyPayment: false, monthlyPaymentAmount: null, paymentDueDay: null },
          });
        }
      }
      for (const b of bindings) {
        if (!b.groupId) continue;
        const group = await prisma.group.findFirst({ where: { id: b.groupId, tenantId: tenantId! } });
        if (!group) continue;
        await prisma.membershipGroup.upsert({
          where: { groupId: b.groupId },
          create: {
            membershipId: id,
            groupId: b.groupId,
            effectiveFrom: b.effectiveFrom ? new Date(b.effectiveFrom) : new Date(),
          },
          update: {
            membershipId: id,
            ...(b.effectiveFrom ? { effectiveFrom: new Date(b.effectiveFrom) } : {}),
          },
        });
        await syncGroupLegacyFlags(b.groupId, {
          price: updated.price,
          paymentWindowEndDay: updated.paymentWindowEndDay,
          isActive: updated.isActive,
        });
        const { backfillGroupMonthlyCharges } = await import('./paymentController');
        await backfillGroupMonthlyCharges({ tenantId: tenantId!, groupId: b.groupId }).catch((err) =>
          console.error('Backfill group monthly charges failed:', err)
        );
      }
    } else if (cat === 'GROUP') {
      const links = await prisma.membershipGroup.findMany({ where: { membershipId: id } });
      for (const link of links) {
        await syncGroupLegacyFlags(link.groupId, {
          price: updated.price,
          paymentWindowEndDay: updated.paymentWindowEndDay,
          isActive: updated.isActive,
        });
      }
    }

    const full = await prisma.membership.findUnique({
      where: { id },
      include: membershipInclude(),
    });
    res.json({ success: true, data: full });
  } catch (error: any) {
    console.error('Update membership error:', error);
    res.status(500).json({ success: false, error: error.message || 'Не удалось обновить абонемент' });
  }
};

export const deleteMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    const membership = await prisma.membership.findFirst({
      where: { id, tenantId },
      include: {
        clientMemberships: { include: { client: { select: { id: true, isActive: true } } } },
        membershipGroups: true,
      },
    });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Абонемент не найден' });
      return;
    }
    // «Используется» = выдан хотя бы одному активному клиенту.
    // Soft-deleted клиенты и история платежей не должны блокировать удаление шаблона.
    const usedByActiveClients = membership.clientMemberships.some((cm) => cm.client.isActive);
    if (usedByActiveClients) {
      res.status(400).json({
        success: false,
        error: 'Нельзя удалить абонемент, который используется. Деактивируйте его.',
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const link of membership.membershipGroups) {
        await tx.group.update({
          where: { id: link.groupId },
          data: { isMonthlyPayment: false, monthlyPaymentAmount: null, paymentDueDay: null },
        });
      }
      // Связи удалённых клиентов и история платежей: отвязать, платежи оставить
      await tx.clientMembership.deleteMany({ where: { membershipId: id, tenantId } });
      await tx.payment.updateMany({
        where: { membershipId: id, tenantId },
        data: { membershipId: null },
      });
      await tx.membership.delete({ where: { id } });
    });

    res.json({ success: true, message: 'Абонемент успешно удалён' });
  } catch (error) {
    console.error('Delete membership error:', error);
    res.status(500).json({ success: false, error: 'Не удалось удалить абонемент' });
  }
};

export const archiveMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    const membership = await prisma.membership.findFirst({
      where: { id: req.params.id, tenantId },
      include: { membershipGroups: true },
    });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Абонемент не найден' });
      return;
    }
    const archived = await prisma.membership.update({
      where: { id: membership.id },
      data: { archivedAt: new Date(), isActive: false },
      include: membershipInclude(),
    });
    for (const link of membership.membershipGroups) {
      await syncGroupLegacyFlags(link.groupId, {
        price: archived.price,
        paymentWindowEndDay: archived.paymentWindowEndDay,
        isActive: false,
      });
    }
    const [decorated] = await decorateMemberships([archived], tenantId);
    res.json({ success: true, data: decorated });
  } catch (error: any) {
    console.error('Archive membership error:', error);
    res.status(500).json({ success: false, error: error.message || 'Не удалось архивировать абонемент' });
  }
};

export const restoreMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    const membership = await prisma.membership.findFirst({
      where: { id: req.params.id, tenantId },
      include: { membershipGroups: true },
    });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Абонемент не найден' });
      return;
    }
    const restored = await prisma.membership.update({
      where: { id: membership.id },
      data: { archivedAt: null, isActive: true },
      include: membershipInclude(),
    });
    for (const link of membership.membershipGroups) {
      await syncGroupLegacyFlags(link.groupId, {
        price: restored.price,
        paymentWindowEndDay: restored.paymentWindowEndDay,
        isActive: true,
      });
    }
    const [decorated] = await decorateMemberships([restored], tenantId);
    res.json({ success: true, data: decorated });
  } catch (error: any) {
    console.error('Restore membership error:', error);
    res.status(500).json({ success: false, error: error.message || 'Не удалось восстановить абонемент' });
  }
};

export const duplicateMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    const source = await prisma.membership.findFirst({ where: { id: req.params.id, tenantId } });
    if (!source) {
      res.status(404).json({ success: false, error: 'Абонемент не найден' });
      return;
    }
    const duplicate = await prisma.membership.create({
      data: {
        name: `${source.name} (копия)`,
        description: source.description,
        price: source.price,
        duration: source.duration,
        visits: source.visits,
        type: source.type,
        isActive: true,
        archivedAt: null,
        category: source.category,
        paymentWindowStartDay: source.paymentWindowStartDay,
        paymentWindowEndDay: source.paymentWindowEndDay,
        recalcMode: source.recalcMode,
        missThresholdPercent: source.missThresholdPercent,
        validityDays: source.validityDays,
        periodType: source.periodType,
        periodMonths: source.periodMonths,
        tenantId: tenantId!,
      },
      include: membershipInclude(),
    });
    const [decorated] = await decorateMemberships([duplicate], tenantId);
    res.status(201).json({ success: true, data: decorated });
  } catch (error: any) {
    console.error('Duplicate membership error:', error);
    res.status(500).json({ success: false, error: error.message || 'Не удалось скопировать абонемент' });
  }
};

export const mergeMemberships = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Требуется ID организации' });
      return;
    }

    const { targetId, sourceIds } = req.body as { targetId?: string; sourceIds?: string[] };

    if (!targetId || typeof targetId !== 'string') {
      res.status(400).json({ success: false, error: 'Требуется targetId' });
      return;
    }
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      res.status(400).json({ success: false, error: 'sourceIds должен быть непустым массивом' });
      return;
    }

    const uniqueSourceIds = [...new Set(sourceIds.map(String).filter(Boolean))];
    if (uniqueSourceIds.length === 0) {
      res.status(400).json({ success: false, error: 'sourceIds должен быть непустым массивом' });
      return;
    }
    if (uniqueSourceIds.includes(targetId)) {
      res.status(400).json({ success: false, error: 'targetId не должен входить в sourceIds' });
      return;
    }

    const allIds = [targetId, ...uniqueSourceIds];
    const found = await prisma.membership.findMany({
      where: { id: { in: allIds }, tenantId },
      select: { id: true },
    });
    const foundIds = new Set(found.map((m) => m.id));
    if (!foundIds.has(targetId)) {
      res.status(404).json({ success: false, error: 'Целевой абонемент не найден' });
      return;
    }
    const missingSources = uniqueSourceIds.filter((id) => !foundIds.has(id));
    if (missingSources.length > 0) {
      res.status(404).json({
        success: false,
        error: `Исходные абонементы не найдены: ${missingSources.join(', ')}`,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.clientMembership.updateMany({
        where: { membershipId: { in: uniqueSourceIds }, tenantId },
        data: { membershipId: targetId },
      });
      await tx.membershipGroup.updateMany({
        where: { membershipId: { in: uniqueSourceIds } },
        data: { membershipId: targetId },
      });
      await tx.membership.updateMany({
        where: { id: { in: uniqueSourceIds }, tenantId },
        data: { isActive: false, archivedAt: new Date() },
      });
    });

    const full = await prisma.membership.findFirst({
      where: { id: targetId, tenantId },
      include: membershipInclude(),
    });

    res.json({ success: true, data: full });
  } catch (error: any) {
    console.error('Merge memberships error:', error);
    res.status(500).json({ success: false, error: error.message || 'Не удалось объединить абонементы' });
  }
};
