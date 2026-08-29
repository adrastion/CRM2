import {
  applyUnifiedSession,
  clearAllAuthStorage,
  currentSessionDestination,
  extractApiError,
  hasAnySession,
} from '../utils/authSession';
import { UnifiedSession } from '../types';

/**
 * Единая авторизация записывает сессию в те же ключи localStorage, которые
 * читают axios-интерцептор и контексты ролей. Проверяем, что для каждой роли
 * пишется свой набор ключей и что чужие токены при этом удаляются.
 */
describe('applyUnifiedSession', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const tenant = { id: 't1', name: 'Бокс', subdomain: 'boks' };

  it('сотрудник школы → /dashboard и ключи token/user/tenant', () => {
    const session: UnifiedSession = {
      requiresSelection: false,
      accountType: 'TENANT_USER',
      token: 'tok-tenant',
      tenant,
      user: {
        id: 'u1',
        email: 'a@b.ru',
        firstName: 'Иван',
        lastName: 'Иванов',
        role: 'OWNER',
        tenantId: 't1',
      },
    };

    expect(applyUnifiedSession(session)).toBe('/dashboard');
    expect(localStorage.getItem('token')).toBe('tok-tenant');
    expect(JSON.parse(localStorage.getItem('tenant') as string).name).toBe('Бокс');
    expect(localStorage.getItem('clientToken')).toBeNull();
  });

  it('ученик → /client/dashboard и userType=client', () => {
    const session: UnifiedSession = {
      requiresSelection: false,
      accountType: 'CLIENT',
      token: 'tok-client',
      tenant,
      client: { id: 'c1' },
      isAccountApproved: false,
    };

    expect(applyUnifiedSession(session)).toBe('/client/dashboard');
    expect(localStorage.getItem('clientToken')).toBe('tok-client');
    expect(localStorage.getItem('userType')).toBe('client');
    // Флаг подтверждения нужен глобальной кнопке поддержки.
    expect(localStorage.getItem('clientApproved')).toBe('false');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('подтверждённый ученик получает clientApproved=true', () => {
    applyUnifiedSession({
      requiresSelection: false,
      accountType: 'CLIENT',
      token: 'tok',
      tenant,
      client: { id: 'c1' },
      isAccountApproved: true,
    });
    expect(localStorage.getItem('clientApproved')).toBe('true');
  });

  it('родитель → /client/dashboard и userType=parent', () => {
    const session: UnifiedSession = {
      requiresSelection: false,
      accountType: 'PARENT',
      token: 'tok-parent',
      tenant,
      parent: { id: 'p1', fullName: 'Иванова Мария' },
    };

    expect(applyUnifiedSession(session)).toBe('/client/dashboard');
    expect(localStorage.getItem('userType')).toBe('parent');
    expect(JSON.parse(localStorage.getItem('client') as string).fullName).toBe('Иванова Мария');
  });

  it('супер-админ → /admin/dashboard', () => {
    expect(
      applyUnifiedSession({
        requiresSelection: false,
        accountType: 'SUPER_ADMIN',
        token: 'tok-sa',
        superAdmin: { id: 's1' },
      })
    ).toBe('/admin/dashboard');
    expect(localStorage.getItem('superAdminToken')).toBe('tok-sa');
  });

  it('персонал платформы с mustChangePassword → смена пароля', () => {
    expect(
      applyUnifiedSession({
        requiresSelection: false,
        accountType: 'PLATFORM_STAFF',
        token: 'tok-ps',
        staff: {
          id: 'ps1',
          email: 'p@s.ru',
          firstName: 'A',
          lastName: 'B',
          role: 'SUPPORT',
          mustChangePassword: true,
        },
      })
    ).toBe('/platform-staff/change-password');
  });

  it('маркетолог и админ промокодов ведут в свои панели', () => {
    expect(
      applyUnifiedSession({
        requiresSelection: false,
        accountType: 'MARKETER',
        token: 'tok-m',
        tenant,
        marketer: { id: 'm1' },
      })
    ).toBe('/marketer/panel');

    expect(
      applyUnifiedSession({
        requiresSelection: false,
        accountType: 'PROMO_CODE_ADMIN',
        token: 'tok-pa',
        tenant,
        admin: { id: 'pa1' },
      })
    ).toBe('/admin/promo-codes');
    // Предыдущий токен маркетолога должен быть вычищен.
    expect(localStorage.getItem('marketerToken')).toBeNull();
  });

  it('запись новой сессии удаляет токены других ролей', () => {
    localStorage.setItem('superAdminToken', 'stale');
    localStorage.setItem('marketerToken', 'stale');

    applyUnifiedSession({
      requiresSelection: false,
      accountType: 'CLIENT',
      token: 'fresh',
      tenant,
      client: { id: 'c2' },
    });

    expect(localStorage.getItem('superAdminToken')).toBeNull();
    expect(localStorage.getItem('marketerToken')).toBeNull();
    expect(localStorage.getItem('clientToken')).toBe('fresh');
  });
});

describe('hasAnySession / currentSessionDestination', () => {
  beforeEach(() => localStorage.clear());

  it('без токенов — сессии нет', () => {
    expect(hasAnySession()).toBe(false);
    expect(currentSessionDestination()).toBeNull();
  });

  it('приоритет у токена сотрудника школы', () => {
    localStorage.setItem('clientToken', 'c');
    localStorage.setItem('token', 't');
    expect(hasAnySession()).toBe(true);
    expect(currentSessionDestination()).toBe('/dashboard');
  });

  it('клиентский токен ведёт в кабинет клиента', () => {
    localStorage.setItem('clientToken', 'c');
    expect(currentSessionDestination()).toBe('/client/dashboard');
  });
});

describe('clearAllAuthStorage', () => {
  it('убирает все ключи всех ролей', () => {
    ['token', 'clientToken', 'marketerToken', 'promoCodeAdminToken', 'superAdminToken', 'platformStaffToken'].forEach(
      (k) => localStorage.setItem(k, 'x')
    );
    localStorage.setItem('clientApproved', 'true');
    sessionStorage.setItem('loginFieldErrors', '{}');

    clearAllAuthStorage();

    expect(hasAnySession()).toBe(false);
    expect(localStorage.getItem('clientApproved')).toBeNull();
    expect(sessionStorage.getItem('loginFieldErrors')).toBeNull();
  });
});

describe('extractApiError', () => {
  it('берёт поле и сообщение из массива ошибок валидации', () => {
    const result = extractApiError({
      response: {
        status: 400,
        data: { error: 'Validation failed', data: [{ field: 'password', message: 'Минимум 6 символов' }] },
      },
    });
    expect(result).toEqual({ message: 'Минимум 6 символов', field: 'password', status: 400 });
  });

  it('берёт error из тела ответа', () => {
    const result = extractApiError({ response: { status: 401, data: { error: 'Неверный пароль' } } });
    expect(result.message).toBe('Неверный пароль');
    expect(result.status).toBe(401);
  });

  it('использовать fallback, если ответа нет', () => {
    expect(extractApiError({}, 'Что-то сломалось').message).toBe('Что-то сломалось');
  });
});
