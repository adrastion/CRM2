import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL не задан в .env (корень проекта).');
  process.exit(1);
}

const prisma = new PrismaClient();

async function createTestPromoCodeAdmin() {
  try {
    // Get first tenant
    const tenant = await prisma.tenant.findFirst();
    
    if (!tenant) {
      console.error('❌ No tenant found. Please create a tenant first.');
      process.exit(1);
    }

    console.log(`📋 Using tenant: ${tenant.name} (${tenant.id})`);

    // Check if admin already exists
    const existing = await prisma.promoCodeAdmin.findFirst({
      where: {
        email: 'admin@promocodes.com',
        tenantId: tenant.id,
      },
    });

    if (existing) {
      console.log('✅ Test promo code admin already exists:');
      console.log(`   Email: admin@promocodes.com`);
      console.log(`   Password: admin123456`);
      console.log(`   Name: ${existing.name}`);
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123456', 10);

    // Create test admin
    const admin = await prisma.promoCodeAdmin.create({
      data: {
        name: 'Администратор Промокодов',
        email: 'admin@promocodes.com',
        password: hashedPassword,
        phone: '+1234567890',
        isActive: true,
        tenantId: tenant.id,
      },
    });

    console.log('✅ Test promo code admin created successfully!');
    console.log('\n📝 Login credentials:');
    console.log(`   Email: admin@promocodes.com`);
    console.log(`   Password: admin123456`);
    console.log(`\n🔗 Login URL: http://localhost:3000/promo-code-admin/login`);
    console.log(`\n📊 After login, you can access: http://localhost:3000/admin/promo-codes`);
  } catch (error) {
    console.error('❌ Error creating test promo code admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestPromoCodeAdmin();

