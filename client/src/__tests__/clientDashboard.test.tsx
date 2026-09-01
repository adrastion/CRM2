import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ClientDashboard from '../pages/ClientDashboard';
import { apiService } from '../services/api';
import { ClientDashboardData } from '../types';

/**
 * Личный кабинет клиента: проверяем оба состояния — подтверждённое
 * и режим ожидания подтверждения с некликабельными заглушками.
 */
jest.mock('../services/api', () => ({
  apiService: { getClientDashboard: jest.fn() },
}));

const mocked = apiService as jest.Mocked<typeof apiService>;
const theme = createTheme();

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('clientToken', 'tok');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount() {
  await act(async () => {
    root.render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ClientDashboard />
        </MemoryRouter>
      </ThemeProvider>
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const approved: ClientDashboardData = {
  isAccountApproved: true,
  userType: 'client',
  viewerName: 'Иванов Иван',
  parent: null,
  tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
  client: {
    id: 'c1',
    firstName: 'Иван',
    lastName: 'Иванов',
    membershipFeePaid: true,
  },
  balance: { amount: 5000, nextCharge: { date: '2026-09-12T00:00:00.000Z', amount: 5000 } },
  attendance: { present: 6, total: 7 },
  staff: [
    {
      id: 'tr1',
      roleLabel: 'Тренер',
      name: 'Петров Пётр Петрович',
      phone: '+7(999) 111-22-33',
      email: null,
    },
    {
      id: 'ad1',
      roleLabel: 'Администратор',
      name: 'Сидорова Анна',
      phone: '+7(999) 444-55-66',
      email: null,
    },
  ],
  groups: [{ id: 'g1', name: 'Плавание', color: '#4880FF', branchName: 'Центральный' }],
  weekRange: { start: '2026-08-03T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z' },
  upcomingTrainings: [
    {
      id: 'tr-1',
      title: 'Плавание',
      startTime: '2026-08-05T14:00:00.000Z',
      endTime: '2026-08-05T15:00:00.000Z',
      groupName: 'Плавание',
      color: '#4880FF',
      branchName: 'Центральный',
      hallName: null,
      trainerName: 'Петров Пётр',
    },
  ],
  monthEvents: [
    {
      id: 'tr-1',
      title: 'Плавание',
      startTime: '2026-08-05T14:00:00.000Z',
      endTime: '2026-08-05T15:00:00.000Z',
      groupName: 'Плавание',
      color: '#4880FF',
      branchName: 'Центральный',
      hallName: null,
      trainerName: 'Петров Пётр',
    },
  ],
};

const pending: ClientDashboardData = {
  isAccountApproved: false,
  userType: 'parent',
  viewerName: 'Иванова Мария',
  parent: { id: 'p1', fullName: 'Иванова Мария', phone: null, email: null },
  tenant: null,
  balance: null,
  attendance: null,
  staff: [],
  groups: [],
  upcomingTrainings: [],
  monthEvents: [],
};

describe('Подтверждённый кабинет', () => {
  beforeEach(() => mocked.getClientDashboard.mockResolvedValue(approved));

  it('показывает баланс, посещаемость и персонал', async () => {
    await mount();
    expect(container.textContent).toContain('Баланс');
    expect(container.textContent).toContain('Посещаемость');
    expect(container.textContent).toContain('6/7');
    expect(container.textContent).toContain('Персонал');
    expect(container.textContent).toContain('Петров Пётр Петрович');
    expect(container.textContent).toContain('Администратор');
  });

  it('показывает дату следующего списания', async () => {
    await mount();
    expect(container.textContent).toContain('будет списано');
  });

  it('показывает календарь и расписание недели', async () => {
    await mount();
    expect(container.textContent).toContain('Календарь событий');
    expect(container.textContent).toContain('Расписание на неделю');
    expect(container.textContent).toContain('Плавание');
  });

  it('меню активно, поиск доступен', async () => {
    await mount();
    const disabledItems = container.querySelectorAll('[aria-disabled="true"]');
    expect(disabledItems.length).toBe(0);
    const search = container.querySelector('input[aria-label="Поиск"]') as HTMLInputElement;
    expect(search.disabled).toBe(false);
  });

  it('роль в шапке — Ученик', async () => {
    await mount();
    expect(container.textContent).toContain('Ученик');
    expect(container.textContent).toContain('Иванов Иван');
  });

  it('кнопка техподдержки становится доступной', async () => {
    await mount();
    // Глобальный SupportFAB читает флаг подтверждения из localStorage.
    expect(localStorage.getItem('clientApproved')).toBe('true');
  });

  it('показывает переключатель спортсменов при нескольких детях', async () => {
    mocked.getClientDashboard.mockResolvedValue({
      ...approved,
      linkedAthletes: [
        { id: 'c1', firstName: 'Мася', lastName: 'Иванов' },
        { id: 'c2', firstName: 'Вася', lastName: 'Иванов' },
      ],
      activeClientId: 'c1',
    });
    await mount();
    expect(container.textContent).toContain('Мася');
    expect(container.textContent).toContain('Вася');
  });
});

describe('Кабинет в ожидании подтверждения', () => {
  beforeEach(() => mocked.getClientDashboard.mockResolvedValue(pending));

  it('показывает сообщение об ожидании', async () => {
    await mount();
    expect(container.textContent).toContain('Ожидайте подтверждения от администратора организации');
  });

  it('не показывает данные школы', async () => {
    await mount();
    expect(container.textContent).not.toContain('Бокс');
    expect(container.textContent).not.toContain('Петров');
    expect(container.textContent).not.toContain('5000');
    expect(container.textContent).not.toContain('6/7');
  });

  it('заглушки некликабельны', async () => {
    await mount();
    // Меню отключено.
    const disabled = container.querySelectorAll('[aria-disabled="true"]');
    expect(disabled.length).toBeGreaterThan(0);
    // Кнопок внутри меню нет.
    const navButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Нормативы')
    );
    expect(navButtons.length).toBe(0);
    // Контент помечен как декоративный и не принимает события.
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
  });

  it('поиск отключён', async () => {
    await mount();
    const search = container.querySelector('input[aria-label="Поиск"]') as HTMLInputElement;
    expect(search.disabled).toBe(true);
  });

  it('роль в шапке — Родитель', async () => {
    await mount();
    expect(container.textContent).toContain('Родитель');
    expect(container.textContent).toContain('Иванова Мария');
  });

  it('техподдержка недоступна до подтверждения', async () => {
    await mount();
    expect(localStorage.getItem('clientApproved')).toBe('false');
  });
});

describe('Ошибки загрузки', () => {
  it('401 очищает сессию', async () => {
    mocked.getClientDashboard.mockRejectedValue({ response: { status: 401, data: {} } });
    await mount();
    expect(localStorage.getItem('clientToken')).toBeNull();
  });

  it('прочие ошибки показываются пользователю', async () => {
    mocked.getClientDashboard.mockRejectedValue({
      response: { status: 500, data: { error: 'Сервис недоступен' } },
    });
    await mount();
    expect(container.textContent).toContain('Сервис недоступен');
  });
});
