import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  People,
  AccountBalance,
  Warning,
  Settings,
  Visibility,
  CalendarToday,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface DashboardData {
  tenants: {
    total: number;
    active: number;
    expired: number;
    soonExpiring: number;
  };
  subscriptions: {
    byPlan: Record<string, number>;
    soonExpiring: Array<{
      id: string;
      name: string;
      email: string;
      planType: string;
      endDate: string;
      daysUntilExpiry: number;
    }>;
    expired: Array<{
      id: string;
      name: string;
      email: string;
      planType: string;
      endDate: string;
    }>;
  };
  revenue: {
    total: number;
    currency: string;
  };
  marketers: {
    total: number;
    totalUnpaid: number;
    list: Array<{
      id: string;
      name: string;
      email: string;
      balance: number;
      commissionPercentage: number;
      referredClientsCount: number;
    }>;
  };
  budget: {
    totalRevenue: number;
    reserveAmount: number;
    totalUnpaidMarketers: number;
    availableBudget: number;
    hasInsufficientFunds: boolean;
    settings: {
      reservePercentage: number | null;
      reserveAmount: number | null;
    };
  };
  recentPayments: Array<{
    id: string;
    tenantName: string;
    amount: number;
    planType: string;
    paidAt: string;
  }>;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [reservePercentage, setReservePercentage] = useState<string>('');
  const [reserveAmount, setReserveAmount] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const dashboardData = await apiService.getAdminDashboard();
      setData(dashboardData);
      
      // Заполняем форму настроек
      if (dashboardData.budget.settings.reservePercentage !== null) {
        setReservePercentage(dashboardData.budget.settings.reservePercentage.toString());
      }
      if (dashboardData.budget.settings.reserveAmount !== null) {
        setReserveAmount(dashboardData.budget.settings.reserveAmount.toString());
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки дашборда');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await apiService.updateAdminSettings({
        reservePercentage: reservePercentage ? parseFloat(reservePercentage) : undefined,
        reserveAmount: reserveAmount ? parseFloat(reserveAmount) : undefined,
      });
      setSettingsDialog(false);
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения настроек');
    } finally {
      setSavingSettings(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Панель управления
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Settings />}
          onClick={() => setSettingsDialog(true)}
        >
          Настройки резерва
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Бюджет и финансы */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Общая выручка
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {formatCurrency(data.revenue.total)}
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 48, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Резерв
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="info.main">
                    {formatCurrency(data.budget.reserveAmount)}
                  </Typography>
                </Box>
                <AccountBalance sx={{ fontSize: 48, color: 'info.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              border: data.budget.hasInsufficientFunds ? 2 : 0,
              borderColor: data.budget.hasInsufficientFunds ? 'error.main' : 'transparent',
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Доступный бюджет
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    color={data.budget.hasInsufficientFunds ? 'error.main' : 'success.main'}
                  >
                    {formatCurrency(data.budget.availableBudget)}
                  </Typography>
                  {data.budget.hasInsufficientFunds && (
                    <Chip
                      label="Недостаточно средств"
                      color="error"
                      size="small"
                      sx={{ mt: 1 }}
                      icon={<Warning />}
                    />
                  )}
                </Box>
                <AccountBalance
                  sx={{
                    fontSize: 48,
                    color: data.budget.hasInsufficientFunds ? 'error.main' : 'success.main',
                    opacity: 0.3,
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Статистика по аккаунтам */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Всего аккаунтов
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {data.tenants.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Активных
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="success.main">
                {data.tenants.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Истекают в течение 7 дней
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="warning.main">
                {data.tenants.soonExpiring}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Истекших
              </Typography>
              <Typography variant="h3" fontWeight="bold" color="error.main">
                {data.tenants.expired}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Распределение по тарифам */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Распределение по тарифам
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Тариф</TableCell>
                    <TableCell align="right">Количество</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(data.subscriptions.byPlan).map(([plan, count]) => (
                    <TableRow key={plan}>
                      <TableCell>
                        <Chip label={plan} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="h6">{count}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Маркетологи
            </Typography>
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">
                Всего маркетологов: {data.marketers.total}
              </Typography>
              <Typography variant="h6" color="warning.main" fontWeight="bold">
                Невыплачено: {formatCurrency(data.marketers.totalUnpaid)}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Имя</TableCell>
                    <TableCell align="right">Баланс</TableCell>
                    <TableCell align="right">%</TableCell>
                    <TableCell align="right">Клиентов</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.marketers.list.map((marketer) => (
                    <TableRow key={marketer.id}>
                      <TableCell>{marketer.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(marketer.balance)}
                      </TableCell>
                      <TableCell align="right">{marketer.commissionPercentage}%</TableCell>
                      <TableCell align="right">{marketer.referredClientsCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Подписки, которые скоро истекают */}
      {data.subscriptions.soonExpiring.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" color="warning.main">
            Подписки, истекающие в течение 7 дней
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Аккаунт</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Тариф</TableCell>
                  <TableCell>Дата окончания</TableCell>
                  <TableCell>Осталось дней</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.subscriptions.soonExpiring.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>{sub.name}</TableCell>
                    <TableCell>{sub.email}</TableCell>
                    <TableCell>
                      <Chip label={sub.planType} size="small" />
                    </TableCell>
                    <TableCell>{formatDate(sub.endDate)}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${sub.daysUntilExpiry} дн.`}
                        color="warning"
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Истекшие подписки */}
      {data.subscriptions.expired.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" color="error.main">
            Истекшие подписки
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Аккаунт</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Тариф</TableCell>
                  <TableCell>Дата окончания</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.subscriptions.expired.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>{sub.name}</TableCell>
                    <TableCell>{sub.email}</TableCell>
                    <TableCell>
                      <Chip label={sub.planType} size="small" />
                    </TableCell>
                    <TableCell>{formatDate(sub.endDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Последние платежи */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Последние платежи
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Аккаунт</TableCell>
                <TableCell>Тариф</TableCell>
                <TableCell align="right">Сумма</TableCell>
                <TableCell>Дата оплаты</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recentPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.tenantName}</TableCell>
                  <TableCell>
                    <Chip label={payment.planType} size="small" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>{formatDate(payment.paidAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Диалог настроек резерва */}
      <Dialog open={settingsDialog} onClose={() => setSettingsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Настройки резерва</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Процент от общей суммы (%)"
              type="number"
              value={reservePercentage}
              onChange={(e) => {
                setReservePercentage(e.target.value);
                if (e.target.value) {
                  setReserveAmount('');
                }
              }}
              helperText="Если указан процент, фиксированная сумма будет проигнорирована"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Фиксированная сумма (₽)"
              type="number"
              value={reserveAmount}
              onChange={(e) => {
                setReserveAmount(e.target.value);
                if (e.target.value) {
                  setReservePercentage('');
                }
              }}
              helperText="Если указана фиксированная сумма, процент будет проигнорирован"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>Отмена</Button>
          <Button
            onClick={handleSaveSettings}
            variant="contained"
            disabled={savingSettings}
          >
            {savingSettings ? <CircularProgress size={24} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminDashboard;

