/**
 * Управление режимом закрытого тестирования из консоли.
 *
 *   npm run closed-testing -- on
 *   npm run closed-testing -- off
 *   npm run closed-testing -- status
 */
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error(
    '\nDATABASE_URL не задан. Создайте `.env` в корне проекта, например:\n' +
      '   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/martial_arts_crm?schema=public"\n'
  );
  process.exit(1);
}

const prisma = new PrismaClient();

function parseAllowlist(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e.includes('@'));
    }
  } catch {
    /* ignore */
  }
  return String(raw)
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

async function ensureSettings() {
  let settings = await prisma.superAdminSettings.findFirst();
  if (!settings) {
    settings = await prisma.superAdminSettings.create({ data: {} });
  }
  return settings;
}

async function printStatus() {
  const s = await ensureSettings();
  const allowlist = parseAllowlist(s.testingModeAllowlist);
  console.log('Режимы доступа:');
  console.log(`  closedTestingMode: ${s.closedTestingMode ? 'ON' : 'off'}`);
  console.log(`  testingMode:       ${s.testingMode ? 'ON' : 'off'}`);
  console.log(`  maintenanceMode:   ${s.maintenanceMode ? 'ON' : 'off'}`);
  console.log(`  allowlist emails:  ${allowlist.length}`);
  if (allowlist.length > 0) {
    allowlist.forEach((e) => console.log(`    - ${e}`));
  }
}

async function main() {
  const cmd = (process.argv[2] || '').trim().toLowerCase();

  if (!cmd || !['on', 'off', 'status'].includes(cmd)) {
    console.log('Использование:');
    console.log('  npm run closed-testing -- on');
    console.log('  npm run closed-testing -- off');
    console.log('  npm run closed-testing -- status');
    process.exit(cmd ? 1 : 0);
  }

  if (cmd === 'status') {
    await printStatus();
    return;
  }

  const s = await ensureSettings();

  if (cmd === 'on') {
    await prisma.superAdminSettings.update({
      where: { id: s.id },
      data: {
        closedTestingMode: true,
        maintenanceMode: false,
        testingMode: false,
      },
    });
    console.log('Закрытое тестирование ВКЛЮЧЕНО.');
    console.log('Вход на сайт недоступен. Allowlist-сессии продолжают работать.');
    console.log('Выключение: npm run closed-testing -- off');
  } else {
    await prisma.superAdminSettings.update({
      where: { id: s.id },
      data: { closedTestingMode: false },
    });
    console.log('Закрытое тестирование ВЫКЛЮЧЕНО.');
  }

  await printStatus();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
