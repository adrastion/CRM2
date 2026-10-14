import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import type { SaMetricsTab as SaMetricsTabKey } from '../../config/saDashboard';

export type SaMetricsTabProps = {
  tab: SaMetricsTabKey;
  onTabChange: (tab: SaMetricsTabKey) => void;
  analyticsData: any;
  analyticsLoading: boolean;
  forecastData: any;
  expenseCategories: any[];
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (value: Date | null) => void;
  onEndDateChange: (value: Date | null) => void;
  onClearDates: () => void;
  formatCurrency: (amount: number) => string;
  kpiData: any;
  kpiLoading: boolean;
  kpiPeriod: string;
  onKpiPeriodChange: (period: string) => void;
  onReloadKpi: () => void;
};

const SaMetricsTab: React.FC<SaMetricsTabProps> = ({
  tab,
  onTabChange,
  analyticsData,
  analyticsLoading,
  forecastData,
  expenseCategories,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClearDates,
  formatCurrency,
  kpiData,
  kpiLoading,
  kpiPeriod,
  onKpiPeriodChange,
  onReloadKpi,
}) => {
  return (
    <Box>
      <Tabs
        value={tab || 'analytics'}
        onChange={(_, v) => onTabChange(v as SaMetricsTabKey)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="analytics" label="Аналитика" />
        <Tab value="kpi" label="KPI" />
      </Tabs>

      {tab === 'analytics' && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              Расширенная аналитика
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
              <Box display="flex" gap={2}>
                <DatePicker
                  label="С"
                  value={startDate}
                  onChange={(newValue) => onStartDateChange(newValue)}
                  slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                />
                <DatePicker
                  label="По"
                  value={endDate}
                  onChange={(newValue) => onEndDateChange(newValue)}
                  slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                />
                {(startDate || endDate) && (
                  <Button size="small" onClick={onClearDates}>
                    Сбросить
                  </Button>
                )}
              </Box>
            </LocalizationProvider>
          </Box>

          {analyticsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : analyticsData ? (
            <>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Общий доход
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="success.main">
                        {formatCurrency(analyticsData.summary.totalIncome)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Общие расходы
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="error.main">
                        {formatCurrency(analyticsData.summary.totalExpenses)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Выплаты маркетологам
                      </Typography>
                      <Typography variant="h5" fontWeight="bold" color="warning.main">
                        {formatCurrency(analyticsData.summary.totalMarketerPayments)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Прибыль
                      </Typography>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color={analyticsData.summary.totalProfit >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(analyticsData.summary.totalProfit)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Динамика доходов и расходов
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={analyticsData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <RechartsTooltip
                            formatter={(value: any) => formatCurrency(Number(value))}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="income"
                            stroke="#4CAF50"
                            name="Доходы"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="expenses"
                            stroke="#F44336"
                            name="Расходы"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="marketerPayments"
                            stroke="#FF9800"
                            name="Выплаты маркетологам"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="profit"
                            stroke="#2196F3"
                            name="Прибыль"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {Object.keys(analyticsData.expensesByCategory).length > 0 && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Расходы по категориям
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Pie
                              data={Object.entries(analyticsData.expensesByCategory).map(([name, value]) => ({
                                name,
                                value: Number(value),
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={(entry: any) => {
                                const name = entry.name || '';
                                const percent = entry.percent || 0;
                                return `${name} ${(percent * 100).toFixed(0)}%`;
                              }}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.entries(analyticsData.expensesByCategory).map(([name], index) => {
                                const category = expenseCategories.find((c) => c.name === name);
                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={
                                      category?.color ||
                                      `#${Math.floor(Math.random() * 16777215).toString(16)}`
                                    }
                                  />
                                );
                              })}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: any) => formatCurrency(Number(value))}
                              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Доходы по тарифам
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsBarChart
                            data={Object.entries(analyticsData.incomeByPlan).map(([plan, amount]) => ({
                              plan,
                              amount: Number(amount),
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="plan" />
                            <YAxis />
                            <RechartsTooltip
                              formatter={(value: any) => formatCurrency(Number(value))}
                              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                            />
                            <Bar dataKey="amount" fill="#4CAF50" />
                          </RechartsBarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {forecastData && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Прогноз доходов на 6 месяцев
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsBarChart data={forecastData.forecast}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip
                          formatter={(value: any) => formatCurrency(Number(value))}
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                        />
                        <Bar dataKey="amount" fill="#2196F3" />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Alert severity="info">Выберите период для отображения аналитики</Alert>
          )}
        </Box>
      )}

      {tab === 'kpi' && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              KPI метрики
            </Typography>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Период</InputLabel>
              <Select
                value={kpiPeriod}
                label="Период"
                onChange={(e) => {
                  onKpiPeriodChange(e.target.value);
                  onReloadKpi();
                }}
              >
                <MenuItem value="week">Неделя</MenuItem>
                <MenuItem value="month">Месяц</MenuItem>
                <MenuItem value="quarter">Квартал</MenuItem>
                <MenuItem value="year">Год</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {kpiLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : kpiData ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      MRR
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {formatCurrency(kpiData.mrr)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Monthly Recurring Revenue
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      ARR
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {formatCurrency(kpiData.arr)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Annual Recurring Revenue
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Churn Rate
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="error.main">
                      {kpiData.churnRate}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Отток клиентов
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      LTV
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {formatCurrency(kpiData.avgLTV)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Lifetime Value
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      CAC
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="warning.main">
                      {formatCurrency(kpiData.cac)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Customer Acquisition Cost
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Conversion Rate
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="info.main">
                      {kpiData.conversionRate}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Конверсия в платные тарифы
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Доход за период
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {formatCurrency(kpiData.revenueInPeriod)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Новых аккаунтов
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {kpiData.newTenants}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">Загрузка метрик...</Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default SaMetricsTab;
