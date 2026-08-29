import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import {
  DashboardOutlined,
  BadgeOutlined,
  AssignmentOutlined,
  GroupsOutlined,
  PeopleAltOutlined,
  CalendarMonthOutlined,
  PaymentsOutlined,
  HelpOutline,
  MenuBookOutlined,
  AccountBalanceWalletOutlined,
  FactCheckOutlined,
  SportsMartialArtsOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { ClientDashboardData, ClientDashboardEvent } from '../types';
import { clearAllAuthStorage, extractApiError, CLIENT_APPROVED_KEY } from '../utils/authSession';
import DashboardShell, { ShellNavItem } from '../components/dashboard/DashboardShell';
import Panel from '../components/dashboard/Panel';
import MetricCard from '../components/dashboard/MetricCard';
import MonthCalendar, { toIso } from '../components/dashboard/MonthCalendar';
import ScheduleList, { ScheduleRow } from '../components/dashboard/ScheduleList';
import StaffCardList from '../components/dashboard/StaffCardList';
import { colors, radii, typography } from '../theme/tokens';

/** Пункты меню личного кабинета клиента (по макету). */
const NAV: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Панель управления', icon: <DashboardOutlined /> },
  { key: 'card', label: 'Карточка спортсмена', icon: <BadgeOutlined /> },
  { key: 'standards', label: 'Нормативы', icon: <AssignmentOutlined /> },
  { key: 'staff', label: 'Персонал', icon: <PeopleAltOutlined /> },
  { key: 'groups', label: 'Группы', icon: <GroupsOutlined /> },
  { key: 'plan', label: 'Календарный план', icon: <CalendarMonthOutlined /> },
  { key: 'payments', label: 'Платежи', icon: <PaymentsOutlined /> },
  { key: 'faq', label: 'FAQ', icon: <HelpOutline /> },
  { key: 'knowledge', label: 'База знаний для клиентов', icon: <MenuBookOutlined /> },
];

const RUB = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toScheduleRow(event: ClientDashboardEvent): ScheduleRow {
  const start = new Date(event.startTime);
  return {
    id: event.id,
    dateLabel: `${start.getDate()}.${String(start.getMonth() + 1).padStart(2, '0')}`,
    timeLabel: `${timeLabel(event.startTime)}-${timeLabel(event.endTime)}`,
    title: event.groupName || event.title,
    icon: <SportsMartialArtsOutlined />,
    color: event.color,
  };
}

/**
 * Личный кабинет ученика или родителя.
 *
 * Два состояния:
 * — аккаунт подтверждён школой: реальные данные (баланс, посещаемость, персонал,
 *   календарь событий и расписание недели);
 * — не подтверждён: те же блоки, но некликабельные заглушки без данных школы
 *   и сообщение «Ожидайте подтверждения от администратора организации».
 */
const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = React.useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [month, setMonth] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!localStorage.getItem('clientToken')) {
      navigate('/auth', { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await apiService.getClientDashboard();
        if (cancelled) return;
        setData(result);
        // Сохраняем статус, чтобы глобальная кнопка поддержки знала о нём.
        localStorage.setItem(CLIENT_APPROVED_KEY, String(result.isAccountApproved));
      } catch (err) {
        if (cancelled) return;
        const { status, message } = extractApiError(err, 'Не удалось загрузить данные');
        if (status === 401) {
          clearAllAuthStorage();
          navigate('/auth', { replace: true });
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogout = () => {
    clearAllAuthStorage();
    navigate('/auth', { replace: true });
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: colors.surface,
        }}
      >
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          bgcolor: colors.surface,
          px: 3,
          textAlign: 'center',
        }}
      >
        <Typography sx={{ color: colors.danger, fontSize: typography.panelTitle }}>
          {error || 'Данные недоступны'}
        </Typography>
        <Typography
          component="button"
          type="button"
          onClick={handleLogout}
          sx={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: colors.primary,
            fontFamily: 'inherit',
            fontSize: typography.label,
          }}
        >
          Вернуться к входу
        </Typography>
      </Box>
    );
  }

  const pending = !data.isAccountApproved;

  const navItems: ShellNavItem[] = NAV.map((item) => ({
    ...item,
    // До подтверждения меню — некликабельные заглушки.
    disabled: pending,
    onClick: pending
      ? undefined
      : item.key === 'faq'
      ? () => navigate('/faq')
      : undefined,
  }));

  const marks = data.monthEvents.map((e) => ({
    date: toIso(new Date(e.startTime)),
    color: e.color,
  }));

  const weekRows = data.upcomingTrainings.map(toScheduleRow);
  const dayRows = selectedDay
    ? data.monthEvents.filter((e) => toIso(new Date(e.startTime)) === selectedDay).map(toScheduleRow)
    : weekRows;

  const attendanceValue = data.attendance
    ? `${data.attendance.present}/${data.attendance.total}`
    : '—';

  const balanceCaption =
    data.balance?.nextCharge && !pending
      ? `${new Date(data.balance.nextCharge.date).toLocaleDateString('ru-RU')} будет списано ${RUB.format(
          data.balance.nextCharge.amount
        )}`
      : undefined;

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
      {/* Верхний ряд: баланс, посещаемость, персонал */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 2fr' },
          gap: { xs: 2, md: 3 },
        }}
      >
        <MetricCard
          label="Баланс"
          value={data.balance ? RUB.format(data.balance.amount) : '—'}
          icon={<AccountBalanceWalletOutlined />}
          progress={
            data.balance
              ? {
                  value: Math.max(0, data.balance.amount),
                  max: Math.max(1, data.balance.nextCharge?.amount || data.balance.amount || 1),
                  danger: data.balance.amount < 0,
                }
              : { value: 0, max: 1 }
          }
          caption={balanceCaption}
          placeholder={pending}
        />
        <MetricCard
          label="Посещаемость"
          value={attendanceValue}
          icon={<FactCheckOutlined />}
          progress={
            data.attendance
              ? { value: data.attendance.present, max: Math.max(1, data.attendance.total) }
              : { value: 0, max: 1 }
          }
          placeholder={pending}
        />
        <Panel title="Персонал">
          <StaffCardList staff={data.staff} placeholder={pending} />
        </Panel>
      </Box>

      {/* Нижний ряд: календарь событий и расписание */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: { xs: 2, md: 3 },
        }}
      >
        <Panel title="Календарь событий" minHeight={420}>
          <MonthCalendar
            month={month}
            onMonthChange={pending ? undefined : setMonth}
            marks={marks}
            selected={selectedDay}
            onSelect={pending ? undefined : (iso) => setSelectedDay(iso === selectedDay ? null : iso)}
            placeholder={pending}
          />
        </Panel>

        <Panel
          title={selectedDay ? 'Тренировки за день' : 'Расписание на неделю'}
          minHeight={420}
          action={
            !pending && selectedDay ? (
              <Typography
                component="button"
                type="button"
                onClick={() => setSelectedDay(null)}
                sx={{
                  border: 'none',
                  background: colors.surface,
                  borderRadius: `${radii.cell}px`,
                  px: 1.5,
                  py: 0.75,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: typography.hint,
                  color: colors.textMuted,
                }}
              >
                Показать неделю
              </Typography>
            ) : undefined
          }
        >
          <ScheduleList
            rows={dayRows}
            placeholder={pending}
            emptyText={selectedDay ? 'В этот день тренировок нет' : 'Нет предстоящих тренировок'}
          />
        </Panel>
      </Box>
    </Box>
  );

  return (
    <DashboardShell
      pageTitle="Панель управления"
      navItems={navItems}
      activeKey="dashboard"
      userName={data.viewerName}
      userRole={data.userType === 'parent' ? 'Родитель' : 'Ученик'}
      onLogout={handleLogout}
      searchDisabled={pending}
    >
      {pending ? (
        <Box sx={{ position: 'relative' }}>
          {/* Заглушки под затемнением: данных школы нет, клики не работают */}
          <Box
            aria-hidden
            sx={{
              pointerEvents: 'none',
              filter: 'grayscale(0.35)',
            }}
          >
            {content}
          </Box>

          <Box
            role="status"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              bgcolor: `${colors.overlay}D9`,
              borderRadius: `${radii.panel}px`,
            }}
          >
            <Box
              sx={{
                maxWidth: 900,
                bgcolor: colors.textMuted,
                color: colors.white,
                borderRadius: `${radii.card}px`,
                px: { xs: 3, md: 6 },
                py: { xs: 4, md: 6 },
                textAlign: 'center',
              }}
            >
              <Typography
                sx={{
                  fontSize: typography.sectionTitle,
                  fontWeight: 600,
                  lineHeight: 1.25,
                }}
              >
                Ожидайте подтверждения от администратора организации
              </Typography>
              <Typography sx={{ mt: 2, fontSize: typography.label, opacity: 0.85 }}>
                Как только школа подтвердит ваш аккаунт, здесь появятся баланс, посещаемость,
                расписание и контакты тренеров.
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : (
        content
      )}
    </DashboardShell>
  );
};

export default ClientDashboard;
