/**
 * Отмена лишних незакрытых ежемесячных платежей (дубли client+group).
 *
 * Оставляет один pending/overdue на пару (tenantId, clientId, groupId):
 * предпочтительно с periodKey = месяц первого занятия группы, иначе самый поздний periodKey.
 * Остальные отменяет с откатом membership_charge.
 *
 * Запуск из корня проекта:
 *   npx ts-node scripts/cancel-duplicate-monthly-pending.ts
 * Dry-run (только отчёт):
 *   npx ts-node scripts/cancel-duplicate-monthly-pending.ts --dry-run
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL не задан в .env');
  process.exit(1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { prisma } = await import('../src/lib/prisma');
  const { FinanceService } = await import('../src/services/financeService');
  const { getGroupFirstTrainingMonth } = await import('../src/utils/monthlyPaymentPeriod');

  const openPayments = await prisma.payment.findMany({
    where: {
      isMonthlyPayment: true,
      status: { in: ['pending', 'overdue'] },
      groupId: { not: null },
    },
    select: {
      id: true,
      tenantId: true,
      clientId: true,
      groupId: true,
      periodKey: true,
      createdAt: true,
      amount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  type Key = string;
  const byKey = new Map<Key, typeof openPayments>();
  for (const p of openPayments) {
    if (!p.groupId) continue;
    const key = `${p.tenantId}|${p.clientId}|${p.groupId}`;
    const list = byKey.get(key) || [];
    list.push(p);
    byKey.set(key, list);
  }

  let groupsWithDupes = 0;
  let toCancel = 0;
  let cancelled = 0;

  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    groupsWithDupes += 1;

    const [, , groupId] = key.split('|');
    const firstMonth = await getGroupFirstTrainingMonth(groupId);

    const sorted = [...list].sort((a, b) => {
      const ak = a.periodKey || '';
      const bk = b.periodKey || '';
      if (ak !== bk) return ak < bk ? -1 : 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    let keep = sorted[sorted.length - 1]; // latest periodKey
    if (firstMonth) {
      const match = sorted.find((p) => p.periodKey === firstMonth);
      if (match) keep = match;
    }

    const victims = list.filter((p) => p.id !== keep.id);
    toCancel += victims.length;

    console.log(
      `\n[${key}] open=${list.length}, keep=${keep.id} period=${keep.periodKey || 'null'}` +
        (firstMonth ? ` (firstTraining=${firstMonth})` : '')
    );
    for (const v of victims) {
      console.log(`  cancel ${v.id} period=${v.periodKey || 'null'} amount=${v.amount}`);
      if (dryRun) continue;

      const op = await prisma.financeOperation.findFirst({
        where: {
          tenantId: v.tenantId,
          externalKey: `membership_charge:${v.id}`,
        },
        select: { id: true },
      });
      if (op) {
        await FinanceService.deleteOperation(v.tenantId, op.id);
      } else {
        await prisma.payment.update({
          where: { id: v.id },
          data: { status: 'cancelled', paidAt: null },
        });
      }
      cancelled += 1;
    }
  }

  console.log(
    `\nГотово. Групп с дублями: ${groupsWithDupes}, к отмене: ${toCancel}` +
      (dryRun ? ` (dry-run, реально отменено 0)` : `, отменено: ${cancelled}`)
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
