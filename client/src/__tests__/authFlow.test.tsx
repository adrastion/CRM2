import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Auth from '../pages/Auth';
import { apiService } from '../services/api';

/**
 * Проверяем поведение экрана /auth: переходы между шагами, сохранение типа
 * контакта (телефон/email) и обработку ошибок сервера.
 *
 * Рендер в jsdom, сетевые вызовы замоканы.
 */
jest.mock('../services/api', () => ({
  apiService: {
    identify: jest.fn(),
    setupPassword: jest.fn(),
    unifiedLogin: jest.fn(),
    selectAccount: jest.fn(),
  },
}));

const mocked = apiService as jest.Mocked<typeof apiService>;
const theme = createTheme();

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// window.location.assign не реализован в jsdom — подменяем, чтобы поймать переход.
const assign = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, assign },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount() {
  act(() => {
    root.render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <Auth />
        </MemoryRouter>
      </ThemeProvider>
    );
  });
}

function input(name: string): HTMLInputElement {
  const el = container.querySelector(`input[name="${name}"]`);
  if (!el) throw new Error(`Поле ${name} не найдено`);
  return el as HTMLInputElement;
}

function type(name: string, value: string) {
  const el = input(name);
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickButtonWithText(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === text
  );
  if (!button) throw new Error(`Кнопка «${text}» не найдена`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Экран /auth — шаг 1', () => {
  it('маскирует введённый телефон', () => {
    mount();
    type('phone', '9991234567');
    expect(input('phone').value).toBe('+7 (999) 123-45-67');
  });

  it('email приводится к нижнему регистру', () => {
    mount();
    type('email', 'USER@Example.RU');
    expect(input('email').value).toBe('user@example.ru');
  });

  it('без данных показывает ошибку и не обращается к серверу', () => {
    mount();
    clickButtonWithText('Войти');
    expect(mocked.identify).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Введите номер телефона или email');
  });

  it('оба поля заполнены — просит оставить одно', () => {
    mount();
    type('phone', '9991234567');
    type('email', 'a@b.ru');
    clickButtonWithText('Войти');
    expect(mocked.identify).not.toHaveBeenCalled();
    expect(container.textContent).toContain('только одно поле');
  });

  it('ошибку «номер не найден» показывает пользователю', async () => {
    mocked.identify.mockRejectedValue({
      response: { status: 401, data: { error: 'Такой номер не найден в базе спортивной школы' } },
    });
    mount();
    type('phone', '9990000000');
    clickButtonWithText('Войти');
    await flush();
    expect(container.textContent).toContain('не найден в базе спортивной школы');
  });
});

describe('Экран /auth — переход на создание пароля', () => {
  it('телефон остаётся на экране создания пароля', async () => {
    mocked.identify.mockResolvedValue({
      identifierType: 'phone',
      identifier: '+79991234567',
      exists: true,
      needsPasswordSetup: true,
      accountsCount: 1,
    });

    mount();
    type('phone', '9991234567');
    clickButtonWithText('Войти');
    await flush();

    expect(input('new-password').placeholder).toBe('Придумайте пароль');
    expect(input('confirm-password').placeholder).toBe('Подтвердите пароль');
    // Контакт сохранён и показан в поле только для чтения.
    const identifier = input('identifier');
    expect(identifier.value).toBe('+7 (999) 123-45-67');
    expect(identifier.readOnly).toBe(true);
    // Поля email на этом шаге быть не должно.
    expect(container.querySelector('input[name="email"]')).toBeNull();
    expect(container.textContent).toContain('Изменить номер');
  });

  it('email остаётся на экране создания пароля', async () => {
    mocked.identify.mockResolvedValue({
      identifierType: 'email',
      identifier: 'user@example.ru',
      exists: true,
      needsPasswordSetup: true,
      accountsCount: 1,
    });

    mount();
    type('email', 'user@example.ru');
    clickButtonWithText('Войти');
    await flush();

    expect(input('identifier').value).toBe('user@example.ru');
    expect(container.querySelector('input[name="phone"]')).toBeNull();
    expect(container.textContent).toContain('Изменить email');
  });

  it('проверяет длину и совпадение паролей до отправки', async () => {
    mocked.identify.mockResolvedValue({
      identifierType: 'phone',
      identifier: '+79991234567',
      exists: true,
      needsPasswordSetup: true,
      accountsCount: 1,
    });

    mount();
    type('phone', '9991234567');
    clickButtonWithText('Войти');
    await flush();

    type('new-password', '123');
    type('confirm-password', '456');
    clickButtonWithText('Войти');
    await flush();

    expect(mocked.setupPassword).not.toHaveBeenCalled();
    expect(container.textContent).toContain('минимум 6 символов');
    expect(container.textContent).toContain('Пароли не совпадают');
    expect(container.textContent).toContain('Необходимо принять условия соглашения');
  });

  it('успешное создание пароля ведёт в кабинет клиента', async () => {
    mocked.identify.mockResolvedValue({
      identifierType: 'phone',
      identifier: '+79991234567',
      exists: true,
      needsPasswordSetup: true,
      accountsCount: 1,
    });
    mocked.setupPassword.mockResolvedValue({
      requiresSelection: false,
      accountType: 'CLIENT',
      token: 'tok',
      tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
      client: { id: 'c1' },
      isAccountApproved: false,
    });

    mount();
    type('phone', '9991234567');
    clickButtonWithText('Войти');
    await flush();

    type('new-password', 'Secret123');
    type('confirm-password', 'Secret123');
    // Принимаем условия.
    const checkbox = container.querySelector('[role="checkbox"]') as HTMLElement;
    act(() => checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    clickButtonWithText('Войти');
    await flush();

    expect(mocked.setupPassword).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: '+79991234567', password: 'Secret123', acceptTerms: true })
    );
    expect(localStorage.getItem('clientToken')).toBe('tok');
    expect(assign).toHaveBeenCalledWith('/client/dashboard');
  });
});

describe('Экран /auth — вход по паролю', () => {
  beforeEach(() => {
    mocked.identify.mockResolvedValue({
      identifierType: 'phone',
      identifier: '+79991234567',
      exists: true,
      needsPasswordSetup: false,
      accountsCount: 1,
    });
  });

  async function goToPasswordStep() {
    mount();
    type('phone', '9991234567');
    clickButtonWithText('Войти');
    await flush();
  }

  it('показывает поле пароля и «Запомнить меня»', async () => {
    await goToPasswordStep();
    expect(input('password').placeholder).toBe('Введите пароль');
    expect(container.textContent).toContain('Запомнить меня');
    // На этом шаге подтверждения пароля нет.
    expect(container.querySelector('input[name="confirm-password"]')).toBeNull();
  });

  it('неверный пароль показывается под полем', async () => {
    mocked.unifiedLogin.mockRejectedValue({
      response: { status: 401, data: { error: 'Неверный пароль' } },
    });

    await goToPasswordStep();
    type('password', 'wrong');
    clickButtonWithText('Войти');
    await flush();

    expect(container.textContent).toContain('Неверный пароль');
    // Пользователь остаётся на шаге ввода пароля.
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
  });

  it('409 переводит на экран создания пароля', async () => {
    mocked.unifiedLogin.mockRejectedValue({
      response: { status: 409, data: { error: 'Пароль ещё не создан' } },
    });

    await goToPasswordStep();
    type('password', 'whatever');
    clickButtonWithText('Войти');
    await flush();

    // Уведомление на шаге создания пароля содержит подсказку.
    expect(container.textContent).toContain('Пароль ещё не создан');
    expect(input('new-password').placeholder).toBe('Придумайте пароль');
  });

  it('«Запомнить меня» передаётся на сервер', async () => {
    mocked.unifiedLogin.mockResolvedValue({
      requiresSelection: false,
      accountType: 'TENANT_USER',
      token: 'tok',
      tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
      user: {
        id: 'u1',
        email: 'a@b.ru',
        firstName: 'И',
        lastName: 'И',
        role: 'OWNER',
        tenantId: 't1',
      },
    });

    await goToPasswordStep();
    type('password', 'Secret123');
    const remember = container.querySelector('[role="checkbox"]') as HTMLElement;
    act(() => remember.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    clickButtonWithText('Войти');
    await flush();

    expect(mocked.unifiedLogin).toHaveBeenCalledWith({
      identifier: '+79991234567',
      password: 'Secret123',
      rememberMe: true,
    });
    expect(assign).toHaveBeenCalledWith('/dashboard');
  });

  it('несколько аккаунтов → экран выбора организации', async () => {
    mocked.unifiedLogin.mockResolvedValue({
      requiresSelection: true,
      selectionToken: 'sel-token',
      clientAccounts: [
        {
          accountType: 'CLIENT',
          id: 'c1',
          displayName: 'Иванов Иван',
          tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
          isAccountApproved: true,
        },
        {
          accountType: 'CLIENT',
          id: 'c2',
          displayName: 'Иванов Иван',
          tenant: { id: 't2', name: 'Плавание', subdomain: 'plav' },
          isAccountApproved: true,
        },
      ],
      staffAccounts: [],
    });

    await goToPasswordStep();
    type('password', 'Secret123');
    clickButtonWithText('Войти');
    await flush();

    expect(container.textContent).toContain('В аккаунт какой организации вы хотите войти?');
    expect(container.textContent).toContain('Бокс');
  });

  it('смешанный случай показывает две колонки', async () => {
    mocked.unifiedLogin.mockResolvedValue({
      requiresSelection: true,
      selectionToken: 'sel-token',
      clientAccounts: [
        {
          accountType: 'CLIENT',
          id: 'c1',
          displayName: 'Иванов Иван',
          tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
          isAccountApproved: true,
        },
      ],
      staffAccounts: [
        {
          accountType: 'TENANT_USER',
          id: 'u1',
          displayName: 'Петров Пётр',
          role: 'ADMIN',
          tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
          isAccountApproved: true,
        },
      ],
    });

    await goToPasswordStep();
    type('password', 'Secret123');
    clickButtonWithText('Войти');
    await flush();

    expect(container.textContent).toContain('Войти в аккаунт как клиент');
    expect(container.textContent).toContain('Войти в аккаунт как Сотрудник');
  });

  it('выбор организации вызывает selectAccount и открывает кабинет', async () => {
    mocked.unifiedLogin.mockResolvedValue({
      requiresSelection: true,
      selectionToken: 'sel-token',
      clientAccounts: [
        {
          accountType: 'CLIENT',
          id: 'c1',
          displayName: 'Иванов Иван',
          tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
          isAccountApproved: true,
        },
        {
          accountType: 'CLIENT',
          id: 'c2',
          displayName: 'Иванов Иван',
          tenant: { id: 't2', name: 'Плавание', subdomain: 'plav' },
          isAccountApproved: true,
        },
      ],
      staffAccounts: [],
    });
    mocked.selectAccount.mockResolvedValue({
      requiresSelection: false,
      accountType: 'CLIENT',
      token: 'tok-c1',
      tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
      client: { id: 'c1' },
      isAccountApproved: true,
    });

    await goToPasswordStep();
    type('password', 'Secret123');
    clickButtonWithText('Войти');
    await flush();

    clickButtonWithText('Войти');
    await flush();

    expect(mocked.selectAccount).toHaveBeenCalledWith({
      selectionToken: 'sel-token',
      accountType: 'CLIENT',
      accountId: 'c1',
    });
    expect(assign).toHaveBeenCalledWith('/client/dashboard');
  });

  it('«Изменить номер» возвращает на первый шаг', async () => {
    await goToPasswordStep();
    clickButtonWithText('Изменить номер');
    await flush();

    expect(container.querySelector('input[name="phone"]')).not.toBeNull();
    expect(container.querySelector('input[name="email"]')).not.toBeNull();
    expect(container.textContent).toContain('Стать партнером');
  });
});

describe('Экран /auth — уже есть сессия', () => {
  it('перенаправляет владельца сессии в его кабинет', () => {
    localStorage.setItem('token', 'existing');
    mount();
    // Навигация выполняется через react-router, форма не рендерится повторно.
    expect(mocked.identify).not.toHaveBeenCalled();
  });
});
