import { prisma } from '../lib/prisma';
import { DEFAULT_TERMS_OF_SERVICE } from '../constants/defaultTermsOfService';
import { DEFAULT_PRIVACY_POLICY } from '../constants/defaultPrivacyPolicy';

export const MAINTENANCE_MESSAGE =
  'На сайте сейчас технические работы. Сервис временно недоступен. Попробуйте позже.';

export const TESTING_MODE_MESSAGE =
  'Сайт сейчас в режиме тестирования. Доступ открыт только для выбранных аккаунтов.';

type AccessCache = {
  maintenance: boolean;
  testing: boolean;
  allowlist: string[];
  at: number;
};

let cache: AccessCache | null = null;
const CACHE_MS = 5_000;

async function ensureSettings() {
  let settings = await prisma.superAdminSettings.findFirst();
  if (!settings) {
    settings = await prisma.superAdminSettings.create({ data: {} });
  }
  return settings;
}

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
    /* fall through — treat as newline/comma separated */
  }
  return String(raw)
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

function serializeAllowlist(emails: string[]): string {
  const unique = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))
  );
  return JSON.stringify(unique);
}

async function loadCache(): Promise<AccessCache> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const s = await ensureSettings();
  cache = {
    maintenance: Boolean(s.maintenanceMode),
    testing: Boolean(s.testingMode),
    allowlist: parseAllowlist(s.testingModeAllowlist),
    at: Date.now(),
  };
  return cache;
}

export function clearMaintenanceCache() {
  cache = null;
}

export async function isMaintenanceMode(): Promise<boolean> {
  return (await loadCache()).maintenance;
}

export async function isTestingMode(): Promise<boolean> {
  return (await loadCache()).testing;
}

export async function getTestingAllowlist(): Promise<string[]> {
  return (await loadCache()).allowlist;
}

export async function isEmailAllowlisted(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const list = await getTestingAllowlist();
  return list.includes(String(email).trim().toLowerCase());
}

export async function getMaintenanceStatus(): Promise<{
  enabled: boolean;
  message: string;
}> {
  const enabled = await isMaintenanceMode();
  return { enabled, message: MAINTENANCE_MESSAGE };
}

export async function getTestingModeStatus(): Promise<{
  enabled: boolean;
  message: string;
  allowlist: string[];
}> {
  const c = await loadCache();
  return {
    enabled: c.testing,
    message: TESTING_MODE_MESSAGE,
    allowlist: c.allowlist,
  };
}

/** Публичный статус (без allowlist). */
export async function getPublicAccessStatus(): Promise<{
  maintenance: { enabled: boolean; message: string };
  testing: { enabled: boolean; message: string };
}> {
  const c = await loadCache();
  return {
    maintenance: { enabled: c.maintenance, message: MAINTENANCE_MESSAGE },
    testing: { enabled: c.testing, message: TESTING_MODE_MESSAGE },
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
  clearMaintenanceCache();
  return { enabled, message: MAINTENANCE_MESSAGE };
}

export async function setTestingMode(params: {
  enabled: boolean;
  allowlist?: string[];
}): Promise<{ enabled: boolean; message: string; allowlist: string[] }> {
  const s = await ensureSettings();
  const data: { testingMode: boolean; testingModeAllowlist?: string } = {
    testingMode: params.enabled,
  };
  if (params.allowlist !== undefined) {
    data.testingModeAllowlist = serializeAllowlist(params.allowlist);
  }
  await prisma.superAdminSettings.update({
    where: { id: s.id },
    data,
  });
  clearMaintenanceCache();
  const status = await getTestingModeStatus();
  return status;
}

export type TestingAccountCandidate = {
  email: string;
  name: string;
  roleLabel: string;
};

const USER_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
};

/**
 * Кандидаты для списка доступа в режиме тестирования — существующие аккаунты платформы.
 */
export async function listTestingAccountCandidates(): Promise<TestingAccountCandidate[]> {
  const byEmail = new Map<string, TestingAccountCandidate>();

  const add = (email: string | null | undefined, name: string, roleLabel: string) => {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized.includes('@') || byEmail.has(normalized)) return;
    byEmail.set(normalized, {
      email: normalized,
      name: name.trim() || normalized,
      roleLabel,
    });
  };

  const [users, clients, parents, marketers, promoAdmins, testers, staff, superAdmins] =
    await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenant: { select: { name: true } },
        },
        take: 3000,
      }),
      prisma.client.findMany({
        where: { isActive: true, email: { not: null } },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          tenant: { select: { name: true } },
        },
        take: 3000,
      }),
      prisma.parent.findMany({
        where: { email: { not: null }, password: { not: null } },
        select: {
          email: true,
          fullName: true,
          tenant: { select: { name: true } },
        },
        take: 3000,
      }),
      prisma.marketer.findMany({
        where: { isActive: true },
        select: { email: true, name: true, tenant: { select: { name: true } } },
        take: 1000,
      }),
      prisma.promoCodeAdmin.findMany({
        where: { isActive: true },
        select: { email: true, name: true, tenant: { select: { name: true } } },
        take: 1000,
      }),
      prisma.tester.findMany({
        where: { isActive: true },
        select: { email: true, firstName: true, lastName: true },
        take: 500,
      }),
      prisma.platformStaffUser.findMany({
        where: { isActive: true },
        select: { email: true, firstName: true, lastName: true, role: true },
        take: 500,
      }),
      prisma.superAdmin.findMany({
        where: { isActive: true },
        select: { email: true, firstName: true, lastName: true },
        take: 100,
      }),
    ]);

  for (const u of users) {
    const role = USER_ROLE_LABELS[u.role] || u.role;
    const school = u.tenant?.name ? ` · ${u.tenant.name}` : '';
    add(u.email, `${u.lastName} ${u.firstName}`.trim(), `${role}${school}`);
  }
  for (const c of clients) {
    const school = c.tenant?.name ? ` · ${c.tenant.name}` : '';
    add(c.email, `${c.lastName} ${c.firstName}`.trim(), `Ученик${school}`);
  }
  for (const p of parents) {
    const school = p.tenant?.name ? ` · ${p.tenant.name}` : '';
    add(p.email, p.fullName, `Родитель${school}`);
  }
  for (const m of marketers) {
    const school = m.tenant?.name ? ` · ${m.tenant.name}` : '';
    add(m.email, m.name, `Маркетолог${school}`);
  }
  for (const a of promoAdmins) {
    const school = a.tenant?.name ? ` · ${a.tenant.name}` : '';
    add(a.email, a.name, `Админ промокодов${school}`);
  }
  for (const t of testers) {
    add(t.email, `${t.lastName} ${t.firstName}`.trim(), 'Тестировщик');
  }
  for (const s of staff) {
    add(s.email, `${s.lastName} ${s.firstName}`.trim(), `Платформа · ${s.role}`);
  }
  for (const sa of superAdmins) {
    add(sa.email, `${sa.lastName} ${sa.firstName}`.trim(), 'Супер-админ');
  }

  return Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function getTermsOfService(): Promise<{
  content: string;
  updatedAt: string | null;
  isDefault: boolean;
}> {
  const s = await ensureSettings();
  const stored = (s.termsOfServiceText || '').trim();
  if (!stored) {
    return {
      content: DEFAULT_TERMS_OF_SERVICE,
      updatedAt: null,
      isDefault: true,
    };
  }
  return {
    content: stored,
    updatedAt: s.termsUpdatedAt?.toISOString() || s.updatedAt.toISOString(),
    isDefault: false,
  };
}

export async function setTermsOfService(content: string): Promise<{
  content: string;
  updatedAt: string | null;
  isDefault: boolean;
}> {
  const s = await ensureSettings();
  const text = String(content || '').trim();
  if (!text) {
    throw new Error('Текст соглашения не может быть пустым');
  }
  const updated = await prisma.superAdminSettings.update({
    where: { id: s.id },
    data: {
      termsOfServiceText: text,
      termsUpdatedAt: new Date(),
    },
  });
  return {
    content: updated.termsOfServiceText || text,
    updatedAt: updated.termsUpdatedAt?.toISOString() || null,
    isDefault: false,
  };
}

export async function getPrivacyPolicy(): Promise<{
  content: string;
  updatedAt: string | null;
  isDefault: boolean;
}> {
  const s = await ensureSettings();
  const stored = (s.privacyPolicyText || '').trim();
  if (!stored) {
    return {
      content: DEFAULT_PRIVACY_POLICY,
      updatedAt: null,
      isDefault: true,
    };
  }
  return {
    content: stored,
    updatedAt: s.privacyUpdatedAt?.toISOString() || s.updatedAt.toISOString(),
    isDefault: false,
  };
}

export async function setPrivacyPolicy(content: string): Promise<{
  content: string;
  updatedAt: string | null;
  isDefault: boolean;
}> {
  const s = await ensureSettings();
  const text = String(content || '').trim();
  if (!text) {
    throw new Error('Текст политики не может быть пустым');
  }
  const updated = await prisma.superAdminSettings.update({
    where: { id: s.id },
    data: {
      privacyPolicyText: text,
      privacyUpdatedAt: new Date(),
    },
  });
  return {
    content: updated.privacyPolicyText || text,
    updatedAt: updated.privacyUpdatedAt?.toISOString() || null,
    isDefault: false,
  };
}
