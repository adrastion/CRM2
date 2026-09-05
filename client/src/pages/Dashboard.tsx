import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DashboardStats } from '../types';
import Panel from '../components/dashboard/Panel';
import MetricCard from '../components/dashboard/MetricCard';
import DesignIcon from '../components/common/DesignIcon';
import { MetricIconName } from '../assets/icons/registry';
import { colors, radii, typography } from '../theme/tokens';

interface Activity {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  amount?: number;
}

interface UpcomingTraining {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  group?: { name: string };
  trainer?: { user?: { firstName: string; lastName: string; middleName?: string } };
  memberCount: number;
}

const RUB = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/** Карточка быстрого действия из макета. */
const QuickAction: React.FC<{
  title: string;
  description: string;
  iconName: MetricIconName;
  onClick: () => void;
}> = ({ title, description, iconName, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      border: 'none',
      textAlign: 'center',
      cursor: 'pointer',
      fontFamily: 'inherit',
      bgcolor: colors.card,
      borderRadius: `${radii.panel}px`,
      boxShadow: '0 4px 18px rgba(32, 34, 36, 0.06)',
      px: { xs: 2.5, md: 4 },
      py: { xs: 2, md: 2.5 },
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1.5,
      transition: 'transform 160ms ease, box-shadow 160ms ease',
      '&:hover': {
        transform: 'translateY(-3px)',
        boxShadow: '0 10px 28px rgba(32, 34, 36, 0.12)',
      },
      '&:focus-visible': { outline: `3px solid ${colors.primarySoft}`, outlineOffset: 3 },
    }}
  >
    <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <DesignIcon category="metric" name={iconName} size={72} />
    </Box>
    <Typography sx={{ fontSize: typography.panelTitle, fontWeight: 700, color: colors.text }}>
      {title}
    </Typography>
    <Typography sx={{ fontSize: typography.label, color: colors.textSubtle }}>
      {description}
    </Typography>
  </Box>
);

/**
 * Панель управления школы по макету dorabot/1920w Панель управления.pdf:
 * восемь KPI-карт, «Последняя активность», «Предстоящие тренировки»
 * и блок быстрых действий.
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
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
    try {
      setPlanUsage(await apiService.getPlanUsage());
    } catch {
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
    }> = [
      {
        label: 'Всего клиентов',
        value: stats?.totalClients ?? 0,
        iconName: 'total-clients',
        show: true,
      },
      {
        label: 'Активные клиенты',
        value: stats?.activeClients ?? 0,
        iconName: 'active-clients',
        show: true,
      },
      {
        label: 'Тренеры',
        value: stats?.totalTrainers ?? 0,
        iconName: 'trainers',
        show: !isTrainer,
      },
      {
        label: 'Группы',
        value: stats?.totalGroups ?? 0,
        iconName: 'groups',
        show: true,
      },
      {
        label: 'Филиалы',
        value: stats?.totalBranches ?? 0,
        iconName: 'branches',
        show: !isTrainer,
      },
      {
        label: 'Месячный доход',
        value: RUB.format(stats?.monthlyRevenue ?? 0),
        iconName: 'monthly-revenue',
        show: !isTrainer,
      },
      {
        label: 'Посещаемость',
        value: `${stats?.attendanceRate ?? 0}%`,
        iconName: 'attendance',
        show: true,
      },
      {
        label: isTrainer ? 'Мои тренировки' : 'Предстоящие тренировки',
        value: stats?.upcomingTrainings ?? 0,
        iconName: 'my-trainings',
        show: true,
      },
      {
        label: 'Заработок за месяц',
        value: RUB.format(stats?.trainerMonthlyEarnings ?? 0),
        iconName: 'balance',
        show: isTrainer,
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3, md: 4 } }} data-onboarding="dashboard-page">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          justifyContent: 'space-between',
          gap: { xs: 1.5, sm: 2 },
          flexWrap: 'wrap',
        }}
        data-onboarding="dashboard"
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: typography.pageTitle,
              fontWeight: 700,
              color: colors.text,
              lineHeight: 1.1,
            }}
          >
            Панель управления
          </Typography>
          <Typography sx={{ mt: 1, fontSize: typography.label, color: colors.textMuted, overflowWrap: 'anywhere' }}>
            {tenant?.name}
            {user?.firstName ? ` · Добро пожаловать, ${user.firstName}!` : ''}
          </Typography>
        </Box>

        {user?.role === 'OWNER' && (
          <Button
            variant="outlined"
            onClick={handleOpenPlanUsage}
            sx={{
              borderRadius: `${radii.button}px`,
              borderColor: colors.primary,
              color: colors.primary,
              textTransform: 'none',
              px: 3,
              py: 1.25,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Мой тариф
          </Button>
        )}
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* KPI-карты */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: { xs: 1.5, sm: 2, md: 3 },
        }}
        data-onboarding="dashboard-stats"
      >
        {metricCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={<DesignIcon category="metric" name={card.iconName} size={60} />}
            designIcon
          />
        ))}
      </Box>

      {/* Активность и тренировки */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: isTrainer ? '1fr' : '1fr 1fr' },
          gap: { xs: 1.5, sm: 2, md: 3 },
        }}
      >
        {!isTrainer && (
          <Panel title="Последняя активность" minHeight={380}>
            {activities.length === 0 ? (
              <Box
                sx={{
                  minHeight: 240,
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
                {activities.map((activity, index) => (
                  <Box
                    key={`${activity.type}-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      px: 2,
                      py: 1.5,
                      borderRadius: `${radii.cell}px`,
                      bgcolor: index % 2 === 0 ? colors.surface : colors.rowAlt,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}
                      >
                        {activity.title}
                      </Typography>
                      <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                        {activity.description}
                      </Typography>
                      <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mt: 0.5 }}>
                        {format(new Date(activity.timestamp), 'd MMMM yyyy, HH:mm', { locale: ru })}
                      </Typography>
                    </Box>
                    {activity.amount != null && (
                      <Typography
                        sx={{
                          fontSize: typography.label,
                          fontWeight: 700,
                          color: colors.success,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {RUB.format(activity.amount)}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Panel>
        )}

        <Panel title="Предстоящие тренировки" minHeight={380}>
          {upcomingTrainings.length === 0 ? (
            <Box
              sx={{
                minHeight: 240,
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
              {upcomingTrainings.map((training, index) => (
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
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    borderRadius: `${radii.cell}px`,
                    bgcolor: index === 0 ? colors.primarySoft : colors.rowAlt,
                    '&:hover': { filter: 'brightness(0.97)' },
                  }}
                >
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
                    sx={{ bgcolor: colors.card, fontWeight: 600 }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Panel>
      </Box>

      {/* Быстрые действия */}
      <Box>
        <Typography
          component="h2"
          sx={{
            fontSize: typography.panelTitle,
            fontWeight: 700,
            color: colors.text,
            mb: { xs: 2, md: 2.5 },
          }}
        >
          Быстрые действия
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' },
            gap: { xs: 1.5, sm: 2, md: 3 },
          }}
        >
          <QuickAction
            title="Добавить клиента"
            description="Зарегистрировать нового клиента"
            iconName="add-client"
            onClick={() => navigate('/clients')}
          />
          <QuickAction
            title="Запланировать тренировку"
            description="Создать занятие в расписании"
            iconName="schedule-training"
            onClick={() => navigate('/schedule')}
          />
          {!isTrainer ? (
            <QuickAction
              title="Записать платеж"
              description="Обработать оплату клиента"
              iconName="record-payment"
              onClick={() => navigate('/finance')}
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

      {/* Диалог тарифа */}
      <Dialog
        open={planUsageDialog}
        onClose={() => setPlanUsageDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Мой тариф: {planUsage?.subscription?.planType || 'Загрузка...'}</DialogTitle>
        <DialogContent>
          {planUsageLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : planUsage ? (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Chip
                  label={planUsage.subscription.status === 'active' ? 'Активна' : 'Неактивна'}
                  color={planUsage.subscription.status === 'active' ? 'success' : 'default'}
                  sx={{ mb: 1 }}
                />
                {planUsage.subscription.endDate && (
                  <Typography variant="body2" color="text.secondary">
                    Действует до:{' '}
                    {new Date(planUsage.subscription.endDate).toLocaleDateString('ru-RU')}
                  </Typography>
                )}
              </Box>

              <Divider sx={{ my: 3 }} />

              {[
                { key: 'clients', label: 'Клиенты' },
                { key: 'trainers', label: 'Тренеры' },
                { key: 'groups', label: 'Группы' },
                { key: 'branches', label: 'Филиалы' },
                { key: 'trainings', label: 'Тренировки (в месяц)' },
              ].map((resource) => {
                const limit = planUsage.limits[resource.key];
                const used = planUsage.usage[resource.key];
                const remaining = planUsage.remaining[resource.key];
                const percent = planUsage.usagePercent[resource.key];

                return (
                  <Box key={resource.key} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {resource.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {used} / {limit === 'unlimited' ? '∞' : limit}
                      </Typography>
                    </Box>
                    {limit !== 'unlimited' && (
                      <>
                        <LinearProgress
                          variant="determinate"
                          value={percent}
                          color={percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'primary'}
                          sx={{ height: 8, borderRadius: 4, mb: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Осталось: {remaining === 'unlimited' ? '∞' : remaining}
                        </Typography>
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Alert severity="error">Не удалось загрузить информацию о тарифе</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanUsageDialog(false)}>Закрыть</Button>
          {user?.role === 'OWNER' && (
            <Button
              variant="contained"
              onClick={() => {
                setPlanUsageDialog(false);
                navigate('/pricing');
              }}
            >
              Изменить тариф
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
