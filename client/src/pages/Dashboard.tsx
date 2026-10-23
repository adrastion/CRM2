import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Chip,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  CalendarToday,
  PersonOutline,
  ArrowForward,
  PaymentsOutlined,
  WorkspacePremium,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { useCreateFlows } from '../contexts/CreateFlowsContext';
import { apiService } from '../services/api';
import { DashboardStats } from '../types';
import Panel from '../components/dashboard/Panel';
import MetricCard from '../components/dashboard/MetricCard';
import MyPlanDialog from '../components/dashboard/MyPlanDialog';
import DesignIcon from '../components/common/DesignIcon';
import { MetricIconName } from '../assets/icons/registry';
import { colors, radii, typography } from '../theme/tokens';

const TRAINING_STRIP = ['#FF8A4C', '#F06292', '#2F6BFF', '#7E57C2'] as const;

const SPARK_COLORS = {
  clients: '#2F6BFF',
  active: '#7E57C2',
  trainers: '#00B69B',
  groups: '#FF8A4C',
  branches: '#4880FF',
  revenue: '#F06292',
  attendance: '#00B69B',
  trainings: '#7E57C2',
} as const;

interface ActivityItem {
  label: string;
  detail?: string | null;
  timestamp: string;
  amount?: number;
}

interface Activity {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  amount?: number;
  count?: number;
  trainingId?: string;
  groupName?: string;
  items?: ActivityItem[];
}

interface UpcomingTraining {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  group?: { name: string };
  trainer?: { user?: { firstName: string; lastName: string; middleName?: string } };
  branch?: { name?: string | null; address?: string | null } | null;
  memberCount: number;
}

const roleLabel = (role?: string) => {
  switch (role) {
    case 'OWNER':
      return 'Владелец';
    case 'ADMIN':
      return 'Администратор';
    case 'TRAINER':
      return 'Тренер';
    case 'PROMOTER':
      return 'Промоутер';
    default:
      return role || '';
  }
};

const userNameFallback = (user?: { firstName?: string; lastName?: string; email?: string } | null) =>
  user?.lastName || user?.email?.split('@')[0] || '';

const formatTrend = (value?: number | null) => {
  if (value == null || !Number.isFinite(value) || value === 0) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
};

const PaperEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      p: 3,
      borderRadius: `${radii.panel}px`,
      bgcolor: colors.card,
      border: `1px solid ${colors.divider}`,
      textAlign: 'center',
    }}
  >
    <Typography sx={{ color: colors.textEmpty, fontSize: typography.field }}>{children}</Typography>
  </Box>
);

const RUB = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/** Компактная карточка быстрого действия. */
const QuickAction: React.FC<{
  title: string;
  description: string;
  iconName: MetricIconName;
  onClick: () => void;
  accent?: string;
}> = ({ title, description, iconName, onClick, accent = colors.primary }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      border: 'none',
      textAlign: 'left',
      cursor: 'pointer',
      fontFamily: 'inherit',
      bgcolor: colors.card,
      borderRadius: `${radii.panel}px`,
      boxShadow: '0 2px 10px rgba(32, 34, 36, 0.06)',
      px: { xs: 1.5, md: 1.25 },
      py: { xs: 1.25, md: 1 },
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: { xs: 1.25, md: 1 },
      minWidth: 0,
      width: '100%',
      transition: 'transform 140ms ease, box-shadow 140ms ease',
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: '0 6px 16px rgba(32, 34, 36, 0.1)',
      },
      '&:focus-visible': { outline: `3px solid ${colors.primarySoft}`, outlineOffset: 2 },
    }}
  >
    <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <DesignIcon category="metric" name={iconName} size={20} />
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: typography.label, fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: typography.hint,
          color: colors.textSubtle,
          display: { xs: 'none', sm: 'block' },
          mt: 0.25,
        }}
      >
        {description}
      </Typography>
    </Box>
    <ArrowForward sx={{ fontSize: 18, color: accent, flexShrink: 0, opacity: 0.85 }} />
  </Box>
);

/**
 * Панель управления: быстрые действия сверху, KPI, активность и расписание.
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const { openCreateClient, openCreateTraining, openAddFinanceOperation } = useCreateFlows();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [expandedActivityKeys, setExpandedActivityKeys] = useState<Record<string, boolean>>({});
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [upcomingTrainings, setUpcomingTrainings] = useState<UpcomingTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planUsageDialog, setPlanUsageDialog] = useState(false);
  const [planUsage, setPlanUsage] = useState<any>(null);
  const [planUsageLoading, setPlanUsageLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError('');
        const [statsData, activitiesData, trainingsData] = await Promise.all([
          apiService.getDashboardStats(abortController.signal),
          apiService.getRecentActivity(10, abortController.signal),
          apiService.getUpcomingTrainings(10, 7, abortController.signal),
        ]);
        if (!isMounted || abortController.signal.aborted) return;
        setStats(statsData);
        setActivities(activitiesData);
        setUpcomingTrainings(trainingsData);
      } catch (err: any) {
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (isMounted) setError('Не удалось загрузить данные панели управления');
      } finally {
        if (isMounted && !abortController.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return `Сегодня, ${format(date, 'HH:mm', { locale: ru })}`;
    if (diffDays === 1) return `Завтра, ${format(date, 'HH:mm', { locale: ru })}`;
    if (diffDays < 7) return format(date, 'EEEE, d MMMM, HH:mm', { locale: ru });
    return format(date, 'd MMMM, HH:mm', { locale: ru });
  }, []);

  const handleOpenPlanUsage = async () => {
    setPlanUsageDialog(true);
    setPlanUsageLoading(true);
    setPlanUsage(null);
    try {
      setPlanUsage(await apiService.getPlanUsage());
    } catch (err) {
      console.error('getPlanUsage failed:', err);
      setError('Не удалось загрузить информацию о тарифе');
    } finally {
      setPlanUsageLoading(false);
    }
  };

  const isTrainer = user?.role === 'TRAINER';

  const metricCards = useMemo(() => {
    const cards: Array<{
      label: string;
      value: React.ReactNode;
      iconName: MetricIconName;
      show: boolean;
      trend?: number | null;
      sparkColor: string;
    }> = [
      {
        label: 'Всего клиентов',
        value: stats?.totalClients ?? 0,
        iconName: 'total-clients',
        show: true,
        trend: stats?.weekDeltas?.clients ?? null,
        sparkColor: SPARK_COLORS.clients,
      },
      {
        label: 'Активные клиенты',
        value: stats?.activeClients ?? 0,
        iconName: 'active-clients',
        show: true,
        trend: null,
        sparkColor: SPARK_COLORS.active,
      },
      {
        label: 'Тренеры',
        value: stats?.totalTrainers ?? 0,
        iconName: 'trainers',
        show: !isTrainer,
        trend: null,
        sparkColor: SPARK_COLORS.trainers,
      },
      {
        label: 'Группы',
        value: stats?.totalGroups ?? 0,
        iconName: 'groups',
        show: true,
        trend: null,
        sparkColor: SPARK_COLORS.groups,
      },
      {
        label: 'Филиалы',
        value: stats?.totalBranches ?? 0,
        iconName: 'branches',
        show: !isTrainer,
        trend: null,
        sparkColor: SPARK_COLORS.branches,
      },
      {
        label: 'Месячный доход',
        value: RUB.format(stats?.monthlyRevenue ?? 0),
        iconName: 'monthly-revenue',
        show: !isTrainer,
        trend: stats?.weekDeltas?.revenue ?? null,
        sparkColor: SPARK_COLORS.revenue,
      },
      {
        label: 'Посещаемость',
        value: `${stats?.attendanceRate ?? 0}%`,
        iconName: 'attendance',
        show: true,
        trend: null,
        sparkColor: SPARK_COLORS.attendance,
      },
      {
        label: isTrainer ? 'Мои тренировки' : 'Предстоящие тренировки',
        value: stats?.upcomingTrainings ?? 0,
        iconName: 'my-trainings',
        show: true,
        trend: null,
        sparkColor: SPARK_COLORS.trainings,
      },
    ];
    return cards.filter((c) => c.show);
  }, [stats, isTrainer]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 420 }}>
        <CircularProgress sx={{ color: colors.primary }} />
      </Box>
    );
  }

  const greetingName = user?.firstName || userNameFallback(user);
  const todayChip = format(new Date(), 'd MMMM, EEE', { locale: ru });
  const todayDesktop = format(new Date(), "'Сегодня,' d MMMM yyyy", { locale: ru });
  const clientsTrend = formatTrend(stats?.weekDeltas?.clients);
  const revenueTrend = formatTrend(stats?.weekDeltas?.revenue);
  const mobileMetrics = [
    {
      key: 'clients',
      label: 'Клиенты',
      value: String(stats?.totalClients ?? 0),
      delta: clientsTrend != null ? `${clientsTrend}%` : null,
      deltaColor: colors.success,
      iconName: 'total-clients' as MetricIconName,
      iconBg: '#EEF4FF',
    },
    {
      key: 'trainings',
      label: 'Тренировки',
      value: String(stats?.upcomingTrainings ?? 0),
      delta: null as string | null,
      deltaColor: colors.success,
      iconName: 'my-trainings' as MetricIconName,
      iconBg: '#F3EEFF',
    },
    {
      key: 'revenue',
      label: isTrainer ? 'Заработок' : 'Доход',
      value: RUB.format(
        isTrainer ? stats?.trainerMonthlyEarnings ?? 0 : stats?.monthlyRevenue ?? 0
      ),
      delta: !isTrainer && revenueTrend != null ? `${revenueTrend}%` : null,
      deltaColor: colors.success,
      iconName: (isTrainer ? 'balance' : 'monthly-revenue') as MetricIconName,
      iconBg: '#EEF9F6',
    },
    {
      key: 'tasks',
      label: 'Задачи',
      value: String(activities.length),
      delta: null as string | null,
      deltaColor: colors.danger,
      iconName: 'groups' as MetricIconName,
      iconBg: '#F3EEFF',
      onClick: () => navigate('/staff-workspace'),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3, md: 1.75 } }} data-onboarding="dashboard-page">
      {/* Мобильный каркас макета 11 */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }} data-onboarding="dashboard">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{ fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md }, fontWeight: 800, color: '#1B2438', lineHeight: 1.2 }}
            >
              Здравствуйте{greetingName ? `, ${greetingName}` : ''}
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: typography.label, color: colors.textHint }}>
              {roleLabel(user?.role)}
              {tenant?.name ? ` · ${tenant.name}` : ''}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.85,
              borderRadius: `${radii.panel}px`,
              bgcolor: colors.card,
              border: `1px solid ${colors.divider}`,
              boxShadow: '0 2px 10px rgba(32,34,36,0.05)',
              flexShrink: 0,
              maxWidth: 148,
            }}
          >
            <CalendarToday sx={{ fontSize: 18, color: colors.primary }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: typography.hint, color: colors.textHint, lineHeight: 1.2 }}>
                Сегодня
              </Typography>
              <Typography
                sx={{
                  fontSize: typography.label,
                  fontWeight: 700,
                  color: colors.text,
                  lineHeight: 1.2,
                  textTransform: 'capitalize',
                }}
              >
                {todayChip}
              </Typography>
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: `${radii.panel}px` }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1.25,
            mb: 2.5,
          }}
          data-onboarding="dashboard-stats"
        >
          {mobileMetrics.map((m) => (
            <Box
              key={m.key}
              component={m.onClick ? 'button' : 'div'}
              type={m.onClick ? 'button' : undefined}
              onClick={m.onClick}
              sx={{
                border: 'none',
                textAlign: 'left',
                fontFamily: 'inherit',
                cursor: m.onClick ? 'pointer' : 'default',
                p: 1.5,
                borderRadius: `${radii.panel}px`,
                bgcolor: colors.card,
                boxShadow: '0 2px 10px rgba(32,34,36,0.06)',
                minWidth: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: m.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DesignIcon category="metric" name={m.iconName} size={20} />
                </Box>
                <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.textMuted }}>
                  {m.label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: typography.metric, fontWeight: 800, color: colors.text, lineHeight: 1.15 }}>
                {m.value}
              </Typography>
              {m.delta && (
                <Typography sx={{ mt: 0.35, fontSize: typography.label, fontWeight: 700, color: m.deltaColor }}>
                  {m.delta}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.25,
          }}
        >
          <Typography sx={{ fontSize: typography.panelTitle, fontWeight: 800, color: colors.text }}>
            Ближайшие тренировки
          </Typography>
          <Button
            onClick={() => navigate('/schedule')}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: colors.primary,
              minWidth: 0,
              px: 0.5,
            }}
          >
            Смотреть все
          </Button>
        </Box>

        {upcomingTrainings.length === 0 ? (
          <PaperEmpty>Нет предстоящих тренировок</PaperEmpty>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {upcomingTrainings.slice(0, 4).map((training, index) => {
              const trainerName = training.trainer?.user
                ? `${training.trainer.user.lastName} ${training.trainer.user.firstName?.[0] || ''}.`
                : null;
              const place =
                training.branch?.address || training.branch?.name || null;
              return (
                <Box
                  key={training.id}
                  component="button"
                  type="button"
                  onClick={() => navigate('/schedule')}
                  sx={{
                    border: 'none',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 0,
                    bgcolor: colors.card,
                    borderRadius: `${radii.panel}px`,
                    boxShadow: '0 2px 10px rgba(32,34,36,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: 5,
                      flexShrink: 0,
                      bgcolor: TRAINING_STRIP[index % TRAINING_STRIP.length],
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 1.25,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Box
                      sx={{
                        px: 1,
                        py: 0.75,
                        borderRadius: `${radii.cell}px`,
                        bgcolor: colors.surface,
                        flexShrink: 0,
                      }}
                    >
                      <Typography sx={{ fontSize: typography.label, fontWeight: 700, color: colors.text }}>
                        {format(new Date(training.startTime), 'HH:mm')}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        sx={{
                          fontSize: typography.field,
                          fontWeight: 700,
                          color: colors.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {training.title || training.group?.name || 'Тренировка'}
                      </Typography>
                      {place && (
                        <Typography
                          sx={{
                            fontSize: typography.label,
                            color: colors.textHint,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {place}
                        </Typography>
                      )}
                      {trainerName && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <PersonOutline sx={{ fontSize: 18, color: colors.primary }} />
                          <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
                            {trainerName}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {user?.role === 'OWNER' && (
          <Button
            variant="outlined"
            fullWidth
            onClick={handleOpenPlanUsage}
            sx={{
              mt: 2.5,
              borderRadius: `${radii.button}px`,
              borderColor: colors.primary,
              color: colors.primary,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Мой тариф
          </Button>
        )}
      </Box>

      {/* Десктоп: макет 5d2e5755 */}
      <Box sx={{ display: { xs: 'none', md: 'contents' } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
          data-onboarding="dashboard"
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ mb: 0.25, fontSize: typography.hint, fontWeight: 500, color: colors.textMuted }}>
              Панель управления
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md },
                fontWeight: 800,
                color: '#1B2438',
                lineHeight: 1.2,
              }}
            >
              Добро пожаловать
              {greetingName ? (
                <>
                  ,{' '}
                  <Box
                    component="span"
                    sx={{
                      background: `linear-gradient(90deg, ${colors.primary} 0%, #6B9BFF 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {greetingName}
                  </Box>
                  !
                </>
              ) : (
                '!'
              )}
            </Typography>
            <Typography sx={{ mt: 0.4, fontSize: typography.label, color: colors.textMuted, maxWidth: 520 }}>
              Центр управления вашим бизнесом. Всё под рукой — для роста и результата.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1, flexWrap: 'nowrap' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.8,
                borderRadius: `${radii.button}px`,
                bgcolor: colors.card,
                border: `1px solid ${colors.divider}`,
                boxShadow: '0 2px 8px rgba(32,34,36,0.04)',
                height: 'fit-content',
                alignSelf: 'center',
              }}
            >
              <CalendarToday sx={{ fontSize: 18, color: colors.primary }} />
              <Typography sx={{ fontSize: typography.hint, fontWeight: 600, color: colors.text, whiteSpace: 'nowrap' }}>
                {todayDesktop}
              </Typography>
            </Box>

            {user?.role === 'OWNER' && (
              <Box
                component="button"
                type="button"
                onClick={() => void handleOpenPlanUsage()}
                sx={{
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.1,
                  px: 1.35,
                  py: 0.95,
                  borderRadius: '16px',
                  bgcolor: colors.card,
                  boxShadow: '0 6px 18px rgba(32,34,36,0.08)',
                  minWidth: 240,
                  maxWidth: 280,
                  '&:hover': { boxShadow: '0 8px 22px rgba(32,34,36,0.12)' },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    background: 'linear-gradient(145deg, #7B5CFF 0%, #5B4DFF 100%)',
                    boxShadow: '0 6px 14px rgba(91, 77, 255, 0.28)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <WorkspacePremium sx={{ fontSize: 22, color: '#FFD56A' }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: typography.label, fontWeight: 800, color: colors.text, lineHeight: 1.15 }}>
                    Мой тариф
                  </Typography>
                  <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mt: 0.25, lineHeight: 1.25 }}>
                    Больше возможностей для развития вашего центра
                  </Typography>
                </Box>
                <Box
                  aria-hidden
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: colors.primary,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ArrowForward sx={{ fontSize: 15 }} />
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Box>
          <Typography
            component="h2"
            sx={{ fontSize: typography.label, fontWeight: 700, color: colors.text, mb: 0.75 }}
          >
            Быстрые действия
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { md: 'repeat(3, 1fr)' },
              gap: 1.25,
            }}
          >
            <QuickAction
              title="Добавить клиента"
              description="Зарегистрировать нового клиента"
              iconName="add-client"
              accent={colors.primary}
              onClick={openCreateClient}
            />
            <QuickAction
              title="Запланировать тренировку"
              description="Создать занятие в расписании"
              iconName="schedule-training"
              accent="#7E57C2"
              onClick={openCreateTraining}
            />
            {!isTrainer ? (
              <QuickAction
                title="Записать платеж"
                description="Обработать оплату клиента"
                iconName="record-payment"
                accent={colors.success}
                onClick={openAddFinanceOperation}
              />
            ) : (
              <QuickAction
                title="Клиенты"
                description="Открыть список и карточку спортсмена"
                iconName="add-client"
                onClick={() => navigate('/clients')}
              />
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { md: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.25,
          }}
          data-onboarding="dashboard-stats"
        >
          {metricCards.map((card) => (
            <MetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={<DesignIcon category="metric" name={card.iconName} size={20} />}
              designIcon
              trend={card.trend}
              trendLabel="за 7 дней"
              sparkline
              sparkColor={card.sparkColor}
            />
          ))}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { md: isTrainer ? '1fr' : '1fr 1fr' },
            gap: 1.25,
          }}
        >
          {!isTrainer && (
            <Panel
              title="Последняя активность"
              minHeight={240}
              compact
              action={
                <Button
                  size="small"
                  onClick={() => setShowAllActivities((value) => !value)}
                  sx={{ p: 0, minWidth: 0, fontSize: typography.label, textTransform: 'none', fontWeight: 600 }}
                >
                  {showAllActivities ? 'Свернуть' : 'Вся активность →'}
                </Button>
              }
            >
              {activities.length === 0 ? (
                <Box
                  sx={{
                    minHeight: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
                    Нет активности
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {activities.slice(0, showAllActivities ? 10 : 3).map((activity, index) => {
                    const key = `desk-${activity.type}-${activity.trainingId || activity.timestamp}-${index}`;
                    const canExpand = (activity.items?.length || 0) > 1;
                    const expanded = Boolean(expandedActivityKeys[key]);
                    const typeTag =
                      activity.type === 'payment' || activity.amount != null
                        ? 'Платеж'
                        : activity.type === 'client' || /клиент/i.test(activity.title)
                          ? 'Клиент'
                          : null;
                    return (
                      <Box
                        key={key}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          px: 1,
                          py: 0.75,
                          borderRadius: `${radii.cell}px`,
                          bgcolor: index % 2 === 0 ? colors.surface : colors.rowAlt,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Box
                            aria-hidden
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor:
                                activity.type === 'payment' || activity.amount != null
                                  ? 'rgba(0,182,155,0.14)'
                                  : 'rgba(47,107,255,0.14)',
                              color:
                                activity.type === 'payment' || activity.amount != null
                                  ? colors.success
                                  : colors.primary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              '& svg': { fontSize: typography.label },
                            }}
                          >
                            {activity.type === 'payment' || activity.amount != null ? (
                              <PaymentsOutlined />
                            ) : (
                              <PersonOutline />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography
                                sx={{ fontSize: typography.hint, fontWeight: 600, color: colors.text }}
                              >
                                {activity.title}
                                {canExpand && activity.count != null ? ` · ${activity.count}` : ''}
                              </Typography>
                              {typeTag && (
                                <Chip
                                  label={typeTag}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: typography.hint,
                                    fontWeight: 600,
                                    bgcolor:
                                      typeTag === 'Платеж'
                                        ? 'rgba(0,182,155,0.12)'
                                        : 'rgba(47,107,255,0.12)',
                                    color: typeTag === 'Платеж' ? colors.success : colors.primary,
                                  }}
                                />
                              )}
                            </Box>
                            <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                              {activity.description}
                            </Typography>
                            <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mt: 0.25 }}>
                              {format(new Date(activity.timestamp), 'd MMMM yyyy, HH:mm', { locale: ru })}
                            </Typography>
                          </Box>
                          {activity.amount != null && (
                            <Typography
                              sx={{
                                fontSize: typography.hint,
                                fontWeight: 700,
                                color: colors.success,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {RUB.format(Number(activity.amount))}
                            </Typography>
                          )}
                          {canExpand && (
                            <IconButton
                              size="small"
                              aria-label={expanded ? 'Свернуть' : 'Подробности'}
                              onClick={() =>
                                setExpandedActivityKeys((prev) => ({
                                  ...prev,
                                  [key]: !prev[key],
                                }))
                              }
                              sx={{ mt: -0.5 }}
                            >
                              {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                            </IconButton>
                          )}
                        </Box>
                        {canExpand && (
                          <Collapse in={expanded}>
                            <Box sx={{ mt: 1, pl: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {(activity.items || []).map((item, i) => (
                                <Box
                                  key={`${key}-item-${i}`}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                    alignItems: 'baseline',
                                  }}
                                >
                                  <Typography sx={{ fontSize: typography.hint, color: colors.text }}>
                                    {item.label}
                                    {item.detail ? ` — ${item.detail}` : ''}
                                  </Typography>
                                  {item.amount != null && (
                                    <Typography
                                      sx={{
                                        fontSize: typography.hint,
                                        fontWeight: 600,
                                        color: colors.success,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {RUB.format(Number(item.amount))}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          </Collapse>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Panel>
          )}

          <Panel
            title="Предстоящие тренировки"
            minHeight={240}
            compact
            action={
              <Button
                size="small"
                endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
                onClick={() => navigate('/schedule')}
                sx={{ p: 0, textTransform: 'none', color: colors.primary, fontSize: typography.label, fontWeight: 600, minWidth: 0 }}
              >
                Все тренировки
              </Button>
            }
          >
            {upcomingTrainings.length === 0 ? (
              <Box
                sx={{
                  minHeight: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ color: colors.textEmpty, fontSize: typography.label }}>
                  Нет предстоящих тренировок
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {upcomingTrainings.slice(0, 3).map((training, index) => (
                  <Box
                    key={training.id}
                    component="button"
                    type="button"
                    onClick={() => navigate('/schedule')}
                    sx={{
                      border: 'none',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1,
                      py: 0.75,
                      borderRadius: `${radii.cell}px`,
                      bgcolor: index === 0 ? colors.primarySoft : colors.rowAlt,
                      '&:hover': { filter: 'brightness(0.97)' },
                    }}
                  >
                    <Box
                      sx={{
                        minWidth: 34,
                        flexShrink: 0,
                      }}
                    >
                      <Typography sx={{ fontSize: typography.hint, fontWeight: 700, color: colors.text }}>
                        {format(new Date(training.startTime), 'HH:mm')}
                      </Typography>
                    </Box>
                    <Box
                      aria-hidden
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '7px',
                        bgcolor: `${TRAINING_STRIP[index % TRAINING_STRIP.length]}22`,
                        color: TRAINING_STRIP[index % TRAINING_STRIP.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CalendarToday sx={{ fontSize: 18 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}
                      >
                        {training.title || training.group?.name || 'Тренировка'}
                      </Typography>
                      <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                        {formatDate(training.startTime)} –{' '}
                        {format(new Date(training.endTime), 'HH:mm', { locale: ru })}
                      </Typography>
                      {training.trainer?.user && (
                        <Typography sx={{ fontSize: typography.hint, color: colors.textHint }}>
                          Тренер: {training.trainer.user.lastName} {training.trainer.user.firstName}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      label={`${training.memberCount} чел.`}
                      size="small"
                      sx={{ height: 20, bgcolor: colors.card, fontSize: typography.hint, fontWeight: 600, flexShrink: 0 }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Panel>
        </Box>
      </Box>

      <MyPlanDialog
        open={planUsageDialog}
        loading={planUsageLoading}
        data={planUsage}
        onClose={() => setPlanUsageDialog(false)}
        onChangePlan={() => {
          setPlanUsageDialog(false);
          navigate('/pricing');
        }}
      />
    </Box>
  );
};

export default Dashboard;
