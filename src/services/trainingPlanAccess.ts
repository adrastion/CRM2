import { prisma } from '../lib/prisma';
import { getSeniorBranchIds } from '../utils/branchAccess';

/** Группы, доступные OWNER/TRAINER для тренировочного плана. */
export async function resolveAccessibleGroupIdsForTrainingPlan(
  user: { id: string; role: string },
  tenantId: string
): Promise<string[] | 'all'> {
  if (user.role === 'OWNER') return 'all';

  if (user.role !== 'TRAINER') return [];

  const trainer = await prisma.trainer.findFirst({
    where: { userId: user.id, tenantId, isActive: true },
    select: { id: true, canViewAllGroups: true },
  });
  if (!trainer) return [];

  if (trainer.canViewAllGroups) return 'all';

  const seniorIds = await getSeniorBranchIds(user.id, tenantId);
  const where: any = {
    tenantId,
    isActive: true,
    OR: [{ trainerId: trainer.id }],
  };
  if (seniorIds.length > 0) {
    where.OR.push({ branchId: { in: seniorIds } });
  }

  const groups = await prisma.group.findMany({
    where,
    select: { id: true },
  });
  return groups.map((g) => g.id);
}

export async function assertGroupsAccessible(
  user: { id: string; role: string },
  tenantId: string,
  groupIds: string[]
): Promise<void> {
  const access = await resolveAccessibleGroupIdsForTrainingPlan(user, tenantId);
  if (access === 'all') return;
  const allowed = new Set(access);
  for (const id of groupIds) {
    if (!allowed.has(id)) {
      const err: any = new Error('Нет доступа к одной из групп');
      err.statusCode = 403;
      throw err;
    }
  }
}
