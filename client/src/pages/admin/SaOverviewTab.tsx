import React from 'react';
import {
  Box,
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
  Button,
} from '@mui/material';
import { TrendingUp, AccountBalance, Warning } from '@mui/icons-material';
import type { SaSection } from '../../config/saDashboard';

export type SaOverviewDashboardData = {
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
    plannedExpensesThisMonth?: number;
    plannedSpendThisMonth?: number;
    totalExpenses: number;
    totalMarketerPayments: number;
    availableBudget: number;
    hasInsufficientFunds: boolean;
    settings: {
      reservePercentage: number | null;
      reserveAmount: number | null;
      errorLogPath?: string | null;
    };
  };
  recentPayments: Array<{
    id: string;
    tenantName: string;
    amount: number;
    planType: string;
    paidAt: string;
    hasDiscount?: boolean;
    originalAmount?: number;
    discountAmount?: number;
  }>;
};

type Props = {
  data: SaOverviewDashboardData;
  formatCurrency: (amount: number) => string;
  formatDate: (dateString: string) => string;
  onNavigateSection: (section: SaSection) => void;
};

/** Обзор супер-админки: бюджет, аккаунты, подписки, платежи. */
const SaOverviewTab: React.FC<Props> = ({
  data,
  formatCurrency,
  formatDate,
  onNavigateSection,
}) => {
  return (
    <>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Общая выручка
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    {formatCurrency(data.revenue.total)}
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 32, color: 'primary.main', opacity: 0.3 }} />
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
                    Запланированные траты на этот месяц
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="info.main">
                    {formatCurrency(
                      data.budget.plannedSpendThisMonth ??
                        (data.budget.plannedExpensesThisMonth || 0) + (data.budget.totalUnpaidMarketers || 0)
                    )}
                  </Typography>
                </Box>
                <AccountBalance sx={{ fontSize: 32, color: 'info.main', opacity: 0.3 }} />
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
                    variant="h5"
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
                    fontSize: 32,
                    color: data.budget.hasInsufficientFunds ? 'error.main' : 'success.main',
                    opacity: 0.3,
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Быстрые действия
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {(
            [
              { section: 'accounts' as SaSection, label: 'Аккаунты' },
              { section: 'tariffs' as SaSection, label: 'Тарифы' },
              { section: 'metrics' as SaSection, label: 'Метрики' },
              { section: 'monitoring' as SaSection, label: 'Мониторинг' },
              { section: 'maintenance' as SaSection, label: 'ТО' },
              { section: 'chats' as SaSection, label: 'Чаты' },
            ] as const
          ).map((item) => (
            <Button
              key={item.section}
              size="small"
              variant="outlined"
              onClick={() => onNavigateSection(item.section)}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Всего аккаунтов
              </Typography>
              <Typography variant="h5" fontWeight="bold">
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
              <Typography variant="h5" fontWeight="bold" color="success.main">
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
              <Typography variant="h5" fontWeight="bold" color="warning.main">
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
              <Typography variant="h5" fontWeight="bold" color="error.main">
                {data.tenants.expired}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                    {payment.hasDiscount ? (
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{ textDecoration: 'line-through', color: 'text.secondary' }}
                        >
                          {formatCurrency(payment.originalAmount ?? payment.amount)}
                        </Typography>
                        <Typography variant="body1" color="success.main">
                          {formatCurrency(payment.amount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Скидка: {formatCurrency(payment.discountAmount ?? 0)}
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
  );
};

export default SaOverviewTab;
