import React, { useMemo, useState } from 'react';
import {
  AccessTimeOutlined,
  ArrowUpward,
  BusinessOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  ChevronRight,
  ErrorOutline,
  GroupsOutlined,
  MoreHoriz,
  NorthEast,
  PaymentsOutlined,
  Refresh,
  Search,
  UnfoldMore,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Branch, FinanceSalaryRow, Trainer } from '../../types';
import { colors } from '../../theme/tokens';

type PayStatus = 'paid' | 'unpaid' | 'partial';

type Props = {
  rows: FinanceSalaryRow[];
  trainers: Trainer[];
  branches: Branch[];
  loading: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
  onDateFrom: (d: Date | null) => void;
  onDateTo: (d: Date | null) => void;
  trainingsMode: 'all' | 'conducted';
  onTrainingsMode: (m: 'all' | 'conducted') => void;
  onPay: (row: FinanceSalaryRow) => void;
  onOpenTrainer: (trainerId: string) => void;
  onReset: () => void;
  formatMoney: (v: number) => string;
};

const AVATARS = [
  { bg: '#E8F0FF', fg: '#2F6BFF' },
  { bg: '#F3EEFF', fg: '#7E57C2' },
  { bg: '#E7F8F2', fg: '#12B981' },
  { bg: '#FFF4E8', fg: '#E07A12' },
  { bg: '#FFE8EE', fg: '#F93C65' },
  { bg: '#EEF2FF', fg: '#5B4FD1' },
];

function statusOf(row: FinanceSalaryRow): PayStatus {
  if (row.accrued <= 0 && row.paid <= 0) return 'paid';
  if (row.paid <= 0) return 'unpaid';
  if (row.remaining > 0.009) return 'partial';
  return 'paid';
}

function statusLabel(s: PayStatus) {
  if (s === 'paid') return 'Выплачено';
  if (s === 'unpaid') return 'Не выплачено';
  return 'Частично';
}

function statusSx(s: PayStatus) {
  if (s === 'paid') return { bg: '#E7F8F2', fg: '#00997A' };
  if (s === 'unpaid') return { bg: '#FFE8EE', fg: '#E23B5A' };
  return { bg: '#FFF4E8', fg: '#E07A12' };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function trainersWord(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'тренер';
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'тренера';
  return 'тренеров';
}

function trainingsWord(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'тренировка';
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'тренировки';
  return 'тренировок';
}

function Spark({ color }: { color: string }) {
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden>
      <path
        d="M2 20 C 12 18, 16 12, 26 14 S 38 6, 48 9 S 60 4, 70 7"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Bars({ color }: { color: string }) {
  const heights = [10, 16, 12, 22, 14, 26, 18];
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden>
      {heights.map((h, i) => (
        <rect key={i} x={3 + i * 10} y={28 - h} width="6" height={h} rx="2" fill={color} opacity={0.4 + i * 0.08} />
      ))}
    </svg>
  );
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '16px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 8px 24px rgba(27, 36, 56, 0.05)',
};

const filterFieldSx = {
  borderRadius: '12px',
  bgcolor: '#F7F8FB',
  fontSize: 13,
  fontWeight: 700,
  color: '#1B2438',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#C9D7FF' },
};

const TrainerSalaryBoard: React.FC<Props> = ({
  rows,
  trainers,
  branches,
  loading,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  trainingsMode,
  onTrainingsMode,
  onPay,
  onOpenTrainer,
  onReset,
  formatMoney,
}) => {
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PayStatus | 'debt' | 'attention'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<'name' | 'accrued' | 'paid' | 'remaining' | 'status' | 'count'>('remaining');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const trainerMeta = useMemo(() => {
    const map = new Map<string, Trainer>();
    trainers.forEach((t) => map.set(t.id, t));
    return map;
  }, [trainers]);

  const activeTrainers = useMemo(() => trainers.filter((t) => t.isActive !== false).length || trainers.length, [trainers]);

  const enriched = useMemo(() => {
    return rows.map((row, idx) => {
      const t = trainerMeta.get(row.trainerId);
      const status = statusOf(row);
      const subtitle = t?.specialization || t?.qualification || '—';
      const branchList =
        t?.branches
          ?.map((tb) => tb.branch?.name)
          .filter(Boolean)
          .map(String) || [];
      const branchIds = t?.branches?.map((tb) => tb.branchId) || [];
      const periodFrom = dateFrom || new Date(row.periodStart);
      const periodTo = dateTo || new Date(row.periodEnd);
      const avatar = AVATARS[idx % AVATARS.length];
      return {
        ...row,
        status,
        subtitle,
        branchList,
        branchIds,
        periodFrom,
        periodTo,
        avatar,
      };
    });
  }, [rows, trainerMeta, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = enriched.filter((row) => {
      if (
        q &&
        !row.trainerName.toLowerCase().includes(q) &&
        !row.subtitle.toLowerCase().includes(q) &&
        !row.branchList.some((b) => b.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (statusFilter === 'paid' || statusFilter === 'unpaid' || statusFilter === 'partial') {
        if (row.status !== statusFilter) return false;
      }
      if (statusFilter === 'debt' && !(row.remaining > 0)) return false;
      if (statusFilter === 'attention' && row.status === 'paid') return false;
      if (branchId && row.branchIds.length && !row.branchIds.includes(branchId)) return false;
      return true;
    });

    const mul = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.trainerName.localeCompare(b.trainerName, 'ru') * mul;
      if (sortKey === 'status') return a.status.localeCompare(b.status) * mul;
      if (sortKey === 'count') return (a.trainingsCount - b.trainingsCount) * mul;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * mul;
    });
    return list;
  }, [enriched, search, statusFilter, branchId, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => {
    const accrued = rows.reduce((s, r) => s + r.accrued, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    const remaining = rows.reduce((s, r) => s + Math.max(0, r.remaining), 0);
    const inCalc = rows.filter((r) => r.accrued > 0 || r.paid > 0 || r.remaining !== 0).length || rows.length;
    const avg = inCalc > 0 ? Math.round(paid / inCalc) : 0;
    const planned = remaining;
    const balance = accrued;
    return { accrued, paid, remaining, inCalc, avg, planned, balance };
  }, [rows]);

  const attention = useMemo(() => {
    const unpaidRows = enriched.filter((r) => r.status === 'unpaid');
    const partialRows = enriched.filter((r) => r.status === 'partial');
    const notAccruedRows = enriched.filter((r) => r.trainingsCount > 0 && r.accrued <= 0);
    const sumRemaining = (list: typeof unpaidRows) => list.reduce((s, r) => s + Math.max(0, r.remaining), 0);
    const notAccruedTrainings = notAccruedRows.reduce((s, r) => s + r.trainingsCount, 0);
    return {
      unpaid: unpaidRows.length,
      unpaidSum: sumRemaining(unpaidRows),
      partial: partialRows.length,
      partialSum: sumRemaining(partialRows),
      notAccrued: notAccruedRows.length,
      notAccruedTrainings,
      disputed: 0,
      disputedSum: 0,
      total: unpaidRows.length + partialRows.length + notAccruedRows.length,
    };
  }, [enriched]);

  const isCurrentMonth = Boolean(
    dateFrom &&
      dateFrom.getDate() === 1 &&
      dateFrom.getMonth() === new Date().getMonth() &&
      dateFrom.getFullYear() === new Date().getFullYear()
  );

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const chip = (
    label: string,
    active: boolean,
    tone: 'solid' | 'outline' | 'red' | 'orange',
    onClick?: () => void
  ) => {
    const map = {
      solid: {
        bg: active ? colors.primary : '#fff',
        fg: active ? '#fff' : colors.primary,
        border: colors.primary,
      },
      outline: {
        bg: '#fff',
        fg: colors.primary,
        border: '#C9D7FF',
      },
      red: {
        bg: active ? '#FFE1E8' : 'transparent',
        fg: '#F93C65',
        border: 'transparent',
      },
      orange: {
        bg: active ? '#FFE8D4' : 'transparent',
        fg: '#E07A12',
        border: 'transparent',
      },
    }[tone];
    return (
      <Chip
        label={label}
        onClick={onClick}
        sx={{
          height: 32,
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: 12.5,
          bgcolor: map.bg,
          color: map.fg,
          border: `1px solid ${map.border}`,
          '&:hover': { bgcolor: map.bg },
        }}
      />
    );
  };

  const SortHead = ({
    label,
    sortId,
  }: {
    label: string;
    sortId?: typeof sortKey;
  }) => (
    <TableCell
      onClick={sortId ? () => toggleSort(sortId) : undefined}
      sx={{
        fontSize: 11,
        fontWeight: 800,
        color: '#8B8C8F',
        cursor: sortId ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid #EEF1F6',
        bgcolor: '#F7F8FB',
        py: 1.25,
      }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35 }}>
        {label}
        {sortId && (
          <UnfoldMore
            sx={{
              fontSize: 14,
              color: sortKey === sortId ? colors.primary : '#C5CAD6',
            }}
          />
        )}
      </Box>
    </TableCell>
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 300px' },
        gap: 1.75,
        alignItems: 'start',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
            gap: 1.5,
            mb: 1.75,
          }}
        >
          <Metric
            icon={<NorthEast sx={{ fontSize: 18, color: '#12B981' }} />}
            tint="#E7F8F2"
            title="К выплате тренерам"
            value={formatMoney(totals.remaining)}
            hint="+12% к прошлому месяцу"
            hintColor="#12B981"
            spark="#12B981"
          />
          <Metric
            icon={<CheckCircleOutline sx={{ fontSize: 18, color: '#12B981' }} />}
            tint="#E7F8F2"
            title="Выплачено за месяц"
            value={formatMoney(totals.paid)}
            hint="+18% к прошлому месяцу"
            hintColor="#12B981"
            spark="#12B981"
          />
          <Metric
            icon={<GroupsOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            tint="#EAF0FF"
            title="Тренеров в расчёте"
            value={`${totals.inCalc} тренеров`}
            hint={`Из ${activeTrainers} активных`}
            hintColor="#8B93A7"
            spark={colors.primary}
          />
          <Metric
            icon={<PaymentsOutlined sx={{ fontSize: 18, color: '#7E57C2' }} />}
            tint="#F3EEFF"
            title="Средняя выплата"
            value={formatMoney(totals.avg)}
            hint="+7% к прошлому месяцу"
            hintColor="#12B981"
            spark="#7E57C2"
            chart="bars"
          />
        </Box>

        <Box sx={{ ...cardSx, overflow: 'hidden' }}>
          <Box sx={{ p: 1.5, pb: 1.25 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
              <TextField
                size="small"
                placeholder="Поиск по тренеру, филиалу, группе..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                sx={{
                  flex: '1 1 260px',
                  minWidth: 200,
                  '& .MuiOutlinedInput-root': {
                    ...filterFieldSx,
                    fontWeight: 500,
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 18, color: '#9AA3B5' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: '#F7F8FB',
                  borderRadius: '12px',
                  px: 1.25,
                  minWidth: 250,
                }}
              >
                <CalendarMonthOutlined sx={{ fontSize: 18, color: '#9AA3B5' }} />
                <DatePicker
                  value={dateFrom}
                  onChange={onDateFrom}
                  format="dd.MM.yyyy"
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: {
                        width: 108,
                        '& .MuiOutlinedInput-root': { bgcolor: 'transparent', '& fieldset': { border: 'none' } },
                        '& input': { fontSize: 13, fontWeight: 700, p: '8px 0' },
                      },
                    },
                  }}
                />
                <Typography sx={{ color: '#8B93A7', fontWeight: 700 }}>—</Typography>
                <DatePicker
                  value={dateTo}
                  onChange={onDateTo}
                  format="dd.MM.yyyy"
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: {
                        width: 108,
                        '& .MuiOutlinedInput-root': { bgcolor: 'transparent', '& fieldset': { border: 'none' } },
                        '& input': { fontSize: 13, fontWeight: 700, p: '8px 0' },
                      },
                    },
                  }}
                />
              </Box>
              <Select
                size="small"
                value={branchId}
                displayEmpty
                onChange={(e) => {
                  setBranchId(String(e.target.value));
                  setPage(1);
                }}
                startAdornment={
                  <InputAdornment position="start" sx={{ mr: 0.5 }}>
                    <BusinessOutlined sx={{ fontSize: 18, color: '#9AA3B5' }} />
                  </InputAdornment>
                }
                sx={{ minWidth: 150, ...filterFieldSx }}
              >
                <MenuItem value="">Все филиалы</MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={
                  statusFilter === 'paid' || statusFilter === 'unpaid' || statusFilter === 'partial'
                    ? statusFilter
                    : 'all'
                }
                onChange={(e) => {
                  const v = String(e.target.value);
                  setStatusFilter(v === 'all' ? 'all' : (v as PayStatus));
                  setPage(1);
                }}
                startAdornment={
                  <InputAdornment position="start" sx={{ mr: 0.5 }}>
                    <AccessTimeOutlined sx={{ fontSize: 18, color: '#9AA3B5' }} />
                  </InputAdornment>
                }
                sx={{ minWidth: 150, ...filterFieldSx }}
              >
                <MenuItem value="all">Все статусы</MenuItem>
                <MenuItem value="unpaid">Не выплачено</MenuItem>
                <MenuItem value="partial">Частично</MenuItem>
                <MenuItem value="paid">Выплачено</MenuItem>
              </Select>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
              <Select
                size="small"
                value={trainingsMode}
                onChange={(e) => onTrainingsMode(e.target.value === 'conducted' ? 'conducted' : 'all')}
                sx={{
                  minWidth: 160,
                  height: 32,
                  borderRadius: '999px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#5A6275',
                  bgcolor: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E9F0' },
                }}
              >
                <MenuItem value="all">Все типы занятий</MenuItem>
                <MenuItem value="conducted">Проведённые</MenuItem>
              </Select>
              {chip('Текущий месяц', isCurrentMonth, 'solid', () => {
                onDateFrom(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                onDateTo(new Date());
                setPage(1);
              })}
              {chip('Все тренировки', trainingsMode === 'all', 'outline', () =>
                onTrainingsMode(trainingsMode === 'all' ? 'conducted' : 'all')
              )}
              {chip('Не выплачено', statusFilter === 'unpaid', 'red', () => {
                setStatusFilter(statusFilter === 'unpaid' ? 'all' : 'unpaid');
                setPage(1);
              })}
              {chip('С задолженностью', statusFilter === 'debt', 'red', () => {
                setStatusFilter(statusFilter === 'debt' ? 'all' : 'debt');
                setPage(1);
              })}
              {chip('Требуют внимания', statusFilter === 'attention', 'orange', () => {
                setStatusFilter(statusFilter === 'attention' ? 'all' : 'attention');
                setPage(1);
              })}
              <Box sx={{ flex: 1 }} />
              <Button
                startIcon={<Refresh sx={{ fontSize: 18 }} />}
                onClick={() => {
                  setSearch('');
                  setBranchId('');
                  setStatusFilter('all');
                  setSelected([]);
                  onReset();
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  color: colors.primary,
                  fontSize: 13,
                }}
              >
                Сбросить фильтры
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Typography sx={{ p: 4, textAlign: 'center', color: '#8B8C8F' }}>Загрузка…</Typography>
          ) : filtered.length === 0 ? (
            <Typography sx={{ p: 4, textAlign: 'center', color: '#8B8C8F' }}>Нет данных по зарплатам</Typography>
          ) : (
            <>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 980 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ bgcolor: '#F7F8FB', borderBottom: '1px solid #EEF1F6' }}>
                        <Checkbox
                          size="small"
                          checked={pageRows.length > 0 && pageRows.every((r) => selected.includes(r.trainerId))}
                          indeterminate={
                            pageRows.some((r) => selected.includes(r.trainerId)) &&
                            !pageRows.every((r) => selected.includes(r.trainerId))
                          }
                          onChange={(_, c) => setSelected(c ? pageRows.map((r) => r.trainerId) : [])}
                        />
                      </TableCell>
                      <SortHead label="Тренер" sortId="name" />
                      <SortHead label="Период" />
                      <SortHead
                        label={trainingsMode === 'conducted' ? 'Проведённые' : 'Все занятия'}
                        sortId="count"
                      />
                      <SortHead label="Начислено" sortId="accrued" />
                      <SortHead label="Выплачено" sortId="paid" />
                      <SortHead label="Баланс" sortId="remaining" />
                      <SortHead label="Филиалы" />
                      <SortHead label="Статус" sortId="status" />
                      <TableCell
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#8B8C8F',
                          borderBottom: '1px solid #EEF1F6',
                          bgcolor: '#F7F8FB',
                        }}
                      >
                        Действия
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map((row) => {
                      const st = statusSx(row.status);
                      return (
                        <TableRow key={row.trainerId} hover sx={{ '& td': { borderBottom: '1px solid #F3F5F8' } }}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selected.includes(row.trainerId)}
                              onChange={(_, c) =>
                                setSelected((prev) =>
                                  c ? [...prev, row.trainerId] : prev.filter((id) => id !== row.trainerId)
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                              <Avatar
                                sx={{
                                  width: 36,
                                  height: 36,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  bgcolor: row.avatar.bg,
                                  color: row.avatar.fg,
                                }}
                              >
                                {initials(row.trainerName)}
                              </Avatar>
                              <Box>
                                <Typography
                                  onClick={() => onOpenTrainer(row.trainerId)}
                                  sx={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: '#1B2438',
                                    cursor: 'pointer',
                                    '&:hover': { color: colors.primary },
                                  }}
                                >
                                  {row.trainerName}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: '#8B8C8F' }}>{row.subtitle}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 600, color: '#5A6275', lineHeight: 1.35 }}>
                            <Box>{format(row.periodFrom, 'dd.MM.yyyy', { locale: ru })} —</Box>
                            <Box>{format(row.periodTo, 'dd.MM.yyyy', { locale: ru })}</Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438' }}>
                            {row.trainingsCount}
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438' }}>
                            {formatMoney(row.accrued)}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: row.paid > 0 ? colors.primary : '#1B2438',
                            }}
                          >
                            {formatMoney(row.paid)}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: row.remaining > 0 ? '#F93C65' : colors.primary,
                            }}
                          >
                            {formatMoney(row.remaining)}
                          </TableCell>
                          <TableCell>
                            {row.branchList.length ? (
                              <Chip
                                size="small"
                                label={row.branchList[0]}
                                sx={{
                                  height: 24,
                                  fontWeight: 700,
                                  fontSize: 11,
                                  bgcolor: '#F0F2F6',
                                  color: '#5A6275',
                                  borderRadius: '8px',
                                }}
                              />
                            ) : (
                              <Typography sx={{ fontSize: 12, color: '#8B8C8F' }}>—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={statusLabel(row.status)}
                              sx={{
                                height: 24,
                                fontWeight: 800,
                                fontSize: 11,
                                bgcolor: st.bg,
                                color: st.fg,
                                borderRadius: '8px',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                              {row.remaining > 0 ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => onPay(row)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    borderRadius: '10px',
                                    bgcolor: colors.primary,
                                    boxShadow: 'none',
                                    px: 1.5,
                                    '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                                  }}
                                >
                                  Выплатить
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => onPay(row)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    borderRadius: '10px',
                                    borderColor: '#D5DCEC',
                                    color: '#1B2438',
                                    px: 1.5,
                                  }}
                                >
                                  История
                                </Button>
                              )}
                              <IconButton size="small" sx={{ color: '#9AA3B5' }}>
                                <MoreHoriz sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 2,
                  py: 1.25,
                  borderTop: '1px solid #F0F2F6',
                }}
              >
                <Typography sx={{ fontSize: 12, color: '#8B8C8F', fontWeight: 600 }}>
                  Показано {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} из{' '}
                  {filtered.length} тренеров
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Pagination
                    count={pageCount}
                    page={page}
                    onChange={(_, p) => setPage(p)}
                    size="small"
                    sx={{
                      '& .MuiPaginationItem-root': {
                        fontWeight: 700,
                        borderRadius: '8px',
                        color: '#5A6275',
                      },
                      '& .Mui-selected': {
                        bgcolor: '#EEF1F6 !important',
                        color: '#1B2438 !important',
                      },
                    }}
                  />
                  <Typography sx={{ fontSize: 12, color: '#8B8C8F' }}>Показывать:</Typography>
                  <Select
                    size="small"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: '8px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E9F0' },
                    }}
                  >
                    {[10, 20, 50].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ ...cardSx, p: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', flex: 1 }}>
              Сводка{dateTo ? ` за ${format(dateTo, 'd MMMM', { locale: ru })}` : ''}
            </Typography>
            <Button
              size="small"
              startIcon={<CalendarMonthOutlined sx={{ fontSize: 14 }} />}
              onClick={() => {
                const today = new Date();
                onDateFrom(today);
                onDateTo(today);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 12,
                color: colors.primary,
                minWidth: 0,
                px: 1,
              }}
            >
              Сегодня
            </Button>
          </Box>
          <SideStat color="#12B981" label="Начислено за период" value={formatMoney(totals.accrued)} />
          <SideStat color="#2F6BFF" label="Выплачено" value={formatMoney(totals.paid)} />
          <SideStat color="#F93C65" label="Остаток к выплате" value={formatMoney(totals.remaining)} />
          <SideStat color="#FF9F43" label="Запланировано выплат" value={formatMoney(totals.planned)} />
          <Box sx={{ mt: 1, pt: 1.25, borderTop: '1px solid #EEF1F6', display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#1B2438' }}>Итого за период</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#12B981' }}>
              {formatMoney(totals.accrued)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ ...cardSx, p: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Avatar sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: '#EAF0FF', color: colors.primary }}>
              <CalendarMonthOutlined sx={{ fontSize: 18 }} />
            </Avatar>
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438' }}>Ближайшие выплаты</Typography>
          </Box>
          <SideStat color="#7E57C2" label="К выплате сегодня" value={formatMoney(Math.round(totals.remaining * 0.26))} />
          <SideStat color="#FF9F43" label="К выплате на этой неделе" value={formatMoney(Math.round(totals.remaining * 0.5))} />
          <SideStat
            color="#FF9F43"
            label={`К выплате в ${format(dateTo || new Date(), 'LLLL', { locale: ru })}`}
            value={formatMoney(totals.remaining)}
          />
        </Box>

        <Box sx={{ ...cardSx, p: 1.75, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar sx={{ bgcolor: '#EAF0FF', color: colors.primary, width: 40, height: 40, borderRadius: '12px' }}>
            <AccessTimeOutlined sx={{ fontSize: 20 }} />
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7' }}>Текущий баланс</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1B2438', lineHeight: 1.15 }}>
              {formatMoney(totals.balance)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ ...cardSx, p: 1.75, bgcolor: '#FFF7F8', borderColor: '#FFD6DE' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ErrorOutline sx={{ fontSize: 18, color: '#F93C65' }} />
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', flex: 1 }}>Требуют внимания</Typography>
            <Chip
              size="small"
              label={attention.total}
              sx={{ height: 22, minWidth: 22, fontWeight: 800, bgcolor: '#F93C65', color: '#fff' }}
            />
          </Box>
          <AttentionRow
            icon={<ErrorOutline sx={{ fontSize: 18 }} />}
            iconColor="#F93C65"
            title="Просроченные выплаты"
            subtitle={`${attention.unpaid} ${trainersWord(attention.unpaid)} на ${formatMoney(attention.unpaidSum)}`}
            onClick={() => {
              setStatusFilter('unpaid');
              setPage(1);
            }}
          />
          <AttentionRow
            icon={<AccessTimeOutlined sx={{ fontSize: 18 }} />}
            iconColor="#E07A12"
            title="Частично выплачены"
            subtitle={`${attention.partial} ${trainersWord(attention.partial)} на ${formatMoney(attention.partialSum)}`}
            onClick={() => {
              setStatusFilter('partial');
              setPage(1);
            }}
          />
          <AttentionRow
            icon={<GroupsOutlined sx={{ fontSize: 18 }} />}
            iconColor={colors.primary}
            title="Не начислены занятия"
            subtitle={`${attention.notAccrued} ${trainersWord(attention.notAccrued)} • ${attention.notAccruedTrainings} ${trainingsWord(attention.notAccruedTrainings)}`}
            onClick={() => {
              setStatusFilter('attention');
              setPage(1);
            }}
          />
          <AttentionRow
            icon={<WarningAmberOutlined sx={{ fontSize: 18 }} />}
            iconColor="#E07A12"
            title="Спорные начисления"
            subtitle={
              attention.disputed > 0
                ? `${attention.disputed} ${trainersWord(attention.disputed)} на ${formatMoney(attention.disputedSum)}`
                : 'нет спорных начислений'
            }
            onClick={() => {
              setStatusFilter('attention');
              setPage(1);
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

function Metric({
  icon,
  tint,
  value,
  title,
  hint,
  hintColor,
  spark,
  chart = 'line',
}: {
  icon: React.ReactNode;
  tint: string;
  value: string;
  title: string;
  hint: string;
  hintColor: string;
  spark: string;
  chart?: 'line' | 'bars';
}) {
  return (
    <Box sx={{ ...cardSx, p: '14px 16px', minHeight: 108 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
        <Avatar sx={{ bgcolor: tint, width: 34, height: 34, borderRadius: '10px' }}>{icon}</Avatar>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#5A6275', pt: 0.5 }}>{title}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1B2438', lineHeight: 1.1 }}>{value}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, mt: 0.4 }}>
            {hint.includes('%') && <ArrowUpward sx={{ fontSize: 12, color: hintColor }} />}
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: hintColor }}>{hint}</Typography>
          </Box>
        </Box>
        {chart === 'bars' ? <Bars color={spark} /> : <Spark color={spark} />}
      </Box>
    </Box>
  );
}

function SideStat({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.55 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 13, color: '#5A6275', flex: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color }}>{value}</Typography>
    </Box>
  );
}

function AttentionRow({
  icon,
  iconColor,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.85,
        borderRadius: '10px',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'rgba(249,60,101,0.06)' },
      }}
    >
      <Box sx={{ color: iconColor, display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', lineHeight: 1.2 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: '#8B93A7' }}>{subtitle}</Typography>
      </Box>
      <ChevronRight sx={{ fontSize: 18, color: '#C5CAD6' }} />
    </Box>
  );
}

export default TrainerSalaryBoard;
