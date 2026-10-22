import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Add,
  CalendarTodayOutlined,
  Close,
  FilterAltOutlined,
  KeyboardArrowDown,
  ListAltOutlined,
  PaymentsOutlined,
  PeopleAltOutlined,
  Tune,
} from '@mui/icons-material';
import { DateTimePicker, DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { canCancelFinanceOperations } from '../utils/roles';
import { useSearchParams } from 'react-router-dom';
import ClientNameLink from '../components/ClientNameLink';
import TrainerNameLink from '../components/TrainerNameLink';
import { useStaffEntityCards } from '../components/StaffEntityCardHost';
import FinanceOperationsTable from '../components/finance/FinanceOperationsTable';
import TrainerSalaryBoard from '../components/finance/TrainerSalaryBoard';
import ClientPaymentsBoard from '../components/finance/ClientPaymentsBoard';
import SchoolPaymentMethodsPanel from '../components/finance/SchoolPaymentMethodsPanel';
import AddFinanceOperationDialog from '../components/finance/AddFinanceOperationDialog';
import { colors, radii, typography } from '../theme/tokens';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import {
  FinanceMembershipRow,
  FinanceOperation,
  FinanceOperationType,
  FinanceSalaryRow,
  Client,
  Trainer,
  Group,
  Branch,
} from '../types';

type FinanceTab = 'operations' | 'salary' | 'memberships';
type SortKey = 'title' | 'typeCode' | 'amount' | 'occurredAt';

const DATE_PRESETS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'this_week', label: 'Эта неделя' },
  { key: 'this_month', label: 'Этот месяц' },
  { key: 'last_month', label: 'Прошлый месяц' },
  { key: 'this_year', label: 'Этот год' },
  { key: 'last_year', label: 'Прошлый год' },
  { key: 'all', label: 'Весь период' },
];

/** Быстрые чипы типов в фильтрах (макет) → коды API. */
const FILTER_TYPE_CHIPS: Array<{ label: string; codes: string[] }> = [
  { label: 'Начисление', codes: ['salary_accrual', 'membership_charge'] },
  { label: 'Оплата', codes: ['client_payment', 'membership'] },
  { label: 'Аренда', codes: ['rent'] },
  { label: 'Покупка', codes: ['purchase'] },
  { label: 'Выдача абонемента', codes: ['membership_issue'] },
  { label: 'Корректировка', codes: ['membership_charge_adjustment'] },
  { label: 'Зарплата', codes: ['salary', 'bonus', 'salary_accrual'] },
  { label: 'Прочее', codes: ['other', 'advertising'] },
];

const FILTER_STATUS_CHIPS = [
  { key: '', label: 'Все' },
  { key: 'posted', label: 'Проведено' },
  { key: 'pending', label: 'Ожидает' },
  { key: 'cancelled', label: 'Отменено' },
];

const formatClientOptionLabel = (
  c: {
    lastName?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    balance?: number | null;
    groupName?: string | null;
    phone?: string | null;
    groupMemberships?: Array<{ group?: { name?: string | null } | null }>;
  },
  options?: { includeBalance?: boolean }
) => {
  const name = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ');
  const group =
    c.groupName ||
    c.groupMemberships?.find((gm) => gm.group?.name)?.group?.name ||
    'без группы';
  if (options?.includeBalance === false) {
    return `${name} — ${group}`;
  }
  const bal = Number(c.balance ?? 0);
  const balStr = `${bal.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;
  return `${name} — ${group} — ${balStr}`;
};

const formatTrainerOptionLabel = (t: {
  id: string;
  user?: { lastName?: string | null; firstName?: string | null } | null;
}) => (t.user ? `${t.user.lastName || ''} ${t.user.firstName || ''}`.trim() : t.id);
const formatMoney = (value: number, withSign = false, direction?: string) => {
  const abs = Math.abs(value).toLocaleString('ru-RU');
  if (!withSign) {
    return value < 0 ? `−${abs} ₽` : `${abs} ₽`;
  }
  const sign = direction === 'expense' || value < 0 ? '−' : '+';
  return `${sign}${abs} ₽`;
};

const formatDateTime = (iso: string) => {
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: ru });
  } catch {
    return iso;
  }
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  TRAINER: 'Тренер',
  MARKETER: 'Маркетолог',
  CLIENT: 'Клиент',
};

const formatOperationCreator = (op: FinanceOperation): string => {
  if (!op.createdBy) return 'Система';
  const role = ROLE_LABELS[op.createdBy.role] || op.createdBy.role;
  const name = [op.createdBy.lastName, op.createdBy.firstName, op.createdBy.middleName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name ? `${role}: ${name}` : role;
};

interface OpFilters {
  datePreset?: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  clientId: string;
  trainerId: string;
  amountFrom: string;
  amountTo: string;
  typeCodes: string[];
  category: string;
  status: string;
  onlyWithDocuments: boolean;
  onlyRecurring: boolean;
  withComments: boolean;
  groupIds: string[];
  branchIds: string[];
}

const emptyOpFilters = (): OpFilters => ({
  // «Всё время» — иначе старые операции пропадают за пределами текущего месяца
  datePreset: 'all',
  dateFrom: null,
  dateTo: null,
  clientId: '',
  trainerId: '',
  amountFrom: '',
  amountTo: '',
  typeCodes: [],
  category: '',
  status: '',
  onlyWithDocuments: false,
  onlyRecurring: false,
  withComments: false,
  groupIds: [],
  branchIds: [],
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      if (e?.response?.status === 429 && attempt < retries) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

const financeErrorMessage = (e: any) => {
  if (e?.response?.status === 429) {
    return 'Слишком много запросов. Подождите несколько секунд и обновите страницу.';
  }
  return e?.response?.data?.error || e?.message || 'Не удалось загрузить данные';
};

const Finance: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canDeleteOperations = canCancelFinanceOperations(user?.role);
  const [tab, setTab] = useState<FinanceTab>('operations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState('');
  const [deletingOpId, setDeletingOpId] = useState<string | null>(null);
  const [cancelOp, setCancelOp] = useState<FinanceOperation | null>(null);
  const [detailOp, setDetailOp] = useState<FinanceOperation | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const [operations, setOperations] = useState<FinanceOperation[]>([]);
  const [types, setTypes] = useState<FinanceOperationType[]>([]);
  const [salaryRows, setSalaryRows] = useState<FinanceSalaryRow[]>([]);
  const [membershipRows, setMembershipRows] = useState<FinanceMembershipRow[]>([]);

  const [clients, setClients] = useState<Client[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const { openClient, openTrainer, dialogs: entityCardDialogs } = useStaffEntityCards({
    branches,
    trainers,
    sourceLabel: 'Финансы',
  });

  const [opFilters, setOpFilters] = useState<OpFilters>(emptyOpFilters());
  const [appliedOpFilters, setAppliedOpFilters] = useState<OpFilters>(emptyOpFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [salaryFiltersOpen, setSalaryFiltersOpen] = useState(false);
  const [membershipFiltersOpen, setMembershipFiltersOpen] = useState(false);

  const [salaryTrainerId, setSalaryTrainerId] = useState('');
  const [salaryDateFrom, setSalaryDateFrom] = useState<Date | null>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [salaryDateTo, setSalaryDateTo] = useState<Date | null>(() => new Date());
  const [salaryAmountFrom, setSalaryAmountFrom] = useState('');
  const [salaryAmountTo, setSalaryAmountTo] = useState('');
  const [salaryTrainingsMode, setSalaryTrainingsMode] = useState<'all' | 'conducted'>('all');
  const [draftSalaryTrainerId, setDraftSalaryTrainerId] = useState('');
  const [draftSalaryDateFrom, setDraftSalaryDateFrom] = useState<Date | null>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [draftSalaryDateTo, setDraftSalaryDateTo] = useState<Date | null>(() => new Date());
  const [draftSalaryAmountFrom, setDraftSalaryAmountFrom] = useState('');
  const [draftSalaryAmountTo, setDraftSalaryAmountTo] = useState('');
  const [draftSalaryTrainingsMode, setDraftSalaryTrainingsMode] = useState<'all' | 'conducted'>('all');

  const [memClientId, setMemClientId] = useState('');
  const [memBranchId, setMemBranchId] = useState('');
  const [memGroupIds, setMemGroupIds] = useState<string[]>([]);
  const [memDate, setMemDate] = useState<Date | null>(new Date());
  const [memAmountFrom, setMemAmountFrom] = useState('');
  const [memAmountTo, setMemAmountTo] = useState('');
  const [draftMemClientId, setDraftMemClientId] = useState('');
  const [draftMemBranchId, setDraftMemBranchId] = useState('');
  const [draftMemGroupIds, setDraftMemGroupIds] = useState<string[]>([]);
  const [draftMemDate, setDraftMemDate] = useState<Date | null>(new Date());
  const [draftMemAmountFrom, setDraftMemAmountFrom] = useState('');
  const [draftMemAmountTo, setDraftMemAmountTo] = useState('');
  const [memBranchSearch, setMemBranchSearch] = useState('');

  const [sortBy, setSortBy] = useState<SortKey>('occurredAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [addOpen, setAddOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<FinanceMembershipRow | null>(null);
  const [selectedSalary, setSelectedSalary] = useState<FinanceSalaryRow | null>(null);


  const [payoutAmount, setPayoutAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [payoutBaseline, setPayoutBaseline] = useState('');
  const [receiveBaseline, setReceiveBaseline] = useState('');
  const [changePackId, setChangePackId] = useState('');
  const [catalogForChange, setCatalogForChange] = useState<any[]>([]);
  const [changingPack, setChangingPack] = useState(false);
  const [accrualCorrectOpen, setAccrualCorrectOpen] = useState(false);
  const [accrualCorrectRow, setAccrualCorrectRow] = useState<FinanceMembershipRow | null>(null);
  const [accrualNewAmount, setAccrualNewAmount] = useState('');
  const [accrualReason, setAccrualReason] = useState('');
  const [accrualOccurredAt, setAccrualOccurredAt] = useState<Date | null>(new Date());
  const [accrualSaving, setAccrualSaving] = useState(false);
  const [accrualHistory, setAccrualHistory] = useState<any[]>([]);
  const [accrualHistoryLoading, setAccrualHistoryLoading] = useState(false);

  const refsLoadedRef = useRef(false);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (appliedOpFilters.datePreset && appliedOpFilters.datePreset !== 'all') {
      chips.push(
        DATE_PRESETS.find((p) => p.key === appliedOpFilters.datePreset)?.label ||
          appliedOpFilters.datePreset
      );
    }
    if (appliedOpFilters.clientId) {
      const c = clients.find((x) => x.id === appliedOpFilters.clientId);
      if (c) chips.push(`${c.lastName} ${c.firstName}`.trim());
    }
    if (appliedOpFilters.trainerId) {
      const t = trainers.find((x) => x.id === appliedOpFilters.trainerId);
      if (t?.user) chips.push(`${t.user.lastName} ${t.user.firstName}`.trim());
    }
    if (appliedOpFilters.amountFrom || appliedOpFilters.amountTo) {
      chips.push(`${appliedOpFilters.amountFrom || '0'} ₽ - ${appliedOpFilters.amountTo || '∞'} ₽`);
    }
    FILTER_TYPE_CHIPS.forEach((chip) => {
      if (
        chip.codes.length &&
        chip.codes.every((code) => appliedOpFilters.typeCodes.includes(code)) &&
        chip.codes.some((code) => appliedOpFilters.typeCodes.includes(code))
      ) {
        const hit = chip.codes.some((c) => appliedOpFilters.typeCodes.includes(c));
        if (hit && !chips.includes(chip.label)) chips.push(chip.label);
      }
    });
    appliedOpFilters.typeCodes.forEach((code) => {
      const known = FILTER_TYPE_CHIPS.some((c) => c.codes.includes(code));
      if (!known) chips.push(types.find((t) => t.code === code)?.name || code);
    });
    if (appliedOpFilters.status) {
      chips.push(FILTER_STATUS_CHIPS.find((s) => s.key === appliedOpFilters.status)?.label || appliedOpFilters.status);
    }
    return chips;
  }, [appliedOpFilters, types, clients, trainers]);

  const loadRefs = useCallback(async () => {
    if (refsLoadedRef.current) return;
    const data = await withRetry(() => apiService.getFinanceRefs());
    setTypes(data.types || []);
    setClients(data.clients || []);
    setTrainers(data.trainers || []);
    setGroups(data.groups || []);
    setBranches(data.branches || []);
    refsLoadedRef.current = true;
  }, []);

  const loadTypes = useCallback(async () => {
    const data = await withRetry(() => apiService.getFinanceTypes());
    setTypes(data);
  }, []);

  const loadOperations = useCallback(async () => {
    const params: Record<string, any> = {
      sortBy,
      sortDir,
      limit: 200,
    };
    if (appliedOpFilters.datePreset && appliedOpFilters.datePreset !== 'all') {
      params.datePreset = appliedOpFilters.datePreset;
    }
    if (appliedOpFilters.dateFrom) params.dateFrom = appliedOpFilters.dateFrom.toISOString();
    if (appliedOpFilters.dateTo) params.dateTo = appliedOpFilters.dateTo.toISOString();
    if (appliedOpFilters.amountFrom) params.amountFrom = appliedOpFilters.amountFrom;
    if (appliedOpFilters.amountTo) params.amountTo = appliedOpFilters.amountTo;
    if (appliedOpFilters.typeCodes.length) params.typeCodes = appliedOpFilters.typeCodes.join(',');
    if (appliedOpFilters.groupIds.length) params.groupIds = appliedOpFilters.groupIds.join(',');
    if (appliedOpFilters.branchIds.length) params.branchIds = appliedOpFilters.branchIds.join(',');
    if (appliedOpFilters.clientId) params.clientIds = appliedOpFilters.clientId;
    if (appliedOpFilters.trainerId) params.trainerIds = appliedOpFilters.trainerId;

    const data = await withRetry(() => apiService.getFinanceOperations(params));
    let items = data.items || [];

    // Клиентские доп. фильтры (метаданные в notes / UI-only)
    if (appliedOpFilters.onlyWithDocuments) {
      items = items.filter((op: any) => String(op.notes || '').includes('[документ:'));
    }
    if (appliedOpFilters.onlyRecurring) {
      items = items.filter((op: any) => String(op.notes || '').includes('[регулярно:'));
    }
    if (appliedOpFilters.withComments) {
      items = items.filter((op: any) => {
        const n = String(op.notes || '').trim();
        return n && !n.startsWith('[');
      });
    }
    if (appliedOpFilters.status === 'pending') {
      items = items.filter((op: any) => String(op.notes || '').includes('[статус:pending]'));
    } else if (appliedOpFilters.status === 'cancelled') {
      items = items.filter((op: any) => String(op.notes || '').includes('[статус:cancelled]'));
    } else if (appliedOpFilters.status === 'posted') {
      items = items.filter(
        (op: any) =>
          !String(op.notes || '').includes('[статус:pending]') &&
          !String(op.notes || '').includes('[статус:cancelled]')
      );
    }
    if (appliedOpFilters.category) {
      items = items.filter((op: any) =>
        String(op.notes || '').includes(`[категория:${appliedOpFilters.category}]`)
      );
    }

    setOperations(items);
  }, [appliedOpFilters, sortBy, sortDir]);

  const loadSalary = useCallback(async () => {
    const params: Record<string, any> = {};
    if (salaryTrainerId) params.trainerIds = salaryTrainerId;
    if (salaryDateFrom) {
      const from = new Date(salaryDateFrom);
      from.setHours(0, 0, 0, 0);
      params.dateFrom = from.toISOString();
    }
    if (salaryDateTo) {
      const to = new Date(salaryDateTo);
      to.setHours(23, 59, 59, 999);
      params.dateTo = to.toISOString();
    }
    if (salaryAmountFrom) params.amountFrom = salaryAmountFrom;
    if (salaryAmountTo) params.amountTo = salaryAmountTo;
    params.trainingsMode = salaryTrainingsMode;
    const rows = await withRetry(() => apiService.getFinanceSalarySummary(params));
    setSalaryRows(rows);
  }, [salaryTrainerId, salaryDateFrom, salaryDateTo, salaryAmountFrom, salaryAmountTo, salaryTrainingsMode]);

  const loadMemberships = useCallback(async () => {
    const params: Record<string, any> = {};
    if (memClientId) params.clientIds = memClientId;
    if (memBranchId) params.branchIds = memBranchId;
    if (memGroupIds.length) params.groupIds = memGroupIds.join(',');
    if (memAmountFrom) params.amountFrom = memAmountFrom;
    if (memAmountTo) params.amountTo = memAmountTo;
    if (memDate) params.periodKey = format(memDate, 'yyyy-MM');
    const rows = await withRetry(() => apiService.getFinanceMembershipSummary(params));
    setMembershipRows(rows);
  }, [memClientId, memBranchId, memGroupIds, memAmountFrom, memAmountTo, memDate]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'operations') await loadOperations();
      if (tab === 'salary') await loadSalary();
      if (tab === 'memberships') await loadMemberships();
    } catch (e: any) {
      setError(financeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [tab, loadOperations, loadSalary, loadMemberships]);

  useEffect(() => {
    loadTypes().catch((e) => setError(financeErrorMessage(e)));
  }, [loadTypes]);

  useEffect(() => {
    if (tab === 'salary' || tab === 'memberships' || filtersOpen || salaryFiltersOpen || membershipFiltersOpen || addOpen) {
      loadRefs().catch((e) => setError(financeErrorMessage(e)));
    }
  }, [tab, filtersOpen, salaryFiltersOpen, membershipFiltersOpen, addOpen, loadRefs]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir(key === 'occurredAt' ? 'desc' : 'asc');
    }
  };

  const discardAddForm = useCallback(() => {
    setAddOpen(false);
  }, []);

  const openAddDialog = () => {
    setAddOpen(true);
  };

  // Deep link ?create=1 — сразу диалог «Добавить операцию»
  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    if (!addOpen) {
      openAddDialog();
    }
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, addOpen, setSearchParams]);

  const handleAddFinanceSuccess = useCallback(
    async (payload: { message: string; refresh?: Array<'operations' | 'salary' | 'memberships' | 'types'> }) => {
      setSnackbar(payload.message);
      const refresh = payload.refresh || ['operations'];
      if (refresh.includes('operations')) await loadOperations();
      if (refresh.includes('salary')) await loadSalary();
      if (refresh.includes('memberships')) await loadMemberships();
      if (refresh.includes('types')) await loadTypes();
    },
    [loadOperations, loadSalary, loadMemberships, loadTypes]
  );

  const handleConfirmCancelOperation = async () => {
    if (!cancelOp) return;
    setDeletingOpId(cancelOp.id);
    try {
      await apiService.deleteFinanceOperation(cancelOp.id);
      setCancelOp(null);
      setSnackbar('Операция отменена');
      await loadOperations();
      if (tab === 'salary') await loadSalary();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось отменить операцию');
    } finally {
      setDeletingOpId(null);
    }
  };

  const handlePurgeUnlinked = async () => {
    setPurging(true);
    try {
      const data = await apiService.purgeUnlinkedFinanceHistory();
      setPurgeOpen(false);
      setSnackbar(
        `Очищено: зарплата ${data.deletedSalaryLedgers}, счета клиентов ${data.cancelledPayments}`
      );
      await Promise.all([loadOperations(), loadSalary(), loadMemberships()]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось очистить старые записи');
    } finally {
      setPurging(false);
    }
  };

  const discardPayoutForm = useCallback(() => {
    setPayoutOpen(false);
    setPayoutAmount('');
    setPayoutBaseline('');
    setSelectedSalary(null);
  }, []);

  const discardReceiveForm = useCallback(() => {
    setReceiveOpen(false);
    setReceiveAmount('');
    setReceiveBaseline('');
    setSelectedMembership(null);
    setChangePackId('');
  }, []);

  const openAccrualCorrectDialog = async (row: FinanceMembershipRow) => {
    setAccrualCorrectRow(row);
    setAccrualNewAmount(String(Math.round(row.membershipPrice ?? 0)));
    setAccrualReason('');
    setAccrualOccurredAt(new Date());
    setAccrualCorrectOpen(true);
    setAccrualHistoryLoading(true);
    try {
      const month = row.periodKey || (memDate ? format(memDate, 'yyyy-MM') : format(new Date(), 'yyyy-MM'));
      const items = await apiService.getMonthChargesBreakdown({
        clientId: row.clientId,
        month,
      });
      setAccrualHistory(items);
    } catch {
      setAccrualHistory([]);
    } finally {
      setAccrualHistoryLoading(false);
    }
  };

  const discardAccrualCorrect = () => {
    setAccrualCorrectOpen(false);
    setAccrualCorrectRow(null);
    setAccrualNewAmount('');
    setAccrualReason('');
    setAccrualOccurredAt(new Date());
    setAccrualHistory([]);
  };

  const handleCorrectAccrual = async (): Promise<boolean> => {
    if (!accrualCorrectRow) return false;
    const newAmount = Number(String(accrualNewAmount).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      setError('Введите корректную новую сумму');
      return false;
    }
    if (!accrualReason.trim()) {
      setError('Укажите причину корректировки');
      return false;
    }
    try {
      setAccrualSaving(true);
      await apiService.correctMembershipAccrual({
        clientId: accrualCorrectRow.clientId,
        paymentId: accrualCorrectRow.latestPaymentId || undefined,
        periodKey: accrualCorrectRow.periodKey || undefined,
        newAmount,
        reason: accrualReason.trim(),
        occurredAt: accrualOccurredAt?.toISOString(),
      });
      discardAccrualCorrect();
      setSnackbar('Начисление скорректировано');
      await Promise.all([loadMemberships(), loadOperations()]);
      return true;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось скорректировать начисление');
      return false;
    } finally {
      setAccrualSaving(false);
    }
  };

  const handlePayout = async (): Promise<boolean> => {
    if (!selectedSalary) return false;
    const increment = Number(payoutAmount);
    if (!Number.isFinite(increment) || increment <= 0) {
      setError('Введите сумму выплаты');
      return false;
    }
    try {
      await apiService.payoutTrainerSalary({
        trainerId: selectedSalary.trainerId,
        amount: increment,
        periodLabel:
          salaryDateFrom && salaryDateTo
            ? `${format(salaryDateFrom, 'dd.MM.yyyy', { locale: ru })} — ${format(salaryDateTo, 'dd.MM.yyyy', { locale: ru })}`
            : salaryDateFrom
              ? `с ${format(salaryDateFrom, 'dd.MM.yyyy', { locale: ru })}`
              : salaryDateTo
                ? `по ${format(salaryDateTo, 'dd.MM.yyyy', { locale: ru })}`
                : undefined,
      });
      discardPayoutForm();
      setSnackbar('Выплата сохранена');
      await Promise.all([loadSalary(), loadOperations()]);
      return true;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось выплатить зарплату');
      return false;
    }
  };

  const handleReceive = async (): Promise<boolean> => {
    if (!selectedMembership) return false;
    const normalized = String(receiveAmount)
      .trim()
      .replace(/−/g, '-')
      .replace(/\s/g, '')
      .replace(',', '.');
    const increment = Number(normalized);
    if (!Number.isFinite(increment) || increment === 0) {
      setError('Введите сумму (можно со знаком минус для уменьшения)');
      return false;
    }
    const paidNow = selectedMembership.paidAmount ?? 0;
    if (increment < 0 && Math.abs(increment) > paidNow) {
      setError(`Нельзя уменьшить больше, чем выплачено (${formatMoney(paidNow)})`);
      return false;
    }
    try {
      await apiService.receiveMembershipPayment({
        paymentId: selectedMembership.latestPaymentId || undefined,
        clientId: selectedMembership.clientId,
        amount: increment,
        periodKey: selectedMembership.periodKey || undefined,
      });
      discardReceiveForm();
      setSnackbar(increment < 0 ? 'Выплачено уменьшено' : 'Оплата сохранена');
      await loadMemberships();
      await loadOperations();
      return true;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить изменение оплаты');
      return false;
    }
  };

  const openReceive = (row: FinanceMembershipRow) => {
    setSelectedMembership(row);
    setReceiveAmount('');
    setReceiveBaseline('');
    setChangePackId('');
    setReceiveOpen(true);
    void apiService
      .getMemberships({ limit: 200 })
      .then((res) =>
        setCatalogForChange((res.data || []).filter((m: any) => m.isActive !== false && m.category !== 'GROUP'))
      )
      .catch(() => setCatalogForChange([]));
  };

  const filterChipSx = {
    bgcolor: colors.primary,
    color: colors.white,
    fontWeight: 600,
    fontSize: typography.hint,
    borderRadius: `${radii.button}px`,
    height: 28,
    '& .MuiChip-deleteIcon': {
      color: colors.white,
      bgcolor: '#EC7C94',
      borderRadius: '50%',
      width: 18,
      height: 18,
      m: 0.5,
      '&:hover': { color: colors.white, bgcolor: '#EC7C94' },
    },
  };

  const filterSectionTitleSx = {
    fontWeight: 700,
    fontSize: 15,
    color: colors.text,
    mb: 1,
  };

  const filterSelectSx = {
    borderRadius: `${radii.button}px`,
    fontSize: typography.field,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.primarySoft },
  };

  const filterPillSx = (selected: boolean) => ({
    fontWeight: 600,
    fontSize: 12.5,
    borderRadius: '12px',
    height: 32,
    bgcolor: selected ? colors.primary : colors.surface,
    color: selected ? colors.white : colors.textMuted,
    border: selected ? 'none' : `1px solid ${colors.divider}`,
    '&:hover': {
      bgcolor: selected ? colors.primaryDark : 'rgba(47, 107, 255, 0.08)',
    },
  });

  const filterFieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      bgcolor: colors.card,
      fontSize: 13,
    },
  };


  const payoutDirty = payoutOpen && isDirtyValue(payoutAmount, payoutBaseline);
  const payoutUnsaved = useUnsavedClose({
    isDirty: Boolean(payoutDirty),
    onDiscard: discardPayoutForm,
    onSave: handlePayout,
  });

  const receiveDirty = receiveOpen && isDirtyValue(receiveAmount, receiveBaseline);
  const receiveUnsaved = useUnsavedClose({
    isDirty: Boolean(receiveDirty),
    onDiscard: discardReceiveForm,
    onSave: handleReceive,
  });

  const renderFinanceToolbar = (
    onOpenFilters: () => void,
    chips: string[],
    onClearFilters: () => void,
    foundCount: number
  ) => (
    <Box sx={{ mb: 1.75 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.25}
        sx={{ mb: chips.length ? 1.25 : 0, flexWrap: 'wrap' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        useFlexGap
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={openAddDialog}
          sx={{
            bgcolor: colors.primary,
            borderRadius: '12px',
            px: 2,
            py: 0.9,
            textTransform: 'none',
            fontSize: typography.button,
            fontWeight: 700,
            boxShadow: 'none',
            width: { xs: '100%', sm: 'auto' },
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          Добавить операцию
        </Button>
        {canDeleteOperations && (
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={() => setPurgeOpen(true)}
            sx={{
              borderRadius: '12px',
              px: 2,
              py: 0.9,
              textTransform: 'none',
              fontSize: typography.button,
              fontWeight: 600,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Очистить старые записи
          </Button>
        )}
        <Button
          variant="outlined"
          size="small"
          onClick={onOpenFilters}
          startIcon={<Tune sx={{ fontSize: 18 }} />}
          sx={{
            borderRadius: '12px',
            px: 2,
            py: 0.9,
            textTransform: 'none',
            fontSize: typography.button,
            fontWeight: 600,
            borderColor: '#E6EAF2',
            color: '#1B2438',
            bgcolor: '#F7F8FB',
            width: { xs: '100%', sm: 'auto' },
            '&:hover': { borderColor: colors.primarySoft, bgcolor: '#EEF2F8' },
          }}
        >
          Все фильтры
          {chips.length > 0 ? ` • ${chips.length}` : ''}
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          {chips.map((chip) => (
            <Chip
              key={chip}
              label={chip}
              onDelete={onClearFilters}
              sx={filterChipSx}
              deleteIcon={<Close sx={{ fontSize: 12 }} />}
            />
          ))}
          {chips.length > 0 && (
            <Button
              size="small"
              onClick={onClearFilters}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 12.5,
                color: colors.primary,
                minWidth: 0,
                px: 0.5,
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
              }}
            >
              Сбросить фильтры
            </Button>
          )}
        </Stack>
        <Typography sx={{ fontSize: 13, color: '#8B93A7', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Найдено операций: {foundCount}
        </Typography>
      </Box>
    </Box>
  );

  const financeTabs = (
    <Tabs
      value={tab}
      onChange={(_, v) => setTab(v)}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{ mb: 1.5 }}
    >
      <Tab value="operations" icon={<ListAltOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Все операции" />
      <Tab value="salary" icon={<PaymentsOutlined sx={{ fontSize: 18 }} />} iconPosition="start" label="Зарплата тренеров" />
      <Tab
        value="memberships"
        icon={<PeopleAltOutlined sx={{ fontSize: 18 }} />}
        iconPosition="start"
        label="Операции клиентов"
      />
    </Tabs>
  );

  const todayLabel = `Сегодня, ${format(new Date(), 'd MMMM yyyy', { locale: ru })}`;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box data-onboarding="finance-page">
        <Box
          sx={{
            mb: { xs: 1.5, md: 2 },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: 22, md: 26 },
                color: '#1B2438',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Финансы
            </Typography>
            <Typography sx={{ fontSize: 13, color: '#8B93A7', mt: 0.75, maxWidth: 640, lineHeight: 1.45 }}>
              Управляйте доходами и расходами спортивного центра. Контролируйте все операции в одном месте.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<CalendarTodayOutlined sx={{ fontSize: 18 }} />}
            endIcon={<KeyboardArrowDown sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              borderRadius: '12px',
              borderColor: '#E6EAF2',
              color: '#1B2438',
              bgcolor: '#fff',
              px: 1.75,
              py: 1,
              whiteSpace: 'nowrap',
              alignSelf: { xs: 'flex-start', sm: 'center' },
              boxShadow: '0 2px 8px rgba(27, 36, 56, 0.04)',
              '&:hover': { borderColor: colors.primarySoft, bgcolor: '#F7F8FB' },
            }}
          >
            {todayLabel}
          </Button>
        </Box>

        <SchoolPaymentMethodsPanel user={user} groups={groups} variant="banner" />
        {financeTabs}

        <Box
          sx={{
            bgcolor: colors.card,
            borderRadius: `${radii.panel}px`,
            p: { xs: 1.5, md: 2 },
            boxShadow: '0 2px 8px rgba(32, 34, 36, 0.04)',
          }}
        >

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!canDeleteOperations && tab === 'operations' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Отменять финансовые операции может только владелец школы.
          </Alert>
        )}

        {tab === 'operations' && (
          <>
            {renderFinanceToolbar(
              () => {
                setOpFilters(appliedOpFilters);
                setFiltersOpen(true);
              },
              activeFilterChips,
              () => {
                const next = emptyOpFilters();
                setAppliedOpFilters(next);
                setOpFilters(next);
              },
              operations.length
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <FinanceOperationsTable
                operations={operations}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                formatMoney={formatMoney}
                formatDateTime={formatDateTime}
                deletingId={deletingOpId}
                onRowClick={(op) => setDetailOp(op)}
                onDelete={canDeleteOperations ? (op) => setCancelOp(op) : undefined}
                onOpenClient={openClient}
              />
            )}
          </>
        )}

        {tab === 'salary' && (
          <TrainerSalaryBoard
            rows={salaryRows}
            trainers={trainers}
            branches={branches}
            loading={loading}
            dateFrom={salaryDateFrom}
            dateTo={salaryDateTo}
            onDateFrom={setSalaryDateFrom}
            onDateTo={setSalaryDateTo}
            trainingsMode={salaryTrainingsMode}
            onTrainingsMode={setSalaryTrainingsMode}
            onPay={(row) => {
              setSelectedSalary(row);
              setPayoutAmount('');
              setPayoutBaseline('');
              setPayoutOpen(true);
            }}
            onOpenTrainer={openTrainer}
            onReset={() => {
              const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
              const today = new Date();
              setSalaryTrainerId('');
              setSalaryDateFrom(monthStart);
              setSalaryDateTo(today);
              setSalaryAmountFrom('');
              setSalaryAmountTo('');
              setSalaryTrainingsMode('all');
            }}
            formatMoney={(v) => formatMoney(v)}
          />
        )}

        {tab === 'memberships' && (
          <ClientPaymentsBoard
            rows={membershipRows}
            clients={clients}
            groups={groups}
            branches={branches}
            loading={loading}
            onOpenClient={openClient}
            onReceive={openReceive}
            onMonthChange={(month) => setMemDate(month)}
            formatMoney={(v) => formatMoney(v)}
          />
        )}

        </Box>

        {/* Filters drawer — Все операции */}
        <Drawer
          anchor="right"
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: 420 },
              bgcolor: '#fff',
              borderRadius: { xs: 0, sm: '16px 0 0 16px' },
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <Box sx={{ px: 2.5, pt: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438' }}>Фильтры</Typography>
            <IconButton onClick={() => setFiltersOpen(false)} sx={{ color: '#8B93A7' }}>
              <Close />
            </IconButton>
          </Box>

          <Box sx={{ px: 2.5, pb: 2, flex: 1, overflow: 'auto' }}>
            <Typography sx={{ ...filterSectionTitleSx, mb: 1 }}>Быстрые периоды</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }} useFlexGap>
              {DATE_PRESETS.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  clickable
                  onClick={() =>
                    setOpFilters((f) => ({
                      ...f,
                      datePreset: p.key === 'all' ? 'all' : p.key,
                      dateFrom: null,
                      dateTo: null,
                    }))
                  }
                  sx={filterPillSx(opFilters.datePreset === p.key || (!opFilters.datePreset && p.key === 'all'))}
                />
              ))}
            </Stack>

            <Typography sx={filterSectionTitleSx}>Период</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
              <DatePicker
                label="Дата начала"
                value={opFilters.dateFrom}
                onChange={(v) => setOpFilters((f) => ({ ...f, dateFrom: v, datePreset: undefined }))}
                format="dd.MM.yyyy"
                slotProps={{ textField: { size: 'small', fullWidth: true, sx: filterFieldSx } }}
              />
              <DatePicker
                label="Дата окончания"
                value={opFilters.dateTo}
                onChange={(v) => setOpFilters((f) => ({ ...f, dateTo: v, datePreset: undefined }))}
                format="dd.MM.yyyy"
                slotProps={{ textField: { size: 'small', fullWidth: true, sx: filterFieldSx } }}
              />
            </Stack>

            <Typography sx={filterSectionTitleSx}>По клиенту / сотруднику</Typography>
            <Box sx={{ mb: 1.25 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>Клиент</Typography>
              <Autocomplete
                size="small"
                options={clients}
                value={clients.find((c) => c.id === opFilters.clientId) || null}
                onChange={(_e, v) => setOpFilters((f) => ({ ...f, clientId: v?.id || '' }))}
                getOptionLabel={(c) => formatClientOptionLabel(c, { includeBalance: false })}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Поиск по ФИО, телефону..." sx={filterFieldSx} />
                )}
              />
            </Box>
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>
                Сотрудник (тренер/администратор)
              </Typography>
              <Autocomplete
                size="small"
                options={trainers}
                value={trainers.find((t) => t.id === opFilters.trainerId) || null}
                onChange={(_e, v) => setOpFilters((f) => ({ ...f, trainerId: v?.id || '' }))}
                getOptionLabel={(t) => formatTrainerOptionLabel(t)}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Поиск по сотрудникам..." sx={filterFieldSx} />
                )}
              />
            </Box>

            <Typography sx={filterSectionTitleSx}>По типу операции</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }} useFlexGap>
              <Chip
                label="Все"
                clickable
                onClick={() => setOpFilters((f) => ({ ...f, typeCodes: [] }))}
                sx={filterPillSx(opFilters.typeCodes.length === 0)}
              />
              {FILTER_TYPE_CHIPS.map((chip) => {
                const selected = chip.codes.some((c) => opFilters.typeCodes.includes(c));
                return (
                  <Chip
                    key={chip.label}
                    label={chip.label}
                    clickable
                    onClick={() =>
                      setOpFilters((f) => {
                        if (selected) {
                          return {
                            ...f,
                            typeCodes: f.typeCodes.filter((c) => !chip.codes.includes(c)),
                          };
                        }
                        return {
                          ...f,
                          typeCodes: Array.from(new Set([...f.typeCodes, ...chip.codes])),
                        };
                      })
                    }
                    sx={filterPillSx(selected)}
                  />
                );
              })}
            </Stack>

            <Typography sx={filterSectionTitleSx}>По категории</Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
              <Select
                value={opFilters.category}
                displayEmpty
                onChange={(e) => setOpFilters((f) => ({ ...f, category: e.target.value }))}
                sx={{ ...filterSelectSx, fontWeight: 650 }}
                renderValue={(v) =>
                  v ? v : <span style={{ color: '#8B93A7' }}>Выберите категорию</span>
                }
              >
                <MenuItem value="">Все категории</MenuItem>
                {['Зарплата', 'Аренда', 'Абонементы', 'Покупки', 'Прочее'].map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography sx={filterSectionTitleSx}>По сумме</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
              <TextField
                size="small"
                fullWidth
                label="От"
                value={opFilters.amountFrom}
                onChange={(e) => setOpFilters((f) => ({ ...f, amountFrom: e.target.value }))}
                InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
                sx={filterFieldSx}
              />
              <TextField
                size="small"
                fullWidth
                label="До"
                value={opFilters.amountTo}
                onChange={(e) => setOpFilters((f) => ({ ...f, amountTo: e.target.value }))}
                InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
                sx={filterFieldSx}
              />
            </Stack>

            <Typography sx={filterSectionTitleSx}>Статус</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }} useFlexGap>
              {FILTER_STATUS_CHIPS.map((s) => (
                <Chip
                  key={s.key || 'all'}
                  label={s.label}
                  clickable
                  onClick={() => setOpFilters((f) => ({ ...f, status: s.key }))}
                  sx={filterPillSx(opFilters.status === s.key)}
                />
              ))}
            </Stack>

            <Typography sx={filterSectionTitleSx}>Дополнительно</Typography>
            <Stack sx={{ mb: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={opFilters.onlyWithDocuments}
                    onChange={(e) =>
                      setOpFilters((f) => ({ ...f, onlyWithDocuments: e.target.checked }))
                    }
                    sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                  />
                }
                label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Только с документами</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={opFilters.onlyRecurring}
                    onChange={(e) =>
                      setOpFilters((f) => ({ ...f, onlyRecurring: e.target.checked }))
                    }
                    sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                  />
                }
                label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Только регулярные</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={opFilters.withComments}
                    onChange={(e) =>
                      setOpFilters((f) => ({ ...f, withComments: e.target.checked }))
                    }
                    sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                  />
                }
                label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>С комментарием</Typography>}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderTop: '1px solid #EEF1F6',
              display: 'flex',
              gap: 1,
            }}
          >
            <Button
              onClick={() => {
                const empty = emptyOpFilters();
                setOpFilters(empty);
                setAppliedOpFilters(empty);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 750,
                color: colors.primary,
                flex: 1,
              }}
            >
              Сбросить
            </Button>
            <Button
              variant="contained"
              startIcon={<FilterAltOutlined />}
              onClick={() => {
                setAppliedOpFilters(opFilters);
                setFiltersOpen(false);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 750,
                bgcolor: colors.primary,
                borderRadius: `${radii.button}px`,
                boxShadow: 'none',
                flex: 1.4,
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
            >
              Применить фильтры
            </Button>
          </Box>
        </Drawer>

        {/* Filters drawer — Зарплата тренеров */}
        <Drawer
          anchor="right"
          open={salaryFiltersOpen}
          onClose={() => setSalaryFiltersOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: 420 },
              bgcolor: '#fff',
              borderRadius: { xs: 0, sm: '16px 0 0 16px' },
              display: 'flex',
              flexDirection: 'column',
              p: 0,
            },
          }}
        >
          <Box sx={{ px: 2.5, pt: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438' }}>Фильтры</Typography>
            <IconButton onClick={() => setSalaryFiltersOpen(false)} sx={{ color: '#8B93A7' }}>
              <Close />
            </IconButton>
          </Box>

          <Box sx={{ px: 2.5, pb: 2, flex: 1, overflow: 'auto' }}>
          <Typography sx={filterSectionTitleSx}>Выбрать тренера</Typography>
          <Autocomplete
            size="small"
            options={trainers}
            value={trainers.find((t) => t.id === draftSalaryTrainerId) || null}
            onChange={(_, value) => setDraftSalaryTrainerId(value?.id || '')}
            getOptionLabel={(t) => formatTrainerOptionLabel(t)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(options, { inputValue }) => {
              const q = inputValue.trim().toLowerCase();
              if (!q) return options;
              return options.filter((t) => formatTrainerOptionLabel(t).toLowerCase().includes(q));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Начните вводить ФИО"
                sx={{ mb: 2.5, ...filterFieldSx }}
              />
            )}
          />

          <Typography sx={filterSectionTitleSx}>Дата</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>От</Typography>
              <DatePicker
                value={draftSalaryDateFrom}
                onChange={setDraftSalaryDateFrom}
                format="dd.MM.yyyy"
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: filterFieldSx,
                  },
                }}
              />
            </Box>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>До</Typography>
              <DatePicker
                value={draftSalaryDateTo}
                onChange={setDraftSalaryDateTo}
                format="dd.MM.yyyy"
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: filterFieldSx,
                  },
                }}
              />
            </Box>
          </Stack>

          <Typography sx={filterSectionTitleSx}>Кол-во тренировок</Typography>
          <RadioGroup
            row
            value={draftSalaryTrainingsMode}
            onChange={(e) => setDraftSalaryTrainingsMode(e.target.value as 'all' | 'conducted')}
            sx={{ mb: 2.5 }}
          >
            <FormControlLabel value="all" control={<Radio size="small" />} label="Все" />
            <FormControlLabel value="conducted" control={<Radio size="small" />} label="Проведённые" />
          </RadioGroup>

          <Typography sx={filterSectionTitleSx}>Сумма</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>От</Typography>
              <TextField
                size="small"
                fullWidth
                value={draftSalaryAmountFrom}
                onChange={(e) => setDraftSalaryAmountFrom(e.target.value)}
                placeholder="0 ₽"
                sx={filterFieldSx}
              />
            </Box>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>До</Typography>
              <TextField
                size="small"
                fullWidth
                value={draftSalaryAmountTo}
                onChange={(e) => setDraftSalaryAmountTo(e.target.value)}
                placeholder="999 ₽"
                sx={filterFieldSx}
              />
            </Box>
          </Stack>
          </Box>

          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderTop: '1px solid #EEF1F6',
              display: 'flex',
              gap: 1.25,
              bgcolor: '#FAFBFD',
            }}
          >
            <Button
              fullWidth
              variant="outlined"
              sx={{
                textTransform: 'none',
                borderRadius: '12px',
                py: 1.1,
                borderColor: colors.primarySoft,
                color: colors.primary,
                fontWeight: 700,
              }}
              onClick={() => {
                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const today = new Date();
                setDraftSalaryTrainerId('');
                setDraftSalaryDateFrom(monthStart);
                setDraftSalaryDateTo(today);
                setDraftSalaryAmountFrom('');
                setDraftSalaryAmountTo('');
                setDraftSalaryTrainingsMode('all');
                setSalaryTrainerId('');
                setSalaryDateFrom(monthStart);
                setSalaryDateTo(today);
                setSalaryAmountFrom('');
                setSalaryAmountTo('');
                setSalaryTrainingsMode('all');
                setSalaryFiltersOpen(false);
              }}
            >
              Сбросить
            </Button>
            <Button
              fullWidth
              variant="contained"
              sx={{
                textTransform: 'none',
                borderRadius: '12px',
                py: 1.1,
                bgcolor: colors.primary,
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
              onClick={() => {
                setSalaryTrainerId(draftSalaryTrainerId);
                setSalaryDateFrom(draftSalaryDateFrom);
                setSalaryDateTo(draftSalaryDateTo);
                setSalaryAmountFrom(draftSalaryAmountFrom);
                setSalaryAmountTo(draftSalaryAmountTo);
                setSalaryTrainingsMode(draftSalaryTrainingsMode);
                setSalaryFiltersOpen(false);
              }}
            >
              Применить
            </Button>
          </Box>
        </Drawer>

        {/* Filters drawer — Операции клиентов */}
        <Drawer
          anchor="right"
          open={membershipFiltersOpen}
          onClose={() => setMembershipFiltersOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: 420 },
              bgcolor: '#fff',
              borderRadius: { xs: 0, sm: '16px 0 0 16px' },
              display: 'flex',
              flexDirection: 'column',
              p: 0,
            },
          }}
        >
          <Box sx={{ px: 2.5, pt: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438' }}>Фильтры</Typography>
            <IconButton onClick={() => setMembershipFiltersOpen(false)} sx={{ color: '#8B93A7' }}>
              <Close />
            </IconButton>
          </Box>

          <Box sx={{ px: 2.5, pb: 2, flex: 1, overflow: 'auto' }}>
          <Typography sx={filterSectionTitleSx}>Выбрать клиента</Typography>
          <Autocomplete
            size="small"
            options={clients}
            value={clients.find((c) => c.id === draftMemClientId) || null}
            onChange={(_, value) => setDraftMemClientId(value?.id || '')}
            getOptionLabel={(c) => formatClientOptionLabel(c, { includeBalance: false })}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(options, { inputValue }) => {
              const q = inputValue.trim().toLowerCase();
              if (!q) return options;
              return options.filter((c) =>
                formatClientOptionLabel(c, { includeBalance: false }).toLowerCase().includes(q)
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Начните вводить ФИО"
                sx={{ mb: 2.5, ...filterFieldSx }}
              />
            )}
          />

          <Typography sx={filterSectionTitleSx}>Дата</Typography>
          <DatePicker
            value={draftMemDate}
            onChange={setDraftMemDate}
            format="dd.MM.yyyy"
            slotProps={{
              textField: {
                size: 'small',
                fullWidth: true,
                sx: { mb: 2.5, ...filterFieldSx },
              },
            }}
          />

          <Typography sx={filterSectionTitleSx}>По филиалу</Typography>
          <Chip
            label="Все филиалы"
            clickable
            onClick={() => setDraftMemBranchId('')}
            sx={{ mb: 1.5, ...filterPillSx(!draftMemBranchId) }}
          />
          <TextField
            size="small"
            fullWidth
            placeholder="Поиск по филиалам"
            value={memBranchSearch}
            onChange={(e) => setMemBranchSearch(e.target.value)}
            sx={{ mb: 1.5, ...filterFieldSx }}
          />
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }} useFlexGap>
            {branches
              .filter((b) => !memBranchSearch || b.name.toLowerCase().includes(memBranchSearch.toLowerCase()))
              .map((b) => (
                <Chip
                  key={b.id}
                  label={b.name}
                  clickable
                  onClick={() => setDraftMemBranchId(b.id)}
                  sx={filterPillSx(draftMemBranchId === b.id)}
                />
              ))}
          </Stack>

          <Typography sx={filterSectionTitleSx}>По группе</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }} useFlexGap>
            {groups.map((g) => {
              const selected = draftMemGroupIds.includes(g.id);
              return (
                <Chip
                  key={g.id}
                  label={g.name}
                  clickable
                  onClick={() =>
                    setDraftMemGroupIds((prev) =>
                      selected ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                    )
                  }
                  sx={filterPillSx(selected)}
                />
              );
            })}
          </Stack>

          <Typography sx={filterSectionTitleSx}>Сумма</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>От</Typography>
              <TextField
                size="small"
                fullWidth
                value={draftMemAmountFrom}
                onChange={(e) => setDraftMemAmountFrom(e.target.value)}
                placeholder="0 ₽"
                sx={filterFieldSx}
              />
            </Box>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#5A6478', mb: 0.5 }}>До</Typography>
              <TextField
                size="small"
                fullWidth
                value={draftMemAmountTo}
                onChange={(e) => setDraftMemAmountTo(e.target.value)}
                placeholder="999 ₽"
                sx={filterFieldSx}
              />
            </Box>
          </Stack>
          </Box>

          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderTop: '1px solid #EEF1F6',
              display: 'flex',
              gap: 1.25,
              bgcolor: '#FAFBFD',
            }}
          >
            <Button
              fullWidth
              variant="outlined"
              sx={{
                textTransform: 'none',
                borderRadius: '12px',
                py: 1.1,
                borderColor: colors.primarySoft,
                color: colors.primary,
                fontWeight: 700,
              }}
              onClick={() => {
                setDraftMemClientId('');
                setDraftMemBranchId('');
                setDraftMemGroupIds([]);
                setDraftMemDate(new Date());
                setDraftMemAmountFrom('');
                setDraftMemAmountTo('');
                setMemClientId('');
                setMemBranchId('');
                setMemGroupIds([]);
                setMemDate(new Date());
                setMemAmountFrom('');
                setMemAmountTo('');
                setMembershipFiltersOpen(false);
              }}
            >
              Сбросить
            </Button>
            <Button
              fullWidth
              variant="contained"
              sx={{
                textTransform: 'none',
                borderRadius: '12px',
                py: 1.1,
                bgcolor: colors.primary,
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
              onClick={() => {
                setMemClientId(draftMemClientId);
                setMemBranchId(draftMemBranchId);
                setMemGroupIds(draftMemGroupIds);
                setMemDate(draftMemDate);
                setMemAmountFrom(draftMemAmountFrom);
                setMemAmountTo(draftMemAmountTo);
                setMembershipFiltersOpen(false);
              }}
            >
              Применить
            </Button>
          </Box>
        </Drawer>

        <AddFinanceOperationDialog
          open={addOpen}
          onClose={discardAddForm}
          onSuccess={(payload) => { void handleAddFinanceSuccess(payload); }}
        />

        <Dialog
          open={payoutOpen}
          onClose={(_event, reason) => {
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
              payoutUnsaved.requestClose(reason);
            }
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Введите сумму выплаты</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1, color: colors.textMuted }}>
              {selectedSalary ? (
                <TrainerNameLink
                  trainerId={selectedSalary.trainerId}
                  name={selectedSalary.trainerName}
                  variant="inherit"
                  sx={{ color: 'inherit', fontWeight: 400, display: 'inline' }}
                  onOpen={openTrainer}
                />
              ) : null}
            </Typography>
            <Typography sx={{ mb: 2, fontSize: typography.label }}>
              Уже выплачено: {formatMoney(selectedSalary?.paid ?? 0)}
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Сумма выплаты"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={discardPayoutForm} sx={{ textTransform: 'none' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={!payoutAmount}
              onClick={handlePayout}
              sx={{ textTransform: 'none', bgcolor: colors.primary }}
            >
              Подтвердить
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={receiveOpen}
          onClose={(_event, reason) => {
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
              receiveUnsaved.requestClose(reason);
            }
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Изменить выплачено</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1 }}>
              {selectedMembership ? (
                <ClientNameLink
                  clientId={selectedMembership.clientId}
                  name={selectedMembership.clientName}
                  variant="inherit"
                  sx={{ color: 'inherit', fontWeight: 400, display: 'inline' }}
                  onOpen={openClient}
                />
              ) : null}
            </Typography>
            <Typography sx={{ mb: 1, fontSize: typography.label }}>
              Уже выплачено: {formatMoney(selectedMembership?.paidAmount ?? 0)}
              {selectedMembership?.periodLabel
                ? ` · период ${selectedMembership.periodLabel}`
                : ''}
            </Typography>
            <Typography sx={{ mb: 2, fontSize: typography.hint, color: colors.textMuted }}>
              Плюс увеличивает выплачено, минус уменьшает (например −3000).
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Сумма изменения"
              placeholder="3000 или -3000"
              value={receiveAmount}
              onChange={(e) => setReceiveAmount(e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
            />
            {(() => {
              const n = Number(
                String(receiveAmount).trim().replace(/−/g, '-').replace(/\s/g, '').replace(',', '.')
              );
              if (!Number.isFinite(n) || n === 0 || !selectedMembership) return null;
              const next = Math.max(0, (selectedMembership.paidAmount ?? 0) + n);
              return (
                <Typography sx={{ mt: 1.5, fontSize: typography.label, color: colors.textMuted }}>
                  Станет выплачено: {formatMoney(next)}
                </Typography>
              );
            })()}
            <Typography sx={{ mt: 3, mb: 1, fontWeight: 600, fontSize: typography.label }}>
              Изменить абонемент
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Новый тариф</InputLabel>
              <Select
                label="Новый тариф"
                value={changePackId}
                onChange={(e) => setChangePackId(String(e.target.value))}
              >
                {catalogForChange.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                    {m.visits != null ? ` (${m.visits} пос.)` : ''}
                    {m.price != null ? ` — ${Number(m.price).toLocaleString('ru-RU')} ₽` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              fullWidth
              variant="outlined"
              disabled={!changePackId || !selectedMembership || changingPack}
              sx={{ textTransform: 'none' }}
              onClick={async () => {
                if (!selectedMembership || !changePackId) return;
                try {
                  setChangingPack(true);
                  await apiService.changeMembershipPack({
                    clientId: selectedMembership.clientId,
                    membershipId: changePackId,
                  });
                  setSnackbar('Абонемент изменён, начисление пересчитано');
                  setChangePackId('');
                  await loadMemberships();
                  await loadOperations();
                } catch (e: any) {
                  setError(e?.response?.data?.error || 'Не удалось сменить абонемент');
                } finally {
                  setChangingPack(false);
                }
              }}
            >
              {changingPack ? 'Смена…' : 'Применить тариф'}
            </Button>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={discardReceiveForm} sx={{ textTransform: 'none' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={!receiveAmount}
              onClick={handleReceive}
              sx={{ textTransform: 'none', bgcolor: colors.primary }}
            >
              Подтвердить оплату
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={accrualCorrectOpen}
          onClose={() => {
            if (!accrualSaving) discardAccrualCorrect();
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Изменить начисление</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1 }}>
              {accrualCorrectRow ? (
                <ClientNameLink
                  clientId={accrualCorrectRow.clientId}
                  name={accrualCorrectRow.clientName}
                  variant="inherit"
                  sx={{ color: 'inherit', fontWeight: 400, display: 'inline' }}
                  onOpen={openClient}
                />
              ) : null}
            </Typography>
            <Typography sx={{ mb: 2, fontSize: typography.label }}>
              Период: {accrualCorrectRow?.periodLabel || accrualCorrectRow?.periodKey || '—'}
              <br />
              Текущее начисление: {formatMoney(accrualCorrectRow?.membershipPrice ?? 0)}
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Новая сумма"
              value={accrualNewAmount}
              onChange={(e) => setAccrualNewAmount(e.target.value)}
              sx={{ mb: 2 }}
              inputProps={{ inputMode: 'decimal' }}
            />
            <TextField
              fullWidth
              required
              label="Причина"
              value={accrualReason}
              onChange={(e) => setAccrualReason(e.target.value)}
              multiline
              minRows={2}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Сотрудник"
              value={
                user
                  ? `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email || '—'
                  : '—'
              }
              InputProps={{ readOnly: true }}
              sx={{ mb: 2 }}
            />
            <DateTimePicker
              label="Дата и время"
              value={accrualOccurredAt}
              onChange={(v) => setAccrualOccurredAt(v)}
              slotProps={{ textField: { fullWidth: true, sx: { mb: 2 } } }}
            />
            <Typography sx={{ fontWeight: 600, mb: 1, fontSize: typography.label }}>
              История начислений
            </Typography>
            {accrualHistoryLoading ? (
              <CircularProgress size={20} />
            ) : accrualHistory.length === 0 ? (
              <Typography sx={{ color: colors.textMuted, fontSize: typography.hint }}>
                Нет операций за выбранный месяц
              </Typography>
            ) : (
              <List dense disablePadding>
                {accrualHistory.map((op) => (
                  <ListItem key={op.id} alignItems="flex-start" sx={{ px: 0 }}>
                    <ListItemText
                      primary={`${formatMoney(Number(op.amount))} · ${op.typeName || op.typeCode}`}
                      secondary={`${op.occurredAt ? format(new Date(op.occurredAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : ''} — ${op.title || ''}${op.notes ? ` (${op.notes})` : ''}`}
                      primaryTypographyProps={{ fontSize: typography.label }}
                      secondaryTypographyProps={{ fontSize: typography.hint }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={discardAccrualCorrect}
              disabled={accrualSaving}
              sx={{ textTransform: 'none' }}
            >
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={accrualSaving || !accrualReason.trim() || !accrualNewAmount}
              onClick={() => void handleCorrectAccrual()}
              sx={{ textTransform: 'none', bgcolor: colors.primary }}
            >
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>
        <UnsavedChangesDialog
          open={payoutUnsaved.confirmOpen}
          saving={payoutUnsaved.saving}
          onSave={payoutUnsaved.save}
          onDiscard={payoutUnsaved.discard}
          onStay={payoutUnsaved.stay}
        />
        <UnsavedChangesDialog
          open={receiveUnsaved.confirmOpen}
          saving={receiveUnsaved.saving}
          onSave={receiveUnsaved.save}
          onDiscard={receiveUnsaved.discard}
          onStay={receiveUnsaved.stay}
        />

        <Dialog open={Boolean(detailOp)} onClose={() => setDetailOp(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>Детали операции</DialogTitle>
          <DialogContent>
            {detailOp && (
              <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                <Typography sx={{ fontSize: typography.label }}>
                  <Box component="span" sx={{ color: colors.textMuted }}>
                    Наименование:{' '}
                  </Box>
                  {detailOp.title}
                </Typography>
                <Typography sx={{ fontSize: typography.label }}>
                  <Box component="span" sx={{ color: colors.textMuted }}>
                    Тип:{' '}
                  </Box>
                  {detailOp.typeName || detailOp.typeCode}
                </Typography>
                <Typography sx={{ fontSize: typography.label }}>
                  <Box component="span" sx={{ color: colors.textMuted }}>
                    Направление:{' '}
                  </Box>
                  {detailOp.direction === 'income' ? 'Приход' : 'Расход'}
                </Typography>
                <Typography sx={{ fontSize: typography.label }}>
                  <Box component="span" sx={{ color: colors.textMuted }}>
                    Сумма:{' '}
                  </Box>
                  {formatMoney(detailOp.amount, true, detailOp.direction)}
                </Typography>
                <Typography sx={{ fontSize: typography.label }}>
                  <Box component="span" sx={{ color: colors.textMuted }}>
                    Дата операции:{' '}
                  </Box>
                  {formatDateTime(detailOp.occurredAt)}
                </Typography>
                {detailOp.createdAt && (
                  <Typography sx={{ fontSize: typography.label }}>
                    <Box component="span" sx={{ color: colors.textMuted }}>
                      Создано в системе:{' '}
                    </Box>
                    {formatDateTime(detailOp.createdAt)}
                  </Typography>
                )}
                <Typography sx={{ fontSize: typography.label }}>
                  <Box component="span" sx={{ color: colors.textMuted }}>
                    Кто создал:{' '}
                  </Box>
                  {formatOperationCreator(detailOp)}
                </Typography>
                {detailOp.client && detailOp.clientId && (
                  <Typography sx={{ fontSize: typography.label }}>
                    <Box component="span" sx={{ color: colors.textMuted }}>
                      Клиент:{' '}
                    </Box>
                    <ClientNameLink
                      clientId={detailOp.clientId}
                      client={detailOp.client}
                      variant="inherit"
                      sx={{ color: 'inherit', fontWeight: 400, display: 'inline' }}
                      onOpen={openClient}
                    />
                  </Typography>
                )}
                {detailOp.trainer && detailOp.trainerId && (
                  <Typography sx={{ fontSize: typography.label }}>
                    <Box component="span" sx={{ color: colors.textMuted }}>
                      Тренер:{' '}
                    </Box>
                    <TrainerNameLink
                      trainerId={detailOp.trainerId}
                      name={`${detailOp.trainer.lastName} ${detailOp.trainer.firstName}`.trim()}
                      variant="inherit"
                      sx={{ color: 'inherit', fontWeight: 400, display: 'inline' }}
                      onOpen={openTrainer}
                    />
                  </Typography>
                )}
                {detailOp.group && (
                  <Typography sx={{ fontSize: typography.label }}>
                    <Box component="span" sx={{ color: colors.textMuted }}>
                      Группа:{' '}
                    </Box>
                    {detailOp.group.name}
                  </Typography>
                )}
                {detailOp.branch && (
                  <Typography sx={{ fontSize: typography.label }}>
                    <Box component="span" sx={{ color: colors.textMuted }}>
                      Филиал:{' '}
                    </Box>
                    {detailOp.branch.name}
                  </Typography>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDetailOp(null)} sx={{ textTransform: 'none' }}>
              Закрыть
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={purgeOpen} onClose={() => !purging && setPurgeOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>Очистить зарплату и операции клиентов?</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1.5 }}>
              Журнал «Все операции» не трогаем. Удаляются начисления зарплаты и счета абонементов,
              которых нет в этом журнале (старые записи до единого учёта).
            </Typography>
            <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
              Балансы тренеров пересчитаются по оставшимся строкам. У клиентов без операций в журнале
              баланс обнулится, незакрытые счета без связи с журналом будут отменены.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPurgeOpen(false)} disabled={purging} sx={{ textTransform: 'none' }}>
              Закрыть
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={purging}
              onClick={handlePurgeUnlinked}
              sx={{ textTransform: 'none' }}
            >
              {purging ? 'Очистка…' : 'Очистить'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(cancelOp)} onClose={() => setCancelOp(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>Отменить операцию?</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1 }}>
              {cancelOp?.title}
              {cancelOp ? ` — ${formatMoney(cancelOp.amount, true, cancelOp.direction)}` : ''}
            </Typography>
            <Typography sx={{ fontSize: typography.label, color: colors.textMuted }}>
              Удаление отменит связанные эффекты (баланс, начисление, счёт), если они есть.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCancelOp(null)} sx={{ textTransform: 'none' }}>
              Закрыть
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={Boolean(deletingOpId)}
              onClick={handleConfirmCancelOperation}
              sx={{ textTransform: 'none' }}
            >
              Отменить операцию
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!snackbar}
          autoHideDuration={3000}
          onClose={() => setSnackbar('')}
          message={snackbar}
        />
        {entityCardDialogs}
      </Box>
    </LocalizationProvider>
  );
};

export default Finance;
