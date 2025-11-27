import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  People,
  Person,
  Groups,
  Business,
  AttachMoney,
  TrendingUp,
  Schedule,
  CheckCircle,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { DashboardStats } from '../types';

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
  description?: string;
  startTime: string;
  endTime: string;
  group?: {
    name: string;
  };
  trainer?: {
    user?: {
      firstName: string;
      lastName: string;
    };
  };
  memberCount: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcomingTrainings, setUpcomingTrainings] = useState<UpcomingTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchDashboardData = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        setError('');
        
        const [statsData, activitiesData, trainingsData] = await Promise.all([
          apiService.getDashboardStats(abortController.signal),
          apiService.getRecentActivity(10, abortController.signal),
          apiService.getUpcomingTrainings(10, 7, abortController.signal)
        ]);
        
        if (!isMounted || abortController.signal.aborted) return;
        setStats(statsData);
        setActivities(activitiesData);
        setUpcomingTrainings(trainingsData);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setError('Не удалось загрузить данные панели управления');
        console.error('Dashboard error:', err);
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const getActivityIcon = useCallback((iconName: string) => {
    switch (iconName) {
      case 'People':
        return <People color="primary" />;
      case 'AttachMoney':
        return <AttachMoney color="success" />;
      case 'CheckCircle':
        return <CheckCircle color="success" />;
      case 'Person':
        return <Person color="warning" />;
      default:
        return <CheckCircle color="primary" />;
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Сегодня, ${format(date, 'HH:mm', { locale: ru })}`;
    } else if (diffDays === 1) {
      return `Завтра, ${format(date, 'HH:mm', { locale: ru })}`;
    } else if (diffDays < 7) {
      return format(date, 'EEEE, d MMMM, HH:mm', { locale: ru });
    } else {
      return format(date, 'd MMMM, HH:mm', { locale: ru });
    }
  }, []);

  const statCards = useMemo(() => {
    const isTrainer = user?.role === 'TRAINER';
    
    const allCards = [
      {
        title: 'Всего клиентов',
        value: stats?.totalClients || 0,
        icon: <People />,
        color: '#1976d2',
        show: true,
      },
      {
        title: 'Активные клиенты',
        value: stats?.activeClients || 0,
        icon: <CheckCircle />,
        color: '#388e3c',
        show: true,
      },
      {
        title: 'Тренеры',
        value: stats?.totalTrainers || 0,
        icon: <Person />,
        color: '#f57c00',
        show: !isTrainer,
      },
      {
        title: 'Группы',
        value: stats?.totalGroups || 0,
        icon: <Groups />,
        color: '#7b1fa2',
        show: true,
      },
      {
        title: 'Филиалы',
        value: stats?.totalBranches || 0,
        icon: <Business />,
        color: '#d32f2f',
        show: !isTrainer,
      },
      {
        title: 'Месячный доход',
        value: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(stats?.monthlyRevenue || 0),
        icon: <AttachMoney />,
        color: '#388e3c',
        show: !isTrainer,
      },
      {
        title: 'Посещаемость',
        value: `${stats?.attendanceRate || 0}%`,
        icon: <TrendingUp />,
        color: '#1976d2',
        show: true,
      },
      {
        title: 'Предстоящие тренировки',
        value: stats?.upcomingTrainings || 0,
        icon: <Schedule />,
        color: '#f57c00',
        show: true,
      },
    ];
    
    return allCards.filter(card => card.show);
  }, [stats, user?.role]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Добро пожаловать, {user?.firstName}!
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {tenant?.name} - Обзор панели управления
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                      {stat.value}
                    </Typography>
                  </Box>
                  <Avatar
                    sx={{
                      backgroundColor: stat.color,
                      width: 56,
                      height: 56,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {user?.role !== 'TRAINER' && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: 400, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium' }}>
                Последняя активность
              </Typography>
            {activities.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Нет активности
                </Typography>
              </Box>
            ) : (
              <List>
                {activities.map((activity, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {getActivityIcon(activity.icon)}
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.title}
                      secondary={
                        <Box>
                          <Typography variant="body2" component="span">
                            {activity.description}
                          </Typography>
                          {activity.amount && (
                            <Typography variant="body2" component="span" sx={{ ml: 1, fontWeight: 'bold', color: 'success.main' }}>
                              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(activity.amount)}
                            </Typography>
                          )}
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                            {format(new Date(activity.timestamp), 'd MMMM yyyy, HH:mm', { locale: ru })}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
          </Grid>
        )}

        <Grid item xs={12} md={user?.role !== 'TRAINER' ? 6 : 12}>
          <Paper sx={{ p: 2, height: 400, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium' }}>
              Предстоящие тренировки
            </Typography>
            {upcomingTrainings.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Нет предстоящих тренировок
                </Typography>
              </Box>
            ) : (
              <List>
                {upcomingTrainings.map((training) => (
                  <ListItem 
                    key={training.id}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => navigate('/schedule')}
                  >
                    <ListItemIcon>
                      <Schedule color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={training.title || training.group?.name || 'Тренировка'}
                      secondary={
                        <Box>
                          <Typography variant="body2" component="span">
                            {formatDate(training.startTime)} - {format(new Date(training.endTime), 'HH:mm', { locale: ru })}
                          </Typography>
                          {training.trainer?.user && (
                            <Typography variant="body2" component="span" display="block" color="text.secondary">
                              Тренер: {training.trainer.user.firstName} {training.trainer.user.lastName}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <Chip 
                      label={`${training.memberCount} ${training.memberCount === 1 ? 'ученик' : training.memberCount < 5 ? 'ученика' : 'учеников'}`} 
                      size="small" 
                      color={training.memberCount > 15 ? 'primary' : training.memberCount > 10 ? 'secondary' : 'default'} 
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium' }}>
              Быстрые действия
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
                  onClick={() => navigate('/clients')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <People sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6">Добавить клиента</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Зарегистрировать нового ученика
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card 
                  sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
                  onClick={() => navigate('/schedule')}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Schedule sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6">Запланировать тренировку</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Создать новый класс
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {user?.role !== 'TRAINER' && (
                <Grid item xs={12} sm={6} md={3}>
                  <Card 
                    sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
                    onClick={() => navigate('/payments')}
                  >
                    <CardContent sx={{ textAlign: 'center' }}>
                      <AttachMoney sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="h6">Записать платеж</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Обработать платеж
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
