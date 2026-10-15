import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
} from '@mui/material';
import type {
  SubscriptionPlanItem,
  SubscriptionGrantLogItem,
} from '../types';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import DeletionScopeDialog, { PurgeOption } from '../components/common/DeletionScopeDialog';
import SuperAdminMaintenanceTab from './SuperAdminMaintenanceTab';
import SuperAdminDevNotesTab from './SuperAdminDevNotesTab';
import SuperAdminPlannerTab from './SuperAdminPlannerTab';
import SuperAdminClientIdeasTab from '../components/SuperAdminClientIdeasTab';
import {
  SuperAdminPlatformChatsTab,
  SuperAdminPlatformChangelogTab,
} from '../components/SuperAdminPlatformTabs';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import SaMonitoringTab from './admin/SaMonitoringTab';
import SaLegalTab from './admin/SaLegalTab';
import SaNotificationsTab from './admin/SaNotificationsTab';
import SaOverviewTab, { type SaOverviewDashboardData } from './admin/SaOverviewTab';
import SaTransactionsTab from './admin/SaTransactionsTab';
import SaAccountsTab from './admin/SaAccountsTab';
import SaMetricsSectionTab from './admin/SaMetricsTab';
import SaAuditTab from './admin/SaAuditTab';
import SaTariffsTab from './admin/SaTariffsTab';
import SaMarketersTab from './admin/SaMarketersTab';
import SaSandboxTab from './admin/SaSandboxTab';
import {
  resolveSaLocation,
  resolveSaTab,
  type SaSection,
  type SaTab,
  type SaMetricsTab,
  type SaMonitoringTab as SaMonitoringTabKey,
  type SaLegalTab as SaLegalTabKey,
} from '../config/saDashboard';

const TENANT_DELETE_OPTIONS: PurgeOption[] = [
  { key: 'devNotes', label: 'Заметки во вкладке «Разработка»', countKeys: ['devNotes'] },
  { key: 'chats', label: 'Переписки (школа и платформа)', countKeys: ['chats'] },
  { key: 'news', label: 'Новости платформы', countKeys: ['news'] },
  { key: 'planner', label: 'Планировщик', countKeys: ['planner'] },
];

type PlatformStaffRole = 'SUPPORT' | 'DESIGNER' | 'SECURITY';

type DashboardData = SaOverviewDashboardData;

const AdminDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const saLoc = useMemo(() => resolveSaLocation(searchParams.toString()), [searchParams]);
  const section: SaSection = saLoc.section;
  const activeTab = useMemo(
    () => resolveSaTab(section, saLoc.tab),
    [section, saLoc.tab]
  );

  const setSectionTab = useCallback(
    (tab: SaTab) => {
      setSearchParams(
        (() => {
          const p = new URLSearchParams(searchParams);
          p.set('section', section);
          p.set('tab', tab);
          return p;
        })(),
        { replace: true }
      );
    },
    [searchParams, section, setSearchParams]
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staffDialog, setStaffDialog] = useState(false);
  const [newStaff, setNewStaff] = useState<{ email: string; role: PlatformStaffRole; firstName: string; lastName: string }>({
    email: '',
    role: 'SUPPORT',
    firstName: '',
    lastName: '',
  });
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [accountsPane, setAccountsPane] = useState<'accounts' | 'staff'>('accounts');
  const [platformStaff, setPlatformStaff] = useState<any[]>([]);
  
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
  
  // Все аккаунты
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [deleteTenantTarget, setDeleteTenantTarget] = useState<any | null>(null);
  
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
  const canWrite = true; // супер-админ страница; доступ только через ProtectedSuperAdminRoute
  const [planPrices, setPlanPrices] = useState<SubscriptionPlanItem[]>([]);
  const [planPricesLoading, setPlanPricesLoading] = useState(false);
  const [editPlanDialog, setEditPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanItem | null>(null);
  const [editingPlanPrice, setEditingPlanPrice] = useState<string>('');
  const [editingPlanName, setEditingPlanName] = useState('');
  const [editingPlanDescription, setEditingPlanDescription] = useState('');
  const [editingPlanIsPublic, setEditingPlanIsPublic] = useState(true);
  const [editingPlanLimits, setEditingPlanLimits] = useState({
    trainers: '',
    clients: '',
    groups: '',
    branches: '',
    trainings: '',
    extraStaff: '',
  });
  const [editingPlanSortOrder, setEditingPlanSortOrder] = useState('0');
  const [createPlanDialog, setCreatePlanDialog] = useState(false);
  const [planForm, setPlanForm] = useState({
    code: '',
    name: '',
    description: '',
    price: '',
    isPublic: true,
    sortOrder: '0',
    trainers: '',
    clients: '',
    groups: '',
    branches: '',
    trainings: '',
    extraStaff: '',
  });
  const [grantEndDate, setGrantEndDate] = useState<Date | null>(null);
  const [grantComment, setGrantComment] = useState('');
  const [grantHistory, setGrantHistory] = useState<SubscriptionGrantLogItem[]>([]);

  // Расширенная статистика маркетологов
  const [marketerStats, setMarketerStats] = useState<any>(null);
  const [marketerStatsLoading, setMarketerStatsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter reserved for marketer filter UI
  const [selectedMarketerId, setSelectedMarketerId] = useState<string>('');
  
  // Редактирование расходов
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editExpenseDialog, setEditExpenseDialog] = useState(false);

  const emptyExpenseForm = () => ({
    expenseAmount: '',
    expenseDescription: '',
    expenseCategoryId: '',
  });
  const emptyCategoryForm = () => ({
    categoryName: '',
    categoryDescription: '',
    categoryColor: '#2196F3',
  });
  const emptyPaymentForm = () => ({
    paymentMarketerId: '',
    paymentAmount: '',
    paymentDescription: '',
  });
  const emptyPlanForm = () => ({
    code: '',
    name: '',
    description: '',
    price: '',
    isPublic: true,
    sortOrder: '0',
    trainers: '',
    clients: '',
    groups: '',
    branches: '',
    trainings: '',
    extraStaff: '',
  });

  const [expenseFormBaseline, setExpenseFormBaseline] = useState(emptyExpenseForm());
  const [editExpenseBaseline, setEditExpenseBaseline] = useState(emptyExpenseForm());
  const [categoryFormBaseline, setCategoryFormBaseline] = useState(emptyCategoryForm());
  const [paymentFormBaseline, setPaymentFormBaseline] = useState(emptyPaymentForm());
  const [editPlanBaseline, setEditPlanBaseline] = useState<Record<string, unknown> | null>(null);
  const [createPlanBaseline, setCreatePlanBaseline] = useState(emptyPlanForm());
  const [grantFormBaseline, setGrantFormBaseline] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    loadDashboard();
    loadExpenseCategories();
    loadForecast();
  }, []);

  useEffect(() => {
    if (section === 'transactions') {
      loadTransactions();
    } else if (section === 'accounts') {
      loadAllTenants();
    } else if (section === 'metrics') {
      if (activeTab === 'kpi') loadKPIMetrics();
      else loadAnalytics();
    } else if (section === 'audit') {
      loadAuditLogs();
    } else if (section === 'tariffs') {
      loadPlanPrices();
    } else if (section === 'marketers') {
      loadMarketerStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, activeTab]);

  useEffect(() => {
    if (section !== 'accounts' || accountsPane !== 'staff') return;
    apiService.superAdminListPlatformStaffUsers().then(setPlatformStaff).catch(() => setPlatformStaff([]));
  }, [section, accountsPane, oneTimePassword]);

  useEffect(() => {
    if (section === 'transactions') {
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionTypeFilter, startDate, endDate, selectedCategoryId]);

  useEffect(() => {
    if (section === 'metrics' && activeTab === 'analytics') {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, section, activeTab]);

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

  const handleLinkTenantSuperAdmin = async (tenantId: string) => {
    try {
      setSubmitting(true);
      await apiService.linkTenantOwnerAsSuperAdmin(tenantId);
      await loadAllTenants();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось сделать супер-админом');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlinkTenantSuperAdmin = async (tenantId: string) => {
    if (!window.confirm('Отвязать OWNER этой школы от супер-админа?')) return;
    try {
      setSubmitting(true);
      await apiService.unlinkTenantOwnerSuperAdmin(tenantId);
      await loadAllTenants();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось отвязать супер-админа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkTenantTester = async (tenantId: string) => {
    try {
      setSubmitting(true);
      await apiService.linkTenantOwnerAsTester(tenantId);
      await loadAllTenants();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось сделать тестировщиком');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteTenantDialog = (tenant: any) => {
    setDeleteTenantTarget(tenant);
  };

  const closeDeleteTenantDialog = () => {
    setDeleteTenantTarget(null);
  };

  const handleConfirmDeleteTenant = async (purge: Record<string, boolean>) => {
    if (!deleteTenantTarget) return;
    setError(null);
    await apiService.deleteTenant(
      deleteTenantTarget.id,
      deleteTenantTarget.subdomain,
      purge
    );
    setDeleteTenantTarget(null);
    setSelectedTenants((ids) => ids.filter((id) => id !== deleteTenantTarget.id));
    await loadAllTenants();
  };

  const handleUnlinkTenantTester = async (tenantId: string) => {
    if (!window.confirm('Отвязать OWNER этой школы от тестировщика?')) return;
    try {
      setSubmitting(true);
      await apiService.unlinkTenantOwnerTester(tenantId);
      await loadAllTenants();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось отвязать тестировщика');
    } finally {
      setSubmitting(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const dashboardData = await apiService.getAdminDashboard();
      setData(dashboardData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки дашборда');
    } finally {
      setLoading(false);
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

  const expenseFormSnapshot = () => ({
    expenseAmount,
    expenseDescription,
    expenseCategoryId,
  });

  const categoryFormSnapshot = () => ({
    categoryName,
    categoryDescription,
    categoryColor,
  });

  const paymentFormSnapshot = () => ({
    paymentMarketerId,
    paymentAmount,
    paymentDescription,
  });

  const editPlanSnapshot = () => ({
    editingPlanName,
    editingPlanDescription,
    editingPlanIsPublic,
    editingPlanPrice,
    editingPlanSortOrder,
    editingPlanLimits,
  });

  const grantFormSnapshot = () => ({
    selectedPlanType,
    grantEndDate: grantEndDate?.toISOString() ?? null,
    grantComment,
  });

  const discardExpenseForm = useCallback(() => {
    setExpenseDialog(false);
    setExpenseAmount('');
    setExpenseDescription('');
    setExpenseCategoryId('');
    setExpenseFormBaseline(emptyExpenseForm());
  }, []);

  const discardEditExpenseForm = useCallback(() => {
    setEditExpenseDialog(false);
    setEditingExpense(null);
    setExpenseAmount('');
    setExpenseDescription('');
    setExpenseCategoryId('');
    setEditExpenseBaseline(emptyExpenseForm());
  }, []);

  const discardCategoryForm = useCallback(() => {
    setCategoryDialog(false);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryColor('#2196F3');
    setCategoryFormBaseline(emptyCategoryForm());
  }, []);

  const discardPaymentForm = useCallback(() => {
    setPaymentDialog(false);
    setPaymentMarketerId('');
    setPaymentAmount('');
    setPaymentDescription('');
    setPaymentFormBaseline(emptyPaymentForm());
  }, []);

  const handleCreateExpense = async (): Promise<boolean> => {
    if (!expenseAmount || !expenseDescription) {
      setError('Заполните все поля');
      return false;
    }

    try {
      setSubmitting(true);
      await apiService.createExpense({
        amount: parseFloat(expenseAmount),
        description: expenseDescription,
        categoryId: expenseCategoryId || undefined,
      });
      discardExpenseForm();
      await loadTransactions();
      await loadDashboard();
      await loadAnalytics();
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания расхода');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async (): Promise<boolean> => {
    if (!categoryName) {
      setError('Название категории обязательно');
      return false;
    }

    try {
      setSubmitting(true);
      await apiService.createExpenseCategory({
        name: categoryName,
        description: categoryDescription,
        color: categoryColor,
      });
      discardCategoryForm();
      await loadExpenseCategories();
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания категории');
      return false;
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

  const handlePayMarketer = async (): Promise<boolean> => {
    if (!paymentMarketerId || !paymentAmount) {
      setError('Выберите маркетолога и укажите сумму');
      return false;
    }

    try {
      setSubmitting(true);
      await apiService.payMarketer({
        marketerId: paymentMarketerId,
        amount: parseFloat(paymentAmount),
        description: paymentDescription || undefined,
      });
      discardPaymentForm();
      await loadTransactions();
      await loadDashboard();
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка выплаты маркетологу');
      return false;
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
    const initial = {
      expenseAmount: expense.amount.toString(),
      expenseDescription: expense.description,
      expenseCategoryId: expense.categoryId || '',
    };
    setEditingExpense(expense);
    setExpenseAmount(initial.expenseAmount);
    setExpenseDescription(initial.expenseDescription);
    setExpenseCategoryId(initial.expenseCategoryId);
    setEditExpenseBaseline(initial);
    setEditExpenseDialog(true);
  };

  const handleUpdateExpense = async (): Promise<boolean> => {
    if (!editingExpense || !expenseAmount || !expenseDescription) {
      setError('Заполните все обязательные поля');
      return false;
    }

    try {
      setSubmitting(true);
      await apiService.updateExpense(editingExpense.id, {
        amount: parseFloat(expenseAmount),
        description: expenseDescription,
        categoryId: expenseCategoryId || undefined,
      });
      discardEditExpenseForm();
      await loadTransactions();
      await loadDashboard();
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления расхода');
      return false;
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

  const parseLimitsForm = (limits: {
    trainers: string;
    clients: string;
    groups: string;
    branches: string;
    trainings: string;
    extraStaff: string;
  }) => {
    const result: Record<string, number | 'unlimited'> = {};
    Object.keys(limits).forEach((key) => {
      const value = limits[key as keyof typeof limits];
      if (value === 'unlimited') {
        result[key] = 'unlimited';
      } else if (value !== '' && !isNaN(Number(value))) {
        result[key] = Number(value);
      }
    });
    return result;
  };

  const formatPlanPrice = (plan: { price: number | null; isNegotiable?: boolean }) => {
    if (plan.price == null || plan.isNegotiable) {
      return 'Цена договорная';
    }
    return formatCurrency(Number(plan.price));
  };

  const resetEditingPlanForm = () => {
    setEditingPlan(null);
    setEditingPlanPrice('');
    setEditingPlanName('');
    setEditingPlanDescription('');
    setEditingPlanIsPublic(true);
    setEditingPlanSortOrder('0');
    setEditingPlanLimits({
      trainers: '',
      clients: '',
      groups: '',
      branches: '',
      trainings: '',
      extraStaff: '',
    });
    setEditPlanBaseline(null);
  };

  const resetPlanForm = () => {
    setPlanForm(emptyPlanForm());
    setCreatePlanBaseline(emptyPlanForm());
  };

  const discardEditPlanForm = useCallback(() => {
    setEditPlanDialog(false);
    resetEditingPlanForm();
  }, []);

  const discardCreatePlanForm = useCallback(() => {
    setCreatePlanDialog(false);
    resetPlanForm();
  }, []);

  const discardGrantForm = useCallback(() => {
    setPlanDialog(false);
    setSelectedTenantId('');
    setSelectedPlanType('');
    setGrantEndDate(null);
    setGrantComment('');
    setGrantHistory([]);
    setGrantFormBaseline(null);
  }, []);

  const handleEditPlan = (plan: SubscriptionPlanItem) => {
    const limits = {
      trainers: plan.limits.trainers === 'unlimited' ? 'unlimited' : String(plan.limits.trainers ?? ''),
      clients: plan.limits.clients === 'unlimited' ? 'unlimited' : String(plan.limits.clients ?? ''),
      groups: plan.limits.groups === 'unlimited' ? 'unlimited' : String(plan.limits.groups ?? ''),
      branches: plan.limits.branches === 'unlimited' ? 'unlimited' : String(plan.limits.branches ?? ''),
      trainings: plan.limits.trainings === 'unlimited' ? 'unlimited' : String(plan.limits.trainings ?? ''),
      extraStaff: plan.limits.extraStaff === 'unlimited' ? 'unlimited' : String(plan.limits.extraStaff ?? ''),
    };
    const initial = {
      editingPlanName: plan.name || '',
      editingPlanDescription: plan.description || '',
      editingPlanIsPublic: plan.isPublic !== false,
      editingPlanPrice: plan.price == null ? '' : plan.price.toString(),
      editingPlanSortOrder: String(plan.sortOrder ?? 0),
      editingPlanLimits: limits,
    };
    setEditingPlan(plan);
    setEditingPlanName(initial.editingPlanName);
    setEditingPlanDescription(initial.editingPlanDescription);
    setEditingPlanIsPublic(initial.editingPlanIsPublic);
    setEditingPlanPrice(initial.editingPlanPrice);
    setEditingPlanSortOrder(initial.editingPlanSortOrder);
    setEditingPlanLimits(limits);
    setEditPlanBaseline(initial);
    setEditPlanDialog(true);
  };

  const handleUpdatePlanPrice = async (): Promise<boolean> => {
    if (!editingPlan || !editingPlanName.trim()) {
      setError('Укажите название тарифа');
      return false;
    }

    try {
      setSubmitting(true);
      const limits = parseLimitsForm(editingPlanLimits);
      const priceValue =
        editingPlanPrice.trim() === '' ? null : parseFloat(editingPlanPrice);

      await apiService.updatePlan(editingPlan.code || editingPlan.planType, {
        name: editingPlanName.trim(),
        description: editingPlanDescription.trim() || null,
        price: Number.isFinite(priceValue as number) ? priceValue : null,
        limits,
        isPublic: editingPlanIsPublic,
        sortOrder: Number.isFinite(Number(editingPlanSortOrder)) ? Number(editingPlanSortOrder) : 0,
      });
      discardEditPlanForm();
      await loadPlanPrices();
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления тарифа');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePlan = async (): Promise<boolean> => {
    if (!planForm.code.trim() || !planForm.name.trim()) {
      setError('Укажите код и название тарифа');
      return false;
    }
    try {
      setSubmitting(true);
      const limits = parseLimitsForm({
        trainers: planForm.trainers,
        clients: planForm.clients,
        groups: planForm.groups,
        branches: planForm.branches,
        trainings: planForm.trainings,
        extraStaff: planForm.extraStaff,
      });
      const priceValue = planForm.price.trim() === '' ? null : parseFloat(planForm.price);
      await apiService.createPlan({
        code: planForm.code.trim().toUpperCase(),
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        price: Number.isFinite(priceValue as number) ? priceValue : null,
        limits,
        isPublic: planForm.isPublic,
        sortOrder: Number.isFinite(Number(planForm.sortOrder)) ? Number(planForm.sortOrder) : 0,
      });
      discardCreatePlanForm();
      await loadPlanPrices();
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания тарифа');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchivePlan = async () => {
    if (!editingPlan) return;
    if (!window.confirm(`Архивировать тариф «${editingPlan.name || editingPlan.code}»?`)) {
      return;
    }
    try {
      setSubmitting(true);
      await apiService.archivePlan(editingPlan.code || editingPlan.planType);
      setEditPlanDialog(false);
      resetEditingPlanForm();
      await loadPlanPrices();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка архивации тарифа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestorePlan = async () => {
    if (!editingPlan) return;
    try {
      setSubmitting(true);
      await apiService.restorePlan(editingPlan.code || editingPlan.planType);
      setEditPlanDialog(false);
      resetEditingPlanForm();
      await loadPlanPrices();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка восстановления тарифа');
    } finally {
      setSubmitting(false);
    }
  };

  const openGrantDialog = async (tenant: any) => {
    const endDate = tenant.subscription?.endDate ? new Date(tenant.subscription.endDate) : null;
    const planType = tenant.subscription?.planType || '';
    setSelectedTenantId(tenant.id);
    setSelectedPlanType(planType);
    setGrantEndDate(endDate);
    setGrantComment('');
    setGrantHistory([]);
    setGrantFormBaseline({
      selectedPlanType: planType,
      grantEndDate: endDate?.toISOString() ?? null,
      grantComment: '',
    });
    setPlanDialog(true);
    try {
      if (planPrices.length === 0) {
        await loadPlanPrices();
      }
      const history = await apiService.getTenantGrantHistory(tenant.id);
      setGrantHistory(history || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки истории выдачи');
    }
  };

  const handleGrantPlan = async (): Promise<boolean> => {
    if (!selectedTenantId || !selectedPlanType) return false;
    setSubmitting(true);
    try {
      await apiService.updateTenantPlan(selectedTenantId, selectedPlanType, {
        endDate: grantEndDate ? grantEndDate.toISOString() : null,
        comment: grantComment.trim() || null,
      });
      await loadAllTenants();
      await loadDashboard();
      discardGrantForm();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления тарифа');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateGrantEndDate = async () => {
    if (!selectedTenantId || !grantEndDate) {
      setError('Укажите дату окончания');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.updateTenantSubscriptionEndDate(
        selectedTenantId,
        grantEndDate.toISOString(),
        grantComment.trim() || null
      );
      const history = await apiService.getTenantGrantHistory(selectedTenantId);
      setGrantHistory(history || []);
      await loadAllTenants();
      await loadDashboard();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления срока тарифа');
    } finally {
      setSubmitting(false);
    }
  };

  const expenseDirty =
    expenseDialog && isDirtyValue(expenseFormSnapshot(), expenseFormBaseline);
  const expenseUnsaved = useUnsavedClose({
    isDirty: Boolean(expenseDirty),
    onDiscard: discardExpenseForm,
    onSave: handleCreateExpense,
  });

  const editExpenseDirty =
    editExpenseDialog && isDirtyValue(expenseFormSnapshot(), editExpenseBaseline);
  const editExpenseUnsaved = useUnsavedClose({
    isDirty: Boolean(editExpenseDirty),
    onDiscard: discardEditExpenseForm,
    onSave: handleUpdateExpense,
  });

  const categoryDirty =
    categoryDialog && isDirtyValue(categoryFormSnapshot(), categoryFormBaseline);
  const categoryUnsaved = useUnsavedClose({
    isDirty: Boolean(categoryDirty),
    onDiscard: discardCategoryForm,
    onSave: handleCreateCategory,
  });

  const paymentDirty =
    paymentDialog && isDirtyValue(paymentFormSnapshot(), paymentFormBaseline);
  const paymentUnsaved = useUnsavedClose({
    isDirty: Boolean(paymentDirty),
    onDiscard: discardPaymentForm,
    onSave: handlePayMarketer,
  });

  const editPlanDirty =
    editPlanDialog &&
    editPlanBaseline != null &&
    isDirtyValue(editPlanSnapshot(), editPlanBaseline);
  const editPlanUnsaved = useUnsavedClose({
    isDirty: Boolean(editPlanDirty),
    onDiscard: discardEditPlanForm,
    onSave: handleUpdatePlanPrice,
  });

  const createPlanDirty =
    createPlanDialog && isDirtyValue(planForm, createPlanBaseline);
  const createPlanUnsaved = useUnsavedClose({
    isDirty: Boolean(createPlanDirty),
    onDiscard: discardCreatePlanForm,
    onSave: handleCreatePlan,
  });

  const grantDirty =
    planDialog &&
    grantFormBaseline != null &&
    isDirtyValue(grantFormSnapshot(), grantFormBaseline);
  const grantUnsaved = useUnsavedClose({
    isDirty: Boolean(grantDirty),
    onDiscard: discardGrantForm,
    onSave: handleGrantPlan,
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Container maxWidth="lg" sx={{ mt: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 2.5 }}>
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
                setPlatformStaff(await apiService.superAdminListPlatformStaffUsers());
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

      {/* Контент секций */}
      {section === 'overview' && data && (
        <SaOverviewTab
          data={data}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onNavigateSection={(s) => setSearchParams({ section: s })}
        />
      )}

      {section === 'transactions' && (
        <SaTransactionsTab
          transactions={transactions}
          transactionsLoading={transactionsLoading}
          transactionTypeFilter={transactionTypeFilter}
          onTransactionTypeFilterChange={setTransactionTypeFilter}
          selectedCategoryId={selectedCategoryId}
          onSelectedCategoryIdChange={setSelectedCategoryId}
          expenseCategories={expenseCategories}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearDates={() => {
            setStartDate(null);
            setEndDate(null);
          }}
          marketersCount={data.marketers.list.length}
          marketers={data.marketers.list}
          formatCurrency={formatCurrency}
          formatDateTime={formatDateTime}
          onOpenExpenseDialog={() => {
            const initial = emptyExpenseForm();
            setExpenseAmount(initial.expenseAmount);
            setExpenseDescription(initial.expenseDescription);
            setExpenseCategoryId(initial.expenseCategoryId);
            setExpenseFormBaseline(initial);
            setExpenseDialog(true);
          }}
          onOpenPaymentDialog={() => {
            const initial = emptyPaymentForm();
            setPaymentMarketerId(initial.paymentMarketerId);
            setPaymentAmount(initial.paymentAmount);
            setPaymentDescription(initial.paymentDescription);
            setPaymentFormBaseline(initial);
            setPaymentDialog(true);
          }}
          onEditExpense={handleEditExpense}
          onDeleteExpense={handleDeleteExpense}
          onExportTransactions={handleExportTransactions}
        />
      )}

      {section === 'accounts' && (
        <Box>
          <Tabs value={accountsPane} onChange={(_, v) => setAccountsPane(v)} sx={{ mb: 2 }}>
            <Tab value="accounts" label="Аккаунты" />
            <Tab value="staff" label="Внутренние сотрудники" />
          </Tabs>
          {accountsPane === 'accounts' ? (
        <SaAccountsTab
          allTenants={allTenants}
          tenantsLoading={tenantsLoading}
          selectedTenants={selectedTenants}
          onSelectedTenantsChange={setSelectedTenants}
          submitting={submitting}
          deletingTenant={Boolean(deleteTenantTarget)}
          canWrite={canWrite}
          onExportTenants={handleExportTenants}
          onBulkAction={handleBulkAction}
          onOpenGrantDialog={openGrantDialog}
          onLinkTenantSuperAdmin={handleLinkTenantSuperAdmin}
          onUnlinkTenantSuperAdmin={handleUnlinkTenantSuperAdmin}
          onLinkTenantTester={handleLinkTenantTester}
          onUnlinkTenantTester={handleUnlinkTenantTester}
          onOpenDeleteTenantDialog={openDeleteTenantDialog}
        />
          ) : (
            <Box>
              <Box display="flex" justifyContent="flex-end" mb={2}>
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
              </Box>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Сотрудник</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Роль</TableCell>
                      <TableCell>Статус</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {platformStaff.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{`${row.lastName || ''} ${row.firstName || ''}`.trim()}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>
                          {row.role === 'SUPPORT' ? 'Поддержка' : row.role === 'DESIGNER' ? 'Дизайнер' : 'Безопасность'}
                        </TableCell>
                        <TableCell>{row.isActive ? 'Активен' : 'Отключён'}</TableCell>
                      </TableRow>
                    ))}
                    {!platformStaff.length && (
                      <TableRow>
                        <TableCell colSpan={4}>Сотрудников платформы нет</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      )}

      {section === 'metrics' && (
        <SaMetricsSectionTab
          tab={(activeTab as SaMetricsTab) || 'analytics'}
          onTabChange={(t) => setSectionTab(t)}
          analyticsData={analyticsData}
          analyticsLoading={analyticsLoading}
          forecastData={forecastData}
          expenseCategories={expenseCategories}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearDates={() => {
                    setStartDate(null);
                    setEndDate(null);
                  }}
          formatCurrency={formatCurrency}
          kpiData={kpiData}
          kpiLoading={kpiLoading}
          kpiPeriod={kpiPeriod}
          onKpiPeriodChange={setKpiPeriod}
          onReloadKpi={loadKPIMetrics}
        />
      )}

      {section === 'audit' && (
        <SaAuditTab
          auditLogs={auditLogs}
          auditLogsLoading={auditLogsLoading}
          auditLogsActionFilter={auditLogsActionFilter}
          auditLogsEntityTypeFilter={auditLogsEntityTypeFilter}
          onActionFilterChange={(value) => {
            setAuditLogsActionFilter(value);
            loadAuditLogs();
          }}
          onEntityTypeFilterChange={(value) => {
            setAuditLogsEntityTypeFilter(value);
            loadAuditLogs();
          }}
        />
      )}

      {section === 'tariffs' && (
        <SaTariffsTab
          canWrite={canWrite}
          planPrices={planPrices}
          planPricesLoading={planPricesLoading}
          formatPlanPrice={formatPlanPrice}
          onCreatePlan={() => {
            const initial = emptyPlanForm();
            setPlanForm(initial);
            setCreatePlanBaseline(initial);
            setCreatePlanDialog(true);
          }}
          onEditPlan={handleEditPlan}
        />
      )}

      {section === 'marketers' && (
        <SaMarketersTab
          marketerStats={marketerStats}
          marketerStatsLoading={marketerStatsLoading}
          formatCurrency={formatCurrency}
          onExportMarketers={handleExportMarketers}
        />
      )}

      {section === 'monitoring' && (
        <SaMonitoringTab
          tab={(activeTab as SaMonitoringTabKey) || 'server'}
          onTabChange={(t) => setSectionTab(t)}
        />
      )}

      {section === 'maintenance' && <SuperAdminMaintenanceTab />}

      {section === 'legal' && (
        <SaLegalTab
          tab={(activeTab as SaLegalTabKey) || 'terms'}
          onTabChange={(t) => setSectionTab(t)}
        />
      )}

      {section === 'notifications' && <SaNotificationsTab />}
      {section === 'sandbox' && <SaSandboxTab />}

      {section === 'planner' && <SuperAdminPlannerTab />}

      {section === 'development' && <SuperAdminDevNotesTab />}

      {section === 'client-ideas' && <SuperAdminClientIdeasTab />}

      {section === 'chats' && <SuperAdminPlatformChatsTab />}

      {section === 'changelog' && <SuperAdminPlatformChangelogTab />}

      {/* Диалог создания расхода */}
      <Dialog
        open={expenseDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            expenseUnsaved.requestClose(reason);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
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
              <Button
                size="small"
                onClick={() => {
                  const initial = emptyCategoryForm();
                  setCategoryName(initial.categoryName);
                  setCategoryDescription(initial.categoryDescription);
                  setCategoryColor(initial.categoryColor);
                  setCategoryFormBaseline(initial);
                  setCategoryDialog(true);
                }}
              >
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
          <Button onClick={discardExpenseForm}>Отмена</Button>
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
      <Dialog
        open={editExpenseDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            editExpenseUnsaved.requestClose(reason);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
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
          <Button onClick={discardEditExpenseForm}>Отмена</Button>
          <Button
            onClick={handleUpdateExpense}
            variant="contained"
            disabled={submitting || !expenseAmount || !expenseDescription}
          >
            {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания категории */}
      <Dialog
        open={categoryDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            categoryUnsaved.requestClose(reason);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
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
          <Button onClick={discardCategoryForm}>Отмена</Button>
          <Button onClick={handleCreateCategory} variant="contained" disabled={submitting || !categoryName}>
            {submitting ? <CircularProgress size={24} /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог выплаты маркетологу */}
      <Dialog
        open={paymentDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            paymentUnsaved.requestClose(reason);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
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
          <Button onClick={discardPaymentForm}>Отмена</Button>
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
      <Dialog
        open={editPlanDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            editPlanUnsaved.requestClose(reason);
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Редактировать тариф: {editingPlan?.name || editingPlan?.code || editingPlan?.planType}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Код"
              value={editingPlan?.code || editingPlan?.planType || ''}
              disabled
              sx={{ mb: 2 }}
              helperText="Код тарифа неизменяем"
            />
            <TextField
              fullWidth
              label="Название"
              value={editingPlanName}
              onChange={(e) => setEditingPlanName(e.target.value)}
              sx={{ mb: 2 }}
              required
              disabled={!canWrite}
            />
            <TextField
              fullWidth
              label="Описание"
              multiline
              rows={2}
              value={editingPlanDescription}
              onChange={(e) => setEditingPlanDescription(e.target.value)}
              sx={{ mb: 2 }}
              disabled={!canWrite}
            />
            <TextField
              fullWidth
              label="Цена (₽)"
              type="number"
              value={editingPlanPrice}
              onChange={(e) => setEditingPlanPrice(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Оставьте пустым для «Цена договорная»"
              disabled={!canWrite}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editingPlanIsPublic}
                  onChange={(e) => setEditingPlanIsPublic(e.target.checked)}
                  disabled={!canWrite}
                />
              }
              label="Публичный тариф (на странице /pricing)"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Порядок отображения"
              type="number"
              value={editingPlanSortOrder}
              onChange={(e) => setEditingPlanSortOrder(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Меньше число — выше в списке на /pricing и в иерархии тарифов"
              disabled={!canWrite}
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Лимиты
            </Typography>
            
            <Grid container spacing={2}>
              {(
                [
                  ['trainers', 'Тренеры'],
                  ['extraStaff', 'Доп. сотрудники'],
                  ['clients', 'Клиенты'],
                  ['groups', 'Группы'],
                  ['branches', 'Филиалы'],
                  ['trainings', 'Тренировки в месяц'],
                ] as const
              ).map(([key, label]) => (
                <Grid item xs={12} sm={6} key={key}>
                <TextField
                  fullWidth
                    label={label}
                  type="text"
                    value={editingPlanLimits[key]}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'unlimited' || value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                        setEditingPlanLimits({ ...editingPlanLimits, [key]: value });
                      }
                    }}
                    helperText={
                      key === 'extraStaff'
                        ? "Админы, промоутеры и аналоги (без владельца и тренеров). Число или 'unlimited'"
                        : "Введите число или 'unlimited'"
                    }
                  disabled={!canWrite}
                />
              </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={discardEditPlanForm}>Отмена</Button>
          {canWrite && editingPlan?.isActive !== false && (
            <Button color="warning" onClick={handleArchivePlan} disabled={submitting}>
              Архивировать
            </Button>
          )}
          {canWrite && editingPlan?.isActive === false && (
            <Button color="success" onClick={handleRestorePlan} disabled={submitting}>
              Восстановить
            </Button>
          )}
          {canWrite && (
            <Button
              onClick={handleUpdatePlanPrice}
              variant="contained"
              disabled={submitting || !editingPlanName.trim()}
            >
              {submitting ? <CircularProgress size={24} /> : 'Сохранить'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Диалог создания тарифа */}
      <Dialog
        open={createPlanDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            createPlanUnsaved.requestClose(reason);
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Создать тариф</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Код"
              value={planForm.code}
              onChange={(e) => setPlanForm({ ...planForm, code: e.target.value.toUpperCase() })}
              sx={{ mb: 2 }}
              required
              helperText="Латиница, уникальный код (например STARTER)"
            />
            <TextField
              fullWidth
              label="Название"
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Описание"
              multiline
              rows={2}
              value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Цена (₽)"
              type="number"
              value={planForm.price}
              onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
              sx={{ mb: 2 }}
              helperText="Оставьте пустым для «Цена договорная»"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={planForm.isPublic}
                  onChange={(e) => setPlanForm({ ...planForm, isPublic: e.target.checked })}
                />
              }
              label="Публичный тариф"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Порядок отображения"
              type="number"
              value={planForm.sortOrder}
              onChange={(e) => setPlanForm({ ...planForm, sortOrder: e.target.value })}
              sx={{ mb: 2 }}
              helperText="Меньше число — выше в списке на /pricing"
            />
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>Лимиты</Typography>
            <Grid container spacing={2}>
              {(
                [
                  ['trainers', 'Тренеры'],
                  ['extraStaff', 'Доп. сотрудники'],
                  ['clients', 'Клиенты'],
                  ['groups', 'Группы'],
                  ['branches', 'Филиалы'],
                  ['trainings', 'Тренировки в месяц'],
                ] as const
              ).map(([key, label]) => (
                <Grid item xs={12} sm={6} key={key}>
                  <TextField
                    fullWidth
                    label={label}
                    value={planForm[key]}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'unlimited' || value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                        setPlanForm({ ...planForm, [key]: value });
                      }
                    }}
                    helperText={
                      key === 'extraStaff'
                        ? "Админы, промоутеры и аналоги (без владельца и тренеров). Число или 'unlimited'"
                        : "Число или 'unlimited'"
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={discardCreatePlanForm}>Отмена</Button>
          <Button
            onClick={handleCreatePlan}
            variant="contained"
            disabled={submitting || !planForm.code.trim() || !planForm.name.trim()}
          >
            {submitting ? <CircularProgress size={24} /> : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог изменения тарифа */}
      <Dialog
        open={planDialog}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            grantUnsaved.requestClose(reason);
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Выдать / изменить тариф</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Тариф</InputLabel>
              <Select
                value={selectedPlanType}
                label="Тариф"
                onChange={(e) => setSelectedPlanType(e.target.value)}
                disabled={!canWrite}
              >
                {planPrices
                  .filter(
                    (p) =>
                      p.isActive ||
                      p.code === selectedPlanType ||
                      p.planType === selectedPlanType
                  )
                  .map((p) => (
                    <MenuItem key={p.code || p.planType} value={p.code || p.planType}>
                      {p.name || p.code || p.planType}
                      {p.price == null || p.isNegotiable
                        ? ' — Цена договорная'
                        : ` — ${formatCurrency(Number(p.price))}`}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
              <DatePicker
                label="Дата окончания"
                value={grantEndDate}
                onChange={(newValue) => setGrantEndDate(newValue)}
                disabled={!canWrite}
                slotProps={{ textField: { fullWidth: true, sx: { mb: 2 } } }}
              />
            </LocalizationProvider>
            <TextField
              fullWidth
              label="Комментарий"
              multiline
              rows={2}
              value={grantComment}
              onChange={(e) => setGrantComment(e.target.value)}
              sx={{ mb: 2 }}
              disabled={!canWrite}
            />
            {canWrite && (
              <Button
                variant="outlined"
                size="small"
                sx={{ mb: 2 }}
                disabled={submitting || !grantEndDate}
                onClick={handleUpdateGrantEndDate}
              >
                Обновить только срок действия
              </Button>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              История выдачи
            </Typography>
            {grantHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Записей пока нет
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 240 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Дата</TableCell>
                      <TableCell>Действие</TableCell>
                      <TableCell>Тариф</TableCell>
                      <TableCell>Срок</TableCell>
                      <TableCell>Комментарий</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {grantHistory.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                        <TableCell>{log.action === 'extend' ? 'Продление' : 'Выдача'}</TableCell>
                        <TableCell>{log.planName || log.planCode}</TableCell>
                        <TableCell>
                          {log.newEndDate
                            ? new Date(log.newEndDate).toLocaleDateString('ru-RU')
                            : '—'}
                        </TableCell>
                        <TableCell>{log.comment || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={discardGrantForm}>Отмена</Button>
          {canWrite && (
            <Button
              onClick={handleGrantPlan}
              variant="contained"
              disabled={submitting || !selectedPlanType}
            >
              {submitting ? <CircularProgress size={24} /> : 'Выдать тариф'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <DeletionScopeDialog
        open={Boolean(deleteTenantTarget)}
        title="Удалить школу навсегда?"
        entityLabel={
          deleteTenantTarget
            ? `${deleteTenantTarget.name} (${deleteTenantTarget.subdomain})`
            : ''
        }
        options={TENANT_DELETE_OPTIONS}
        loadImpact={() => apiService.getTenantDeletionImpact(deleteTenantTarget!.id)}
        onClose={closeDeleteTenantDialog}
        onConfirm={handleConfirmDeleteTenant}
        confirmText={
          deleteTenantTarget
            ? {
                label: `Введите поддомен «${deleteTenantTarget.subdomain}» для подтверждения`,
                expected: deleteTenantTarget.subdomain,
              }
            : undefined
        }
        warning="Действие необратимо для данных школы (клиенты, сотрудники, платежи, расписание, файлы). Идеи клиентов сохраняются. Отметьте ниже только платформенную историю, которую тоже нужно стереть."
      />

      <UnsavedChangesDialog
        open={expenseUnsaved.confirmOpen}
        saving={expenseUnsaved.saving}
        onSave={expenseUnsaved.save}
        onDiscard={expenseUnsaved.discard}
        onStay={expenseUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={editExpenseUnsaved.confirmOpen}
        saving={editExpenseUnsaved.saving}
        onSave={editExpenseUnsaved.save}
        onDiscard={editExpenseUnsaved.discard}
        onStay={editExpenseUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={categoryUnsaved.confirmOpen}
        saving={categoryUnsaved.saving}
        onSave={categoryUnsaved.save}
        onDiscard={categoryUnsaved.discard}
        onStay={categoryUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={paymentUnsaved.confirmOpen}
        saving={paymentUnsaved.saving}
        onSave={paymentUnsaved.save}
        onDiscard={paymentUnsaved.discard}
        onStay={paymentUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={editPlanUnsaved.confirmOpen}
        saving={editPlanUnsaved.saving}
        onSave={editPlanUnsaved.save}
        onDiscard={editPlanUnsaved.discard}
        onStay={editPlanUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={createPlanUnsaved.confirmOpen}
        saving={createPlanUnsaved.saving}
        onSave={createPlanUnsaved.save}
        onDiscard={createPlanUnsaved.discard}
        onStay={createPlanUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={grantUnsaved.confirmOpen}
        saving={grantUnsaved.saving}
        onSave={grantUnsaved.save}
        onDiscard={grantUnsaved.discard}
        onStay={grantUnsaved.stay}
      />
    </Container>
  );
};

export default AdminDashboard;

