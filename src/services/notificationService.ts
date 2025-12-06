import { PrismaClient } from '@prisma/client';
import { format, addMinutes, isToday, startOfDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { sendPushNotification } from './pushNotificationService';

const prisma = new PrismaClient();

/**
 * Отправка ежедневных уведомлений о всех тренировках
 * Вызывается в указанное время для каждого тренера
 */
export async function sendDailyTrainingNotifications(): Promise<void> {
  try {
    console.log('[Notifications] Starting daily training notifications...');

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Получаем всех тренеров с включенными ежедневными уведомлениями
    const trainersWithNotifications = await prisma.trainer.findMany({
      where: {
        isActive: true,
        notificationSettings: {
          allTrainingsEnabled: true,
          allTrainingsTime: currentMinutes // Точное совпадение времени
        }
      },
      include: {
        user: true,
        notificationSettings: true,
        tenant: true
      }
    });

    if (trainersWithNotifications.length === 0) {
      console.log('[Notifications] No trainers with daily notifications enabled at this time');
      return;
    }

    // Получаем тренировки в зависимости от выбранного периода для каждого тренера
    const today = startOfDay(now);

    for (const trainer of trainersWithNotifications) {
      try {
        // Определяем период для получения тренировок
        const period = trainer.notificationSettings?.notificationPeriod || 'tomorrow';
        let startDate: Date;
        let endDate: Date;

        switch (period) {
          case 'tomorrow':
            startDate = addDays(today, 1);
            endDate = addDays(today, 2);
            break;
          case 'week':
            startDate = today;
            endDate = addDays(today, 7);
            break;
          case 'month':
            startDate = today;
            endDate = addDays(today, 30);
            break;
          default:
            startDate = addDays(today, 1);
            endDate = addDays(today, 2);
        }

        // Получаем тренировки тренера (где он основной или заменяющий)
        const trainings = await prisma.training.findMany({
          where: {
            tenantId: trainer.tenantId,
            isCancelled: false,
            OR: [
              { trainerId: trainer.id },
              { substituteTrainerId: trainer.id }
            ],
            startTime: {
              gte: startDate,
              lt: endDate
            }
          },
          include: {
            group: true,
            branch: true,
            hall: true,
            trainer: {
              include: {
                user: true
              }
            },
            substituteTrainer: {
              include: {
                user: true
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        });

        if (trainings.length === 0) {
          console.log(`[Notifications] No trainings found for trainer ${trainer.user?.email}`);
          continue;
        }

        // Формируем сообщение с учетом периода
        const message = formatTrainingsMessage(trainings, trainer.tenant?.name || '', period);

        // Отправляем push уведомление
        try {
          const periodLabel = period === 'tomorrow' ? 'на завтра' : period === 'week' ? 'на неделю' : 'на месяц';
          await sendPushNotification(
            trainer.userId,
            `Расписание тренировок ${periodLabel}`,
            `У вас ${trainings.length} тренировок в выбранном периоде`,
            {
              type: 'daily_training_notification',
              trainingsCount: trainings.length,
              period: period
            }
          );
        } catch (error) {
          console.error(`[Notifications] Error sending push notification:`, error);
        }

        console.log(`[Notifications] Daily notification for trainer ${trainer.user?.email}:`);
        console.log(message);

      } catch (error) {
        console.error(`[Notifications] Error sending notification to trainer ${trainer.id}:`, error);
      }
    }

    console.log(`[Notifications] Daily notifications sent to ${trainersWithNotifications.length} trainers`);
  } catch (error) {
    console.error('[Notifications] Error in sendDailyTrainingNotifications:', error);
  }
}

/**
 * Отправка напоминаний перед тренировками
 * Вызывается каждую минуту для проверки предстоящих тренировок
 */
export async function sendTrainingReminders(): Promise<void> {
  try {
    const now = new Date();

    // Получаем всех тренеров с включенными напоминаниями
    const trainersWithReminders = await prisma.trainer.findMany({
      where: {
        isActive: true,
        notificationSettings: {
          reminderEnabled: true,
          reminderBeforeMinutes: { not: null }
        }
      },
      include: {
        user: true,
        notificationSettings: true,
        tenant: true
      }
    });

    if (trainersWithReminders.length === 0) {
      return;
    }

    for (const trainer of trainersWithReminders) {
      try {
        const reminderMinutes = trainer.notificationSettings?.reminderBeforeMinutes;
        if (!reminderMinutes) continue;

        // Вычисляем время начала тренировки (текущее время + минуты напоминания)
        const reminderTime = addMinutes(now, reminderMinutes);

        // Получаем тренировки, которые начинаются в это время (с точностью до минуты)
        const trainings = await prisma.training.findMany({
          where: {
            tenantId: trainer.tenantId,
            isCancelled: false,
            OR: [
              { trainerId: trainer.id },
              { substituteTrainerId: trainer.id }
            ],
            startTime: {
              gte: new Date(reminderTime.getTime() - 60000), // -1 минута
              lte: new Date(reminderTime.getTime() + 60000)  // +1 минута
            }
          },
          include: {
            group: true,
            branch: true,
            hall: true,
            trainer: {
              include: {
                user: true
              }
            },
            substituteTrainer: {
              include: {
                user: true
              }
            }
          }
        });

        if (trainings.length === 0) {
          continue;
        }

        // Отправляем напоминание для каждой тренировки
        for (const training of trainings) {
          const message = formatReminderMessage(training, reminderMinutes, trainer.tenant?.name || '');

          // Отправляем push уведомление
          try {
            const groupName = training.group?.name || 'Индивидуальная тренировка';
            const time = format(training.startTime, 'HH:mm', { locale: ru });
            
            await sendPushNotification(
              trainer.userId,
              `Напоминание: тренировка через ${reminderMinutes} минут`,
              `${groupName} в ${time}`,
              {
                type: 'training_reminder',
                trainingId: training.id,
                startTime: training.startTime.toISOString(),
                groupName: groupName
              }
            );
          } catch (error) {
            console.error(`[Notifications] Error sending push reminder:`, error);
          }

          console.log(`[Notifications] Reminder for trainer ${trainer.user?.email}:`);
          console.log(message);
        }

      } catch (error) {
        console.error(`[Notifications] Error sending reminder to trainer ${trainer.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Notifications] Error in sendTrainingReminders:', error);
  }
}

/**
 * Форматирование сообщения о тренировках для ежедневного уведомления
 */
function formatTrainingsMessage(trainings: any[], tenantName: string, period: string = 'tomorrow'): string {
  let periodLabel = '';
  switch (period) {
    case 'tomorrow':
      periodLabel = 'на завтра';
      break;
    case 'week':
      periodLabel = 'на неделю';
      break;
    case 'month':
      periodLabel = 'на месяц';
      break;
    default:
      periodLabel = 'на завтра';
  }

  let message = `📅 Расписание тренировок ${periodLabel} (${tenantName})\n\n`;

  // Группируем тренировки по датам
  const trainingsByDate = new Map<string, any[]>();
  trainings.forEach(training => {
    const dateKey = format(training.startTime, 'yyyy-MM-dd');
    if (!trainingsByDate.has(dateKey)) {
      trainingsByDate.set(dateKey, []);
    }
    trainingsByDate.get(dateKey)!.push(training);
  });

  // Сортируем даты
  const sortedDates = Array.from(trainingsByDate.keys()).sort();

  sortedDates.forEach(dateKey => {
    const dateTrainings = trainingsByDate.get(dateKey)!;
    const date = new Date(dateKey);
    const isTodayDate = isToday(date);
    const isTomorrowDate = format(date, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd');

    let dateLabel = '';
    if (isTodayDate) {
      dateLabel = `Сегодня (${format(date, 'd MMMM', { locale: ru })})`;
    } else if (isTomorrowDate) {
      dateLabel = `Завтра (${format(date, 'd MMMM', { locale: ru })})`;
    } else {
      dateLabel = format(date, 'EEEE, d MMMM', { locale: ru });
    }

    message += `${dateLabel}:\n`;
    dateTrainings.forEach(training => {
      message += formatTrainingLine(training);
    });
    message += '\n';
  });

  return message;
}

/**
 * Форматирование строки тренировки
 */
function formatTrainingLine(training: any): string {
  const time = format(training.startTime, 'HH:mm', { locale: ru });
  const groupName = training.group?.name || 'Индивидуальная тренировка';
  const branchName = training.branch?.name || '';
  const hallName = training.hall?.name || '';
  const isSubstitute = training.substituteTrainerId !== null;
  const trainerName = isSubstitute 
    ? `${training.substituteTrainer?.user?.lastName} ${training.substituteTrainer?.user?.firstName}`.trim()
    : `${training.trainer?.user?.lastName} ${training.trainer?.user?.firstName}`.trim();

  let line = `  ⏰ ${time} - ${groupName}`;
  if (branchName) line += ` (${branchName})`;
  if (hallName) line += `, зал: ${hallName}`;
  if (isSubstitute) line += ` [ЗАМЕНА: ${trainerName}]`;
  line += '\n';

  return line;
}

/**
 * Форматирование сообщения-напоминания
 */
function formatReminderMessage(training: any, minutesBefore: number, tenantName: string): string {
  const time = format(training.startTime, 'HH:mm', { locale: ru });
  const date = format(training.startTime, 'd MMMM yyyy', { locale: ru });
  const groupName = training.group?.name || 'Индивидуальная тренировка';
  const branchName = training.branch?.name || '';
  const hallName = training.hall?.name || '';
  const isSubstitute = training.substituteTrainerId !== null;

  let message = `🔔 Напоминание: тренировка через ${minutesBefore} минут\n\n`;
  message += `📅 ${date} в ${time}\n`;
  message += `👥 ${groupName}\n`;
  if (branchName) message += `📍 ${branchName}\n`;
  if (hallName) message += `🏢 Зал: ${hallName}\n`;
  if (isSubstitute) {
    message += `⚠️ Вы заменяете тренера\n`;
  }
  message += `\n${tenantName}`;

  return message;
}

