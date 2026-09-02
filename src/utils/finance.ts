import { prisma } from '../lib/prisma';

/**
 * Рассчитывает заработок тренера в зависимости от типа оплаты
 */
export async function calculateTrainerEarnings(
  trainerId: string,
  trainingId: string,
  tenantId: string
): Promise<number> {
  const trainer = await prisma.trainer.findFirst({
    where: { id: trainerId, tenantId }
  });

  if (!trainer || !trainer.salaryType) {
    return 0;
  }

  const training = await prisma.training.findFirst({
    where: { id: trainingId, tenantId },
    include: {
      group: true,
      attendances: {
        where: {
          OR: [
            { status: 'PRESENT' },
            { status: 'ABSENT', shouldCharge: false }, // shouldCharge=false означает списывать средства
            { status: 'EXCUSED', shouldCharge: false } // shouldCharge=false означает списывать средства
          ]
        },
        include: { client: true }
      }
    }
  });

  if (!training) {
    return 0;
  }

  const presentCount = training.attendances.length;
  const trainingPrice = training.group?.trainingPrice ? Number(training.group.trainingPrice) : 0;
  const totalRevenue = presentCount * trainingPrice;

  let earnings = 0;

  switch (trainer.salaryType) {
    case 'percentage':
      // Вариант 1: Процент от суммы оплаты
      // Общая сумма оплаты с группы делим на 100 и умножаем на процент
      if (trainer.salaryAmount) {
        const percentage = Number(trainer.salaryAmount);
        earnings = (totalRevenue * percentage) / 100;
      }
      break;

    case 'per_student':
      // Вариант 2: Оплата за каждую тренировку в зависимости от кол-ва учеников
      // Кол-во посещений за месяц умножаем на цену за каждого
      // Для одной тренировки: просто количество * цена за ученика
      if (trainer.salaryAmount) {
        const pricePerStudent = Number(trainer.salaryAmount);
        earnings = presentCount * pricePerStudent;
      }
      break;

    case 'fixed':
      // Вариант 3: Фиксированная плата
      if (trainer.salaryAmount) {
        earnings = Number(trainer.salaryAmount);
      }
      break;

    case 'per_training':
      // Вариант 4: Оплата за тренировку независимо от кол-ва учеников
      if (trainer.salaryAmount) {
        earnings = Number(trainer.salaryAmount);
      }
      break;

    case 'individual':
      // Вариант 5: Индивидуальное занятие
      // Оплата тренировки делится на часть зала и часть тренеру
      // Если presentCount === 1, значит индивидуальное занятие
      if (presentCount === 1 && trainer.salaryAmount && trainer.salaryPercentage) {
        const trainingTotal = trainingPrice;
        const trainerPercentage = Number(trainer.salaryPercentage);
        earnings = (trainingTotal * trainerPercentage) / 100;
      } else {
        // Для групповых занятий используем другой расчет или 0
        earnings = 0;
      }
      break;

    default:
      earnings = 0;
  }

  return earnings;
}

/**
 * Рассчитывает заработок тренера за конкретное посещение клиента
 */
export async function calculateTrainerEarningsForAttendance(
  trainerId: string,
  trainingId: string,
  attendanceId: string,
  tenantId: string
): Promise<number> {
  const training = await prisma.training.findFirst({
    where: { id: trainingId, tenantId },
    include: {
      group: {
        include: {
          memberships: {
            where: { isActive: true }
          }
        }
      },
      attendances: {
        where: {
          OR: [
            { status: 'PRESENT' },
            { status: 'ABSENT', shouldCharge: false }, // shouldCharge=false означает списывать средства
            { status: 'EXCUSED', shouldCharge: false } // shouldCharge=false означает списывать средства
          ]
        },
        include: { client: true }
      }
    }
  });

  if (!training) {
    return 0;
  }

  // Если есть замена тренера, используем тренера-замену для расчета заработка
  const actualTrainerId = training.substituteTrainerId || training.trainerId;
  
  // Проверяем, что trainerId соответствует тренеру, который должен получить заработок
  if (trainerId !== actualTrainerId) {
    return 0; // Если запрашивается заработок не для того тренера, возвращаем 0
  }

  const trainer = await prisma.trainer.findFirst({
    where: { id: actualTrainerId, tenantId }
  });

  if (!trainer) {
    return 0;
  }

  // Для индивидуальных тренировок используем настройки из тренировки
  if (!training.groupId) {
    if (training.trainerEarningType === 'percentage' && training.trainerEarningValue && training.price) {
      const percentage = Number(training.trainerEarningValue);
      return (Number(training.price) * percentage) / 100;
    } else if (training.trainerEarningType === 'amount' && training.trainerEarningValue) {
      return Number(training.trainerEarningValue);
    }
    // Если нет настроек в тренировке, используем настройки тренера
    if (trainer.salaryType === 'individual' && trainer.salaryPercentage && training.price) {
      const trainerPercentage = Number(trainer.salaryPercentage);
      return (Number(training.price) * trainerPercentage) / 100;
    }
    return 0;
  }

  // Для групповых тренировок используем настройки из группы
  const group = training.group;
  if (!group) {
    return 0;
  }

  const trainingPrice = group.trainingPrice ? Number(group.trainingPrice) : 0;
  const totalPresentCount = training.attendances.length;

  let earnings = 0;

  // Приоритет: настройки группы > настройки тренера
  if (group.trainerSalaryType) {
    switch (group.trainerSalaryType) {
      case 'monthly_percentage':
        // Ежемесячный процент - не начисляется за посещение, только когда все оплатили
        // Возвращаем 0, так как это начисляется отдельно
        return 0;

      case 'per_visit_percentage':
        // Процент за посещение
        if (group.trainerPerVisitPercentage) {
          const percentage = Number(group.trainerPerVisitPercentage);
          earnings = (trainingPrice * percentage) / 100;
        }
        break;

      case 'per_visit_amount':
        // Фиксированная сумма за посещение
        if (group.trainerPerVisitAmount) {
          earnings = Number(group.trainerPerVisitAmount);
        }
        break;

      default:
        earnings = 0;
    }
  } else {
    // Используем настройки тренера, если нет настроек группы
  switch (trainer.salaryType) {
    case 'percentage':
      // Процент от оплаты одного клиента
      if (trainer.salaryAmount) {
        const percentage = Number(trainer.salaryAmount);
        earnings = (trainingPrice * percentage) / 100;
      }
      break;

    case 'per_student':
      // Оплата за каждого ученика
      if (trainer.salaryAmount) {
        earnings = Number(trainer.salaryAmount);
      }
      break;

    case 'fixed':
      // Фиксированная плата - распределяется между всеми присутствующими
      if (trainer.salaryAmount && totalPresentCount > 0) {
        earnings = Number(trainer.salaryAmount) / totalPresentCount;
      }
      break;

    case 'per_training':
      // Оплата за тренировку - распределяется между всеми присутствующими
      if (trainer.salaryAmount && totalPresentCount > 0) {
        earnings = Number(trainer.salaryAmount) / totalPresentCount;
      }
      break;

    default:
      earnings = 0;
    }
  }

  return earnings;
}

/**
 * Снимает деньги с баланса клиента и создает транзакцию
 */
export async function deductFromClientBalance(
  clientId: string,
  amount: number,
  trainingId: string,
  attendanceId: string,
  tenantId: string,
  description?: string
): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId }
  });

  if (!client) {
    throw new Error('Client not found');
  }

  const currentBalance = Number(client.balance || 0);
  const newBalance = currentBalance - amount;

  // Обновляем баланс клиента
  await prisma.client.update({
    where: { id: clientId },
    data: { balance: newBalance }
  });

  // Создаем транзакцию
  await prisma.transaction.create({
    data: {
      type: 'training_payment',
      amount: -amount, // Отрицательная сумма - списание
      description: description || `Оплата тренировки`,
      clientId,
      trainingId,
      attendanceId,
      tenantId
    }
  });
}

/**
 * Начисляет заработок тренеру и создает транзакцию
 */
export async function addToTrainerBalance(
  trainerId: string,
  amount: number,
  trainingId: string,
  attendanceId: string,
  tenantId: string,
  description?: string
): Promise<void> {
  const trainer = await prisma.trainer.findFirst({
    where: { id: trainerId, tenantId }
  });

  if (!trainer) {
    throw new Error('Trainer not found');
  }

  const currentBalance = Number(trainer.balance || 0);
  const newBalance = currentBalance + amount;

  // Обновляем баланс тренера
  await prisma.trainer.update({
    where: { id: trainerId },
    data: { balance: newBalance }
  });

  // Создаем транзакцию
  await prisma.transaction.create({
    data: {
      type: 'trainer_earnings',
      amount: amount, // Положительная сумма - начисление
      description: description || `Заработок за тренировку`,
      trainerId,
      trainingId,
      attendanceId,
      tenantId
    }
  });
}

