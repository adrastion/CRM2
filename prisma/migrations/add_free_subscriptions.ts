import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Миграция: Добавление подписки FREE всем tenant'ам, у которых её нет
 * Запуск: npx ts-node prisma/migrations/add_free_subscriptions.ts
 */
async function main() {
  console.log('🔄 Starting migration: Adding FREE subscriptions to all tenants...');

  // Получаем всех tenant'ов
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`Found ${tenants.length} tenants`);

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    // Проверяем, есть ли уже подписка у этого tenant'а
    const existingSubscription = await prisma.subscription.findUnique({
      where: { tenantId: tenant.id },
      select: { id: true, planType: true },
    });

    if (existingSubscription) {
      console.log(`⏭️  Tenant ${tenant.name} (${tenant.id}) already has subscription: ${existingSubscription.planType}`);
      skipped++;
      continue;
    }

    // Создаем подписку FREE
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 100); // Устанавливаем дату окончания далеко в будущем для FREE тарифа

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planType: 'FREE',
        status: 'active',
        startDate,
        endDate,
        autoRenew: true,
      },
    });

    console.log(`✅ Created FREE subscription for tenant: ${tenant.name} (${tenant.id})`);
    created++;
  }

  console.log('\n📊 Migration summary:');
  console.log(`   Created: ${created} subscriptions`);
  console.log(`   Skipped: ${skipped} tenants (already have subscription)`);
  console.log('✅ Migration completed!');
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

