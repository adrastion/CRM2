import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  AccountBalance,
  Warning,
  Settings,
  History,
  Add,
  Payment,
  AccountBox,
  ShowChart,
  Edit,
  Delete,
  GetApp,
  Assessment,
  Security,
  AttachMoney,
  People,
  DragIndicator,
  Visibility,
  VisibilityOff,
  Bookmark,
} from '@mui/icons-material';
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiService } from '../services/api';

type PlatformStaffRole = 'SUPPORT' | 'DESIGNER' | 'SECURITY';

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
    totalExpenses: number;
    totalMarketerPayments: number;
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

// Компонент для перетаскиваемого виджета
interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  title: string;
  visible: boolean;
  onToggleVisibility: () => void;
}

const SortableWidget: React.FC<SortableWidgetProps> = ({ id, children, title, visible, onToggleVisibility }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!visible) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton
                {...attributes}
                {...listeners}
                size="small"
                sx={{ cursor: 'grab' }}
              >
                <DragIndicator />
              </IconButton>
              <Typography variant="h6" fontWeight="bold">
                {title}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={onToggleVisibility}
              title="Скрыть виджет"
            >
              <Visibility />
            </IconButton>
          </Box>
          {children}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  // const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [staffDialog, setStaffDialog] = useState(false);
  const [newStaff, setNewStaff] = useState<{ email: string; role: PlatformStaffRole; firstName: string; lastName: string }>({
    email: '',
    role: 'SUPPORT',
    firstName: '',
    lastName: '',
  });
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [reservePercentage, setReservePercentage] = useState<string>('');
  const [reserveAmount, setReserveAmount] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);
  
  // История транзакций
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  // Категории расходов
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  
  // Расширенная аналитика
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [forecastData, setForecastData] = useState<any>(null);
  
  // Виджеты дашборда
  const [widgetOrder, setWidgetOrder] = useState<string[]>([
    'revenue',
    'expenses',
    'profit',
    'forecast',
    'categories',
    'plans',
  ]);
  const [widgetVisibility, setWidgetVisibility] = useState<Record<string, boolean>>({
    revenue: true,
    expenses: true,
    profit: true,
    forecast: true,
    categories: true,
    plans: true,
  });
  
  // Пресеты дашборда
  const [presets, setPresets] = useState<any[]>([]);
  const [currentPreset, setCurrentPreset] = useState<any>(null);
  const [presetDialog, setPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState<string>('');
  const [presetIsDefault, setPresetIsDefault] = useState<boolean>(false);
  const [, setPresetsLoading] = useState(false);
  
  // Датчики для drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Все аккаунты
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  
  // Диалоги
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [planDialog, setPlanDialog] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedPlanType, setSelectedPlanType] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [categoryDescription, setCategoryDescription] = useState<string>('');
  const [categoryColor, setCategoryColor] = useState<string>('#2196F3');
  const [paymentMarketerId, setPaymentMarketerId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  
  // KPI метрики
  const [kpiData, setKpiData] = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiPeriod, setKpiPeriod] = useState<string>('month');
  
  // Логи аудита
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  /* eslint-disable @typescript-eslint/no-unused-vars -- offset/total reserved for audit log pagination */
  const [auditLogsOffset, setAuditLogsOffset] = useState(0);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const [auditLogsActionFilter, setAuditLogsActionFilter] = useState<string>('all');
  const [auditLogsEntityTypeFilter, setAuditLogsEntityTypeFilter] = useState<string>('all');
  
  // Управление тарифами
  const [planPrices, setPlanPrices] = useState<any[]>([]);
  const [planPricesLoading, setPlanPricesLoading] = useState(false);
  const [editPlanDialog, setEditPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [editingPlanPrice, setEditingPlanPrice] = useState<string>('');
  const [editingPlanLimits, setEditingPlanLimits] = useState({
    trainers: '',
    clients: '',
    groups: '',
    branches: '',
    trainings: '',
  });
  
  // Расширенная статистика маркетологов
  const [marketerStats, setMarketerStats] = useState<any>(null);
  const [marketerStatsLoading, setMarketerStatsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter reserved for marketer filter UI
  const [selectedMarketerId, setSelectedMarketerId] = useState<string>('');
  
  // Редактирование расходов
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editExpenseDialog, setEditExpenseDialog] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadExpenseCategories();
    loadForecast();
    loadPresets();
  }, []);

  useEffect(() => {
    // Загружаем пресет по умолчанию при загрузке пресетов
    if (presets.length > 0 && !currentPreset) {
      const defaultPreset = presets.find(p => p.isDefault) || presets[0];
      if (defaultPreset) {
        setCurrentPreset(defaultPreset);
        setWidgetOrder(defaultPreset.widgetOrder || widgetOrder);
        setWidgetVisibility(defaultPreset.widgetVisibility || widgetVisibility);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  useEffect(() => {
    // Загружаем аналитику для главной вкладки, если даты установлены
    if (startDate && endDate && tabValue === 0) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, tabValue]);

  useEffect(() => {
    if (tabValue === 1) {
      loadTransactions();
    } else if (tabValue === 2) {
      loadAllTenants();
    } else if (tabValue === 3) {
      loadAnalytics();
    } else if (tabValue === 4) {
      loadKPIMetrics();
    } else if (tabValue === 5) {
      loadAuditLogs();
    } else if (tabValue === 6) {
      loadPlanPrices();
    } else if (tabValue === 7) {
      loadMarketerStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue]);

  useEffect(() => {
    if (tabValue === 1) {
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionTypeFilter, startDate, endDate, selectedCategoryId]);

  useEffect(() => {
    if (tabValue === 3) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const loadTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const params: any = {
        type: transactionTypeFilter !== 'all' ? transactionTypeFilter : undefined,
        startDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
        endDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
        categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : undefined,
      };
      const result = await apiService.getTransactionHistory(params);
      setTransactions(result.transactions || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки истории транзакций');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const loadExpenseCategories = async () => {
    try {
      const categories = await apiService.getExpenseCategories();
      setExpenseCategories(categories || []);
    } catch (err: any) {
      console.error('Ошибка загрузки категорий:', err);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const params: any = {
        startDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
        endDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
      };
      const analytics = await apiService.getAnalyticsByPeriod(params);
      setAnalyticsData(analytics);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки аналитики');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadForecast = async () => {
    try {
      const forecast = await apiService.getRevenueForecast();
      setForecastData(forecast);
    } catch (err: any) {
      console.error('Ошибка загрузки прогноза:', err);
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
        categoryId: expenseCategoryId || undefined,
      });
      setExpenseDialog(false);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseCategoryId('');
      await loadTransactions();
      await loadDashboard();
      await loadAnalytics();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания расхода');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryName) {
      setError('Название категории обязательно');
      return;
    }

    try {
      setSubmitting(true);
      await apiService.createExpenseCategory({
        name: categoryName,
        description: categoryDescription,
        color: categoryColor,
      });
      setCategoryDialog(false);
      setCategoryName('');
      setCategoryDescription('');
      setCategoryColor('#2196F3');
      await loadExpenseCategories();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания категории');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkAction = async (action: string, data?: any) => {
    if (selectedTenants.length === 0) {
      setError('Выберите хотя бы один аккаунт');
      return;
    }

    try {
      setSubmitting(true);
      await apiService.bulkUpdateTenants({
        tenantIds: selectedTenants,
        action,
        data,
      });
      setSelectedTenants([]);
      await loadAllTenants();
      await loadDashboard();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка выполнения действия');
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

  const loadKPIMetrics = async () => {
    try {
      setKpiLoading(true);
      const data = await apiService.getKPIMetrics(kpiPeriod);
      setKpiData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки KPI метрик');
    } finally {
      setKpiLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setAuditLogsLoading(true);
      const params: any = {
        limit: 50,
        offset: auditLogsOffset,
      };
      if (auditLogsActionFilter !== 'all') {
        params.action = auditLogsActionFilter;
      }
      if (auditLogsEntityTypeFilter !== 'all') {
        params.entityType = auditLogsEntityTypeFilter;
      }
      const data = await apiService.getAuditLogs(params);
      setAuditLogs(data.logs);
      setAuditLogsTotal(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки логов аудита');
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const loadPlanPrices = async () => {
    try {
      setPlanPricesLoading(true);
      const data = await apiService.getPlanPrices();
      setPlanPrices(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки цен тарифов');
    } finally {
      setPlanPricesLoading(false);
    }
  };

  const loadMarketerStats = async () => {
    try {
      setMarketerStatsLoading(true);
      const data = await apiService.getAdminMarketerStats(selectedMarketerId || undefined);
      setMarketerStats(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки статистики маркетологов');
    } finally {
      setMarketerStatsLoading(false);
    }
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setExpenseAmount(expense.amount.toString());
    setExpenseDescription(expense.description);
    setExpenseCategoryId(expense.categoryId || '');
    setEditExpenseDialog(true);
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense || !expenseAmount || !expenseDescription) {
      setError('Заполните все обязательные поля');
      return;
    }

    try {
      setSubmitting(true);
      await apiService.updateExpense(editingExpense.id, {
        amount: parseFloat(expenseAmount),
        description: expenseDescription,
        categoryId: expenseCategoryId || undefined,
      });
      setEditExpenseDialog(false);
      setEditingExpense(null);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseCategoryId('');
      await loadTransactions();
      await loadDashboard();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления расхода');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот расход?')) {
      return;
    }

    try {
      setSubmitting(true);
      await apiService.deleteExpense(expenseId);
      await loadTransactions();
      await loadDashboard();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка удаления расхода');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportTransactions = async () => {
    try {
      const params: any = {};
      if (transactionTypeFilter !== 'all') params.type = transactionTypeFilter;
      if (startDate) params.startDate = startDate.toISOString().split('T')[0];
      if (endDate) params.endDate = endDate.toISOString().split('T')[0];
      if (selectedCategoryId !== 'all') params.categoryId = selectedCategoryId;
      
      const blob = await apiService.exportTransactions(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка экспорта транзакций');
    }
  };

  const handleExportTenants = async () => {
    try {
      const blob = await apiService.exportTenants();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenants_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка экспорта аккаунтов');
    }
  };

  const handleExportMarketers = async () => {
    try {
      const blob = await apiService.exportMarketers();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marketers_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка экспорта маркетологов');
    }
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlan(plan);
    setEditingPlanPrice(plan.price.toString());
    setEditingPlanLimits({
      trainers: plan.limits.trainers === 'unlimited' ? 'unlimited' : plan.limits.trainers.toString(),
      clients: plan.limits.clients === 'unlimited' ? 'unlimited' : plan.limits.clients.toString(),
      groups: plan.limits.groups === 'unlimited' ? 'unlimited' : plan.limits.groups.toString(),
      branches: plan.limits.branches === 'unlimited' ? 'unlimited' : plan.limits.branches.toString(),
      trainings: plan.limits.trainings === 'unlimited' ? 'unlimited' : plan.limits.trainings.toString(),
    });
    setEditPlanDialog(true);
  };

  const handleUpdatePlanPrice = async () => {
    if (!editingPlan || !editingPlanPrice) {
      setError('Заполните все обязательные поля');
      return;
    }

    try {
      setSubmitting(true);
      const limits: any = {};
      
      // Преобразуем лимиты
      Object.keys(editingPlanLimits).forEach((key) => {
        const value = editingPlanLimits[key as keyof typeof editingPlanLimits];
        if (value === 'unlimited') {
          limits[key] = 'unlimited';
        } else if (value && !isNaN(Number(value))) {
          limits[key] = Number(value);
        }
      });

      await apiService.updatePlanPrice({
        planType: editingPlan.planType,
        price: parseFloat(editingPlanPrice),
        limits,
      });
      setEditPlanDialog(false);
      setEditingPlan(null);
      setEditingPlanPrice('');
      setEditingPlanLimits({
        trainers: '',
        clients: '',
        groups: '',
        branches: '',
        trainings: '',
      });
      await loadPlanPrices();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления тарифа');
    } finally {
      setSubmitting(false);
    }
  };

  const loadPresets = async () => {
    try {
      setPresetsLoading(true);
      const data = await apiService.getDashboardPresets();
      setPresets(data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки пресетов');
    } finally {
      setPresetsLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgetOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleToggleWidgetVisibility = (widgetId: string) => {
    setWidgetVisibility((prev) => ({
      ...prev,
      [widgetId]: !prev[widgetId],
    }));
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      setError('Введите название пресета');
      return;
    }

    try {
      setSubmitting(true);
      const preset = await apiService.saveDashboardPreset({
        id: currentPreset?.id,
        name: presetName,
        isDefault: presetIsDefault,
        widgetOrder,
        widgetVisibility,
      });
      setPresetDialog(false);
      setPresetName('');
      setPresetIsDefault(false);
      await loadPresets();
      setCurrentPreset(preset);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка сохранения пресета');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadPreset = async (preset: any) => {
    setCurrentPreset(preset);
    setWidgetOrder(preset.widgetOrder || widgetOrder);
    setWidgetVisibility(preset.widgetVisibility || widgetVisibility);
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот пресет?')) {
      return;
    }

    try {
      setSubmitting(true);
      await apiService.deleteDashboardPreset(presetId);
      await loadPresets();
      if (currentPreset?.id === presetId) {
        setCurrentPreset(null);
        // Сбрасываем к дефолтным значениям
        setWidgetOrder(['revenue', 'expenses', 'profit', 'forecast', 'categories', 'plans']);
        setWidgetVisibility({
          revenue: true,
          expenses: true,
          profit: true,
          forecast: true,
          categories: true,
          plans: true,
        });
      }
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка удаления пресета');
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

  if (!data) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Панель управления
          </Typography>
          <Button component={RouterLink} to="/admin/support-hub" size="small" sx={{ mt: 1 }}>
            Поддержка и дизайн — чаты и записи
          </Button>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => {
              setOneTimePassword(null);
              setNewStaff({ email: '', role: 'SUPPORT', firstName: '', lastName: '' });
              setStaffDialog(true);
            }}
          >
            Создать сотрудника платформы
          </Button>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Пресет дашборда</InputLabel>
            <Select
              value={currentPreset?.id || ''}
              label="Пресет дашборда"
              onChange={(e) => {
                const preset = presets.find(p => p.id === e.target.value);
                if (preset) {
                  handleLoadPreset(preset);
                } else {
                  setCurrentPreset(null);
                  setWidgetOrder(['revenue', 'expenses', 'profit', 'forecast', 'categories', 'plans']);
                  setWidgetVisibility({
                    revenue: true,
                    expenses: true,
                    profit: true,
                    forecast: true,
                    categories: true,
                    plans: true,
                  });
                }
              }}
            >
              <MenuItem value="">
                <em>По умолчанию</em>
              </MenuItem>
              {presets.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.name} {preset.isDefault && '(По умолчанию)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<Bookmark />}
            onClick={() => {
              setPresetName(currentPreset?.name || '');
              setPresetIsDefault(currentPreset?.isDefault || false);
              setPresetDialog(true);
            }}
          >
            Сохранить пресет
          </Button>
          <Button
            variant="outlined"
            startIcon={<Settings />}
            onClick={() => setSettingsDialog(true)}
          >
            Настройки резерва
          </Button>
        </Box>
      </Box>

      <Dialog open={staffDialog} onClose={() => setStaffDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создание сотрудника платформы</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Будет создана учётная запись техподдержки / дизайнера / безопасности. Система выдаст одноразовый пароль — при первом входе сотрудник обязан сменить пароль.
          </Typography>
          {oneTimePassword && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Одноразовый пароль: <b>{oneTimePassword}</b>
            </Alert>
          )}
          <TextField
            label="Email"
            fullWidth
            margin="normal"
            value={newStaff.email}
            onChange={(e) => setNewStaff((p) => ({ ...p, email: e.target.value }))}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Роль</InputLabel>
            <Select
              value={newStaff.role}
              label="Роль"
              onChange={(e) => setNewStaff((p) => ({ ...p, role: e.target.value as PlatformStaffRole }))}
            >
              <MenuItem value="SUPPORT">SUPPORT (техподдержка)</MenuItem>
              <MenuItem value="DESIGNER">DESIGNER (дизайнер)</MenuItem>
              <MenuItem value="SECURITY">SECURITY (безопасность)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Имя"
            fullWidth
            margin="normal"
            value={newStaff.firstName}
            onChange={(e) => setNewStaff((p) => ({ ...p, firstName: e.target.value }))}
          />
          <TextField
            label="Фамилия"
            fullWidth
            margin="normal"
            value={newStaff.lastName}
            onChange={(e) => setNewStaff((p) => ({ ...p, lastName: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStaffDialog(false)}>Закрыть</Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              try {
                const resp = await apiService.superAdminCreatePlatformStaffUser({
                  email: newStaff.email,
                  role: newStaff.role,
                  firstName: newStaff.firstName,
                  lastName: newStaff.lastName,
                });
                setOneTimePassword(resp.oneTimePassword);
              } catch (e: any) {
                setError(e?.response?.data?.error || 'Ошибка создания сотрудника');
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Вкладки */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} variant="scrollable" scrollButtons="auto">
          <Tab icon={<TrendingUp />} label="Общая статистика" />
          <Tab icon={<History />} label="История транзакций" />
          <Tab icon={<AccountBox />} label="Все аккаунты" />
          <Tab icon={<ShowChart />} label="Аналитика" />
          <Tab icon={<Assessment />} label="KPI метрики" />
          <Tab icon={<Security />} label="Логи аудита" />
          <Tab icon={<AttachMoney />} label="Управление тарифами" />
          <Tab icon={<People />} label="Маркетологи" />
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

      {/* Виджеты с возможностью перетаскивания */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgetOrder} strategy={verticalListSortingStrategy}>
          {widgetOrder.map((widgetId) => {
            if (!widgetVisibility[widgetId]) return null;

            switch (widgetId) {
              case 'revenue':
                if (!analyticsData || !analyticsData.chartData || analyticsData.chartData.length === 0) return null;
                return (
                  <SortableWidget
                    key={widgetId}
                    id={widgetId}
                    title="Динамика доходов и расходов"
                    visible={widgetVisibility[widgetId]}
                    onToggleVisibility={() => handleToggleWidgetVisibility(widgetId)}
                  >
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analyticsData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <RechartsTooltip 
                          formatter={(value: any) => formatCurrency(Number(value))}
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="income" stroke="#4CAF50" name="Доходы" strokeWidth={2} />
                        <Line type="monotone" dataKey="expenses" stroke="#F44336" name="Расходы" strokeWidth={2} />
                        <Line type="monotone" dataKey="profit" stroke="#2196F3" name="Прибыль" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </SortableWidget>
                );
              case 'forecast':
                if (!forecastData) return null;
                return (
                  <SortableWidget
                    key={widgetId}
                    id={widgetId}
                    title="Прогноз доходов на 6 месяцев"
                    visible={widgetVisibility[widgetId]}
                    onToggleVisibility={() => handleToggleWidgetVisibility(widgetId)}
                  >
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
                  </SortableWidget>
                );
              case 'categories':
                if (!analyticsData || Object.keys(analyticsData.expensesByCategory).length === 0) return null;
                return (
                  <SortableWidget
                    key={widgetId}
                    id={widgetId}
                    title="Расходы по категориям"
                    visible={widgetVisibility[widgetId]}
                    onToggleVisibility={() => handleToggleWidgetVisibility(widgetId)}
                  >
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
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
                                const category = expenseCategories.find(c => c.name === name);
                                return (
                                  <Cell key={`cell-${index}`} fill={category?.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`} />
                                );
                              })}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value: any) => formatCurrency(Number(value))}
                              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsBarChart data={Object.entries(analyticsData.incomeByPlan).map(([plan, amount]) => ({
                            plan,
                            amount: Number(amount),
                          }))}>
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
                      </Grid>
                    </Grid>
                  </SortableWidget>
                );
              default:
                return null;
            }
          })}
        </SortableContext>
      </DndContext>

      {/* Список скрытых виджетов */}
      {Object.entries(widgetVisibility).some(([_, visible]) => !visible) && (
        <Card sx={{ mb: 3, bgcolor: 'grey.100' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Скрытые виджеты
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {Object.entries(widgetVisibility)
                .filter(([_, visible]) => !visible)
                .map(([widgetId]) => (
                  <Chip
                    key={widgetId}
                    label={
                      widgetId === 'revenue' ? 'Динамика доходов' :
                      widgetId === 'forecast' ? 'Прогноз доходов' :
                      widgetId === 'categories' ? 'Расходы по категориям' :
                      widgetId
                    }
                    onClick={() => handleToggleWidgetVisibility(widgetId)}
                    icon={<VisibilityOff />}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
            </Box>
          </CardContent>
        </Card>
      )}

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

      {/* Вкладка: История транзакций */}
      {tabValue === 1 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              История транзакций
            </Typography>
            <Box display="flex" gap={2}>
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

          {/* Фильтры */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
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
              
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Категория</InputLabel>
                <Select
                  value={selectedCategoryId}
                  label="Категория"
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                  }}
                >
                  <MenuItem value="all">Все категории</MenuItem>
                  {expenseCategories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                <DatePicker
                  label="С"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                />
                <DatePicker
                  label="По"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                />
              </LocalizationProvider>

              {(startDate || endDate) && (
                <Button
                  size="small"
                  onClick={() => {
                    setStartDate(null);
                    setEndDate(null);
                  }}
                >
                  Сбросить даты
                </Button>
              )}
            </Box>
          </Paper>

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
                      <TableCell>Категория</TableCell>
                      <TableCell>Маркетолог</TableCell>
                      <TableCell align="right">Сумма</TableCell>
                      <TableCell align="right">Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
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
                            {transaction.category ? (
                              <Chip
                                label={transaction.category.name}
                                size="small"
                                sx={{
                                  backgroundColor: transaction.category.color || '#2196F3',
                                  color: 'white',
                                }}
                              />
                            ) : (
                              '-'
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
                          <TableCell align="right">
                            {transaction.type === 'expense' && (
                              <Box display="flex" gap={1} justifyContent="flex-end">
                                <Tooltip title="Редактировать">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditExpense(transaction)}
                                  >
                                    <Edit fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Удалить">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteExpense(transaction.id)}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box display="flex" justifyContent="flex-end" p={2}>
                <Button
                  variant="outlined"
                  startIcon={<GetApp />}
                  onClick={handleExportTransactions}
                >
                  Экспорт в Excel
                </Button>
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* Вкладка: Все аккаунты */}
      {tabValue === 2 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              Все аккаунты
            </Typography>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                startIcon={<GetApp />}
                onClick={handleExportTenants}
              >
                Экспорт в Excel
              </Button>
              {selectedTenants.length > 0 && (
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleBulkAction('activate')}
                    disabled={submitting}
                  >
                    Активировать ({selectedTenants.length})
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => handleBulkAction('deactivate')}
                    disabled={submitting}
                  >
                    Деактивировать ({selectedTenants.length})
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

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
                      <TableCell padding="checkbox">
                        <input
                          type="checkbox"
                          checked={selectedTenants.length === allTenants.length && allTenants.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTenants(allTenants.map(t => t.id));
                            } else {
                              setSelectedTenants([]);
                            }
                          }}
                        />
                      </TableCell>
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
                        <TableCell colSpan={11} align="center">
                          <Typography color="text.secondary" sx={{ py: 4 }}>
                            Нет аккаунтов
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      allTenants.map((tenant) => (
                        <TableRow key={tenant.id}>
                          <TableCell padding="checkbox">
                            <input
                              type="checkbox"
                              checked={selectedTenants.includes(tenant.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTenants([...selectedTenants, tenant.id]);
                                } else {
                                  setSelectedTenants(selectedTenants.filter(id => id !== tenant.id));
                                }
                              }}
                            />
                          </TableCell>
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

      {/* Вкладка: Аналитика */}
      {tabValue === 3 && (
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
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                />
                <DatePicker
                  label="По"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                />
                {(startDate || endDate) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setStartDate(null);
                      setEndDate(null);
                    }}
                  >
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
              {/* Сводка */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Общий доход
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color="success.main">
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
                      <Typography variant="h4" fontWeight="bold" color="error.main">
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
                      <Typography variant="h4" fontWeight="bold" color="warning.main">
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
                        variant="h4"
                        fontWeight="bold"
                        color={analyticsData.summary.totalProfit >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(analyticsData.summary.totalProfit)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* График динамики */}
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
                          <Line type="monotone" dataKey="income" stroke="#4CAF50" name="Доходы" strokeWidth={2} />
                          <Line type="monotone" dataKey="expenses" stroke="#F44336" name="Расходы" strokeWidth={2} />
                          <Line type="monotone" dataKey="marketerPayments" stroke="#FF9800" name="Выплаты маркетологам" strokeWidth={2} />
                          <Line type="monotone" dataKey="profit" stroke="#2196F3" name="Прибыль" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Расходы по категориям */}
              {widgetVisibility.categories && Object.keys(analyticsData.expensesByCategory).length > 0 && (
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
                                const category = expenseCategories.find(c => c.name === name);
                                return (
                                  <Cell key={`cell-${index}`} fill={category?.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`} />
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
                          <RechartsBarChart data={Object.entries(analyticsData.incomeByPlan).map(([plan, amount]) => ({
                            plan,
                            amount: Number(amount),
                          }))}>
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

              {/* Прогноз доходов */}
              {widgetVisibility.forecast && forecastData && (
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

      {/* Вкладка: KPI метрики */}
      {tabValue === 4 && (
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
                  setKpiPeriod(e.target.value);
                  loadKPIMetrics();
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
                    <Typography color="text.secondary" gutterBottom>MRR</Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
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
                    <Typography color="text.secondary" gutterBottom>ARR</Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
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
                    <Typography color="text.secondary" gutterBottom>Churn Rate</Typography>
                    <Typography variant="h4" fontWeight="bold" color="error.main">
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
                    <Typography color="text.secondary" gutterBottom>LTV</Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
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
                    <Typography color="text.secondary" gutterBottom>CAC</Typography>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
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
                    <Typography color="text.secondary" gutterBottom>Conversion Rate</Typography>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
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
                    <Typography color="text.secondary" gutterBottom>Доход за период</Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {formatCurrency(kpiData.revenueInPeriod)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>Новых аккаунтов</Typography>
                    <Typography variant="h4" fontWeight="bold">
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

      {/* Вкладка: Логи аудита */}
      {tabValue === 5 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              Логи аудита
            </Typography>
            <Box display="flex" gap={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Действие</InputLabel>
                <Select
                  value={auditLogsActionFilter}
                  label="Действие"
                  onChange={(e) => {
                    setAuditLogsActionFilter(e.target.value);
                    loadAuditLogs();
                  }}
                >
                  <MenuItem value="all">Все</MenuItem>
                  <MenuItem value="create_expense">Создание расхода</MenuItem>
                  <MenuItem value="update_expense">Обновление расхода</MenuItem>
                  <MenuItem value="delete_expense">Удаление расхода</MenuItem>
                  <MenuItem value="pay_marketer">Выплата маркетологу</MenuItem>
                  <MenuItem value="update_tenant_plan">Изменение тарифа</MenuItem>
                  <MenuItem value="update_plan_price">Изменение цены тарифа</MenuItem>
                  <MenuItem value="update_settings">Обновление настроек</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Тип сущности</InputLabel>
                <Select
                  value={auditLogsEntityTypeFilter}
                  label="Тип сущности"
                  onChange={(e) => {
                    setAuditLogsEntityTypeFilter(e.target.value);
                    loadAuditLogs();
                  }}
                >
                  <MenuItem value="all">Все</MenuItem>
                  <MenuItem value="expense">Расход</MenuItem>
                  <MenuItem value="marketer">Маркетолог</MenuItem>
                  <MenuItem value="tenant">Аккаунт</MenuItem>
                  <MenuItem value="plan">Тариф</MenuItem>
                  <MenuItem value="settings">Настройки</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          {auditLogsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Дата</TableCell>
                    <TableCell>Действие</TableCell>
                    <TableCell>Описание</TableCell>
                    <TableCell>Супер-админ</TableCell>
                    <TableCell>IP адрес</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.createdAt).toLocaleString('ru-RU')}</TableCell>
                      <TableCell>
                        <Chip label={log.action} size="small" color="primary" />
                      </TableCell>
                      <TableCell>{log.description}</TableCell>
                      <TableCell>
                        {log.superAdmin
                          ? `${log.superAdmin.firstName} ${log.superAdmin.lastName}`
                          : 'Система'}
                      </TableCell>
                      <TableCell>{log.ipAddress || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Вкладка: Управление тарифами */}
      {tabValue === 6 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              Управление тарифами
            </Typography>
          </Box>

          {planPricesLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : planPrices && planPrices.length > 0 ? (
            <Grid container spacing={3}>
              {planPrices.map((plan: any) => (
                <Grid item xs={12} md={6} lg={4} key={plan.planType}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 6 },
                      transition: 'box-shadow 0.3s',
                    }}
                    onClick={() => handleEditPlan(plan)}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6" fontWeight="bold">
                          {plan.planType}
                        </Typography>
                        <Edit fontSize="small" color="action" />
                      </Box>
                      <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
                        {formatCurrency(Number(plan.price))}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Лимиты:
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2">
                          Тренеры: {plan.limits.trainers === 'unlimited' ? 'Безлимит' : plan.limits.trainers}
                        </Typography>
                        <Typography variant="body2">
                          Клиенты: {plan.limits.clients === 'unlimited' ? 'Безлимит' : plan.limits.clients}
                        </Typography>
                        <Typography variant="body2">
                          Группы: {plan.limits.groups === 'unlimited' ? 'Безлимит' : plan.limits.groups}
                        </Typography>
                        <Typography variant="body2">
                          Филиалы: {plan.limits.branches === 'unlimited' ? 'Безлимит' : plan.limits.branches}
                        </Typography>
                        <Typography variant="body2">
                          Тренировки: {plan.limits.trainings === 'unlimited' ? 'Безлимит' : `${plan.limits.trainings}/мес`}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Alert severity="info">Загрузка тарифов...</Alert>
          )}
        </Box>
      )}

      {/* Вкладка: Маркетологи */}
      {tabValue === 7 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight="bold">
              Статистика маркетологов
            </Typography>
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              onClick={handleExportMarketers}
            >
              Экспорт в Excel
            </Button>
          </Box>

          {marketerStatsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : marketerStats ? (
            <>
              {marketerStats.summary && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Всего маркетологов
                        </Typography>
                        <Typography variant="h4" fontWeight="bold">
                          {marketerStats.summary.totalMarketers}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Привлечено аккаунтов
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" color="success.main">
                          {marketerStats.summary.totalReferredTenants}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Общий доход
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" color="primary">
                          {formatCurrency(marketerStats.summary.totalRevenue)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>
                          Невыплачено
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" color="warning.main">
                          {formatCurrency(marketerStats.summary.totalUnpaid)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Имя</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Процент</TableCell>
                      <TableCell>Баланс</TableCell>
                      <TableCell>Привлечено</TableCell>
                      <TableCell>Общий доход</TableCell>
                      <TableCell>Комиссия</TableCell>
                      <TableCell>Средний доход/аккаунт</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {marketerStats.marketers?.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.email}</TableCell>
                        <TableCell>{m.commissionPercentage}%</TableCell>
                        <TableCell>{formatCurrency(m.balance)}</TableCell>
                        <TableCell>{m.stats.referredTenantsCount}</TableCell>
                        <TableCell>{formatCurrency(m.stats.totalRevenue)}</TableCell>
                        <TableCell>{formatCurrency(m.stats.totalCommission)}</TableCell>
                        <TableCell>{formatCurrency(m.stats.avgRevenuePerTenant)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Alert severity="info">Загрузка статистики маркетологов...</Alert>
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Категория</InputLabel>
              <Select
                value={expenseCategoryId}
                label="Категория"
                onChange={(e) => setExpenseCategoryId(e.target.value)}
              >
                <MenuItem value="">Без категории</MenuItem>
                {expenseCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box display="flex" justifyContent="flex-end" mb={1}>
              <Button size="small" onClick={() => setCategoryDialog(true)}>
                + Создать категорию
              </Button>
            </Box>
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
          <Button onClick={() => {
            setExpenseDialog(false);
            setExpenseAmount('');
            setExpenseDescription('');
            setExpenseCategoryId('');
          }}>Отмена</Button>
          <Button
            onClick={handleCreateExpense}
            variant="contained"
            disabled={submitting || !expenseAmount || !expenseDescription}
          >
            {submitting ? <CircularProgress size={24} /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования расхода */}
      <Dialog open={editExpenseDialog} onClose={() => {
        setEditExpenseDialog(false);
        setEditingExpense(null);
        setExpenseAmount('');
        setExpenseDescription('');
        setExpenseCategoryId('');
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать расход</DialogTitle>
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Категория</InputLabel>
              <Select
                value={expenseCategoryId}
                label="Категория"
                onChange={(e) => setExpenseCategoryId(e.target.value)}
              >
                <MenuItem value="">Без категории</MenuItem>
                {expenseCategories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          <Button onClick={() => {
            setEditExpenseDialog(false);
            setEditingExpense(null);
            setExpenseAmount('');
            setExpenseDescription('');
            setExpenseCategoryId('');
          }}>Отмена</Button>
          <Button
            onClick={handleUpdateExpense}
            variant="contained"
            disabled={submitting || !expenseAmount || !expenseDescription}
          >
            {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог сохранения пресета */}
      <Dialog open={presetDialog} onClose={() => {
        setPresetDialog(false);
        setPresetName('');
        setPresetIsDefault(false);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Сохранить пресет дашборда</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Название пресета"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <input
                type="checkbox"
                checked={presetIsDefault}
                onChange={(e) => setPresetIsDefault(e.target.checked)}
                id="preset-default"
              />
              <label htmlFor="preset-default">Установить как пресет по умолчанию</label>
            </Box>
            {presets.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Существующие пресеты:
                </Typography>
                {presets.map((preset) => (
                  <Box key={preset.id} display="flex" justifyContent="space-between" alignItems="center" mb={1} p={1} sx={{ bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography>
                      {preset.name} {preset.isDefault && '(По умолчанию)'}
                    </Typography>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setPresetName(preset.name);
                          setPresetIsDefault(preset.isDefault);
                          setCurrentPreset(preset);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPresetDialog(false);
            setPresetName('');
            setPresetIsDefault(false);
          }}>Отмена</Button>
          <Button
            onClick={handleSavePreset}
            variant="contained"
            disabled={submitting || !presetName.trim()}
          >
            {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания категории */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создать категорию расходов</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Название"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Описание"
              multiline
              rows={2}
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box display="flex" alignItems="center" gap={2}>
              <Typography>Цвет:</Typography>
              <input
                type="color"
                value={categoryColor}
                onChange={(e) => setCategoryColor(e.target.value)}
                style={{ width: 50, height: 40, border: 'none', borderRadius: 4 }}
              />
              <TextField
                label="Hex код"
                size="small"
                value={categoryColor}
                onChange={(e) => setCategoryColor(e.target.value)}
                sx={{ width: 120 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCategoryDialog(false);
            setCategoryName('');
            setCategoryDescription('');
            setCategoryColor('#2196F3');
          }}>Отмена</Button>
          <Button onClick={handleCreateCategory} variant="contained" disabled={submitting || !categoryName}>
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

      {/* Диалог редактирования тарифа */}
      <Dialog open={editPlanDialog} onClose={() => {
        setEditPlanDialog(false);
        setEditingPlan(null);
        setEditingPlanPrice('');
        setEditingPlanLimits({
          trainers: '',
          clients: '',
          groups: '',
          branches: '',
          trainings: '',
        });
      }} maxWidth="md" fullWidth>
        <DialogTitle>Редактировать тариф: {editingPlan?.planType}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Цена (₽)"
              type="number"
              value={editingPlanPrice}
              onChange={(e) => setEditingPlanPrice(e.target.value)}
              sx={{ mb: 3 }}
              required
            />
            
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Лимиты
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Тренеры"
                  type="text"
                  value={editingPlanLimits.trainers}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'unlimited' || value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                      setEditingPlanLimits({ ...editingPlanLimits, trainers: value });
                    }
                  }}
                  helperText="Введите число или 'unlimited'"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Клиенты"
                  type="text"
                  value={editingPlanLimits.clients}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'unlimited' || value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                      setEditingPlanLimits({ ...editingPlanLimits, clients: value });
                    }
                  }}
                  helperText="Введите число или 'unlimited'"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Группы"
                  type="text"
                  value={editingPlanLimits.groups}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'unlimited' || value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                      setEditingPlanLimits({ ...editingPlanLimits, groups: value });
                    }
                  }}
                  helperText="Введите число или 'unlimited'"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Филиалы"
                  type="text"
                  value={editingPlanLimits.branches}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'unlimited' || value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                      setEditingPlanLimits({ ...editingPlanLimits, branches: value });
                    }
                  }}
                  helperText="Введите число или 'unlimited'"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Тренировки в месяц"
                  type="text"
                  value={editingPlanLimits.trainings}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'unlimited' || value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                      setEditingPlanLimits({ ...editingPlanLimits, trainings: value });
                    }
                  }}
                  helperText="Введите число или 'unlimited'"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditPlanDialog(false);
            setEditingPlan(null);
            setEditingPlanPrice('');
            setEditingPlanLimits({
              trainers: '',
              clients: '',
              groups: '',
              branches: '',
              trainings: '',
            });
          }}>Отмена</Button>
          <Button
            onClick={handleUpdatePlanPrice}
            variant="contained"
            disabled={submitting || !editingPlanPrice}
          >
            {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
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

