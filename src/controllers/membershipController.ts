import { prisma } from '../lib/prisma';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';

function membershipInclude() {
  return {
    membershipGroups: {
      include: {
        group: { select: { id: true, name: true, branchId: true } },
      },
    },
  } as const;
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
    const { page = 1, limit = 100, search, category } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { tenantId: req.tenant?.id };
    if (category) where.category = String(category).toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
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

    res.json({
      success: true,
      data: memberships,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get memberships error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve memberships' });
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
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }
    res.json({ success: true, data: membership });
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve membership' });
  }
};

export const createMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant ID is required' });
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
      midMonthHalfChargeEnabled = true,
      validityDays,
      periodType,
      periodMonths,
      groupIds,
      groupBindings,
      effectiveFrom,
    } = req.body;

    const cat = String(category).toUpperCase() === 'GROUP' ? 'GROUP' : 'CLIENT';

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
        midMonthHalfChargeEnabled: cat === 'GROUP' ? midMonthHalfChargeEnabled !== false : true,
        validityDays: cat === 'CLIENT' ? parseOptionalInt(validityDays) ?? parseOptionalInt(duration) : null,
        periodType: cat === 'CLIENT' ? resolvedPeriodType : null,
        periodMonths: cat === 'CLIENT' ? parseOptionalInt(periodMonths) : null,
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
      }
    }

    const full = await prisma.membership.findUnique({
      where: { id: membership.id },
      include: membershipInclude(),
    });

    res.status(201).json({ success: true, data: full });
  } catch (error: any) {
    console.error('Create membership error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create membership' });
  }
};

export const updateMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    const membership = await prisma.membership.findFirst({ where: { id, tenantId } });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Membership not found' });
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
      midMonthHalfChargeEnabled,
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
    if (category !== undefined) updateData.category = String(category).toUpperCase() === 'GROUP' ? 'GROUP' : 'CLIENT';
    if (paymentWindowStartDay !== undefined) updateData.paymentWindowStartDay = parseOptionalInt(paymentWindowStartDay);
    if (paymentWindowEndDay !== undefined) updateData.paymentWindowEndDay = parseOptionalInt(paymentWindowEndDay);
    if (recalcMode !== undefined) updateData.recalcMode = recalcMode;
    if (missThresholdPercent !== undefined) updateData.missThresholdPercent = parseOptionalFloat(missThresholdPercent);
    if (midMonthHalfChargeEnabled !== undefined) updateData.midMonthHalfChargeEnabled = midMonthHalfChargeEnabled;
    if (validityDays !== undefined) updateData.validityDays = parseOptionalInt(validityDays);
    if (periodType !== undefined) updateData.periodType = periodType;
    if (periodMonths !== undefined) updateData.periodMonths = parseOptionalInt(periodMonths);

    const updated = await prisma.membership.update({ where: { id }, data: updateData });

    const cat = updateData.category || membership.category;
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
    res.status(500).json({ success: false, error: error.message || 'Failed to update membership' });
  }
};

export const deleteMembership = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const membership = await prisma.membership.findFirst({
      where: { id, tenantId: req.tenant?.id },
      include: { clientMemberships: true, payments: true, membershipGroups: true },
    });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }
    if (membership.clientMemberships.length > 0 || membership.payments.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete membership that is in use. Deactivate it instead.',
      });
      return;
    }
    for (const link of membership.membershipGroups) {
      await prisma.group.update({
        where: { id: link.groupId },
        data: { isMonthlyPayment: false, monthlyPaymentAmount: null, paymentDueDay: null },
      });
    }
    await prisma.membership.delete({ where: { id } });
    res.json({ success: true, message: 'Membership deleted successfully' });
  } catch (error) {
    console.error('Delete membership error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete membership' });
  }
};
