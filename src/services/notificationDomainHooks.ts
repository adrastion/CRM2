import { prisma } from '../lib/prisma';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  fanoutNotification,
  resolveClientAndParents,
  resolveGroupMembers,
  resolveSchoolAdmins,
  resolveSchoolManagers,
} from './notificationFanout';

function personName(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').trim();
}

/** Новый спортсмен → OWNER + ADMIN (+ seniors), кроме автора. */
export async function notifyAthleteCreated(params: {
  tenantId: string;
  clientId: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  createdByUserId?: string | null;
  branchId?: string | null;
}): Promise<void> {
  const name = personName([params.lastName, params.firstName, params.middleName]);
  const recipients = await resolveSchoolManagers(params.tenantId, {
    excludeUserId: params.createdByUserId || undefined,
    branchId: params.branchId,
    includeSeniors: true,
  });
  await fanoutNotification({
    tenantId: params.tenantId,
    category: 'athlete',
    type: 'athlete_created',
    title: `Добавлен спортсмен: ${name || 'без имени'}`,
    body: undefined,
    data: { url: `/clients/${params.clientId}`, clientId: params.clientId },
    eventType: 'athlete_created',
    recipients,
  });
}

/** Финансовая операция → OWNER + ADMIN (+ seniors по филиалу). */
export async function notifyFinanceChange(params: {
  tenantId: string;
  title: string;
  body?: string;
  branchId?: string | null;
  excludeUserId?: string | null;
  entityUrl?: string;
}): Promise<void> {
  const recipients = await resolveSchoolManagers(params.tenantId, {
    excludeUserId: params.excludeUserId || undefined,
    branchId: params.branchId,
    includeSeniors: false,
    roles: ['OWNER'],
  });
  await fanoutNotification({
    tenantId: params.tenantId,
    category: 'finance',
    type: 'finance_change',
    title: params.title,
    body: params.body,
    data: { url: params.entityUrl || '/finance' },
    eventType: 'finance',
    recipients,
  });
}

/** Тренер отметил посещаемость / начал тренировку → ADMIN (+ seniors филиала). */
export async function notifyAttendanceMarked(params: {
  tenantId: string;
  trainingId: string;
  branchId?: string | null;
  markedByUserId?: string | null;
  trainerDisplayName: string;
}): Promise<void> {
  const recipients = await resolveSchoolAdmins(params.tenantId, {
    excludeUserId: params.markedByUserId || undefined,
    branchId: params.branchId,
  });
  await fanoutNotification({
    tenantId: params.tenantId,
    category: 'attendance',
    type: 'attendance_started',
    title: `${params.trainerDisplayName} отметил спортсменов и начал тренировку`,
    data: { url: `/schedule`, trainingId: params.trainingId },
    eventType: 'attendance',
    recipients,
  });
}

/** Сводка неявок за день → ADMIN (+ seniors). */
export async function sendDailyAbsenceDigest(): Promise<void> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const tenant of tenants) {
    try {
      const absences = await prisma.attendance.findMany({
        where: {
          tenantId: tenant.id,
          status: { in: ['ABSENT', 'EXCUSED'] },
          training: {
            startTime: { gte: dayStart, lte: dayEnd },
            isCancelled: false,
          },
        },
        select: { clientId: true, training: { select: { branchId: true } } },
      });
      if (absences.length === 0) continue;

      const uniqueClients = new Set(absences.map((a) => a.clientId));
      const count = uniqueClients.size;
      const branchIds = [
        ...new Set(absences.map((a) => a.training.branchId).filter(Boolean) as string[]),
      ];

      const recipients =
        branchIds.length === 1
          ? await resolveSchoolAdmins(tenant.id, { branchId: branchIds[0] })
          : await resolveSchoolAdmins(tenant.id);

      await fanoutNotification({
        tenantId: tenant.id,
        category: 'attendance',
        type: 'absence_digest',
        title: `Сегодня на тренировку не пришло (${count} чел)`,
        data: { url: '/schedule', count },
        eventType: 'attendance',
        recipients,
      });
    } catch (e) {
      console.error(`[Notifications] Absence digest failed for tenant ${tenant.id}:`, e);
    }
  }
}

/** Начисление / выплата зарплаты тренеру. */
export async function notifyTrainerSalary(params: {
  tenantId: string;
  trainerId: string;
  kind: 'accrual' | 'payout';
  amount: number;
  title?: string;
}): Promise<void> {
  const trainer = await prisma.trainer.findFirst({
    where: { id: params.trainerId, tenantId: params.tenantId },
    select: { userId: true },
  });
  if (!trainer?.userId) return;

  const amountLabel = Number(params.amount).toLocaleString('ru-RU');
  const isPayout = params.kind === 'payout';
  await fanoutNotification({
    tenantId: params.tenantId,
    category: 'salary',
    type: isPayout ? 'salary_payout' : 'salary_accrual',
    title: isPayout
      ? `Выплачена зарплата ${amountLabel}`
      : `Начислена зарплата ${amountLabel}`,
    body: params.title,
    data: { url: '/settings', trainerId: params.trainerId },
    eventType: 'salary',
    recipients: [{ actorType: 'USER', actorId: trainer.userId }],
  });
}

/** Оплата получена → клиент + родители. */
export async function notifyClientPaymentReceived(params: {
  tenantId: string;
  clientId: string;
  amount: number;
}): Promise<void> {
  const recipients = await resolveClientAndParents(params.clientId);
  const amountLabel = Number(params.amount).toLocaleString('ru-RU');
  await fanoutNotification({
    tenantId: params.tenantId,
    category: 'finance',
    type: 'payment_received',
    title: 'Оплата получена',
    body: `Сумма: ${amountLabel}`,
    data: { url: '/client/dashboard', amount: params.amount },
    eventType: 'payment',
    recipients,
  });
}

/** Задолженность → клиент + родители. */
export async function notifyClientDebt(params: {
  tenantId: string;
  clientId: string;
  amount: number;
  label?: string;
}): Promise<void> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) return;
  const recipients = await resolveClientAndParents(params.clientId);
  const amountLabel = Number(params.amount).toLocaleString('ru-RU');
  await fanoutNotification({
    tenantId: params.tenantId,
    category: 'finance',
    type: 'payment_debt',
    title: `Задолженность: ${amountLabel}`,
    body: params.label,
    data: { url: '/client/dashboard', amount: params.amount },
    eventType: 'payment',
    recipients,
  });
}

/** Перенос / отмена тренировки → члены группы + родители. */
export async function notifyTrainingScheduleChange(params: {
  tenantId: string;
  trainingId: string;
  groupId?: string | null;
  clientIds?: string[];
  kind: 'rescheduled' | 'cancelled';
  whenLabel: string;
  groupName?: string;
}): Promise<void> {
  let recipients =
    params.groupId != null
      ? await resolveGroupMembers(params.groupId)
      : [];
  if ((!recipients.length) && params.clientIds?.length) {
    const all = [];
    for (const id of params.clientIds) {
      all.push(...(await resolveClientAndParents(id)));
    }
    recipients = all;
  }
  if (!recipients.length) return;

  const verb = params.kind === 'cancelled' ? 'отменена' : 'перенесена';
  const group = params.groupName ? ` (${params.groupName})` : '';
  await fanoutNotification({
    tenantId: params.tenantId,
    category: 'training',
    type: params.kind === 'cancelled' ? 'training_cancelled' : 'training_rescheduled',
    title: `Тренировка ${verb}: ${params.whenLabel}${group}`,
    data: { url: '/client/dashboard', trainingId: params.trainingId },
    eventType: 'schedule_change',
    recipients,
  });
}

/** Напоминание клиентам/родителям за N минут до тренировки. */
export async function sendClientTrainingReminders(minutesBefore = 60): Promise<void> {
  const now = new Date();
  const target = new Date(now.getTime() + minutesBefore * 60_000);
  const windowStart = new Date(target.getTime() - 60_000);
  const windowEnd = new Date(target.getTime() + 60_000);

  const trainings = await prisma.training.findMany({
    where: {
      isCancelled: false,
      startTime: { gte: windowStart, lte: windowEnd },
      tenant: { isActive: true },
    },
    include: {
      group: { select: { id: true, name: true } },
      branch: { select: { name: true } },
    },
  });

  for (const training of trainings) {
    try {
      let recipients = training.groupId
        ? await resolveGroupMembers(training.groupId)
        : [];
      if (!recipients.length) {
        const att = await prisma.attendance.findMany({
          where: { trainingId: training.id },
          select: { clientId: true },
        });
        const all = [];
        for (const a of att) {
          all.push(...(await resolveClientAndParents(a.clientId)));
        }
        recipients = all;
      }
      if (!recipients.length) continue;

      const time = format(training.startTime, 'HH:mm', { locale: ru });
      const groupName = training.group?.name || training.title || 'тренировка';
      await fanoutNotification({
        tenantId: training.tenantId,
        category: 'training',
        type: 'client_training_reminder',
        title: `Через 1 ч тренировка: ${groupName}`,
        body: `${time}${training.branch?.name ? ` · ${training.branch.name}` : ''}`,
        data: { url: '/client/dashboard', trainingId: training.id },
        eventType: 'training_reminder',
        recipients,
      });
    } catch (e) {
      console.error(`[Notifications] Client reminder failed for ${training.id}:`, e);
    }
  }
}
