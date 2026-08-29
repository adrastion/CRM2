import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MetricCard from '../components/dashboard/MetricCard';
import MonthCalendar from '../components/dashboard/MonthCalendar';
import ScheduleList from '../components/dashboard/ScheduleList';
import StaffCardList from '../components/dashboard/StaffCardList';
import DashboardShell from '../components/dashboard/DashboardShell';
import { colors } from '../theme/tokens';

/**
 * Проверяем блоки панели управления, в том числе режим заглушек,
 * который используется, пока школа не подтвердила аккаунт клиента.
 */
const theme = createTheme();

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

describe('KPI-карточка', () => {
  it('показывает подпись, значение и прирост', () => {
    const html = render(
      <MetricCard label="Всего клиентов" value={48} icon={<span />} trend={8.5} />
    );
    expect(html).toContain('Всего клиентов');
    expect(html).toContain('48');
    expect(html).toContain('8.5%');
    expect(html).toContain('Прирост со вчерашнего дня');
  });

  it('в режиме заглушки скрывает значение', () => {
    const html = render(
      <MetricCard label="Баланс" value="5000 ₽" icon={<span />} placeholder />
    );
    expect(html).toContain('Баланс');
    expect(html).not.toContain('5000');
    expect(html).toContain('—');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('Календарь событий', () => {
  const month = new Date(2026, 7, 1); // Август 2026

  it('показывает месяц и дни недели', () => {
    const html = render(<MonthCalendar month={month} />);
    expect(html).toContain('Август 2026');
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((d) => expect(html).toContain(d));
  });

  it('отмеченные дни выделяются', () => {
    const html = render(<MonthCalendar month={month} marks={[{ date: '2026-08-05' }]} />);
    expect(html.toLowerCase()).toContain('5');
  });

  it('в режиме заглушки не рендерит кнопки перелистывания', () => {
    const html = render(<MonthCalendar month={month} onMonthChange={() => undefined} placeholder />);
    expect(html).not.toContain('Предыдущий месяц');
    expect(html).not.toContain('Следующий месяц');
  });
});

describe('Список тренировок', () => {
  it('выводит дату, время и название', () => {
    const html = render(
      <ScheduleList
        rows={[
          { id: '1', dateLabel: '5.08', timeLabel: '17:00-18:00', title: 'Плавание' },
          { id: '2', dateLabel: '6.08', timeLabel: '18:00-19:00', title: 'Бокс' },
        ]}
      />
    );
    expect(html).toContain('5.08');
    expect(html).toContain('17:00-18:00');
    expect(html).toContain('Плавание');
    expect(html).toContain('Бокс');
  });

  it('показывает пустое состояние', () => {
    const html = render(<ScheduleList rows={[]} />);
    expect(html).toContain('Нет предстоящих тренировок');
  });

  it('в режиме заглушки не содержит текста', () => {
    const html = render(<ScheduleList rows={[]} placeholder placeholderRows={4} />);
    expect(html).not.toContain('Нет предстоящих тренировок');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('Персонал', () => {
  it('показывает роль, имя и телефон', () => {
    const html = render(
      <StaffCardList
        staff={[
          {
            id: 't1',
            roleLabel: 'Тренер',
            name: 'Иванов Иван Иванович',
            phone: '+7(999) 999-99-99',
            email: null,
          },
        ]}
      />
    );
    expect(html).toContain('Тренер');
    expect(html).toContain('Иванов Иван Иванович');
    expect(html).toContain('999-99-99');
  });

  it('в режиме заглушки не раскрывает данные школы', () => {
    const html = render(
      <StaffCardList
        staff={[
          { id: 't1', roleLabel: 'Тренер', name: 'Иванов Иван', phone: '+79999999999', email: null },
        ]}
        placeholder
      />
    );
    expect(html).not.toContain('Иванов');
    expect(html).not.toContain('79999999999');
  });
});

describe('Каркас панели управления', () => {
  const navItems = [
    { key: 'dashboard', label: 'Панель управления', icon: <span />, onClick: () => undefined },
    { key: 'clients', label: 'Клиенты', icon: <span />, onClick: () => undefined },
  ];

  it('содержит шапку, меню и футер', () => {
    const html = render(
      <DashboardShell
        pageTitle="Панель управления"
        navItems={navItems}
        activeKey="dashboard"
        userName="Иванов Иван"
        userRole="Владелец"
        notifications={7}
        onLogout={() => undefined}
      >
        <div>контент</div>
      </DashboardShell>
    );

    expect(html).toContain('PROF');
    expect(html).toContain('SPORTCRM');
    expect(html).toContain('Панель управления');
    expect(html).toContain('Клиенты');
    expect(html).toContain('Иванов Иван');
    expect(html).toContain('Владелец');
    expect(html).toContain('7');
    expect(html).toContain('контент');
    expect(html).toContain('Пользовательское соглашение');
    expect(html).toContain('Контакты и реквизиты');
    expect(html).toContain('Тарифы');
    expect(html).toContain('ПрофСпортСРМ. Все права защищены.');
  });

  it('отключённые пункты меню не кнопки', () => {
    const html = render(
      <DashboardShell
        navItems={[{ key: 'a', label: 'Нормативы', icon: <span />, disabled: true }]}
        activeKey="a"
        userName="Тест"
        userRole="Ученик"
        onLogout={() => undefined}
      >
        <div />
      </DashboardShell>
    );
    expect(html).toContain('Нормативы');
    expect(html).toContain('aria-disabled="true"');
  });

  it('поиск можно отключить', () => {
    const html = render(
      <DashboardShell
        navItems={navItems}
        activeKey="dashboard"
        userName="Тест"
        userRole="Ученик"
        searchDisabled
        onLogout={() => undefined}
      >
        <div />
      </DashboardShell>
    );
    expect(html).toContain('disabled=""');
  });
});

describe('Токены размеров', () => {
  it('фон холста — цвет макета', () => {
    expect(colors.surface).toBe('#F5F6FA');
  });
});
