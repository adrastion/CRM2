import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error(
    '\n❌ DATABASE_URL не задан. Создайте `.env` в корне проекта (рядом с package.json), например:\n' +
      '   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/martial_arts_crm?schema=public"\n'
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('🔐 Создание суперадмина\n');

  const email = await question('Email: ');
  const password = await question('Пароль: ');
  const firstName = await question('Имя: ');
  const lastName = await question('Фамилия: ');

  if (!email || !password || !firstName || !lastName) {
    console.error('❌ Все поля обязательны!');
    rl.close();
    process.exit(1);
  }

  try {
    // Check if super admin already exists
    const existing = await prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      console.error('❌ Суперадмин с таким email уже существует!');
      rl.close();
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create super admin
    const superAdmin = await prisma.superAdmin.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isActive: true,
      },
    });

    console.log('\n✅ Суперадмин успешно создан!');
    console.log(`   ID: ${superAdmin.id}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Имя: ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log('\n🔗 Войдите на странице: /super-admin/login');
  } catch (error) {
    console.error('❌ Ошибка при создании суперадмина:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();

