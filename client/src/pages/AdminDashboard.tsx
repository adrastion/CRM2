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
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  TrendingUp,
  People,
  AccountBalance,
  Warning,
  Settings,
  Visibility,
  CalendarToday,
  History,
  Add,
  Payment,
  AccountBox,
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
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [reservePercentage, setReservePercentage] = useState<string>('');
  const [reserveAmount, setReserveAmount] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);
  
  // История транзакций
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  
  // Все аккаунты
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  
  // Диалоги
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedPlanType, setSelectedPlanType] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [paymentMarketerId, setPaymentMarketerId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (tabValue === 1) {
      loadTransactions();
    } else if (tabValue === 2) {
      loadAllTenants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue]);

  useEffect(() => {
    if (tabValue === 1) {
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionTypeFilter]);

  const loadTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const result = await apiService.getTransactionHistory({
        type: transactionTypeFilter !== 'all' ? transactionTypeFilter : undefined,
      });
      setTransactions(result.transactions || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки истории транзакций');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const loadAllTenants = async () => {
    try {
      setTenantsLoading(true);
      const tenants = await apiService.getAllTenants();
      setAllTenants(tenants || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки аккаунтов');
    } finally {
      setTenantsLoading(false);
    }
  };

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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCreateExpense = async () => {
    if (!expenseAmount || !expenseDescription) {
      setError('Заполните все поля');
      return;
    }

    try {
      setSubmitting(true);
      await apiService.createExpense({
        amount: parseFloat(expenseAmount),
        description: expenseDescription,
      });
      setExpenseDialog(false);
      setExpenseAmount('');
      setExpenseDescription('');
      await loadTransactions();
      await loadDashboard();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания расхода');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayMarketer = async () => {
    if (!paymentMarketerId || !paymentAmount) {
      setError('Выберите маркетолога и укажите сумму');
      return;
    }

    try {
      setSubmitting(true);
      await apiService.payMarketer({
        marketerId: paymentMarketerId,
        amount: parseFloat(paymentAmount),
        description: paymentDescription || undefined,
      });
      setPaymentDialog(false);
      setPaymentMarketerId('');
      setPaymentAmount('');
      setPaymentDescription('');
      await loadTransactions();
      await loadDashboard();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка выплаты маркетологу');
    } finally {
      setSubmitting(false);
    }
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

      {/* Вкладки */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab icon={<TrendingUp />} label="Общая статистика" />
          <Tab icon={<History />} label="История поступления средств" />
          <Tab icon={<AccountBox />} label="Все аккаунты" />
        </Tabs>
      </Paper>

      {/* Контент вкладок */}
      {tabValue === 0 && data && (
        <>
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
              {data.recentPayments.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.tenantName}</TableCell>
                  <TableCell>
                    <Chip label={payment.planType} size="small" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {payment.hasDiscount ? (
                      <Box>
                        <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                          {formatCurrency(payment.originalAmount)}
                        </Typography>
                        <Typography variant="body1" color="success.main">
                          {formatCurrency(payment.amount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Скидка: {formatCurrency(payment.discountAmount)}
                        </Typography>
                      </Box>
                    ) : (
                      formatCurrency(payment.amount)
                    )}
                  </TableCell>
                  <TableCell>{formatDate(payment.paidAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
        </>
      )}

      {/* Вкладка: История поступления средств */}
      {tabValue === 1 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              История поступления средств
            </Typography>
            <Box display="flex" gap={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Тип транзакции</InputLabel>
                <Select
                  value={transactionTypeFilter}
                  label="Тип транзакции"
                  onChange={(e) => {
                    setTransactionTypeFilter(e.target.value);
                  }}
                >
                  <MenuItem value="all">Все</MenuItem>
                  <MenuItem value="income">Поступления</MenuItem>
                  <MenuItem value="expense">Расходы</MenuItem>
                  <MenuItem value="marketer_payment">Выплаты маркетологам</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setExpenseDialog(true)}
              >
                Создать расход
              </Button>
              <Button
                variant="contained"
                startIcon={<Payment />}
                onClick={() => setPaymentDialog(true)}
                disabled={!data?.marketers.list.length}
              >
                Выплатить маркетологу
              </Button>
            </Box>
          </Box>

          {transactionsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Paper>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Дата</TableCell>
                      <TableCell>Тип</TableCell>
                      <TableCell>Описание</TableCell>
                      <TableCell>Маркетолог</TableCell>
                      <TableCell align="right">Сумма</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography color="text.secondary" sx={{ py: 4 }}>
                            Нет транзакций
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((transaction: any) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                          <TableCell>
                            <Chip
                              label={
                                transaction.type === 'income'
                                  ? transaction.source === 'subscription' ? 'Платеж за подписку' : 'Поступление'
                                  : transaction.type === 'expense'
                                  ? 'Расход'
                                  : 'Выплата маркетологу'
                              }
                              color={
                                transaction.type === 'income'
                                  ? 'success'
                                  : transaction.type === 'expense'
                                  ? 'error'
                                  : 'warning'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {transaction.description}
                            {transaction.promoCode && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Промокод: {transaction.promoCode}
                              </Typography>
                            )}
                            {transaction.tenant && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Аккаунт: {transaction.tenant.name}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {transaction.marketer ? (
                              `${transaction.marketer.name} (${transaction.marketer.email})`
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {transaction.type === 'income' ? (
                              transaction.hasDiscount || transaction.discountAmount > 0 ? (
                                <Box>
                                  <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                                    {formatCurrency(transaction.originalAmount || transaction.amount)}
                                  </Typography>
                                  <Typography variant="body1" color="success.main">
                                    +{formatCurrency(transaction.amount)}
                                  </Typography>
                                  {transaction.discountAmount > 0 && (
                                    <Typography variant="caption" color="text.secondary">
                                      Скидка: {formatCurrency(transaction.discountAmount)}
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                `+${formatCurrency(transaction.amount)}`
                              )
                            ) : (
                              `-${formatCurrency(transaction.amount)}`
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* Вкладка: Все аккаунты */}
      {tabValue === 2 && (
        <Box>
          <Typography variant="h5" fontWeight="bold" mb={3}>
            Все аккаунты
          </Typography>

          {tenantsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Paper>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Название</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Поддомен</TableCell>
                      <TableCell>Тариф</TableCell>
                      <TableCell align="right">Админов</TableCell>
                      <TableCell align="right">Клиентов</TableCell>
                      <TableCell align="right">Тренеров</TableCell>
                      <TableCell align="right">Филиалов</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allTenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} align="center">
                          <Typography color="text.secondary" sx={{ py: 4 }}>
                            Нет аккаунтов
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      allTenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell>{tenant.name}</TableCell>
                          <TableCell>{tenant.email}</TableCell>
                          <TableCell>{tenant.subdomain}</TableCell>
                          <TableCell>
                            {tenant.subscription ? (
                              <Chip label={tenant.subscription.planType} size="small" />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right">{tenant.stats.admins}</TableCell>
                          <TableCell align="right">{tenant.stats.clients}</TableCell>
                          <TableCell align="right">{tenant.stats.trainers}</TableCell>
                          <TableCell align="right">{tenant.stats.branches}</TableCell>
                          <TableCell>
                            <Chip
                              label={tenant.isActive ? 'Активен' : 'Неактивен'}
                              color={tenant.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setSelectedTenantId(tenant.id);
                                setSelectedPlanType(tenant.subscription?.planType || 'FREE');
                                setPlanDialog(true);
                              }}
                              title="Изменить тариф"
                            >
                              <Settings />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* Диалог создания расхода */}
      <Dialog open={expenseDialog} onClose={() => setExpenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создать расход</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Сумма (₽)"
              type="number"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Описание"
              multiline
              rows={3}
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseDialog(false)}>Отмена</Button>
          <Button
            onClick={handleCreateExpense}
            variant="contained"
            disabled={submitting || !expenseAmount || !expenseDescription}
          >
            {submitting ? <CircularProgress size={24} /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог выплаты маркетологу */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Выплата маркетологу</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Маркетолог</InputLabel>
              <Select
                value={paymentMarketerId}
                label="Маркетолог"
                onChange={(e) => setPaymentMarketerId(e.target.value)}
                required
              >
                {data?.marketers.list.map((marketer) => (
                  <MenuItem key={marketer.id} value={marketer.id}>
                    {marketer.name} ({marketer.email}) - Баланс: {formatCurrency(marketer.balance)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Сумма (₽)"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Описание (необязательно)"
              multiline
              rows={2}
              value={paymentDescription}
              onChange={(e) => setPaymentDescription(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Отмена</Button>
          <Button
            onClick={handlePayMarketer}
            variant="contained"
            disabled={submitting || !paymentMarketerId || !paymentAmount}
          >
            {submitting ? <CircularProgress size={24} /> : 'Выплатить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог изменения тарифа */}
      <Dialog open={planDialog} onClose={() => setPlanDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Изменить тариф</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Тариф</InputLabel>
              <Select
                value={selectedPlanType}
                label="Тариф"
                onChange={(e) => setSelectedPlanType(e.target.value)}
              >
                <MenuItem value="FREE">FREE</MenuItem>
                <MenuItem value="STARTER">STARTER</MenuItem>
                <MenuItem value="BUSINESS">BUSINESS</MenuItem>
                <MenuItem value="PROFESSIONAL">PROFESSIONAL</MenuItem>
                <MenuItem value="ENTERPRISE">ENTERPRISE</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanDialog(false)}>Отмена</Button>
          <Button
            onClick={async () => {
              if (!selectedTenantId || !selectedPlanType) return;
              setSubmitting(true);
              try {
                await apiService.updateTenantPlan(selectedTenantId, selectedPlanType);
                await loadAllTenants();
                await loadDashboard();
                setPlanDialog(false);
                setSelectedTenantId('');
                setSelectedPlanType('');
              } catch (err: any) {
                setError(err.response?.data?.error || 'Ошибка обновления тарифа');
              } finally {
                setSubmitting(false);
              }
            }}
            variant="contained"
            disabled={submitting || !selectedPlanType}
          >
            {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

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

