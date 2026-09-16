import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Prisma импортируется раньше dotenv.config() в server.ts — грузим .env здесь.
const rootEnv = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: rootEnv });
dotenv.config();

/**
 * Единый Prisma Client на весь процесс.
 * Без синглтона каждый контроллер/сервис открывает свой пул —
 * PostgreSQL быстро упирается в max_connections (ошибка P2037).
 */
const globalForPrisma = globalThis as unknown as { __crmPrisma?: PrismaClient };

function buildDatasourceUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      `DATABASE_URL is not set. Expected it in ${rootEnv} (or process env).`
    );
  }
  // Ограничиваем пул на один процесс, если явно не задано.
  if (/[?&]connection_limit=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=10&pool_timeout=20`;
}

export const prisma =
  globalForPrisma.__crmPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: buildDatasourceUrl(),
      },
    },
  });

globalForPrisma.__crmPrisma = prisma;

const disconnect = async () => {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
};

process.once('beforeExit', disconnect);
process.once('SIGINT', async () => {
  await disconnect();
  process.exit(0);
});
process.once('SIGTERM', async () => {
  await disconnect();
  process.exit(0);
});
