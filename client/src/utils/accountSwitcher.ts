import { AccountType, UnifiedSession, User } from '../types';

export const SAVED_ACCOUNTS_KEY = 'savedAccounts';
const MAX_SAVED_ACCOUNTS = 8;

/** Совпадает с CLIENT_APPROVED_KEY в authSession — без импорта, чтобы не было цикла. */
const CLIENT_APPROVED_STORAGE_KEY = 'clientApproved';

/** Ключи активной сессии (реестр savedAccounts не входит). */
export const AUTH_STORAGE_KEYS = [
  'token',
  'user',
  'tenant',
  'clientToken',
  'client',
  'clientTenant',
  'userType',
  CLIENT_APPROVED_STORAGE_KEY,
  'marketerToken',
  'marketer',
  'marketerTenant',
  'promoCodeAdminToken',
  'promoCodeAdmin',
  'promoCodeAdminTenant',
  'superAdminToken',
  'superAdmin',
  'testerToken',
  'tester',
  'platformStaffToken',
  'platformStaff',
] as const;

export interface SavedAccountSlot {
  id: string;
  accountType: AccountType;
  displayName: string;
  subtitle: string;
  destination: string;
  updatedAt: number;
  /** Снимок значений localStorage для восстановления сессии. */
  keys: Record<string, string>;
  /**
   * Id школьного User, от которого авто-добавлен SA/Tester.
   * Нужен, чтобы убрать слот при отвязке без повторного логина.
   */
  linkedFromUserId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
};

function personName(parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(' ').trim();
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Очистка активных auth-ключей без удаления savedAccounts. */
function clearActiveAuthKeys(): void {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  sessionStorage.removeItem('marketerLoggedOut');
  sessionStorage.removeItem('loginFieldErrors');
  sessionStorage.removeItem('clientLoginFieldErrors');
}

function activeDestination(): string {
  if (localStorage.getItem('token')) return '/dashboard';
  if (localStorage.getItem('clientToken')) return '/client/dashboard';
  if (localStorage.getItem('superAdminToken')) return '/admin/dashboard';
  if (localStorage.getItem('testerToken')) return '/tester/dashboard';
  if (localStorage.getItem('platformStaffToken')) {
    const staff = safeParse<{ mustChangePassword?: boolean }>(localStorage.getItem('platformStaff'));
    return staff?.mustChangePassword ? '/platform-staff/change-password' : '/platform-staff/desk';
  }
  if (localStorage.getItem('promoCodeAdminToken')) return '/admin/promo-codes';
  if (localStorage.getItem('marketerToken')) return '/marketer/dashboard';
  return '/auth';
}

export function listSavedAccounts(): SavedAccountSlot[] {
  const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedAccountSlot =>
        item &&
        typeof item.id === 'string' &&
        typeof item.accountType === 'string' &&
        item.keys &&
        typeof item.keys === 'object'
    );
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedAccountSlot[]): void {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function removeSavedAccount(id: string): void {
  writeSavedAccounts(listSavedAccounts().filter((a) => a.id !== id));
}

/** Снимок текущих auth-ключей из localStorage. */
export function captureActiveSessionKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const key of AUTH_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value != null) keys[key] = value;
  }
  return keys;
}

/**
 * Определяет id активного аккаунта по ключам в localStorage.
 * Приоритет совпадает с выбором токена в приложении.
 */
export function getActiveAccountId(): string | null {
  const token = localStorage.getItem('token');
  const user = safeParse<User>(localStorage.getItem('user'));
  if (token && user?.id) return `TENANT_USER:${user.id}`;

  const clientToken = localStorage.getItem('clientToken');
  const client = safeParse<{ id: string }>(localStorage.getItem('client'));
  const userType = localStorage.getItem('userType');
  if (clientToken && client?.id) {
    const type: AccountType = userType === 'parent' ? 'PARENT' : 'CLIENT';
    return `${type}:${client.id}`;
  }

  const marketer = safeParse<{ id: string }>(localStorage.getItem('marketer'));
  if (localStorage.getItem('marketerToken') && marketer?.id) return `MARKETER:${marketer.id}`;

  const promoAdmin = safeParse<{ id: string }>(localStorage.getItem('promoCodeAdmin'));
  if (localStorage.getItem('promoCodeAdminToken') && promoAdmin?.id) {
    return `PROMO_CODE_ADMIN:${promoAdmin.id}`;
  }

  const superAdmin = safeParse<{ id: string }>(localStorage.getItem('superAdmin'));
  if (localStorage.getItem('superAdminToken') && superAdmin?.id) {
    return `SUPER_ADMIN:${superAdmin.id}`;
  }

  const tester = safeParse<{ id: string }>(localStorage.getItem('tester'));
  if (localStorage.getItem('testerToken') && tester?.id) {
    return `TESTER:${tester.id}`;
  }

  const staff = safeParse<{ id: string }>(localStorage.getItem('platformStaff'));
  if (localStorage.getItem('platformStaffToken') && staff?.id) {
    return `PLATFORM_STAFF:${staff.id}`;
  }

  return null;
}

function metaFromActiveStorage(): Pick<
  SavedAccountSlot,
  'id' | 'accountType' | 'displayName' | 'subtitle' | 'destination'
> | null {
  const id = getActiveAccountId();
  if (!id) return null;
  const destination = activeDestination();
  const accountType = id.split(':')[0] as AccountType;

  if (accountType === 'TENANT_USER') {
    const user = safeParse<User>(localStorage.getItem('user'));
    const tenant = safeParse<{ name?: string }>(localStorage.getItem('tenant'));
    return {
      id,
      accountType,
      displayName: personName([user?.lastName, user?.firstName, user?.middleName]) || user?.email || 'Пользователь',
      subtitle: [ROLE_LABELS[user?.role || ''] || user?.role, tenant?.name].filter(Boolean).join(' · '),
      destination,
    };
  }

  if (accountType === 'CLIENT' || accountType === 'PARENT') {
    const client = safeParse<{
      id: string;
      firstName?: string;
      lastName?: string;
      middleName?: string;
      fullName?: string;
      email?: string;
    }>(localStorage.getItem('client'));
    const tenant = safeParse<{ name?: string }>(localStorage.getItem('clientTenant'));
    const name =
      client?.fullName ||
      personName([client?.lastName, client?.firstName, client?.middleName]) ||
      client?.email ||
      'Клиент';
    return {
      id,
      accountType,
      displayName: name,
      subtitle: [accountType === 'PARENT' ? 'Родитель' : 'Ученик', tenant?.name].filter(Boolean).join(' · '),
      destination,
    };
  }

  if (accountType === 'MARKETER') {
    const marketer = safeParse<{ name?: string; email?: string }>(localStorage.getItem('marketer'));
    const tenant = safeParse<{ name?: string }>(localStorage.getItem('marketerTenant'));
    return {
      id,
      accountType,
      displayName: marketer?.name || marketer?.email || 'Маркетолог',
      subtitle: ['Маркетолог', tenant?.name].filter(Boolean).join(' · '),
      destination,
    };
  }

  if (accountType === 'PROMO_CODE_ADMIN') {
    const admin = safeParse<{ name?: string; email?: string }>(localStorage.getItem('promoCodeAdmin'));
    const tenant = safeParse<{ name?: string }>(localStorage.getItem('promoCodeAdminTenant'));
    return {
      id,
      accountType,
      displayName: admin?.name || admin?.email || 'Админ промокодов',
      subtitle: ['Промокоды', tenant?.name].filter(Boolean).join(' · '),
      destination,
    };
  }

  if (accountType === 'SUPER_ADMIN') {
    const admin = safeParse<{ firstName?: string; lastName?: string; email?: string }>(
      localStorage.getItem('superAdmin')
    );
    return {
      id,
      accountType,
      displayName: personName([admin?.lastName, admin?.firstName]) || admin?.email || 'Супер-админ',
      subtitle: 'Супер-админ',
      destination,
    };
  }

  if (accountType === 'TESTER') {
    const tester = safeParse<{ firstName?: string; lastName?: string; email?: string }>(
      localStorage.getItem('tester')
    );
    return {
      id,
      accountType,
      displayName: personName([tester?.lastName, tester?.firstName]) || tester?.email || 'Тестировщик',
      subtitle: 'Тестировщик',
      destination,
    };
  }

  if (accountType === 'PLATFORM_STAFF') {
    const staff = safeParse<{ firstName?: string; lastName?: string; email?: string; role?: string }>(
      localStorage.getItem('platformStaff')
    );
    return {
      id,
      accountType,
      displayName: personName([staff?.lastName, staff?.firstName]) || staff?.email || 'Сотрудник платформы',
      subtitle: staff?.role || 'Платформа',
      destination,
    };
  }

  return null;
}

/** Сохраняет / обновляет слот по текущей активной сессии в localStorage. */
export function upsertFromActiveStorage(extra?: {
  linkedFromUserId?: string;
}): SavedAccountSlot | null {
  const meta = metaFromActiveStorage();
  if (!meta) return null;

  const existingSlot = listSavedAccounts().find((a) => a.id === meta.id);

  const slot: SavedAccountSlot = {
    ...meta,
    updatedAt: Date.now(),
    keys: captureActiveSessionKeys(),
    ...(extra?.linkedFromUserId
      ? { linkedFromUserId: extra.linkedFromUserId }
      : existingSlot?.linkedFromUserId
        ? { linkedFromUserId: existingSlot.linkedFromUserId }
        : {}),
  };

  const existing = listSavedAccounts();
  const without = existing.filter((a) => a.id !== slot.id);
  without.unshift(slot);

  while (without.length > MAX_SAVED_ACCOUNTS) {
    let dropIdx = -1;
    for (let i = without.length - 1; i >= 0; i -= 1) {
      if (without[i].id !== slot.id) {
        dropIdx = i;
        break;
      }
    }
    if (dropIdx < 0) break;
    without.splice(dropIdx, 1);
  }

  writeSavedAccounts(without);
  return slot;
}

/** Upsert после applyUnifiedSession / login — сессия уже записана в localStorage. */
export function upsertSavedAccountFromSession(_session?: UnifiedSession): void {
  upsertFromActiveStorage();
}

/** Bearer-токен из снимка слота (приоритет как у axios-интерцептора). */
export function getSlotBearerToken(slot: SavedAccountSlot): string | null {
  const keys = slot.keys || {};
  return (
    keys.superAdminToken ||
    keys.testerToken ||
    keys.platformStaffToken ||
    keys.promoCodeAdminToken ||
    keys.marketerToken ||
    keys.clientToken ||
    keys.token ||
    null
  );
}

/**
 * Можно ли переключиться на слот при maintenance/testing.
 * SUPER_ADMIN всегда можно; при testing — только allowlist (по токену слота).
 */
export async function canSwitchToSavedAccount(slot: SavedAccountSlot): Promise<boolean> {
  if (slot.accountType === 'SUPER_ADMIN') return true;

  const maintenanceOn = sessionStorage.getItem('maintenanceMode') === '1';
  if (maintenanceOn) return false;

  const testingOn =
    sessionStorage.getItem('testingMode') === '1' ||
    sessionStorage.getItem('closedTestingMode') === '1';
  if (!testingOn) return true;

  const token = getSlotBearerToken(slot);
  if (!token) return false;

  try {
    const { apiService } = await import('../services/api');
    const access = await apiService.getMaintenanceAccessWithToken(token);
    return Boolean(access?.canAccess);
  } catch {
    return false;
  }
}

/**
 * Переключить аккаунт с проверкой testing/maintenance.
 * Не уходит на заглушку «вслепую» — сначала проверяет доступ слота.
 */
export async function switchToAccountSafe(
  id: string
): Promise<'ok' | 'blocked' | 'missing'> {
  const slot = listSavedAccounts().find((a) => a.id === id);
  if (!slot) return 'missing';

  const allowed = await canSwitchToSavedAccount(slot);
  if (!allowed) return 'blocked';

  if (sessionStorage.getItem('testingMode') === '1' || sessionStorage.getItem('closedTestingMode') === '1') {
    sessionStorage.setItem('testingModeAccess', '1');
  }

  switchToAccount(id);
  return 'ok';
}

/** Переключить активную сессию на сохранённый слот (полный reload). */
export function switchToAccount(id: string): void {
  const slot = listSavedAccounts().find((a) => a.id === id);
  if (!slot) return;

  clearActiveAuthKeys();
  for (const [key, value] of Object.entries(slot.keys)) {
    localStorage.setItem(key, value);
  }

  upsertFromActiveStorage();
  window.location.assign(slot.destination || '/auth');
}

/**
 * Выйти только из текущего аккаунта.
 * Если в реестре остались другие — активирует самый свежий и возвращает destination.
 * Иначе очищает активную сессию и возвращает null (гость → лендинг `/`).
 */
export function logoutCurrentAccount(): string | null {
  const activeId = getActiveAccountId();
  if (activeId) removeSavedAccount(activeId);

  const remaining = listSavedAccounts().sort((a, b) => b.updatedAt - a.updatedAt);
  clearActiveAuthKeys();

  if (remaining.length === 0) return null;

  // При выходе предпочтительно SA — иначе при testing можно попасть на заглушку
  const next =
    remaining.find((a) => a.accountType === 'SUPER_ADMIN') || remaining[0];
  for (const [key, value] of Object.entries(next.keys)) {
    localStorage.setItem(key, value);
  }
  upsertFromActiveStorage();
  return next.destination || '/auth';
}

/**
 * Подготовить вход ещё одного аккаунта: текущий остаётся в реестре,
 * активные ключи очищаются.
 */
export function prepareAddAccount(): void {
  upsertFromActiveStorage();
  clearActiveAuthKeys();
}

/** Удалить авто-привязанные SA/Tester слоты для школьного userId (кроме keepIds). */
export function removeLinkedSlotsForUser(userId: string, keepIds?: Set<string>): void {
  const next = listSavedAccounts().filter((slot) => {
    if (slot.linkedFromUserId !== userId) return true;
    if (keepIds && keepIds.has(slot.id)) return true;
    return false;
  });
  writeSavedAccounts(next);
}

/**
 * Переключиться на школьный слот после отзыва платформенного аккаунта.
 */
export function fallbackToSchoolAccount(): string | null {
  const school = listSavedAccounts().find((a) => a.accountType === 'TENANT_USER');
  if (!school) return null;
  clearActiveAuthKeys();
  for (const [key, value] of Object.entries(school.keys)) {
    localStorage.setItem(key, value);
  }
  upsertFromActiveStorage();
  return school.destination || '/dashboard';
}
