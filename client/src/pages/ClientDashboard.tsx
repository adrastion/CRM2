import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { HourglassEmpty, SportsMartialArtsOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { ClientDashboardData, ClientDashboardEvent } from '../types';
import { clearAllAuthStorage, extractApiError, CLIENT_APPROVED_KEY } from '../utils/authSession';
import AthleteCard from '../components/athlete/AthleteCard';
import ClientCalendarPlan from '../components/client/ClientCalendarPlan';
import ClientPaymentsPanel from '../components/client/ClientPaymentsPanel';
import DashboardShell, { ShellNavItem } from '../components/dashboard/DashboardShell';
import Panel from '../components/dashboard/Panel';
import MetricCard from '../components/dashboard/MetricCard';
import MonthCalendar, { toIso } from '../components/dashboard/MonthCalendar';
import ScheduleList, { ScheduleRow } from '../components/dashboard/ScheduleList';
import StaffCardList from '../components/dashboard/StaffCardList';
import AthleteSwitcher from '../components/dashboard/AthleteSwitcher';
import DesignIcon from '../components/common/DesignIcon';
import { NavIconName } from '../assets/icons/registry';
import { colors, radii, typography } from '../theme/tokens';

/** Пункты меню личного кабинета клиента. */
const NAV: Array<{ key: string; label: string; iconName: NavIconName }> = [
  { key: 'dashboard', label: 'Панель управления', iconName: 'dashboard' },
  { key: 'card', label: 'Карточка спортсмена', iconName: 'clients' },
  { key: 'plan', label: 'Календарный план', iconName: 'schedule' },
  { key: 'payments', label: 'Платежи', iconName: 'tariffs' },
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
    icon: <SportsMartialArtsOutlined sx={{ color: colors.primary, fontSize: 22 }} />,
    color: event.color,
  };
}

async function loadDashboard(clientId?: string): Promise<ClientDashboardData> {
  const result = await apiService.getClientDashboard(clientId);
  localStorage.setItem(CLIENT_APPROVED_KEY, String(result.isAccountApproved));
  return result;
}

/**
 * Личный кабинет ученика или родителя по макету Figma 180-2 / 215-637.
 */
const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = React.useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [month, setMonth] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [switchClientId, setSwitchClientId] = React.useState<string | undefined>();
  const [activeKey, setActiveKey] = React.useState('dashboard');

  React.useEffect(() => {
    if (!localStorage.getItem('clientToken')) {
      navigate('/auth', { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await loadDashboard(switchClientId);
        if (cancelled) return;
        setData(result);
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
  }, [navigate, switchClientId]);

  const handleLogout = () => {
    clearAllAuthStorage();
    navigate('/auth', { replace: true });
  };

  const handleAthleteChange = (id: string) => {
    setSelectedDay(null);
    setSwitchClientId(id);
  };

  if (loading && !data) {
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
  const linkedAthletes = data.linkedAthletes || [];
  const currentAthleteId = data.activeClientId || switchClientId || linkedAthletes[0]?.id || '';

  const navItems: ShellNavItem[] = NAV.map((item) => ({
    key: item.key,
    label: item.label,
    icon: <DesignIcon category="nav" name={item.iconName} size={34} />,
    iconName: item.iconName,
    disabled: pending,
    onClick: pending
      ? undefined
      : ['dashboard', 'card', 'plan', 'payments'].includes(item.key)
        ? () => setActiveKey(item.key)
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

  const athleteSwitcher =
    linkedAthletes.length > 1 ? (
      <AthleteSwitcher
        athletes={linkedAthletes}
        activeId={currentAthleteId}
        disabled={pending}
        onChange={handleAthleteChange}
      />
    ) : null;

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
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
          icon={<DesignIcon category="metric" name="balance" size={81} />}
          designIcon
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
          icon={<DesignIcon category="metric" name="attendance" size={81} />}
          designIcon
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

  const pageTitle =
    activeKey === 'card'
      ? 'Карточка спортсмена'
      : activeKey === 'plan'
        ? 'Календарный план'
        : activeKey === 'payments'
          ? 'Платежи'
          : 'Панель управления';

  const cardContent = (
    <AthleteCard mode="client" clientId={currentAthleteId || undefined} />
  );

  const planContent = <ClientCalendarPlan clientId={currentAthleteId || undefined} />;
  const paymentsContent = <ClientPaymentsPanel clientId={currentAthleteId || undefined} />;

  const mainContent =
    activeKey === 'card'
      ? cardContent
      : activeKey === 'plan'
        ? planContent
        : activeKey === 'payments'
          ? paymentsContent
          : content;

  return (
    <DashboardShell
      pageTitle={pageTitle}
      pageAction={athleteSwitcher}
      navItems={navItems}
      activeKey={activeKey}
      userName={data.viewerName}
      userRole={data.userType === 'parent' ? 'Родитель' : 'Ученик'}
      onLogout={handleLogout}
      searchDisabled={pending}
    >
      {pending ? (
        <Box sx={{ position: 'relative' }}>
          <Box
            aria-hidden
            sx={{
              pointerEvents: 'none',
              filter: 'grayscale(0.35)',
            }}
          >
            {mainContent}
          </Box>

          <Box
            role="status"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
              bgcolor: `${colors.overlay}D9`,
              borderRadius: `${radii.panel}px`,
              pointerEvents: 'auto',
            }}
          >
            <HourglassEmpty sx={{ fontSize: 48, color: colors.primary, mb: 1 }} />
            <Typography sx={{ fontSize: typography.panelTitle, fontWeight: 700, textAlign: 'center' }}>
              Аккаунт ожидает подтверждения школой
            </Typography>
            <Typography sx={{ fontSize: typography.label, color: colors.textMuted, textAlign: 'center', mt: 1, maxWidth: 420 }}>
              После одобрения администратором откроется полный доступ к карточке и расписанию.
            </Typography>
          </Box>
        </Box>
      ) : (
        mainContent
      )}
    </DashboardShell>
  );
};

export default ClientDashboard;
