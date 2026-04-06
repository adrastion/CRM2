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

async function createTestMarketer() {
  try {
    // Get first tenant
    const tenant = await prisma.tenant.findFirst();
    
    if (!tenant) {
      console.error('❌ No tenant found. Please create a tenant first.');
      process.exit(1);
    }

    console.log(`📋 Using tenant: ${tenant.name} (${tenant.id})`);

    // Check if marketer already exists
    const existing = await prisma.marketer.findFirst({
      where: {
        email: 'marketer@test.com',
        tenantId: tenant.id,
      },
    });

    if (existing) {
      console.log('✅ Test marketer already exists:');
      console.log(`   Email: marketer@test.com`);
      console.log(`   Password: test123456`);
      console.log(`   Name: ${existing.name}`);
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('test123456', 10);

    // Create test marketer
    const marketer = await prisma.marketer.create({
      data: {
        name: 'Тестовый Маркетолог',
        email: 'marketer@test.com',
        password: hashedPassword,
        phone: '+1234567890',
        type: 'MARKETER',
        isActive: true,
        tenantId: tenant.id,
      },
    });

    console.log('✅ Test marketer created successfully!');
    console.log('\n📝 Login credentials:');
    console.log(`   Email: marketer@test.com`);
    console.log(`   Password: test123456`);
    console.log(`\n🔗 Login URL: http://localhost:3000/marketer/login`);
    console.log(`\n📊 After login, you can access: http://localhost:3000/admin/promo-codes`);
  } catch (error) {
    console.error('❌ Error creating test marketer:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestMarketer();

