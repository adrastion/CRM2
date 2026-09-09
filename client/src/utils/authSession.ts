import { UnifiedSession } from '../types';
import {
  captureActiveSessionKeys,
  upsertFromActiveStorage,
  upsertSavedAccountFromSession,
  removeLinkedSlotsForUser,
  removeSavedAccount,
  fallbackToSchoolAccount,
  getActiveAccountId,
  listSavedAccounts,
} from './accountSwitcher';
import { apiService } from '../services/api';

/**
 * Флаг подтверждения клиентского аккаунта школой.
 *
 * Хранится отдельно, чтобы компоненты вне личного кабинета (например, кнопка
 * техподдержки) могли скрыть функциональность до подтверждения, не дожидаясь
 * ответа /client-auth/dashboard.
 */
export const CLIENT_APPROVED_KEY = 'clientApproved';

/** Подтверждён ли текущий клиентский аккаунт администратором школы. */
export function isClientApproved(): boolean {
  return localStorage.getItem(CLIENT_APPROVED_KEY) === 'true';
}

/**
 * Очищает все токены всех ролей.
 *
 * В приложении шесть параллельных наборов ключей, и axios-интерцептор выбирает
 * токен по фиксированному приоритету. Поэтому перед записью новой сессии нужно
 * убрать все старые, иначе запросы уйдут от «чужого» аккаунта.
 * Реестр сохранённых аккаунтов (`savedAccounts`) не трогаем.
 */
export function clearAllAuthStorage(): void {
  const keys = [
    'token',
    'user',
    'tenant',
    'clientToken',
    'client',
    'clientTenant',
    'userType',
    CLIENT_APPROVED_KEY,
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
  ];
  keys.forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem('marketerLoggedOut');
  sessionStorage.removeItem('loginFieldErrors');
  sessionStorage.removeItem('clientLoginFieldErrors');
}

type SessionLike = Omit<UnifiedSession, 'requiresSelection'>;

/** Записывает ключи сессии в localStorage (без очистки). */
function writeSessionKeys(session: SessionLike): string {
  let destination = '/auth';

  switch (session.accountType) {
    case 'TENANT_USER':
      localStorage.setItem('token', session.token);
      localStorage.setItem('user', JSON.stringify(session.user));
      localStorage.setItem('tenant', JSON.stringify(session.tenant));
      destination = '/dashboard';
      break;

    case 'CLIENT':
      localStorage.setItem('clientToken', session.token);
      localStorage.setItem('client', JSON.stringify(session.client));
      localStorage.setItem('clientTenant', JSON.stringify(session.tenant));
      localStorage.setItem('userType', 'client');
      localStorage.setItem(CLIENT_APPROVED_KEY, String(Boolean(session.isAccountApproved)));
      destination = '/client/dashboard';
      break;

    case 'PARENT':
      localStorage.setItem('clientToken', session.token);
      localStorage.setItem('client', JSON.stringify(session.parent));
      localStorage.setItem('clientTenant', JSON.stringify(session.tenant));
      localStorage.setItem('userType', 'parent');
      localStorage.setItem(CLIENT_APPROVED_KEY, String(Boolean(session.isAccountApproved)));
      destination = '/client/dashboard';
      break;

    case 'MARKETER':
      localStorage.setItem('marketerToken', session.token);
      localStorage.setItem('marketer', JSON.stringify(session.marketer));
      localStorage.setItem('marketerTenant', JSON.stringify(session.tenant));
      destination = '/marketer/panel';
      break;

    case 'PROMO_CODE_ADMIN':
      localStorage.setItem('promoCodeAdminToken', session.token);
      localStorage.setItem('promoCodeAdmin', JSON.stringify(session.admin));
      localStorage.setItem('promoCodeAdminTenant', JSON.stringify(session.tenant));
      destination = '/admin/promo-codes';
      break;

    case 'SUPER_ADMIN':
      localStorage.setItem('superAdminToken', session.token);
      localStorage.setItem('superAdmin', JSON.stringify(session.superAdmin));
      destination = '/admin/dashboard';
      break;

    case 'TESTER':
      localStorage.setItem('testerToken', session.token);
      localStorage.setItem('tester', JSON.stringify(session.tester));
      destination = '/tester/dashboard';
      break;

    case 'PLATFORM_STAFF':
      localStorage.setItem('platformStaffToken', session.token);
      localStorage.setItem('platformStaff', JSON.stringify(session.staff));
      destination = session.staff?.mustChangePassword
        ? '/platform-staff/change-password'
        : '/platform-staff/desk';
      break;

    default:
      destination = '/auth';
      break;
  }

  return destination;
}

function restoreSessionKeys(keys: Record<string, string>): void {
  for (const [key, value] of Object.entries(keys)) {
    localStorage.setItem(key, value);
  }
}

/**
 * Записывает сессию в localStorage в формате, который ожидают
 * существующие контексты и middleware, и возвращает маршрут для перехода.
 * Если есть linkedSession / linkedSessions (OWNER ↔ SA / Tester) — слоты в свитчере.
 */
export function applyUnifiedSession(session: UnifiedSession): string {
  clearAllAuthStorage();

  const destination = writeSessionKeys(session);
  upsertSavedAccountFromSession(session);

  const links =
    session.linkedSessions && session.linkedSessions.length > 0
      ? session.linkedSessions
      : session.linkedSession
        ? [session.linkedSession]
        : [];

  const linkedFromUserId =
    session.accountType === 'TENANT_USER' && session.user?.id
      ? String(session.user.id)
      : undefined;

  if (links.length > 0) {
    const primaryKeys = captureActiveSessionKeys();
    for (const link of links) {
      clearAllAuthStorage();
      writeSessionKeys(link);
      upsertFromActiveStorage(
        linkedFromUserId && (link.accountType === 'SUPER_ADMIN' || link.accountType === 'TESTER')
          ? { linkedFromUserId }
          : undefined
      );
    }
    clearAllAuthStorage();
    restoreSessionKeys(primaryKeys);
    upsertFromActiveStorage();
  }

  return destination;
}

/**
 * Подтянуть SA/Tester в свитчер по текущей школьной сессии (без повторного логина).
 * При отвязке — убрать слоты; если активен отозванный аккаунт — вернуться в школу.
 */
export async function syncLinkedPlatformAccounts(): Promise<{
  changed: boolean;
  kickedTo?: string;
}> {
  const schoolToken = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');
  if (!schoolToken || !userRaw) {
    return { changed: false };
  }

  let userId: string | null = null;
  try {
    userId = JSON.parse(userRaw)?.id || null;
  } catch {
    return { changed: false };
  }
  if (!userId) return { changed: false };

  // Запрос должен идти с school token — временно приоритетнее SA/Tester в interceptor нет
  // если school token активен в localStorage как `token` и нет superAdminToken...
  // Когда OWNER в школе, superAdminToken отсутствует в active keys. OK.
  let linkedSessions: UnifiedSession[] = [];
  try {
    const data = await apiService.getLinkedSessions();
    linkedSessions = (data?.linkedSessions || []) as UnifiedSession[];
  } catch {
    return { changed: false };
  }

  const keepIds = new Set<string>();
  const primaryKeys = captureActiveSessionKeys();

  for (const link of linkedSessions) {
    if (link.accountType !== 'SUPER_ADMIN' && link.accountType !== 'TESTER') continue;
    const id =
      link.accountType === 'SUPER_ADMIN'
        ? `SUPER_ADMIN:${link.superAdmin?.id}`
        : `TESTER:${link.tester?.id}`;
    if (!id.endsWith(':undefined') && !id.endsWith(':')) keepIds.add(id);

    clearAllAuthStorage();
    writeSessionKeys(link as Omit<UnifiedSession, 'requiresSelection'>);
    upsertFromActiveStorage({ linkedFromUserId: userId });
  }

  clearAllAuthStorage();
  restoreSessionKeys(primaryKeys);
  upsertFromActiveStorage();

  const before = listSavedAccounts().map((s) => s.id).sort().join(',');
  removeLinkedSlotsForUser(userId, keepIds);
  const after = listSavedAccounts().map((s) => s.id).sort().join(',');

  const activeId = getActiveAccountId();
  if (
    activeId &&
    (activeId.startsWith('SUPER_ADMIN:') || activeId.startsWith('TESTER:')) &&
    !keepIds.has(activeId)
  ) {
    removeSavedAccount(activeId);
    const dest = fallbackToSchoolAccount();
    if (dest) {
      window.location.assign(dest);
      return { changed: true, kickedTo: dest };
    }
    clearAllAuthStorage();
    window.location.assign('/');
    return { changed: true, kickedTo: '/' };
  }

  return { changed: before !== after };
}

/** Есть ли хоть одна активная сессия. */
export function hasAnySession(): boolean {
  return Boolean(
    localStorage.getItem('token') ||
      localStorage.getItem('clientToken') ||
      localStorage.getItem('marketerToken') ||
      localStorage.getItem('promoCodeAdminToken') ||
      localStorage.getItem('superAdminToken') ||
      localStorage.getItem('testerToken') ||
      localStorage.getItem('platformStaffToken')
  );
}

/** Куда вести пользователя, у которого уже есть сессия. */
export function currentSessionDestination(): string | null {
  if (localStorage.getItem('token')) return '/dashboard';
  if (localStorage.getItem('clientToken')) return '/client/dashboard';
  if (localStorage.getItem('superAdminToken')) return '/admin/dashboard';
  if (localStorage.getItem('testerToken')) return '/tester/dashboard';
  if (localStorage.getItem('platformStaffToken')) return '/platform-staff/desk';
  if (localStorage.getItem('promoCodeAdminToken')) return '/admin/promo-codes';
  if (localStorage.getItem('marketerToken')) return '/marketer/panel';
  return null;
}

/** Единое извлечение сообщения об ошибке из ответа axios. */
export function extractApiError(err: any, fallback = 'Произошла ошибка. Попробуйте ещё раз.'): {
  message: string;
  field?: string;
  status?: number;
} {
  const status = err?.response?.status;
  const data = err?.response?.data;

  if (Array.isArray(data?.data) && data.data.length > 0) {
    const first = data.data[0];
    return { message: first.message || data.error || fallback, field: first.field, status };
  }

  return { message: data?.error || err?.message || fallback, status };
}
