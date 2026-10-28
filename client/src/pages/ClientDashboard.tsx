import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  BarChartOutlined,
  CalendarMonthOutlined,
  DescriptionOutlined,
  EmojiEventsOutlined,
  HourglassEmpty,
  PaymentsOutlined,
  SportsMartialArtsOutlined,
  SupportAgentOutlined,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { ClientDashboardData, ClientDashboardEvent, ClientDashboardStaffMember } from '../types';
import { extractApiError, CLIENT_APPROVED_KEY } from '../utils/authSession';
import { logoutCurrentAccount, prepareAddAccount } from '../utils/accountSwitcher';
import AthleteCard from '../components/athlete/AthleteCard';
import ClientCalendarPlan from '../components/client/ClientCalendarPlan';
import ClientPaymentsPanel from '../components/client/ClientPaymentsPanel';
import ClientDocumentsPanel from '../components/client/ClientDocumentsPanel';
import ChatWorkspace from '../components/chat/ChatWorkspace';
import ClientSettingsPanel from '../components/client/ClientSettingsPanel';
import DashboardShell, { ShellNavItem } from '../components/dashboard/DashboardShell';
import Panel from '../components/dashboard/Panel';
import MetricCard from '../components/dashboard/MetricCard';
import { toIso } from '../components/dashboard/MonthCalendar';
import { ScheduleRow } from '../components/dashboard/ScheduleList';
import WeekEventCalendar from '../components/dashboard/WeekEventCalendar';
import StaffCardList from '../components/dashboard/StaffCardList';
import AthleteSwitcher from '../components/dashboard/AthleteSwitcher';
import ClientTrainerCardDialog from '../components/client/ClientTrainerCardDialog';
import DesignIcon from '../components/common/DesignIcon';
import { NavIconName } from '../assets/icons/registry';
import { colors, radii, typography } from '../theme/tokens';
import { useChatUnreadBadge } from '../hooks/useChatUnreadBadge';
import ClientNewsPanel from '../components/client/ClientNewsPanel';
import DeveloperFeedback from '../components/DeveloperFeedback';

/** Пункты меню личного кабинета клиента. */
const NAV: Array<{ key: string; label: string; iconName: NavIconName }> = [
  { key: 'dashboard', label: 'Панель управления', iconName: 'dashboard' },
  { key: 'chats', label: 'Чаты', iconName: 'chats' },
  { key: 'card', label: 'Карточка спортсмена', iconName: 'clients' },
  { key: 'documents', label: 'Документы', iconName: 'faq' },
  { key: 'plan', label: 'Календарный план', iconName: 'schedule' },
  { key: 'payments', label: 'Платежи', iconName: 'tariffs' },
  { key: 'news', label: 'Новости', iconName: 'issued-tariffs' },
  { key: 'feedback', label: 'Связь с разработчиком', iconName: 'chats' },
  { key: 'settings', label: 'Настройки', iconName: 'settings' },
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
  const [weekAnchor] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(() => toIso(new Date()));
  const [switchClientId, setSwitchClientId] = React.useState<string | undefined>();
  const [activeKey, setActiveKey] = React.useState('dashboard');
  const [verifyCode, setVerifyCode] = React.useState('');
  const [verifySending, setVerifySending] = React.useState(false);
  const [verifyChecking, setVerifyChecking] = React.useState(false);
  const [verifyNotice, setVerifyNotice] = React.useState('');
  const [verifyError, setVerifyError] = React.useState('');
  const [emailVerifiedLocal, setEmailVerifiedLocal] = React.useState<boolean | null>(null);
  const [trainerCardId, setTrainerCardId] = React.useState<string | null>(null);
  const [openChatEnsure, setOpenChatEnsure] = React.useState<{
    type: string;
    clientId?: string;
    trainerId?: string;
  } | null>(null);
  const [changeMembershipOpen, setChangeMembershipOpen] = React.useState(false);
  const [portalCatalog, setPortalCatalog] = React.useState<any[]>([]);
  const [portalMembershipId, setPortalMembershipId] = React.useState('');
  const [changingPortalMembership, setChangingPortalMembership] = React.useState(false);
  const [portalMembershipError, setPortalMembershipError] = React.useState('');
  const clientToken = localStorage.getItem('clientToken');
  const chatUnread = useChatUnreadBadge({
    mode: 'client',
    token: clientToken,
    enabled: Boolean(clientToken),
  });

  React.useEffect(() => {
    if (!localStorage.getItem('clientToken')) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await loadDashboard(switchClientId);
        if (cancelled) return;
        setData(result);
        setEmailVerifiedLocal(null);
        setVerifyCode('');
        setVerifyNotice('');
        setVerifyError('');
      } catch (err) {
        if (cancelled) return;
        const { status, message } = extractApiError(err, 'Не удалось загрузить данные');
        if (status === 401) {
          const nextDestination = logoutCurrentAccount();
          window.location.assign(nextDestination || '/');
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

  React.useEffect(() => {
    if (!data || data.isAccountApproved) return;
    if (activeKey === 'chats' || activeKey === 'card') {
      setActiveKey('dashboard');
    }
  }, [data, activeKey]);

  const handleLogout = () => {
    const nextDestination = logoutCurrentAccount();
    window.location.assign(nextDestination || '/');
  };

  const handleAddAccount = () => {
    prepareAddAccount();
    navigate('/auth', { replace: true });
  };

  const handleAthleteChange = (id: string) => {
    setSelectedDay(null);
    setSwitchClientId(id);
  };

  const handleSendVerification = async () => {
    setVerifyError('');
    setVerifyNotice('');
    setVerifySending(true);
    try {
      const result = await apiService.sendEmailVerification();
      if (result.alreadyVerified) {
        setEmailVerifiedLocal(true);
        setVerifyNotice('Email уже подтверждён');
      } else {
        setVerifyNotice(result.message || 'Код отправлен на почту');
      }
    } catch (err) {
      setVerifyError(extractApiError(err, 'Не удалось отправить код').message);
    } finally {
      setVerifySending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      setVerifyError('Введите 6-значный код');
      return;
    }
    setVerifyError('');
    setVerifyChecking(true);
    try {
      const result = await apiService.verifyEmailCode(verifyCode.trim());
      setEmailVerifiedLocal(true);
      setVerifyCode('');
      setVerifyNotice(result.message || 'Email подтверждён');
      if (result.isAccountApproved) {
        localStorage.setItem(CLIENT_APPROVED_KEY, 'true');
      }
      const refreshed = await loadDashboard(switchClientId);
      setData(refreshed);
    } catch (err) {
      setVerifyError(extractApiError(err, 'Неверный код').message);
    } finally {
      setVerifyChecking(false);
    }
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
  const viewerEmail = data.viewerEmail || data.parent?.email || data.client?.email || null;
  const emailVerified =
    emailVerifiedLocal ?? data.emailVerified ?? data.parent?.emailVerified ?? data.client?.emailVerified ?? false;
  const showEmailVerify = Boolean(viewerEmail) && emailVerified === false;

  const navItems: ShellNavItem[] = NAV.map((item) => ({
    key: item.key,
    label: item.label,
    icon: <DesignIcon category="nav" name={item.iconName} size={34} />,
    iconName: item.iconName,
    // До подтверждения: главная, настройки, новости, связь с разработчиком.
    // Чаты и карточка спортсмена недоступны.
    disabled:
      pending &&
      item.key !== 'dashboard' &&
      item.key !== 'settings' &&
      item.key !== 'news' &&
      item.key !== 'feedback',
    onClick:
      pending &&
      item.key !== 'dashboard' &&
      item.key !== 'settings' &&
      item.key !== 'news' &&
      item.key !== 'feedback'
        ? undefined
        : [
              'dashboard',
              'card',
              'documents',
              'plan',
              'payments',
              'chats',
              'settings',
              'news',
              'feedback',
            ].includes(item.key)
          ? () => setActiveKey(item.key)
          : undefined,
    ...(item.key === 'chats' && chatUnread > 0 ? { badge: chatUnread } : {}),
  }));

  const markedDates = data.monthEvents.map((e) => toIso(new Date(e.startTime)));
  const dayRows = selectedDay
    ? data.monthEvents.filter((e) => toIso(new Date(e.startTime)) === selectedDay).map(toScheduleRow)
    : data.upcomingTrainings.map(toScheduleRow);

  const attendanceValue = data.attendance
    ? `${data.attendance.present}/${data.attendance.total}`
    : '—';

  const membershipRemaining = data.membership?.remaining;
  const membershipValue =
    membershipRemaining == null
      ? data.membership
        ? 'без лимита'
        : '—'
      : String(membershipRemaining);
  const membershipCaption = data.membership
    ? data.membership.visitsTotal != null
      ? `${data.membership.name} · использовано ${data.membership.visitsUsed} из ${data.membership.visitsTotal}`
      : data.membership.name
    : 'Нет активного абонемента';

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

  const openChangeMembership = async () => {
    setPortalMembershipError('');
    setPortalMembershipId('');
    setChangeMembershipOpen(true);
    try {
      const items = await apiService.getPortalMembershipCatalog();
      setPortalCatalog(items);
    } catch (e: any) {
      setPortalMembershipError(e?.response?.data?.error || 'Не удалось загрузить тарифы');
    }
  };

  const openStaffChat = (member: ClientDashboardStaffMember) => {
    if (pending || !currentAthleteId) return;
    const isTrainer = member.role === 'TRAINER' || member.roleLabel === 'Тренер';
    setOpenChatEnsure(
      isTrainer
        ? { type: 'CLIENT_TRAINER', clientId: currentAthleteId, trainerId: member.id }
        : { type: 'CLIENT_ADMIN', clientId: currentAthleteId }
    );
    setActiveKey('chats');
  };

  const metricAction = (
    label: string,
    accent: string,
    onClick?: () => void,
    disabled?: boolean
  ) => (
    <Box
      component="button"
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      sx={{
        border: 'none',
        background: 'none',
        p: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: disabled || !onClick ? 'default' : 'pointer',
        fontFamily: 'inherit',
        color: accent,
        opacity: disabled ? 0.45 : 1,
        '&:hover': disabled || !onClick ? undefined : { opacity: 0.85 },
      }}
    >
      <Typography sx={{ fontSize: typography.hint, fontWeight: 700, color: 'inherit' }}>
        {label}
      </Typography>
      <ArrowForward sx={{ fontSize: 14 }} />
    </Box>
  );

  const metricIcon = (bg: string, fg: string, icon: React.ReactNode) => (
    <Box
      aria-hidden
      sx={{
        width: 48,
        height: 48,
        borderRadius: '14px',
        bgcolor: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        '& svg': { fontSize: 24 },
      }}
    >
      {icon}
    </Box>
  );

  const quickAction = (
    label: string,
    bg: string,
    fg: string,
    icon: React.ReactNode,
    onClick?: () => void
  ) => (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={pending || !onClick}
      sx={{
        border: 'none',
        cursor: pending || !onClick ? 'default' : 'pointer',
        fontFamily: 'inherit',
        textAlign: 'center',
        bgcolor: colors.card,
        borderRadius: `${radii.panel}px`,
        boxShadow: '0 2px 10px rgba(32, 34, 36, 0.06)',
        p: 1.25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        minWidth: 0,
        opacity: pending ? 0.55 : 1,
        transition: 'transform 140ms ease, box-shadow 140ms ease',
        '&:hover':
          pending || !onClick
            ? undefined
            : {
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 16px rgba(32, 34, 36, 0.1)',
              },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 44,
          height: 44,
          borderRadius: '14px',
          bgcolor: bg,
          color: fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& svg': { fontSize: 22 },
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          fontSize: { xs: 11, md: 12 },
          fontWeight: 700,
          color: colors.text,
          lineHeight: 1.25,
          minHeight: 30,
        }}
      >
        {label}
      </Typography>
    </Box>
  );

  const emailVerifyPanel = showEmailVerify ? (
    <Panel title="Подтвердите email">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={{ color: colors.textMuted, fontSize: typography.label }}>
          {pending
            ? `Подтвердите ${viewerEmail} кодом из письма — откроется полный доступ к кабинету. Либо дождитесь одобрения школой.`
            : `На ${viewerEmail} можно отправить код подтверждения.`}
        </Typography>
        {verifyNotice && (
          <Typography sx={{ color: colors.primary, fontSize: typography.hint }}>{verifyNotice}</Typography>
        )}
        {verifyError && (
          <Typography sx={{ color: colors.danger, fontSize: typography.hint }}>{verifyError}</Typography>
        )}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={handleSendVerification}
            disabled={verifySending}
            sx={{ textTransform: 'none' }}
          >
            {verifySending ? 'Отправка…' : 'Отправить код'}
          </Button>
          <TextField
            size="small"
            placeholder="Код из письма"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleVerifyCode}
            disabled={verifyChecking || verifyCode.trim().length !== 6}
            sx={{ textTransform: 'none' }}
          >
            {verifyChecking ? '…' : 'Подтвердить'}
          </Button>
        </Box>
      </Box>
    </Panel>
  ) : null;

  const greetingDate = format(new Date(), 'EEEE, d MMMM', { locale: ru });
  const greetingName =
    data.client?.firstName && data.client?.lastName
      ? `${data.client.lastName} ${data.client.firstName}`
      : data.viewerName;

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' },
          gap: { xs: 2, md: 2.5 },
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography
            sx={{
              fontSize: typography.hint,
              color: colors.textMuted,
              fontWeight: 600,
              textTransform: 'capitalize',
              mb: 0.75,
            }}
          >
            {greetingDate}
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 26, md: 34 },
              fontWeight: 800,
              color: colors.text,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              mb: 1,
            }}
          >
            {greetingName} 👋
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: colors.textMuted, maxWidth: 520 }}>
            Следите за расписанием, посещаемостью и достижениями — всё важное собрано здесь
          </Typography>
        </Box>

        <Box
          sx={{
            bgcolor: colors.primary,
            borderRadius: `${radii.panel}px`,
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
            color: colors.white,
            px: { xs: 2, md: 2.5 },
            py: { xs: 2, md: 2.25 },
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            minHeight: { xs: 96, md: 112 },
            boxShadow: '0 10px 28px rgba(47, 107, 255, 0.28)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
            <Typography sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 800, lineHeight: 1.25, mb: 0.5 }}>
              Спорт делает сильнее!
            </Typography>
            <Typography sx={{ fontSize: typography.hint, color: 'rgba(255,255,255,0.82)', lineHeight: 1.4 }}>
              Новые возможности начинаются здесь
            </Typography>
          </Box>
          <Box
            aria-hidden
            sx={{
              width: { xs: 64, md: 76 },
              height: { xs: 64, md: 76 },
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <EmojiEventsOutlined sx={{ fontSize: { xs: 34, md: 40 }, color: '#FFD76A' }} />
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
          gap: { xs: 2, md: 2.5 },
        }}
      >
        <MetricCard
          label="Баланс"
          value={data.balance ? RUB.format(data.balance.amount) : '—'}
          icon={metricIcon('#E8F0FF', colors.primary, <PaymentsOutlined />)}
          caption={balanceCaption}
          placeholder={pending}
          action={metricAction('Перейти к платежам', colors.primary, () => setActiveKey('payments'), pending)}
        />
        <MetricCard
          label="Абонемент"
          value={membershipValue}
          icon={metricIcon('#E6F8F3', colors.success, <CalendarMonthOutlined />)}
          caption={
            data.onGroupBilling
              ? `${membershipCaption}${
                  data.balance?.nextCharge
                    ? ` · следующий платёж ${new Date(data.balance.nextCharge.date).toLocaleDateString('ru-RU')}: ${RUB.format(data.balance.nextCharge.amount)}`
                    : ''
                }`
              : membershipCaption
          }
          placeholder={pending}
          action={metricAction(
            'Сменить тариф',
            colors.success,
            !pending && data.canChangeMembership !== false && !data.onGroupBilling
              ? openChangeMembership
              : undefined,
            pending || data.canChangeMembership === false || data.onGroupBilling
          )}
        />
        <MetricCard
          label="Посещаемость"
          value={attendanceValue}
          icon={metricIcon('#F0E9FF', '#7E57C2', <BarChartOutlined />)}
          placeholder={pending}
          action={metricAction('Подробнее', '#7E57C2', () => setActiveKey('plan'), pending)}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.55fr 1fr' },
          gap: { xs: 2, md: 2.5 },
          alignItems: 'stretch',
        }}
      >
        <Panel minHeight={360}>
          <WeekEventCalendar
            weekAnchor={weekAnchor}
            selected={selectedDay}
            onSelect={
              pending
                ? undefined
                : (iso) => setSelectedDay(iso || null)
            }
            markedDates={markedDates}
            rows={dayRows}
            placeholder={pending}
            emptyText={
              selectedDay ? 'В этот день пока нет событий' : 'На этой неделе пока нет событий'
            }
          />
        </Panel>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 }, minWidth: 0 }}>
          <Panel title="Персонал">
            <StaffCardList
              staff={data.staff}
              placeholder={pending}
              placeholderCount={1}
              layout="stack"
              hideOwner
              showChatButton
              onChatClick={openStaffChat}
              onTrainerClick={(id) => setTrainerCardId(id)}
            />
          </Panel>

          <Panel title="Быстрые действия">
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1.25,
              }}
            >
              {quickAction(
                'Оплатить занятия',
                '#E8F0FF',
                colors.primary,
                <PaymentsOutlined />,
                () => setActiveKey('payments')
              )}
              {quickAction(
                'Посмотреть расписание',
                '#E6F8F3',
                colors.success,
                <CalendarMonthOutlined />,
                () => setActiveKey('plan')
              )}
              {quickAction(
                'Мои документы',
                '#F0E9FF',
                '#7E57C2',
                <DescriptionOutlined />,
                () => setActiveKey('documents')
              )}
              {quickAction(
                'Написать в поддержку',
                '#FFF1E8',
                '#FF8A4C',
                <SupportAgentOutlined />,
                () => window.dispatchEvent(new Event('crm:open-support'))
              )}
            </Box>
          </Panel>
        </Box>
      </Box>
    </Box>
  );

  const pageTitle =
    activeKey === 'card'
      ? 'Карточка спортсмена'
      : activeKey === 'documents'
        ? 'Документы'
        : activeKey === 'plan'
          ? 'Календарный план'
          : activeKey === 'payments'
            ? 'Платежи'
            : activeKey === 'chats'
              ? 'Чаты'
              : activeKey === 'news'
                ? 'Новости'
                : activeKey === 'settings'
                  ? 'Настройки'
                  : 'Панель управления'

  const cardContent = (
    <AthleteCard
      mode="client"
      clientId={currentAthleteId || undefined}
      onTrainerClick={(id) => setTrainerCardId(id)}
    />
  );

  const documentsContent = currentAthleteId ? (
    <ClientDocumentsPanel clientId={currentAthleteId} />
  ) : (
    <Typography color="text.secondary">Выберите спортсмена</Typography>
  );

  const planContent = <ClientCalendarPlan clientId={currentAthleteId || undefined} />;
  const paymentsContent = <ClientPaymentsPanel clientId={currentAthleteId || undefined} />;

  const chatSelf = (() => {
    if (data.userType === 'parent' && data.parent?.id) {
      return { kind: 'PARENT' as const, id: data.parent.id };
    }
    if (data.client?.id) {
      return { kind: 'CLIENT' as const, id: data.client.id };
    }
    try {
      const stored = JSON.parse(localStorage.getItem('client') || '{}');
      if (stored?.id) {
        return {
          kind: (localStorage.getItem('userType') === 'parent' ? 'PARENT' : 'CLIENT') as
            | 'PARENT'
            | 'CLIENT',
          id: stored.id,
        };
      }
    } catch {
      /* ignore */
    }
    return { kind: 'CLIENT' as const, id: '' };
  })();

  const chatsContent = (
    <ChatWorkspace
      key={
        openChatEnsure
          ? `ensure:${openChatEnsure.type}:${openChatEnsure.trainerId || ''}:${openChatEnsure.clientId || ''}`
          : 'chats'
      }
      mode="client"
      socketToken={localStorage.getItem('clientToken')}
      self={chatSelf}
      immersiveMobile
      initialEnsurePayload={openChatEnsure}
    />
  );

  const settingsContent = (
    <ClientSettingsPanel onLogoutEverywhere={() => void logoutCurrentAccount()} />
  );

  const newsContent = <ClientNewsPanel />;

  const feedbackContent = <DeveloperFeedback source="portal" />;

  const mainContent =
    activeKey === 'card'
      ? cardContent
      : activeKey === 'documents'
        ? documentsContent
        : activeKey === 'plan'
          ? planContent
          : activeKey === 'payments'
            ? paymentsContent
            : activeKey === 'chats'
              ? chatsContent
              : activeKey === 'news'
                ? newsContent
                : activeKey === 'feedback'
                  ? feedbackContent
                  : activeKey === 'settings'
                    ? settingsContent
                    : content;

  return (
    <DashboardShell
      pageTitle={
        activeKey === 'chats' || activeKey === 'dashboard' || activeKey === 'feedback'
          ? undefined
          : pageTitle
      }
      headerLeading={athleteSwitcher}
      navItems={navItems}
      activeKey={activeKey}
      userName={data.viewerName}
      userRole={data.userType === 'parent' ? 'Родитель' : 'Ученик'}
      notificationsChannel="portal"
      onLogout={handleLogout}
      onAddAccount={handleAddAccount}
      hideSearch
      showSupportHelp={!pending}
      hideMobileBottomNav={activeKey === 'chats'}
    >
      <ClientTrainerCardDialog
        open={Boolean(trainerCardId)}
        trainerId={trainerCardId}
        clientId={currentAthleteId || null}
        onClose={() => setTrainerCardId(null)}
      />
      <Dialog
        open={changeMembershipOpen}
        onClose={() => setChangeMembershipOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Сменить абонемент</DialogTitle>
        <DialogContent>
          {portalMembershipError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {portalMembershipError}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Выберите тариф из каталога школы. Долг по посещениям перейдёт на новый пакет.
            Автопродление при ручной смене не запускается.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Тариф</InputLabel>
            <Select
              label="Тариф"
              value={portalMembershipId}
              onChange={(e) => setPortalMembershipId(String(e.target.value))}
            >
              {portalCatalog.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                  {m.visits != null ? ` (${m.visits} пос.)` : ''}
                  {m.price != null ? ` — ${Number(m.price).toLocaleString('ru-RU')} ₽` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeMembershipOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={!portalMembershipId || changingPortalMembership}
            onClick={async () => {
              try {
                setChangingPortalMembership(true);
                setPortalMembershipError('');
                await apiService.changePortalMembership({
                  membershipId: portalMembershipId,
                  clientId: currentAthleteId || undefined,
                });
                setChangeMembershipOpen(false);
                const refreshed = await loadDashboard(switchClientId);
                setData(refreshed);
              } catch (e: any) {
                setPortalMembershipError(e?.response?.data?.error || 'Не удалось сменить тариф');
              } finally {
                setChangingPortalMembership(false);
              }
            }}
          >
            {changingPortalMembership ? '…' : 'Подтвердить'}
          </Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
        {emailVerifyPanel}
        {pending && activeKey !== 'settings' && activeKey !== 'news' && activeKey !== 'feedback' ? (
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
              <Typography
                sx={{
                  fontSize: typography.label,
                  color: colors.textMuted,
                  textAlign: 'center',
                  mt: 1,
                  maxWidth: 420,
                }}
              >
                {showEmailVerify
                  ? 'Подтвердите email выше или дождитесь одобрения администратором — после этого откроется полный доступ к карточке и расписанию.'
                  : 'Ожидайте подтверждения от администратора организации. После одобрения откроется полный доступ к карточке и расписанию.'}
              </Typography>
            </Box>
          </Box>
        ) : (
          mainContent
        )}
      </Box>
    </DashboardShell>
  );
};

export default ClientDashboard;
