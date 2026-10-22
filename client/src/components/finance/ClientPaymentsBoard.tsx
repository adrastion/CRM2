import React, { useMemo, useState } from 'react';
import {
  AccessTimeOutlined,
  ArrowUpward,
  CalendarMonthOutlined,
  CheckCircleOutline,
  ChevronRight,
  ErrorOutline,
  FileDownloadOutlined,
  FilterAltOutlined,
  GroupsOutlined,
  MoreHoriz,
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
import { format, isBefore, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Branch, Client, FinanceMembershipRow, Group } from '../../types';
import { colors } from '../../theme/tokens';

type PayStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

type Props = {
  rows: FinanceMembershipRow[];
  clients: Client[];
  groups: Group[];
  branches: Branch[];
  loading: boolean;
  onOpenClient: (clientId: string) => void;
  onReceive: (row: FinanceMembershipRow) => void;
  onMonthChange: (month: Date) => void;
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

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '16px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 8px 24px rgba(27, 36, 56, 0.05)',
};

const fieldSx = {
  borderRadius: '12px',
  bgcolor: '#F7F8FB',
  fontSize: 13,
  fontWeight: 700,
  color: '#1B2438',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function clientsWord(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'клиент';
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'клиента';
  return 'клиентов';
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

function deriveStatus(row: FinanceMembershipRow): PayStatus {
  if (row.status === 'paid' || (row.remaining <= 0.009 && row.paidAmount > 0)) return 'paid';
  if (row.status === 'partial' || (row.paidAmount > 0 && row.remaining > 0.009)) return 'partial';
  const month = /^\d{4}-\d{2}$/.test(row.periodKey) ? new Date(`${row.periodKey}-01`) : null;
  if (month && isBefore(month, startOfMonth(new Date()))) return 'overdue';
  return 'unpaid';
}

function statusLabel(s: PayStatus) {
  if (s === 'paid') return 'Оплачено';
  if (s === 'partial') return 'Частично';
  if (s === 'overdue') return 'Просрочено';
  return 'Без оплаты';
}

function statusSx(s: PayStatus) {
  if (s === 'paid') return { bg: '#E7F8F2', fg: '#00997A' };
  if (s === 'partial') return { bg: '#FFF4E8', fg: '#E07A12' };
  if (s === 'overdue') return { bg: '#FFE8EE', fg: '#E23B5A' };
  return { bg: '#FFF1F4', fg: '#F93C65' };
}

const ClientPaymentsBoard: React.FC<Props> = ({
  rows,
  clients,
  groups,
  branches,
  loading,
  onOpenClient,
  onReceive,
  onMonthChange,
  formatMoney,
}) => {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dateTo, setDateTo] = useState<Date | null>(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const [groupId, setGroupId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PayStatus>('all');
  const [chip, setChip] = useState<'month' | 'today' | 'overdue' | 'partial' | 'unpaid' | null>('month');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<'name' | 'accrued' | 'paid' | 'remaining' | 'status'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const clientById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const enriched = useMemo(() => {
    return rows.map((row, idx) => {
      const client = clientById.get(row.clientId);
      const payStatus = deriveStatus(row);
      const groupName = row.groups?.[0]?.name || '—';
      const branchIds = row.groups?.map((g) => g.branchId).filter(Boolean) as string[];
      const period = /^\d{4}-\d{2}$/.test(row.periodKey)
        ? {
            from: new Date(`${row.periodKey}-01`),
            to: new Date(Number(row.periodKey.slice(0, 4)), Number(row.periodKey.slice(5, 7)), 0),
          }
        : null;
      return {
        ...row,
        payStatus,
        phone: client?.phone || '',
        groupName,
        branchIds,
        period,
        avatar: AVATARS[idx % AVATARS.length],
        key: `${row.clientId}:${row.periodKey}`,
      };
    });
  }, [rows, clientById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = enriched.filter((row) => {
      if (q && !row.clientName.toLowerCase().includes(q) && !row.phone.toLowerCase().includes(q)) return false;
      if (groupId && !row.groups.some((g) => g.id === groupId)) return false;
      if (branchId && row.branchIds.length && !row.branchIds.includes(branchId)) return false;
      if (statusFilter !== 'all' && row.payStatus !== statusFilter) return false;
      if (chip === 'overdue' && row.payStatus !== 'overdue') return false;
      if (chip === 'partial' && row.payStatus !== 'partial') return false;
      if (chip === 'unpaid' && row.payStatus !== 'unpaid') return false;
      return true;
    });
    const mul = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.clientName.localeCompare(b.clientName, 'ru') * mul;
      if (sortKey === 'status') return a.payStatus.localeCompare(b.payStatus) * mul;
      const pick = (r: typeof a) =>
        sortKey === 'accrued' ? r.membershipPrice : sortKey === 'paid' ? r.paidAmount : r.remaining;
      return (pick(a) - pick(b)) * mul;
    });
    return list;
  }, [enriched, search, groupId, branchId, statusFilter, chip, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => {
    const paid = rows.reduce((s, r) => s + r.paidAmount, 0);
    const expected = rows.reduce((s, r) => s + Math.max(0, r.remaining), 0);
    const overdueRows = enriched.filter((r) => r.payStatus === 'overdue');
    const overdue = overdueRows.reduce((s, r) => s + Math.max(0, r.remaining), 0);
    const payers = new Set(rows.filter((r) => r.paidAmount > 0).map((r) => r.clientId)).size;
    const clientsTotal = new Set(rows.map((r) => r.clientId)).size;
    const partial = enriched.filter((r) => r.payStatus === 'partial');
    const unpaid = enriched.filter((r) => r.payStatus === 'unpaid');
    return {
      paid,
      expected,
      overdue,
      overdueCount: overdueRows.length,
      payers,
      clientsTotal,
      partialCount: partial.length,
      partialSum: partial.reduce((s, r) => s + Math.max(0, r.remaining), 0),
      unpaidCount: unpaid.length,
      unpaidSum: unpaid.reduce((s, r) => s + Math.max(0, r.remaining), 0),
    };
  }, [rows, enriched]);

  const applyMonth = (from: Date, to: Date) => {
    setDateFrom(from);
    setDateTo(to);
    setChip('month');
    setPage(1);
    onMonthChange(from);
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const pill = (label: string, active: boolean, tone: 'blue' | 'red' | 'orange', onClick: () => void, badge?: number) => {
    const map = {
      blue: { bg: active ? colors.primary : '#fff', fg: active ? '#fff' : colors.primary, border: active ? colors.primary : '#C9D7FF' },
      red: { bg: active ? '#FFE1E8' : 'transparent', fg: '#F93C65', border: 'transparent' },
      orange: { bg: active ? '#FFE8D4' : 'transparent', fg: '#E07A12', border: 'transparent' },
    }[tone];
    return (
      <Chip
        label={badge ? `${label}  ${badge}` : label}
        onClick={onClick}
        sx={{
          height: 32,
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: 12.5,
          bgcolor: map.bg,
          color: map.fg,
          border: `1px solid ${map.border}`,
        }}
      />
    );
  };

  const SortHead = ({ label, id }: { label: string; id?: typeof sortKey }) => (
    <TableCell
      onClick={id ? () => toggleSort(id) : undefined}
      sx={{
        fontSize: 11,
        fontWeight: 800,
        color: '#8B8C8F',
        whiteSpace: 'nowrap',
        cursor: id ? 'pointer' : 'default',
        bgcolor: '#F7F8FB',
        borderBottom: '1px solid #EEF1F6',
      }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
        {label}
        {id && <UnfoldMore sx={{ fontSize: 14, color: sortKey === id ? colors.primary : '#C5CAD6' }} />}
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
            icon={<CheckCircleOutline sx={{ fontSize: 18, color: '#12B981' }} />}
            tint="#E7F8F2"
            title="Оплачено за месяц"
            value={formatMoney(totals.paid)}
            hint="+12% к прошлому месяцу"
            hintColor="#12B981"
          />
          <Metric
            icon={<AccessTimeOutlined sx={{ fontSize: 18, color: '#E07A12' }} />}
            tint="#FFF4E8"
            title="Ожидается оплат"
            value={formatMoney(totals.expected)}
            hint="+6% к прошлому месяцу"
            hintColor="#E07A12"
            spark="#E07A12"
          />
          <Metric
            icon={<ErrorOutline sx={{ fontSize: 18, color: '#F93C65' }} />}
            tint="#FFE8EE"
            title="Просрочено"
            value={formatMoney(totals.overdue)}
            hint={`${totals.overdueCount} ${clientsWord(totals.overdueCount)}`}
            hintColor="#F93C65"
            spark="#F93C65"
          />
          <Metric
            icon={<GroupsOutlined sx={{ fontSize: 18, color: colors.primary }} />}
            tint="#EAF0FF"
            title="Активных плательщиков"
            value={String(totals.payers)}
            hint={`из ${totals.clientsTotal} клиентов`}
            hintColor="#8B93A7"
            spark={colors.primary}
          />
        </Box>

        <Box sx={{ ...cardSx, overflow: 'hidden' }}>
          <Box sx={{ p: 1.5, pb: 1.25 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
              <TextField
                size="small"
                placeholder="Поиск по клиенту, телефону..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                sx={{ flex: '1 1 220px', minWidth: 180, '& .MuiOutlinedInput-root': { ...fieldSx, fontWeight: 500 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 18, color: '#9AA3B5' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#F7F8FB', borderRadius: '12px', px: 1, minWidth: 240 }}>
                <CalendarMonthOutlined sx={{ fontSize: 18, color: '#9AA3B5' }} />
                <DatePicker
                  value={dateFrom}
                  onChange={(d) => d && applyMonth(d, dateTo || d)}
                  format="dd.MM.yyyy"
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: {
                        width: 108,
                        '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } },
                        '& input': { fontSize: 13, fontWeight: 700, p: '8px 0' },
                      },
                    },
                  }}
                />
                <Typography sx={{ color: '#8B93A7', fontWeight: 700 }}>—</Typography>
                <DatePicker
                  value={dateTo}
                  onChange={(d) => d && setDateTo(d)}
                  format="dd.MM.yyyy"
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: {
                        width: 108,
                        '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } },
                        '& input': { fontSize: 13, fontWeight: 700, p: '8px 0' },
                      },
                    },
                  }}
                />
              </Box>
              <Select
                size="small"
                displayEmpty
                value={groupId}
                onChange={(e) => {
                  setGroupId(String(e.target.value));
                  setPage(1);
                }}
                sx={{ minWidth: 140, ...fieldSx }}
              >
                <MenuItem value="">Абонемент</MenuItem>
                {groups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                displayEmpty
                value={branchId}
                onChange={(e) => {
                  setBranchId(String(e.target.value));
                  setPage(1);
                }}
                sx={{ minWidth: 130, ...fieldSx }}
              >
                <MenuItem value="">Филиал</MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                displayEmpty
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | PayStatus);
                  setPage(1);
                }}
                sx={{ minWidth: 130, ...fieldSx }}
              >
                <MenuItem value="all">Статус</MenuItem>
                <MenuItem value="paid">Оплачено</MenuItem>
                <MenuItem value="partial">Частично</MenuItem>
                <MenuItem value="unpaid">Без оплаты</MenuItem>
                <MenuItem value="overdue">Просрочено</MenuItem>
              </Select>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
              <Select
                size="small"
                value="all"
                displayEmpty
                sx={{
                  minWidth: 150,
                  height: 32,
                  borderRadius: '999px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E9F0' },
                }}
                startAdornment={
                  <InputAdornment position="start">
                    <FilterAltOutlined sx={{ fontSize: 18, color: '#9AA3B5' }} />
                  </InputAdornment>
                }
              >
                <MenuItem value="all">Способ оплаты</MenuItem>
              </Select>
              {pill('Сегодня', chip === 'today', 'blue', () => {
                const today = new Date();
                setDateFrom(today);
                setDateTo(today);
                setChip('today');
                onMonthChange(today);
              })}
              {pill('Этот месяц', chip === 'month', 'blue', () => {
                const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                const to = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
                applyMonth(from, to);
              })}
              {pill(
                'Просрочено',
                chip === 'overdue',
                'red',
                () => {
                  setChip(chip === 'overdue' ? 'month' : 'overdue');
                  setPage(1);
                },
                totals.overdueCount || undefined
              )}
              {pill('Частично оплачено', chip === 'partial', 'orange', () => {
                setChip(chip === 'partial' ? 'month' : 'partial');
                setPage(1);
              })}
              {pill('Без оплаты', chip === 'unpaid', 'red', () => {
                setChip(chip === 'unpaid' ? 'month' : 'unpaid');
                setPage(1);
              })}
              <Box sx={{ flex: 1 }} />
              <Button
                startIcon={<Refresh sx={{ fontSize: 18 }} />}
                onClick={() => {
                  setSearch('');
                  setGroupId('');
                  setBranchId('');
                  setStatusFilter('all');
                  setSelected([]);
                  const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                  const to = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
                  applyMonth(from, to);
                }}
                sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary, fontSize: 13 }}
              >
                Сбросить фильтры
              </Button>
              <Button
                startIcon={<FileDownloadOutlined sx={{ fontSize: 18 }} />}
                sx={{ textTransform: 'none', fontWeight: 700, color: '#5A6275', fontSize: 13 }}
                onClick={() => {
                  const header = 'Клиент;Телефон;Группа;Начислено;Оплачено;Баланс;Статус';
                  const body = filtered
                    .map(
                      (r) =>
                        `${r.clientName};${r.phone};${r.groupName};${r.membershipPrice};${r.paidAmount};${r.remaining};${statusLabel(r.payStatus)}`
                    )
                    .join('\n');
                  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'oplaty-klientov.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Экспорт
              </Button>
            </Box>
          </Box>

          {loading ? (
            <Typography sx={{ p: 4, textAlign: 'center', color: '#8B8C8F' }}>Загрузка…</Typography>
          ) : filtered.length === 0 ? (
            <Typography sx={{ p: 4, textAlign: 'center', color: '#8B8C8F' }}>Нет оплат за период</Typography>
          ) : (
            <>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 980 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ bgcolor: '#F7F8FB', borderBottom: '1px solid #EEF1F6' }}>
                        <Checkbox
                          size="small"
                          checked={pageRows.length > 0 && pageRows.every((r) => selected.includes(r.key))}
                          onChange={(_, c) => setSelected(c ? pageRows.map((r) => r.key) : [])}
                        />
                      </TableCell>
                      <SortHead label="Клиент" id="name" />
                      <SortHead label="Период" />
                      <SortHead label="Группа" />
                      <SortHead label="Начислено" id="accrued" />
                      <SortHead label="Оплачено" id="paid" />
                      <SortHead label="Баланс" id="remaining" />
                      <SortHead label="Статус" id="status" />
                      <TableCell sx={{ fontSize: 11, fontWeight: 800, color: '#8B8C8F', bgcolor: '#F7F8FB', borderBottom: '1px solid #EEF1F6' }}>
                        Действия
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map((row) => {
                      const st = statusSx(row.payStatus);
                      return (
                        <TableRow key={row.key} hover sx={{ '& td': { borderBottom: '1px solid #F3F5F8' } }}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selected.includes(row.key)}
                              onChange={(_, c) =>
                                setSelected((prev) => (c ? [...prev, row.key] : prev.filter((id) => id !== row.key)))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 36, height: 36, fontSize: 12, fontWeight: 800, bgcolor: row.avatar.bg, color: row.avatar.fg }}>
                                {initials(row.clientName)}
                              </Avatar>
                              <Box>
                                <Typography
                                  onClick={() => onOpenClient(row.clientId)}
                                  sx={{ fontSize: 13, fontWeight: 800, color: '#1B2438', cursor: 'pointer', '&:hover': { color: colors.primary } }}
                                >
                                  {row.clientName}
                                </Typography>
                                {row.phone && (
                                  <Typography sx={{ fontSize: 11, color: '#8B8C8F' }}>{row.phone}</Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 600, color: '#5A6275', lineHeight: 1.35 }}>
                            {row.period ? (
                              <>
                                <Box>{format(row.period.from, 'dd.MM.yyyy')} —</Box>
                                <Box>{format(row.period.to, 'dd.MM.yyyy')}</Box>
                              </>
                            ) : (
                              row.periodLabel || '—'
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 600, color: '#5A6275' }}>{row.groupName}</TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 700 }}>{formatMoney(row.membershipPrice)}</TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#12B981' }}>{formatMoney(row.paidAmount)}</TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 800, color: row.remaining > 0 ? '#F93C65' : '#12B981' }}>
                            {formatMoney(row.remaining)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={statusLabel(row.payStatus)}
                              sx={{ height: 24, fontWeight: 800, fontSize: 11, bgcolor: st.bg, color: st.fg, borderRadius: '8px' }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              sx={{ color: '#9AA3B5' }}
                              onClick={() =>
                                row.interactive && row.remaining > 0 ? onReceive(row) : onOpenClient(row.clientId)
                              }
                            >
                              <MoreHoriz sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.25, gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 12, color: '#8B8C8F', fontWeight: 600 }}>
                  Показано {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} из {filtered.length}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Pagination
                    count={pageCount}
                    page={Math.min(page, pageCount)}
                    onChange={(_, p) => setPage(p)}
                    size="small"
                    sx={{
                      '& .Mui-selected': { bgcolor: '#EEF1F6 !important', color: '#1B2438 !important' },
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
                    sx={{ fontSize: 12, borderRadius: '8px', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E9F0' } }}
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
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438', flex: 1 }}>
              Сводка{dateTo ? ` за ${format(dateTo, 'd MMMM', { locale: ru })}` : ''}
            </Typography>
            <Button
              size="small"
              startIcon={<CalendarMonthOutlined sx={{ fontSize: 14 }} />}
              onClick={() => {
                const today = new Date();
                setDateFrom(today);
                setDateTo(today);
                setChip('today');
                onMonthChange(today);
              }}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, color: colors.primary, minWidth: 0 }}
            >
              Сегодня
            </Button>
          </Box>
          <Side color="#12B981" label="Поступления" value={formatMoney(totals.paid)} />
          <Side color="#E07A12" label="Ожидается оплат" value={formatMoney(totals.expected)} />
          <Side color="#F93C65" label="Просрочено" value={formatMoney(totals.overdue)} />
          <Side color={colors.primary} label="Плательщиков" value={String(totals.payers)} />
          <Box sx={{ mt: 1, pt: 1.25, borderTop: '1px solid #EEF1F6', display: 'flex' }}>
            <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 800 }}>Итого за день</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#12B981' }}>{formatMoney(totals.paid)}</Typography>
          </Box>
        </Box>

        <Box sx={{ ...cardSx, p: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Avatar sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: '#E7F8F2', color: '#12B981' }}>
              <PaymentsOutlined sx={{ fontSize: 18 }} />
            </Avatar>
            <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Ожидаемые поступления</Typography>
          </Box>
          <Side color="#12B981" label="В ближайшие 7 дней" value={formatMoney(totals.expected)} />
          <Side color="#12B981" label="В ближайшие 30 дней" value={formatMoney(totals.expected)} />
          <Side color="#1B2438" label="Всего ожидается" value={formatMoney(totals.expected)} />
        </Box>

        <Box sx={{ ...cardSx, p: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ErrorOutline sx={{ color: '#F93C65', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }}>Просроченные счета</Typography>
            <Chip size="small" label={totals.overdueCount} sx={{ height: 22, fontWeight: 800, bgcolor: '#F93C65', color: '#fff' }} />
          </Box>
          <Side color="#F93C65" label="Клиентов с просрочкой" value={String(totals.overdueCount)} />
          <Side color="#F93C65" label="Сумма задолженности" value={formatMoney(totals.overdue)} />
        </Box>

        <Box sx={{ ...cardSx, p: 1.75, bgcolor: '#FFF7F8', borderColor: '#FFD6DE' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <WarningAmberOutlined sx={{ color: '#F93C65', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }}>Требуют внимания</Typography>
            <Chip
              size="small"
              label={totals.overdueCount + totals.partialCount + totals.unpaidCount}
              sx={{ height: 22, fontWeight: 800, bgcolor: '#F93C65', color: '#fff' }}
            />
          </Box>
          <Att
            title="Просроченные оплаты"
            subtitle={`${totals.overdueCount} ${clientsWord(totals.overdueCount)} на ${formatMoney(totals.overdue)}`}
            color="#F93C65"
            onClick={() => setChip('overdue')}
          />
          <Att
            title="Частично оплаченные"
            subtitle={`${totals.partialCount} ${clientsWord(totals.partialCount)} на ${formatMoney(totals.partialSum)}`}
            color="#E07A12"
            onClick={() => setChip('partial')}
          />
          <Att
            title="Без оплаты"
            subtitle={`${totals.unpaidCount} ${clientsWord(totals.unpaidCount)} на ${formatMoney(totals.unpaidSum)}`}
            color="#F93C65"
            onClick={() => setChip('unpaid')}
          />
        </Box>
      </Box>
    </Box>
  );
};

function Metric({
  icon,
  tint,
  title,
  value,
  hint,
  hintColor,
  spark = '#12B981',
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  value: string;
  hint: string;
  hintColor: string;
  spark?: string;
}) {
  return (
    <Box sx={{ ...cardSx, p: '14px 16px', minHeight: 108 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
        <Avatar sx={{ bgcolor: tint, width: 34, height: 34, borderRadius: '10px' }}>{icon}</Avatar>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#5A6275', pt: 0.5 }}>{title}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1B2438', lineHeight: 1.1 }}>{value}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, mt: 0.4 }}>
            {hint.includes('%') && <ArrowUpward sx={{ fontSize: 12, color: hintColor }} />}
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: hintColor }}>{hint}</Typography>
          </Box>
        </Box>
        <Spark color={spark} />
      </Box>
    </Box>
  );
}

function Side({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography sx={{ fontSize: 13, color: '#5A6275', flex: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color }}>{value}</Typography>
    </Box>
  );
}

function Att({ title, subtitle, color, onClick }: { title: string; subtitle: string; color: string; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, cursor: 'pointer', borderRadius: '10px', '&:hover': { bgcolor: 'rgba(249,60,101,0.05)' } }}
    >
      <ErrorOutline sx={{ fontSize: 16, color }} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438' }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: '#8B93A7' }}>{subtitle}</Typography>
      </Box>
      <ChevronRight sx={{ fontSize: 18, color: '#C5CAD6' }} />
    </Box>
  );
}

export default ClientPaymentsBoard;
