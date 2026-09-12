import { prisma } from '../lib/prisma';
import { fanoutNotification } from './notificationFanout';

const SOON_MS = 24 * 60 * 60 * 1000;

/** Напоминания о дедлайнах задач: скоро (24ч) и просрочено. */
export async function processStaffTaskDeadlineNotifications(): Promise<void> {
  const now = new Date();
  const soonUntil = new Date(now.getTime() + SOON_MS);

  const soonTasks = await prisma.staffTask.findMany({
    where: {
      status: 'OPEN',
      dueAt: { gt: now, lte: soonUntil },
      remindBeforeSentAt: null,
    },
    include: {
      assignees: { select: { userId: true } },
      createdBy: { select: { id: true } },
    },
  });

  for (const task of soonTasks) {
    const recipients = dedupeUsers([
      task.createdByUserId,
      ...task.assignees.map((a) => a.userId),
    ]);
    try {
      await fanoutNotification({
        tenantId: task.tenantId,
        category: 'system',
        type: 'task_deadline_soon',
        title: `Скоро дедлайн: ${task.title}`,
        body: task.dueAt
          ? `До ${task.dueAt.toLocaleString('ru-RU')}`
          : undefined,
        data: { url: '/staff-workspace', taskId: task.id },
        eventType: 'task_reminder',
        recipients: recipients.map((actorId) => ({ actorType: 'USER' as const, actorId })),
      });
      await prisma.staffTask.update({
        where: { id: task.id },
        data: { remindBeforeSentAt: now },
      });
    } catch (e) {
      console.error(`[StaffTasks] soon notify failed for ${task.id}:`, e);
    }
  }

  const overdueTasks = await prisma.staffTask.findMany({
    where: {
      status: 'OPEN',
      dueAt: { lt: now },
      overdueNotifiedAt: null,
    },
    include: {
      assignees: { select: { userId: true } },
    },
  });

  for (const task of overdueTasks) {
    const recipients = dedupeUsers([
      task.createdByUserId,
      ...task.assignees.map((a) => a.userId),
    ]);
    try {
      await fanoutNotification({
        tenantId: task.tenantId,
        category: 'system',
        type: 'task_overdue',
        title: `Просрочена задача: ${task.title}`,
        body: task.dueAt
          ? `Дедлайн был ${task.dueAt.toLocaleString('ru-RU')}`
          : undefined,
        data: { url: '/staff-workspace', taskId: task.id },
        eventType: 'task_reminder',
        recipients: recipients.map((actorId) => ({ actorType: 'USER' as const, actorId })),
      });
      await prisma.staffTask.update({
        where: { id: task.id },
        data: { overdueNotifiedAt: now },
      });
    } catch (e) {
      console.error(`[StaffTasks] overdue notify failed for ${task.id}:`, e);
    }
  }
}

function dedupeUsers(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}
