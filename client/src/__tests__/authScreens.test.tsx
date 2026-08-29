import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Auth from '../pages/Auth';
import PartnerRegister from '../pages/PartnerRegister';
import AccountSelect from '../components/auth/AccountSelect';
import { PublicAccount } from '../types';
import { colors } from '../theme/tokens';

/**
 * Smoke-тесты новых экранов авторизации: проверяем, что разметка собирается
 * и содержит ключевые элементы макета. Рендер серверный, поэтому эффекты
 * и сетевые запросы не выполняются.
 */
const theme = createTheme();

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{node}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('Экран /auth (шаг 1)', () => {
  const html = render(<Auth />);

  it('показывает заголовок из макета', () => {
    expect(html).toContain('Вход в личный кабинет');
  });

  it('содержит поля телефона и email с разделителем «или»', () => {
    expect(html).toContain('placeholder="Телефон"');
    expect(html).toContain('placeholder="Email"');
    expect(html).toContain('или');
  });

  it('содержит обе кнопки: «Войти» и «Стать партнером»', () => {
    expect(html).toContain('Войти');
    expect(html).toContain('Стать партнером');
  });

  it('предупреждает, что контакт должен быть в базе школы', () => {
    expect(html).toContain('в базе спортивной школы');
  });

  it('ссылается на пользовательское соглашение', () => {
    expect(html).toContain('Пользовательское соглашение');
  });
});

describe('Дизайн-токены соответствуют макету', () => {
  it('палитра взята из PDF-макетов', () => {
    expect(colors.primary).toBe('#4880FF');
    expect(colors.primaryDark).toBe('#0D4BD7');
    expect(colors.primarySoft).toBe('#BFD3FF');
    expect(colors.surface).toBe('#F5F6FA');
    expect(colors.text).toBe('#202224');
    expect(colors.textMuted).toBe('#404040');
    expect(colors.danger).toBe('#F93C65');
    expect(colors.success).toBe('#00B69B');
    expect(colors.divider).toBe('#D9D9D9');
  });
});

describe('Экран регистрации партнёра', () => {
  const html = render(<PartnerRegister />);

  it('показывает заголовок и секции макета', () => {
    expect(html).toContain('Создайте свою спортивную школу');
    expect(html).toContain('Информация о школе');
    expect(html).toContain('Информация о владельце');
  });

  it('содержит все поля владельца', () => {
    ['Название школы *', 'Имя *', 'Фамилия *', 'Email *', 'Телефон', 'Придумайте пароль *', 'Подтвердите пароль *'].forEach(
      (label) => expect(html).toContain(label)
    );
  });

  it('содержит подсказки из макета', () => {
    expect(html).toContain('Будет использован для входа в систему');
    expect(html).toContain('Минимум 6 символов');
  });

  it('содержит согласие и кнопку', () => {
    expect(html).toContain('Принимаю условия клиентского соглашения');
    expect(html).toContain('Создать аккаунт');
  });
});

describe('Выбор аккаунта', () => {
  const clientAccount: PublicAccount = {
    accountType: 'CLIENT',
    id: 'c1',
    displayName: 'Иванов Иван',
    tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
    isAccountApproved: true,
  };
  const parentAccount: PublicAccount = {
    accountType: 'PARENT',
    id: 'p1',
    displayName: 'Иванова Мария',
    tenant: { id: 't2', name: 'Плавание', subdomain: 'plav' },
    isAccountApproved: false,
    childName: 'Иванов Иван',
  };
  const staffAccount: PublicAccount = {
    accountType: 'TENANT_USER',
    id: 'u1',
    displayName: 'Петров Пётр',
    role: 'ADMIN',
    tenant: { id: 't1', name: 'Бокс', subdomain: 'boks' },
    isAccountApproved: true,
  };

  it('только клиентские аккаунты — одна колонка', () => {
    const html = render(
      <AccountSelect
        clientAccounts={[clientAccount, parentAccount]}
        staffAccounts={[]}
        onSubmit={() => undefined}
        onBack={() => undefined}
      />
    );
    expect(html).toContain('В аккаунт какой организации вы хотите войти?');
    expect(html).not.toContain('Войти в аккаунт как Сотрудник');
    expect(html).toContain('Бокс');
  });

  it('только аккаунты сотрудника — одна колонка', () => {
    const html = render(
      <AccountSelect
        clientAccounts={[]}
        staffAccounts={[staffAccount]}
        onSubmit={() => undefined}
        onBack={() => undefined}
      />
    );
    expect(html).toContain('В аккаунт какой организации вы хотите войти?');
    expect(html).toContain('Администратор');
  });

  it('смешанный случай — две колонки', () => {
    const html = render(
      <AccountSelect
        clientAccounts={[clientAccount]}
        staffAccounts={[staffAccount]}
        onSubmit={() => undefined}
        onBack={() => undefined}
      />
    );
    expect(html).toContain('Войти в аккаунт как клиент');
    expect(html).toContain('Войти в аккаунт как Сотрудник');
  });

  it('для родителя показывает ФИО ребёнка и статус подтверждения', () => {
    const html = render(
      <AccountSelect
        clientAccounts={[parentAccount]}
        staffAccounts={[]}
        onSubmit={() => undefined}
        onBack={() => undefined}
      />
    );
    expect(html).toContain('Родитель');
    expect(html).toContain('Иванов Иван');
    expect(html).toContain('Ожидает подтверждения');
  });
});
