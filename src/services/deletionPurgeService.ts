import { prisma } from '../lib/prisma';

/** Флаги выборочной очистки связанной истории (финансы и идеи клиентов сюда не входят). */
export type SchoolPurgeFlags = {
  attendance?: boolean;
  trainerAssignments?: boolean;
  salaries?: boolean;
  /** Занятия (отмена) и/или состав групп (soft leave). */
  groupComposition?: boolean;
  chats?: boolean;
};

export type SaTenantPurgeFlags = {
  devNotes?: boolean;
  chats?: boolean;
  news?: boolean;
  planner?: boolean;
};

export type DeletionImpactCounts = {
  attendance: number;
  trainerAssignments: number;
  salaries: number;
  trainings: number;
  memberships: number;
  chats: number;
  /** SA / tenant wipe */
  devNotes?: number;
  news?: number;
  planner?: number;
};

function parseBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

export function parseSchoolPurge(body: any): SchoolPurgeFlags {
  const raw = body?.purge && typeof body.purge === 'object' ? body.purge : body || {};
  return {
    attendance: parseBool(raw.attendance),
    trainerAssignments: parseBool(raw.trainerAssignments),
    salaries: parseBool(raw.salaries),
    groupComposition: parseBool(raw.groupComposition),
    chats: parseBool(raw.chats),
  };
}

export function parseSaTenantPurge(body: any): SaTenantPurgeFlags {
  const raw = body?.purge && typeof body.purge === 'object' ? body.purge : {};
  return {
    devNotes: parseBool(raw.devNotes),
    chats: parseBool(raw.chats),
    news: parseBool(raw.news),
    planner: parseBool(raw.planner),
  };
}

async function countClientChats(tenantId: string, clientId: string): Promise<number> {
  return prisma.chatThread.count({
    where: { tenantId, clientId },
  });
}

async function countTrainerChats(tenantId: string, trainerId: string): Promise<number> {
  return prisma.chatThread.count({
    where: { tenantId, trainerId },
  });
}

async function countGroupChats(tenantId: string, groupId: string): Promise<number> {
  return prisma.chatThread.count({
    where: { tenantId, groupId },
  });
}

async function deleteThreadsByIds(ids: string[]) {
  if (!ids.length) return 0;
  // messages/reads cascade from thread
  const res = await prisma.chatThread.deleteMany({ where: { id: { in: ids } } });
  return res.count;
}

async function recalculateTrainerBalance(tenantId: string, trainerId: string) {
  const rows = await prisma.trainerSalaryLedger.findMany({
    where: { tenantId, trainerId },
    select: { amount: true },
  });
  const balance = rows.reduce((s, r) => s + Number(r.amount), 0);
  await prisma.trainer.update({
    where: { id: trainerId },
    data: { balance },
  });
}

/** Preview для удаления клиента. */
export async function getClientDeletionImpact(
  tenantId: string,
  clientId: string
): Promise<DeletionImpactCounts> {
  const [attendance, chats] = await Promise.all([
    prisma.attendance.count({ where: { tenantId, clientId } }),
    countClientChats(tenantId, clientId),
  ]);
  return {
    attendance,
    trainerAssignments: 0,
    salaries: 0,
    trainings: 0,
    memberships: 0,
    chats,
  };
}

/** Preview для удаления тренера. */
export async function getTrainerDeletionImpact(
  tenantId: string,
  trainerId: string
): Promise<DeletionImpactCounts> {
  const [trainerAssignments, salaries, trainings, chats] = await Promise.all([
    prisma.group.count({ where: { tenantId, trainerId, isActive: true } }),
    prisma.trainerSalaryLedger.count({ where: { tenantId, trainerId } }),
    prisma.training.count({ where: { tenantId, trainerId, isCancelled: false } }),
    countTrainerChats(tenantId, trainerId),
  ]);
  return {
    attendance: 0,
    trainerAssignments,
    salaries,
    trainings,
    memberships: 0,
    chats,
  };
}

/** Preview для удаления группы. */
export async function getGroupDeletionImpact(
  tenantId: string,
  groupId: string
): Promise<DeletionImpactCounts> {
  const [attendance, trainings, memberships, chats] = await Promise.all([
    prisma.attendance.count({
      where: { tenantId, training: { groupId } },
    }),
    prisma.training.count({ where: { tenantId, groupId, isCancelled: false } }),
    prisma.groupMembership.count({ where: { groupId, isActive: true } }),
    countGroupChats(tenantId, groupId),
  ]);
  return {
    attendance,
    trainerAssignments: 0,
    salaries: 0,
    trainings,
    memberships,
    chats,
  };
}

/** Preview для удаления филиала. */
export async function getBranchDeletionImpact(
  tenantId: string,
  branchId: string
): Promise<DeletionImpactCounts> {
  const groups = await prisma.group.findMany({
    where: { tenantId, branchId },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);
  const [attendance, trainings, memberships, chats] = await Promise.all([
    groupIds.length
      ? prisma.attendance.count({
          where: { tenantId, training: { groupId: { in: groupIds } } },
        })
      : 0,
    prisma.training.count({ where: { tenantId, branchId, isCancelled: false } }),
    groupIds.length
      ? prisma.groupMembership.count({
          where: { groupId: { in: groupIds }, isActive: true },
        })
      : 0,
    groupIds.length
      ? prisma.chatThread.count({
          where: { tenantId, groupId: { in: groupIds } },
        })
      : 0,
  ]);
  return {
    attendance,
    trainerAssignments: groups.filter(() => true).length,
    salaries: 0,
    trainings,
    memberships,
    chats,
  };
}

/** Preview SA wipe: школьные чаты + опциональные платформенные сущности (идеи не считаем). */
export async function getTenantDeletionImpact(tenantId: string): Promise<DeletionImpactCounts> {
  const [devNotes, news, planner, schoolChats, platformChats] = await Promise.all([
    prisma.superAdminDevNote.count(),
    prisma.platformChangelogEntry.count(),
    prisma.platformCalendarEvent.count(),
    prisma.chatThread.count({ where: { tenantId } }),
    prisma.chatThread.count({ where: { tenantId: null } }),
  ]);

  return {
    attendance: 0,
    trainerAssignments: 0,
    salaries: 0,
    trainings: 0,
    memberships: 0,
    chats: schoolChats + platformChats,
    devNotes,
    news,
    planner,
  };
}

/**
 * Применить purge при удалении клиента.
 * Не трогает Payment / FinanceOperation / ClientMembership.
 */
export async function purgeOnClientDelete(
  tenantId: string,
  clientId: string,
  purge: SchoolPurgeFlags
): Promise<void> {
  if (purge.attendance) {
    await prisma.attendance.deleteMany({ where: { tenantId, clientId } });
  }
  if (purge.chats) {
    const threads = await prisma.chatThread.findMany({
      where: { tenantId, clientId },
      select: { id: true },
    });
    await deleteThreadsByIds(threads.map((t) => t.id));
  }
}

export async function purgeOnTrainerDelete(
  tenantId: string,
  trainerId: string,
  purge: SchoolPurgeFlags
): Promise<void> {
  if (purge.salaries) {
    await prisma.trainerSalaryLedger.deleteMany({ where: { tenantId, trainerId } });
    await recalculateTrainerBalance(tenantId, trainerId);
  }
  if (purge.groupComposition || purge.trainerAssignments) {
    // Назначения = группы, где он основной тренер → soft-deactivate
    await prisma.group.updateMany({
      where: { tenantId, trainerId, isActive: true },
      data: { isActive: false },
    });
  }
  if (purge.groupComposition) {
    await prisma.training.updateMany({
      where: { tenantId, trainerId, isCancelled: false },
      data: { isCancelled: true },
    });
  }
  if (purge.chats) {
    const threads = await prisma.chatThread.findMany({
      where: { tenantId, trainerId },
      select: { id: true },
    });
    await deleteThreadsByIds(threads.map((t) => t.id));
  }
}

export async function purgeOnGroupDelete(
  tenantId: string,
  groupId: string,
  purge: SchoolPurgeFlags
): Promise<void> {
  if (purge.attendance) {
    const trainings = await prisma.training.findMany({
      where: { tenantId, groupId },
      select: { id: true },
    });
    const trainingIds = trainings.map((t) => t.id);
    if (trainingIds.length) {
      await prisma.attendance.deleteMany({
        where: { tenantId, trainingId: { in: trainingIds } },
      });
    }
  }
  if (purge.groupComposition) {
    await prisma.training.updateMany({
      where: { tenantId, groupId, isCancelled: false },
      data: { isCancelled: true },
    });
    await prisma.groupMembership.updateMany({
      where: { groupId, isActive: true },
      data: { isActive: false, leftAt: new Date() },
    });
  }
  if (purge.chats) {
    const threads = await prisma.chatThread.findMany({
      where: { tenantId, groupId },
      select: { id: true },
    });
    await deleteThreadsByIds(threads.map((t) => t.id));
  }
}

export async function purgeOnBranchDelete(
  tenantId: string,
  branchId: string,
  purge: SchoolPurgeFlags
): Promise<void> {
  const groups = await prisma.group.findMany({
    where: { tenantId, branchId },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);

  if (purge.attendance && groupIds.length) {
    const trainings = await prisma.training.findMany({
      where: { tenantId, groupId: { in: groupIds } },
      select: { id: true },
    });
    const trainingIds = trainings.map((t) => t.id);
    if (trainingIds.length) {
      await prisma.attendance.deleteMany({
        where: { tenantId, trainingId: { in: trainingIds } },
      });
    }
  }

  if (purge.groupComposition) {
    await prisma.training.updateMany({
      where: { tenantId, branchId, isCancelled: false },
      data: { isCancelled: true },
    });
    if (groupIds.length) {
      await prisma.groupMembership.updateMany({
        where: { groupId: { in: groupIds }, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });
      await prisma.group.updateMany({
        where: { id: { in: groupIds }, isActive: true },
        data: { isActive: false },
      });
    }
  }

  if (purge.chats && groupIds.length) {
    const threads = await prisma.chatThread.findMany({
      where: { tenantId, groupId: { in: groupIds } },
      select: { id: true },
    });
    await deleteThreadsByIds(threads.map((t) => t.id));
  }
}

/**
 * Опциональная очистка платформенных данных SA при wipe школы.
 * Идеи клиентов (ClientFeatureIdea) никогда не удаляются.
 */
export async function purgeSaPlatformOnTenantDelete(
  tenantId: string,
  purge: SaTenantPurgeFlags
): Promise<void> {
  if (purge.devNotes) {
    // Отвязать идеи (SetNull) перед удалением заметок — idea остаётся
    await prisma.clientFeatureIdea.updateMany({
      where: { devNoteId: { not: null } },
      data: { devNoteId: null },
    });
    await prisma.superAdminDevNoteAttachment.deleteMany({});
    await prisma.superAdminDevNote.deleteMany({});
  }
  if (purge.news) {
    await prisma.platformChangelogEntry.deleteMany({});
  }
  if (purge.planner) {
    await prisma.platformCalendarEvent.deleteMany({});
  }
  if (purge.chats) {
    // Школьные треды уйдут с tenant cascade; платформенные — только по флагу
    const platform = await prisma.chatThread.findMany({
      where: { tenantId: null },
      select: { id: true },
    });
    await deleteThreadsByIds(platform.map((t) => t.id));
    const school = await prisma.chatThread.findMany({
      where: { tenantId },
      select: { id: true },
    });
    await deleteThreadsByIds(school.map((t) => t.id));
  }
}
