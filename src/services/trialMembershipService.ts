import { prisma } from '../lib/prisma';

/**
 * Деактивирует пробные членства, у которых тренировка уже закончилась.
 * Возвращает число обновлённых записей.
 */
export async function cleanupExpiredTrialMemberships(tenantId?: string): Promise<number> {
  const now = new Date();
  const expired = await prisma.groupMembership.findMany({
    where: {
      isTrial: true,
      isActive: true,
      ...(tenantId ? { client: { tenantId } } : {}),
      trialTraining: {
        endTime: { lte: now },
      },
    },
    select: { id: true },
  });

  if (expired.length === 0) return 0;

  const result = await prisma.groupMembership.updateMany({
    where: { id: { in: expired.map((m) => m.id) } },
    data: {
      isActive: false,
      leftAt: now,
    },
  });

  return result.count;
}

/**
 * Записать клиента на пробное занятие: временное членство в группе + attendance без списания.
 */
export async function assignClientToTrial(params: {
  tenantId: string;
  clientId: string;
  trainingId: string;
}) {
  const { tenantId, clientId, trainingId } = params;

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId, isActive: true },
  });
  if (!client) {
    throw Object.assign(new Error('Клиент не найден'), { status: 404 });
  }

  const training = await prisma.training.findFirst({
    where: { id: trainingId, tenantId, isCancelled: false },
  });
  if (!training) {
    throw Object.assign(new Error('Тренировка не найдена'), { status: 404 });
  }
  if (!training.groupId) {
    throw Object.assign(new Error('У тренировки нет группы'), { status: 400 });
  }
  if (training.endTime <= new Date()) {
    throw Object.assign(new Error('Нельзя записаться на уже прошедшее занятие'), { status: 400 });
  }

  const groupId = training.groupId;

  const membership = await prisma.groupMembership.upsert({
    where: {
      clientId_groupId: { clientId, groupId },
    },
    create: {
      clientId,
      groupId,
      isActive: true,
      isTrial: true,
      trialTrainingId: trainingId,
      leftAt: null,
    },
    update: {
      isActive: true,
      isTrial: true,
      trialTrainingId: trainingId,
      leftAt: null,
      joinedAt: new Date(),
    },
    include: {
      group: true,
      trialTraining: true,
    },
  });

  const existingAttendance = await prisma.attendance.findFirst({
    where: { clientId, trainingId, tenantId },
  });

  if (!existingAttendance) {
    await prisma.attendance.create({
      data: {
        clientId,
        trainingId,
        tenantId,
        status: 'ABSENT',
        shouldCharge: false,
        notes: 'Пробное занятие',
      },
    });
  }

  return membership;
}
