import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
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
  Collapse,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import { Add, Close, Tune } from '@mui/icons-material';
import { DateTimePicker, DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { canCancelFinanceOperations } from '../utils/roles';
import ClientNameLink from '../components/ClientNameLink';
import FinanceOperationsTable from '../components/finance/FinanceOperationsTable';
import FinanceSummaryTable, {
  FinanceSummaryRow,
  FinanceSummarySortKey,
} from '../components/finance/FinanceSummaryTable';
import SchoolPaymentMethodsPanel from '../components/finance/SchoolPaymentMethodsPanel';
import { colors, radii, typography } from '../theme/tokens';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import {
  FinanceDirection,
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
];

const formatMoney = (value: number, withSign = false, direction?: string) => {
  const abs = Math.abs(value).toLocaleString('ru-RU');
  if (!withSign) return `${abs} ₽`;
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

interface OpFilters {
  datePreset?: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  search: string;
  amountFrom: string;
  amountTo: string;
  typeCodes: string[];
  groupIds: string[];
  branchIds: string[];
}

const emptyOpFilters = (): OpFilters => ({
  datePreset: undefined,
  dateFrom: null,
  dateTo: null,
  search: '',
  amountFrom: '',
  amountTo: '',
  typeCodes: [],
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
  const canDeleteOperations = canCancelFinanceOperations(user?.role);
  const [tab, setTab] = useState<FinanceTab>('operations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState('');
  const [deletingOpId, setDeletingOpId] = useState<string | null>(null);
  const [cancelOp, setCancelOp] = useState<FinanceOperation | null>(null);

  const [operations, setOperations] = useState<FinanceOperation[]>([]);
  const [types, setTypes] = useState<FinanceOperationType[]>([]);
  const [salaryRows, setSalaryRows] = useState<FinanceSalaryRow[]>([]);
  const [membershipRows, setMembershipRows] = useState<FinanceMembershipRow[]>([]);

  const [clients, setClients] = useState<Client[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

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
  const [memTrainerId, setMemTrainerId] = useState('');
  const [memBranchId, setMemBranchId] = useState('');
  const [memGroupIds, setMemGroupIds] = useState<string[]>([]);
  const [memDate, setMemDate] = useState<Date | null>(new Date());
  const [memAmountFrom, setMemAmountFrom] = useState('');
  const [memAmountTo, setMemAmountTo] = useState('');
  const [draftMemClientId, setDraftMemClientId] = useState('');
  const [draftMemTrainerId, setDraftMemTrainerId] = useState('');
  const [draftMemBranchId, setDraftMemBranchId] = useState('');
  const [draftMemGroupIds, setDraftMemGroupIds] = useState<string[]>([]);
  const [draftMemDate, setDraftMemDate] = useState<Date | null>(new Date());
  const [draftMemAmountFrom, setDraftMemAmountFrom] = useState('');
  const [draftMemAmountTo, setDraftMemAmountTo] = useState('');
  const [memBranchSearch, setMemBranchSearch] = useState('');

  const [sortBy, setSortBy] = useState<SortKey>('occurredAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [salarySortBy, setSalarySortBy] = useState<FinanceSummarySortKey>('name');
  const [salarySortDir, setSalarySortDir] = useState<'asc' | 'desc'>('asc');
  const [membershipSortBy, setMembershipSortBy] = useState<FinanceSummarySortKey>('name');
  const [membershipSortDir, setMembershipSortDir] = useState<'asc' | 'desc'>('asc');

  const [addOpen, setAddOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<FinanceMembershipRow | null>(null);
  const [selectedSalary, setSelectedSalary] = useState<FinanceSalaryRow | null>(null);

  const [formDirection, setFormDirection] = useState<FinanceDirection>('expense');
  const [formTypeCode, setFormTypeCode] = useState('other');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formOccurredAt, setFormOccurredAt] = useState<Date | null>(new Date());
  const [formNotes, setFormNotes] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [formTrainerId, setFormTrainerId] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [showTrainerPicker, setShowTrainerPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  const [payoutAmount, setPayoutAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [addFormBaseline, setAddFormBaseline] = useState<Record<string, unknown> | null>(null);
  const [payoutBaseline, setPayoutBaseline] = useState('');
  const [receiveBaseline, setReceiveBaseline] = useState('');

  const refsLoadedRef = useRef(false);

  const addFormSnapshot = () => ({
    formDirection,
    formTypeCode,
    formTitle,
    formAmount,
    formOccurredAt: formOccurredAt?.toISOString() ?? null,
    formNotes,
    newTypeName,
    formTrainerId,
    formClientId,
    showTrainerPicker,
    showClientPicker,
  });

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (appliedOpFilters.datePreset) {
      chips.push(DATE_PRESETS.find((p) => p.key === appliedOpFilters.datePreset)?.label || appliedOpFilters.datePreset);
    }
    if (appliedOpFilters.search) chips.push(appliedOpFilters.search);
    if (appliedOpFilters.amountFrom || appliedOpFilters.amountTo) {
      chips.push(`${appliedOpFilters.amountFrom || '0'} ₽ - ${appliedOpFilters.amountTo || '∞'} ₽`);
    }
    appliedOpFilters.typeCodes.forEach((code) => {
      chips.push(types.find((t) => t.code === code)?.name || code);
    });
    return chips;
  }, [appliedOpFilters, types]);

  const salaryFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (salaryTrainerId) {
      const t = trainers.find((tr) => tr.id === salaryTrainerId);
      chips.push(t?.user ? `${t.user.lastName} ${t.user.firstName}` : salaryTrainerId);
    }
    if (salaryDateFrom || salaryDateTo) {
      const from = salaryDateFrom ? format(salaryDateFrom, 'dd.MM.yyyy', { locale: ru }) : '…';
      const to = salaryDateTo ? format(salaryDateTo, 'dd.MM.yyyy', { locale: ru }) : '…';
      chips.push(`${from} — ${to}`);
    }
    chips.push(salaryTrainingsMode === 'conducted' ? 'Проведённые' : 'Все тренировки');
    if (salaryAmountFrom || salaryAmountTo) {
      chips.push(`${salaryAmountFrom || '0'} ₽ - ${salaryAmountTo || '∞'} ₽`);
    }
    return chips;
  }, [salaryTrainerId, salaryDateFrom, salaryDateTo, salaryTrainingsMode, salaryAmountFrom, salaryAmountTo, trainers]);

  const membershipFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (memClientId) {
      const c = clients.find((cl) => cl.id === memClientId);
      chips.push(c ? `${c.lastName} ${c.firstName}` : memClientId);
    }
    if (memTrainerId) {
      const t = trainers.find((tr) => tr.id === memTrainerId);
      chips.push(t?.user ? `${t.user.lastName} ${t.user.firstName}` : memTrainerId);
    }
    if (memDate) chips.push(format(memDate, 'dd.MM.yyyy', { locale: ru }));
    if (memBranchId) chips.push(branches.find((b) => b.id === memBranchId)?.name || memBranchId);
    memGroupIds.forEach((gid) => chips.push(groups.find((g) => g.id === gid)?.name || gid));
    if (memAmountFrom || memAmountTo) {
      chips.push(`${memAmountFrom || '0'} ₽ - ${memAmountTo || '∞'} ₽`);
    }
    return chips;
  }, [memClientId, memTrainerId, memDate, memBranchId, memGroupIds, memAmountFrom, memAmountTo, clients, trainers, branches, groups]);

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
    if (appliedOpFilters.datePreset) params.datePreset = appliedOpFilters.datePreset;
    if (appliedOpFilters.dateFrom) params.dateFrom = appliedOpFilters.dateFrom.toISOString();
    if (appliedOpFilters.dateTo) params.dateTo = appliedOpFilters.dateTo.toISOString();
    if (appliedOpFilters.search) params.search = appliedOpFilters.search;
    if (appliedOpFilters.amountFrom) params.amountFrom = appliedOpFilters.amountFrom;
    if (appliedOpFilters.amountTo) params.amountTo = appliedOpFilters.amountTo;
    if (appliedOpFilters.typeCodes.length) params.typeCodes = appliedOpFilters.typeCodes.join(',');
    if (appliedOpFilters.groupIds.length) params.groupIds = appliedOpFilters.groupIds.join(',');
    if (appliedOpFilters.branchIds.length) params.branchIds = appliedOpFilters.branchIds.join(',');

    const data = await withRetry(() => apiService.getFinanceOperations(params));
    setOperations(data.items || []);
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
    if (memTrainerId) params.trainerIds = memTrainerId;
    if (memBranchId) params.branchIds = memBranchId;
    if (memGroupIds.length) params.groupIds = memGroupIds.join(',');
    if (memAmountFrom) params.amountFrom = memAmountFrom;
    if (memAmountTo) params.amountTo = memAmountTo;
    const rows = await withRetry(() => apiService.getFinanceMembershipSummary(params));
    setMembershipRows(rows);
  }, [memClientId, memTrainerId, memBranchId, memGroupIds, memAmountFrom, memAmountTo]);

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

  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    const created = await apiService.createFinanceType({
      name: newTypeName.trim(),
      defaultDirection: formDirection,
    });
    setTypes((prev) => [...prev, created]);
    setFormTypeCode(created.code);
    setNewTypeName('');
    setSnackbar('Тип операции создан');
  };

  const discardAddForm = useCallback(() => {
    setAddOpen(false);
    setFormTitle('');
    setFormAmount('');
    setFormNotes('');
    setFormTrainerId('');
    setFormClientId('');
    setShowTrainerPicker(false);
    setShowClientPicker(false);
    setNewTypeName('');
    setAddFormBaseline(null);
  }, []);

  const openAddDialog = () => {
    setAddFormBaseline(addFormSnapshot());
    setAddOpen(true);
  };

  const handleSaveOperation = async (): Promise<boolean> => {
    if (formTypeCode === 'bonus' && !formTrainerId) {
      setError('Выберите тренера для начисления премии');
      return false;
    }
    if (
      formDirection === 'income' &&
      (formTypeCode === 'client_payment' || formTypeCode === 'membership') &&
      !formClientId
    ) {
      setError('Выберите клиента для операции');
      return false;
    }
    if (
      formDirection === 'expense' &&
      formTypeCode !== 'bonus' &&
      showClientPicker &&
      !formClientId
    ) {
      setError('Выберите клиента для начисления платежа');
      return false;
    }
    try {
      await apiService.createFinanceOperation({
        direction: formDirection,
        typeCode: formTypeCode,
        title: formTitle,
        amount: Number(formAmount),
        occurredAt: formOccurredAt?.toISOString(),
        notes: formNotes || undefined,
        trainerId: formTrainerId || undefined,
        clientId: formClientId || undefined,
      });
      discardAddForm();
      setSnackbar('Операция сохранена');
      await loadOperations();
      return true;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить операцию');
      return false;
    }
  };

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
  }, []);

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

  const handleSummarySort = (
    key: FinanceSummarySortKey,
    currentKey: FinanceSummarySortKey,
    setKey: (k: FinanceSummarySortKey) => void,
    setDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>
  ) => {
    if (currentKey === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setKey(key);
      setDir(key === 'name' || key === 'period' ? 'asc' : 'desc');
    }
  };

  const sortSummaryRows = (
    rows: FinanceSummaryRow[],
    key: FinanceSummarySortKey,
    dir: 'asc' | 'desc'
  ): FinanceSummaryRow[] => {
    const mul = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const pick = (row: FinanceSummaryRow): string | number => {
        switch (key) {
          case 'name':
            return typeof row.name === 'string' ? row.name : row.id;
          case 'period':
            return row.period;
          case 'count':
            return typeof row.count === 'number' ? row.count : 0;
          case 'accrued':
            return row.accrued;
          case 'paid':
            return row.paid;
          case 'remaining':
            return row.remaining;
          default:
            return row.name as string;
        }
      };
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
      return String(av).localeCompare(String(bv), 'ru') * mul;
    });
  };

  const salaryTableRows: FinanceSummaryRow[] = useMemo(
    () =>
      salaryRows.map((row) => ({
        id: row.trainerId,
        name: row.trainerName,
        period:
          salaryDateFrom && salaryDateTo
            ? `${format(salaryDateFrom, 'dd.MM.yyyy', { locale: ru })} — ${format(salaryDateTo, 'dd.MM.yyyy', { locale: ru })}`
            : salaryDateFrom
              ? `с ${format(salaryDateFrom, 'dd.MM.yyyy', { locale: ru })}`
              : salaryDateTo
                ? `по ${format(salaryDateTo, 'dd.MM.yyyy', { locale: ru })}`
                : `${format(new Date(row.periodStart), 'dd.MM.yyyy', { locale: ru })} — ${format(new Date(row.periodEnd), 'dd.MM.yyyy', { locale: ru })}`,
        count: row.trainingsCount,
        accrued: row.accrued,
        paid: row.paid,
        remaining: row.remaining,
        onPaidClick: () => {
          setSelectedSalary(row);
          setPayoutAmount('');
          setPayoutBaseline('');
          setPayoutOpen(true);
        },
      })),
    [salaryRows, salaryDateFrom, salaryDateTo]
  );

  const membershipTableRows: FinanceSummaryRow[] = useMemo(
    () =>
      membershipRows.map((row) => ({
        id: row.clientId,
        name: <ClientNameLink clientId={row.clientId} name={row.clientName} />,
        period: memDate ? format(memDate, 'dd.MM.yyyy', { locale: ru }) : '—',
        count: '—',
        accrued: row.membershipPrice,
        paid: row.paidAmount,
        remaining: row.remaining,
        onPaidClick: () => {
          setSelectedMembership(row);
          setReceiveAmount('');
          setReceiveBaseline('');
          setReceiveOpen(true);
        },
      })),
    [membershipRows, memDate]
  );

  const sortedSalaryRows = useMemo(
    () => sortSummaryRows(salaryTableRows, salarySortBy, salarySortDir),
    [salaryTableRows, salarySortBy, salarySortDir]
  );

  const sortedMembershipRows = useMemo(
    () => sortSummaryRows(membershipTableRows, membershipSortBy, membershipSortDir),
    [membershipTableRows, membershipSortBy, membershipSortDir]
  );

  const tabSx = (active: boolean) => ({
    textTransform: 'none' as const,
    fontSize: typography.label,
    fontWeight: active ? 600 : 500,
    minHeight: 40,
    flex: { xs: '1 1 auto', md: '0 1 auto' },
    minWidth: { md: 160 },
    borderRadius: '12px 12px 0 0',
    mx: 0,
    px: 2,
    color: colors.text,
    bgcolor: active ? colors.card : colors.divider,
    alignSelf: 'flex-end',
    '&.Mui-selected': {
      color: colors.text,
      bgcolor: colors.card,
    },
  });

  const filterChipSx = {
    bgcolor: colors.primary,
    color: colors.white,
    fontWeight: 600,
    fontSize: typography.hint,
    borderRadius: '12px',
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
    fontWeight: 600,
    fontSize: typography.panelTitle,
    color: colors.text,
    mb: 1,
  };

  const filterSelectSx = {
    borderRadius: '12px',
    fontSize: typography.field,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.primary },
  };

  const addDirty = addOpen && addFormBaseline != null && isDirtyValue(addFormSnapshot(), addFormBaseline);
  const addUnsaved = useUnsavedClose({
    isDirty: Boolean(addDirty),
    onDiscard: discardAddForm,
    onSave: handleSaveOperation,
  });

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
    onClearFilters: () => void
  ) => (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{ mb: 1.5, flexWrap: 'wrap' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      useFlexGap
    >
      <Button
        variant="contained"
        size="small"
        startIcon={<Add sx={{ fontSize: 18 }} />}
        onClick={openAddDialog}
        sx={{
          bgcolor: colors.primary,
          borderRadius: '12px',
          px: 2,
          py: 0.75,
          textTransform: 'none',
          fontSize: typography.button,
          fontWeight: 600,
          boxShadow: 'none',
          width: { xs: '100%', sm: 'auto' },
          '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
        }}
      >
        Добавить операцию
      </Button>
      <Button
        variant="contained"
        size="small"
        onClick={onOpenFilters}
        sx={{
          bgcolor: colors.primarySoft,
          color: colors.text,
          borderRadius: '12px',
          px: 2,
          py: 0.75,
          textTransform: 'none',
          fontSize: typography.button,
          fontWeight: 600,
          boxShadow: 'none',
          width: { xs: '100%', sm: 'auto' },
          '&:hover': { bgcolor: colors.primarySoft, filter: 'brightness(0.97)' },
        }}
        startIcon={<Tune sx={{ fontSize: 18, color: colors.text }} />}
      >
        Все фильтры
        {chips.length > 0 ? ` • ${chips.length}` : ''}
      </Button>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
        {chips.map((chip) => (
          <Chip
            key={chip}
            label={chip}
            onDelete={onClearFilters}
            sx={filterChipSx}
            deleteIcon={<Close sx={{ fontSize: 12 }} />}
          />
        ))}
      </Stack>
    </Stack>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Box data-onboarding="finance-page">
        <Typography
          component="h1"
          sx={{
            fontWeight: 600,
            fontSize: typography.pageTitle,
            color: colors.text,
            mb: { xs: 1.5, md: 2 },
          }}
        >
          Финансы
        </Typography>

        <SchoolPaymentMethodsPanel user={user} groups={groups} />

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            mb: 0,
            minHeight: 48,
            alignItems: 'flex-end',
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTabs-flexContainer': { gap: 0.5, flexWrap: { xs: 'nowrap', md: 'wrap' }, alignItems: 'flex-end' },
          }}
        >
          <Tab value="operations" label="Все операции" sx={tabSx(tab === 'operations')} />
          <Tab value="salary" label="Зарплата тренеров" sx={tabSx(tab === 'salary')} />
          <Tab value="memberships" label="Оплата абонементов" sx={tabSx(tab === 'memberships')} />
        </Tabs>

        <Box
          sx={{
            bgcolor: colors.card,
            borderRadius: `0 ${radii.panel * 2}px ${radii.panel * 2}px ${radii.panel * 2}px`,
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
              }
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
                onDelete={canDeleteOperations ? (op) => setCancelOp(op) : undefined}
              />
            )}
          </>
        )}

        {tab === 'salary' && (
          <>
            {renderFinanceToolbar(
              () => {
                setDraftSalaryTrainerId(salaryTrainerId);
                setDraftSalaryDateFrom(salaryDateFrom);
                setDraftSalaryDateTo(salaryDateTo);
                setDraftSalaryAmountFrom(salaryAmountFrom);
                setDraftSalaryAmountTo(salaryAmountTo);
                setDraftSalaryTrainingsMode(salaryTrainingsMode);
                setSalaryFiltersOpen(true);
              },
              salaryFilterChips,
              () => {
                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const today = new Date();
                setSalaryTrainerId('');
                setSalaryDateFrom(monthStart);
                setSalaryDateTo(today);
                setSalaryAmountFrom('');
                setSalaryAmountTo('');
                setSalaryTrainingsMode('all');
              }
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress sx={{ color: colors.primary }} />
              </Box>
            ) : (
              <FinanceSummaryTable
                nameColumnLabel="Тренер"
                countColumnLabel={
                  salaryTrainingsMode === 'conducted' ? 'Проведённые' : 'Все занятия'
                }
                rows={sortedSalaryRows}
                sortBy={salarySortBy}
                onSort={(key) => handleSummarySort(key, salarySortBy, setSalarySortBy, setSalarySortDir)}
                formatMoney={(v) => formatMoney(v)}
                emptyMessage="Нет данных по зарплатам"
              />
            )}
          </>
        )}

        {tab === 'memberships' && (
          <>
            {renderFinanceToolbar(
              () => {
                setDraftMemClientId(memClientId);
                setDraftMemTrainerId(memTrainerId);
                setDraftMemBranchId(memBranchId);
                setDraftMemGroupIds(memGroupIds);
                setDraftMemDate(memDate);
                setDraftMemAmountFrom(memAmountFrom);
                setDraftMemAmountTo(memAmountTo);
                setMembershipFiltersOpen(true);
              },
              membershipFilterChips,
              () => {
                setMemClientId('');
                setMemTrainerId('');
                setMemBranchId('');
                setMemGroupIds([]);
                setMemDate(new Date());
                setMemAmountFrom('');
                setMemAmountTo('');
              }
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress sx={{ color: colors.primary }} />
              </Box>
            ) : (
              <FinanceSummaryTable
                nameColumnLabel="Клиент"
                rows={sortedMembershipRows}
                sortBy={membershipSortBy}
                onSort={(key) =>
                  handleSummarySort(key, membershipSortBy, setMembershipSortBy, setMembershipSortDir)
                }
                formatMoney={(v) => formatMoney(v)}
                emptyMessage="Нет данных по абонементам"
              />
            )}
          </>
        )}

        </Box>

        {/* Filters drawer — Все операции */}
        <Drawer anchor="right" open={filtersOpen} onClose={() => setFiltersOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              Фильтры
            </Typography>
            <IconButton onClick={() => setFiltersOpen(false)}>
              <Close />
            </IconButton>
          </Stack>

          <Typography sx={{ mb: 1, fontWeight: 600 }}>По дате</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {DATE_PRESETS.map((p) => (
              <Chip
                key={p.key}
                label={p.label}
                clickable
                color={opFilters.datePreset === p.key ? 'primary' : 'default'}
                onClick={() => setOpFilters((f) => ({ ...f, datePreset: p.key, dateFrom: null, dateTo: null }))}
              />
            ))}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 3 }}>
            <DatePicker
              label="Дата начала"
              value={opFilters.dateFrom}
              onChange={(v) => setOpFilters((f) => ({ ...f, dateFrom: v, datePreset: undefined }))}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
            <DatePicker
              label="Дата окончания"
              value={opFilters.dateTo}
              onChange={(v) => setOpFilters((f) => ({ ...f, dateTo: v, datePreset: undefined }))}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          </Stack>

          <Typography sx={{ mb: 1, fontWeight: 600 }}>По имени</Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Поиск по ФИО клиента, тренера, названию операции"
            value={opFilters.search}
            onChange={(e) => setOpFilters((f) => ({ ...f, search: e.target.value }))}
            sx={{ mb: 3 }}
          />

          <Typography sx={{ mb: 1, fontWeight: 600 }}>По сумме</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 3 }}>
            <TextField
              size="small"
              fullWidth
              label="От"
              value={opFilters.amountFrom}
              onChange={(e) => setOpFilters((f) => ({ ...f, amountFrom: e.target.value }))}
              InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
            />
            <TextField
              size="small"
              fullWidth
              label="До"
              value={opFilters.amountTo}
              onChange={(e) => setOpFilters((f) => ({ ...f, amountTo: e.target.value }))}
              InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
            />
          </Stack>

          <Typography sx={{ mb: 1, fontWeight: 600 }}>По типу операции</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
            {types.map((t) => {
              const selected = opFilters.typeCodes.includes(t.code);
              return (
                <Chip
                  key={t.id}
                  label={t.name}
                  clickable
                  color={selected ? 'primary' : 'default'}
                  onClick={() =>
                    setOpFilters((f) => ({
                      ...f,
                      typeCodes: selected
                        ? f.typeCodes.filter((c) => c !== t.code)
                        : [...f.typeCodes, t.code],
                    }))
                  }
                />
              );
            })}
          </Stack>

          <Typography sx={{ mb: 1, fontWeight: 600 }}>По группе</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
            {groups.map((g) => {
              const selected = opFilters.groupIds.includes(g.id);
              return (
                <Chip
                  key={g.id}
                  label={g.name}
                  clickable
                  color={selected ? 'primary' : 'default'}
                  onClick={() =>
                    setOpFilters((f) => ({
                      ...f,
                      groupIds: selected ? f.groupIds.filter((id) => id !== g.id) : [...f.groupIds, g.id],
                    }))
                  }
                />
              );
            })}
          </Stack>

          <Typography sx={{ mb: 1, fontWeight: 600 }}>По филиалу</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 4 }}>
            <Chip
              label="Все филиалы"
              clickable
              color={opFilters.branchIds.length === 0 ? 'primary' : 'default'}
              onClick={() => setOpFilters((f) => ({ ...f, branchIds: [] }))}
            />
            {branches.map((b) => {
              const selected = opFilters.branchIds.includes(b.id);
              return (
                <Chip
                  key={b.id}
                  label={b.name}
                  clickable
                  color={selected ? 'primary' : 'default'}
                  onClick={() =>
                    setOpFilters((f) => ({
                      ...f,
                      branchIds: selected ? f.branchIds.filter((id) => id !== b.id) : [...f.branchIds, b.id],
                    }))
                  }
                />
              );
            })}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              fullWidth
              variant="outlined"
              sx={{ textTransform: 'none' }}
              onClick={() => {
                const empty = emptyOpFilters();
                setOpFilters(empty);
                setAppliedOpFilters(empty);
                setFiltersOpen(false);
              }}
            >
              Сбросить фильтры
            </Button>
            <Button
              fullWidth
              variant="contained"
              sx={{ textTransform: 'none', bgcolor: colors.primary }}
              onClick={() => {
                setAppliedOpFilters(opFilters);
                setFiltersOpen(false);
              }}
            >
              Применить
            </Button>
          </Stack>
        </Drawer>

        {/* Filters drawer — Зарплата тренеров */}
        <Drawer
          anchor="right"
          open={salaryFiltersOpen}
          onClose={() => setSalaryFiltersOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 3 } }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 600, fontSize: typography.panelTitle }}>Фильтры</Typography>
            <IconButton onClick={() => setSalaryFiltersOpen(false)}>
              <Close />
            </IconButton>
          </Stack>

          <Typography sx={filterSectionTitleSx}>Выбрать тренера</Typography>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <Select
              displayEmpty
              value={draftSalaryTrainerId}
              onChange={(e) => setDraftSalaryTrainerId(e.target.value)}
              sx={filterSelectSx}
            >
              <MenuItem value="">Выбрать тренера</MenuItem>
              {trainers.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.user ? `${t.user.lastName} ${t.user.firstName}` : t.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography sx={filterSectionTitleSx}>Дата</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 14, mb: 0.5 }}>От</Typography>
              <DatePicker
                value={draftSalaryDateFrom}
                onChange={setDraftSalaryDateFrom}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { borderRadius: '19px' } },
                  },
                }}
              />
            </Box>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 14, mb: 0.5 }}>До</Typography>
              <DatePicker
                value={draftSalaryDateTo}
                onChange={setDraftSalaryDateTo}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { borderRadius: '19px' } },
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
            sx={{ mb: 3 }}
          >
            <FormControlLabel value="all" control={<Radio />} label="Все" />
            <FormControlLabel value="conducted" control={<Radio />} label="Проведённые" />
          </RadioGroup>

          <Typography sx={filterSectionTitleSx}>Сумма</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 4 }}>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 14, mb: 0.5 }}>От</Typography>
              <TextField
                fullWidth
                value={draftSalaryAmountFrom}
                onChange={(e) => setDraftSalaryAmountFrom(e.target.value)}
                placeholder="0 ₽"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '19px' } }}
              />
            </Box>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 14, mb: 0.5 }}>До</Typography>
              <TextField
                fullWidth
                value={draftSalaryAmountTo}
                onChange={(e) => setDraftSalaryAmountTo(e.target.value)}
                placeholder="999 ₽"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '19px' } }}
              />
            </Box>
          </Stack>

          <Button
            fullWidth
            variant="contained"
            sx={{
              textTransform: 'none',
              borderRadius: '19px',
              py: 1.5,
              bgcolor: colors.danger,
              '&:hover': { bgcolor: colors.danger, filter: 'brightness(0.95)' },
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
            Сбросить фильтры
          </Button>
          <Button
            fullWidth
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: '12px', py: 1, mt: 2, bgcolor: colors.primary }}
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
        </Drawer>

        {/* Filters drawer — Оплата абонементов */}
        <Drawer
          anchor="right"
          open={membershipFiltersOpen}
          onClose={() => setMembershipFiltersOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, p: 3 } }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 600, fontSize: typography.panelTitle }}>Фильтры</Typography>
            <IconButton onClick={() => setMembershipFiltersOpen(false)}>
              <Close />
            </IconButton>
          </Stack>

          <Typography sx={filterSectionTitleSx}>Выбрать клиента</Typography>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <Select
              displayEmpty
              value={draftMemClientId}
              onChange={(e) => setDraftMemClientId(e.target.value)}
              sx={filterSelectSx}
            >
              <MenuItem value="">Выбрать клиента</MenuItem>
              {clients.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.lastName} {c.firstName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography sx={filterSectionTitleSx}>Дата</Typography>
          <DatePicker
            value={draftMemDate}
            onChange={setDraftMemDate}
            slotProps={{
              textField: {
                fullWidth: true,
                sx: { mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '19px' } },
              },
            }}
          />

          <Typography sx={filterSectionTitleSx}>Выбрать тренера</Typography>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <Select
              displayEmpty
              value={draftMemTrainerId}
              onChange={(e) => setDraftMemTrainerId(e.target.value)}
              sx={filterSelectSx}
            >
              <MenuItem value="">Выбрать тренера</MenuItem>
              {trainers.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.user ? `${t.user.lastName} ${t.user.firstName}` : t.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography sx={filterSectionTitleSx}>По филиалу</Typography>
          <Chip
            label="Все филиалы"
            clickable
            onClick={() => setDraftMemBranchId('')}
            sx={{
              mb: 1.5,
              bgcolor: !draftMemBranchId ? colors.primarySoft : colors.divider,
              color: colors.primary,
              fontWeight: 600,
              borderRadius: '19px',
              px: 1,
            }}
          />
          <TextField
            fullWidth
            placeholder="Поиск по филиалам"
            value={memBranchSearch}
            onChange={(e) => setMemBranchSearch(e.target.value)}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '19px' } }}
          />
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
            {branches
              .filter((b) => !memBranchSearch || b.name.toLowerCase().includes(memBranchSearch.toLowerCase()))
              .map((b) => (
                <Chip
                  key={b.id}
                  label={b.name}
                  clickable
                  onClick={() => setDraftMemBranchId(b.id)}
                  sx={{
                    bgcolor: draftMemBranchId === b.id ? colors.primarySoft : colors.divider,
                    color: colors.primary,
                    fontWeight: 600,
                    borderRadius: '19px',
                  }}
                />
              ))}
          </Stack>

          <Typography sx={filterSectionTitleSx}>По группе</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
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
                  sx={{
                    bgcolor: selected ? colors.primarySoft : colors.divider,
                    color: colors.primary,
                    fontWeight: 600,
                    borderRadius: '19px',
                  }}
                />
              );
            })}
          </Stack>

          <Typography sx={filterSectionTitleSx}>Сумма</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 4 }}>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 14, mb: 0.5 }}>От</Typography>
              <TextField
                fullWidth
                value={draftMemAmountFrom}
                onChange={(e) => setDraftMemAmountFrom(e.target.value)}
                placeholder="0 ₽"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '19px' } }}
              />
            </Box>
            <Box sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Typography sx={{ fontSize: 14, mb: 0.5 }}>До</Typography>
              <TextField
                fullWidth
                value={draftMemAmountTo}
                onChange={(e) => setDraftMemAmountTo(e.target.value)}
                placeholder="999 ₽"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '19px' } }}
              />
            </Box>
          </Stack>

          <Button
            fullWidth
            variant="contained"
            sx={{
              textTransform: 'none',
              borderRadius: '19px',
              py: 1.5,
              bgcolor: colors.danger,
              '&:hover': { bgcolor: colors.danger, filter: 'brightness(0.95)' },
            }}
            onClick={() => {
              setDraftMemClientId('');
              setDraftMemTrainerId('');
              setDraftMemBranchId('');
              setDraftMemGroupIds([]);
              setDraftMemDate(new Date());
              setDraftMemAmountFrom('');
              setDraftMemAmountTo('');
              setMemClientId('');
              setMemTrainerId('');
              setMemBranchId('');
              setMemGroupIds([]);
              setMemDate(new Date());
              setMemAmountFrom('');
              setMemAmountTo('');
              setMembershipFiltersOpen(false);
            }}
          >
            Сбросить фильтры
          </Button>
          <Button
            fullWidth
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: '12px', py: 1, mt: 2, bgcolor: colors.primary }}
            onClick={() => {
              setMemClientId(draftMemClientId);
              setMemTrainerId(draftMemTrainerId);
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
        </Drawer>

        {/* Add operation */}
        <Dialog
          open={addOpen}
          onClose={(_event, reason) => {
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
              addUnsaved.requestClose(reason);
            }
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Добавить операцию</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl>
                <Typography sx={{ mb: 0.5 }}>Тип движения средств</Typography>
                <RadioGroup
                  row
                  value={formDirection}
                  onChange={(e) => setFormDirection(e.target.value as FinanceDirection)}
                >
                  <FormControlLabel value="income" control={<Radio />} label="Приход" />
                  <FormControlLabel value="expense" control={<Radio />} label="Расход" />
                </RadioGroup>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Тип операции</InputLabel>
                <Select
                  label="Тип операции"
                  value={formTypeCode}
                  onChange={(e) => setFormTypeCode(e.target.value)}
                >
                  {types.map((t) => (
                    <MenuItem key={t.id} value={t.code}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {(formDirection === 'expense' &&
                (formTypeCode === 'bonus' || formTypeCode === 'salary')) && (
                <Box>
                  <Button
                    onClick={() => setShowTrainerPicker((v) => !v)}
                    sx={{ textTransform: 'none', color: colors.primary, p: 0, mb: showTrainerPicker ? 1 : 0 }}
                  >
                    {showTrainerPicker ? '− Скрыть выбор тренера' : '+ Выбрать тренера'}
                  </Button>
                  <Collapse in={showTrainerPicker}>
                    <FormControl fullWidth>
                      <InputLabel>Тренер</InputLabel>
                      <Select
                        label="Тренер"
                        value={formTrainerId}
                        onChange={(e) => setFormTrainerId(e.target.value)}
                      >
                        {trainers.map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.user?.lastName} {t.user?.firstName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Collapse>
                </Box>
              )}
              {(formDirection === 'income' &&
                (formTypeCode === 'client_payment' || formTypeCode === 'membership')) ||
              (formDirection === 'expense' && formTypeCode !== 'bonus') ? (
                <Box>
                  <Button
                    onClick={() => setShowClientPicker((v) => !v)}
                    sx={{ textTransform: 'none', color: colors.primary, p: 0, mb: showClientPicker ? 1 : 0 }}
                  >
                    {showClientPicker ? '− Скрыть выбор клиента' : '+ Выбрать клиента'}
                  </Button>
                  <Collapse in={showClientPicker}>
                    <FormControl fullWidth>
                      <InputLabel>Клиент</InputLabel>
                      <Select
                        label="Клиент"
                        value={formClientId}
                        onChange={(e) => setFormClientId(e.target.value)}
                      >
                        {clients.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.lastName} {c.firstName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Collapse>
                </Box>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="+ Добавить новый тип"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                />
                <Button
                  onClick={handleCreateType}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
                >
                  Создать тип
                </Button>
              </Stack>
              <TextField
                label="Наименование операции"
                fullWidth
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
              <TextField
                label="Сумма"
                fullWidth
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">₽</InputAdornment> }}
              />
              <DateTimePicker
                label="Дата и время"
                value={formOccurredAt}
                onChange={setFormOccurredAt}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <TextField
                label="Комментарий"
                fullWidth
                multiline
                minRows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={discardAddForm} sx={{ textTransform: 'none' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              disabled={!formTitle || !formAmount}
              onClick={handleSaveOperation}
              sx={{ textTransform: 'none', bgcolor: colors.primary }}
            >
              Сохранить операцию
            </Button>
          </DialogActions>
        </Dialog>

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
            <Typography sx={{ mb: 1, color: colors.textMuted }}>{selectedSalary?.trainerName}</Typography>
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
                />
              ) : null}
            </Typography>
            <Typography sx={{ mb: 1, fontSize: typography.label }}>
              Уже выплачено: {formatMoney(selectedMembership?.paidAmount ?? 0)}
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
              Подтвердить
            </Button>
          </DialogActions>
        </Dialog>

        <UnsavedChangesDialog
          open={addUnsaved.confirmOpen}
          saving={addUnsaved.saving}
          onSave={addUnsaved.save}
          onDiscard={addUnsaved.discard}
          onStay={addUnsaved.stay}
        />
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
      </Box>
    </LocalizationProvider>
  );
};

export default Finance;
