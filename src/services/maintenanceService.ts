import { prisma } from '../lib/prisma';

export const MAINTENANCE_MESSAGE =
  'На сайте сейчас технические работы. Сервис временно недоступен. Попробуйте позже.';

let cachedEnabled: boolean | null = null;
let cachedAt = 0;
const CACHE_MS = 5_000;

async function ensureSettings() {
  let settings = await prisma.superAdminSettings.findFirst();
  if (!settings) {
    settings = await prisma.superAdminSettings.create({ data: {} });
  }
  return settings;
}

function setCache(enabled: boolean) {
  cachedEnabled = enabled;
  cachedAt = Date.now();
}

export async function isMaintenanceMode(): Promise<boolean> {
  if (cachedEnabled !== null && Date.now() - cachedAt < CACHE_MS) {
    return cachedEnabled;
  }
  const s = await ensureSettings();
  const enabled = Boolean(s.maintenanceMode);
  setCache(enabled);
  return enabled;
}

export async function getMaintenanceStatus(): Promise<{
  enabled: boolean;
  message: string;
}> {
  const enabled = await isMaintenanceMode();
  return {
    enabled,
    message: MAINTENANCE_MESSAGE,
  };
}

export async function setMaintenanceMode(enabled: boolean): Promise<{
  enabled: boolean;
  message: string;
}> {
  const s = await ensureSettings();
  await prisma.superAdminSettings.update({
    where: { id: s.id },
    data: { maintenanceMode: enabled },
  });
  setCache(enabled);
  return {
    enabled,
    message: MAINTENANCE_MESSAGE,
  };
}

/** Сброс кэша (тесты / после внешних правок). */
export function clearMaintenanceCache() {
  cachedEnabled = null;
  cachedAt = 0;
}
