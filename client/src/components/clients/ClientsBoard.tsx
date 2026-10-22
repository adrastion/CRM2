import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  CalendarMonthOutlined,
  ChatBubbleOutline,
  CheckCircleOutline,
  Close,
  FileDownloadOutlined,
  GridViewOutlined,
  MoreHoriz,
  MoreVert,
  PeopleAltOutlined,
  PersonOutline,
  Refresh,
  Search,
  SettingsOutlined,
  Star,
  ViewListOutlined,
} from '@mui/icons-material';
import { differenceInYears, format, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Client } from '../../types';
import { colors, radii } from '../../theme/tokens';

export type ClientCategoryTab = 'all' | 'trial' | 'active' | 'inactive' | 'new' | 'vip';

type BranchLite = { id: string; name: string };
type GroupLite = { id: string; name: string; isActive?: boolean; branchId?: string };

type Props = {
  clients: Client[];
  branches: BranchLite[];
  groups: GroupLite[];
  isPromoter?: boolean;
  onAdd: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onEdit: (client: Client) => void;
  onGroupClick?: (client: Client) => void;
  onMembershipClick?: (client: Client) => void;
  onDelete?: (clientId: string) => void;
};

type ClientStatusKey = 'active' | 'trial' | 'inactive';

function fullName(c: Client) {
  return [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ');
}

function initials(c: Client) {
  return `${(c.lastName || '')[0] || ''}${(c.firstName || '')[0] || ''}`.toUpperCase() || '?';
}

function ageLabel(c: Client) {
  if (!c.dateOfBirth) return null;
  const years = differenceInYears(new Date(), new Date(c.dateOfBirth));
  if (!Number.isFinite(years) || years < 0) return null;
  const mod10 = years % 10;
  const mod100 = years % 100;
  const word =
    mod10 === 1 && mod100 !== 11 ? 'год' : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 'года' : 'лет';
  return `${years} ${word}`;
}

function isTrialClient(c: Client) {
  return (c.groupMemberships || []).some((gm: any) => gm.isActive && gm.isTrial);
}

function isVipClient(c: Client) {
  return Boolean((c as any).isVip || (c.achievements || []).length >= 1);
}

function isNewClient(c: Client) {
  if (!c.createdAt) return false;
  const d = new Date(c.createdAt);
  return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
}

function clientStatus(c: Client): ClientStatusKey {
  if (isTrialClient(c)) return 'trial';
  if (c.activeMembership && c.activeMembership.isActive) {
    if (c.activeMembership.endDate && new Date(c.activeMembership.endDate) < new Date()) {
      return 'inactive';
    }
    if (c.activeMembership.remaining != null && c.activeMembership.remaining < 0) return 'inactive';
    return 'active';
  }
  if (c.athleteStatus === 'active' && (c.groupMemberships || []).some((gm: any) => gm.isActive && !gm.isTrial)) {
    return 'active';
  }
  return 'inactive';
}

function primaryGroup(c: Client): { name: string; branch: string | null; isTrial: boolean } {
  const active = (c.groupMemberships || []).filter((gm: any) => gm.isActive);
  if (!active.length) return { name: '—', branch: null, isTrial: false };
  const gm = active[0] as any;
  return {
    name: gm.group?.name || 'Группа',
    branch: gm.group?.branch?.name || null,
    isTrial: Boolean(gm.isTrial),
  };
}

function membershipInfo(c: Client): { title: string; sub: string; expired: boolean } {
  const m = c.activeMembership;
  if (!m) {
    if (isTrialClient(c)) return { title: 'Пробное занятие', sub: '1 из 3', expired: false };
    return { title: 'Нет абонемента', sub: '—', expired: true };
  }
  if (m.endDate && new Date(m.endDate) < new Date()) {
    return {
      title: 'Истек',
      sub: `с ${format(new Date(m.endDate), 'dd.MM.yyyy')}`,
      expired: true,
    };
  }
  if (m.visitsTotal != null) {
    return {
      title: m.name || 'Абонемент',
      sub: `${m.visitsUsed} из ${m.visitsTotal}`,
      expired: false,
    };
  }
  return {
    title: m.name || 'Абонемент',
    sub: m.endDate ? `до ${format(new Date(m.endDate), 'dd.MM.yyyy')}` : 'Без срока',
    expired: false,
  };
}

function attendanceInfo(c: Client): { pct: number; label: string; danger: boolean } | null {
  const m = c.activeMembership;
  if (!m || m.visitsTotal == null || m.visitsTotal <= 0) return null;
  const used = Math.min(m.visitsUsed, m.visitsTotal);
  const pct = Math.round((used / m.visitsTotal) * 100);
  return {
    pct,
    label: `${used} из ${m.visitsTotal}`,
    danger: pct < 30,
  };
}

function formatBalance(value?: number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0 ₽';
  const abs = Math.abs(n).toLocaleString('ru-RU');
  return n < 0 ? `−${abs} ₽` : `${abs} ₽`;
}

function nextLessonLabel(c: Client): { main: string; sub: string; accent?: string } {
  const nt = (c as any).nextTraining;
  if (!nt?.startTime) return { main: 'Нет записей', sub: '' };
  const start = new Date(nt.startTime);
  const end = nt.endTime ? new Date(nt.endTime) : null;
  const time = end
    ? `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`
    : format(start, 'HH:mm');
  if (isToday(start)) return { main: 'Сегодня', sub: time, accent: colors.primary };
  if (isTomorrow(start)) return { main: 'Завтра', sub: time };
  return { main: format(start, 'd MMM', { locale: ru }), sub: time };
}

const STATUS_CHIP: Record<ClientStatusKey, { label: string; bg: string; fg: string }> = {
  active: { label: 'Активен', bg: '#D1FAE5', fg: '#059669' },
  trial: { label: 'Пробное', bg: '#EDE9FE', fg: '#7C3AED' },
  inactive: { label: 'Неактивен', bg: '#FEE2E2', fg: '#DC2626' },
};

function Sparkline({ color }: { color: string }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 80 28"
      sx={{ width: 72, height: 28, flexShrink: 0 }}
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="0,20 12,16 24,18 36,10 48,14 60,6 80,8"
      />
    </Box>
  );
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: `${radii.panel}px`,
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
};

const ClientsBoard: React.FC<Props> = ({
  clients,
  branches,
  groups,
  isPromoter,
  onAdd,
  onExport,
  onImport,
  onEdit,
  onGroupClick,
  onMembershipClick,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [membershipFilter, setMembershipFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tab, setTab] = useState<ClientCategoryTab>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moreEl, setMoreEl] = useState<null | HTMLElement>(null);
  const [addEl, setAddEl] = useState<null | HTMLElement>(null);
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; client: Client } | null>(null);

  const counts = useMemo(() => {
    let trial = 0;
    let active = 0;
    let inactive = 0;
    let neu = 0;
    let vip = 0;
    for (const c of clients) {
      const st = clientStatus(c);
      if (st === 'trial') trial += 1;
      else if (st === 'active') active += 1;
      else inactive += 1;
      if (isNewClient(c)) neu += 1;
      if (isVipClient(c)) vip += 1;
    }
    return { all: clients.length, trial, active, inactive, neu, vip };
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (q) {
        const hay = [fullName(c), c.phone || '', c.email || ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (branchId) {
        const ok = (c.groupMemberships || []).some(
          (gm: any) => gm.isActive && (gm.group?.branchId === branchId || gm.group?.branch?.id === branchId)
        );
        if (!ok) return false;
      }
      if (groupId) {
        const ok = (c.groupMemberships || []).some(
          (gm: any) => gm.isActive && (gm.groupId === groupId || gm.group?.id === groupId)
        );
        if (!ok) return false;
      }
      if (statusFilter) {
        if (clientStatus(c) !== statusFilter) return false;
      }
      if (membershipFilter === 'none' && c.activeMembership) return false;
      if (membershipFilter === 'active' && !c.activeMembership) return false;
      if (membershipFilter === 'expired') {
        const m = c.activeMembership;
        if (!m?.endDate || new Date(m.endDate) >= new Date()) return false;
      }
      if (sourceFilter) {
        const src = (c as any).source || ((c as any).createdByUserId ? 'promoter' : 'manual');
        if (src !== sourceFilter) return false;
      }
      if (tab === 'trial' && clientStatus(c) !== 'trial') return false;
      if (tab === 'active' && clientStatus(c) !== 'active') return false;
      if (tab === 'inactive' && clientStatus(c) !== 'inactive') return false;
      if (tab === 'new' && !isNewClient(c)) return false;
      if (tab === 'vip' && !isVipClient(c)) return false;
      return true;
    });
  }, [clients, search, branchId, groupId, statusFilter, membershipFilter, sourceFilter, tab]);

  const resetFilters = () => {
    setSearch('');
    setBranchId('');
    setGroupId('');
    setStatusFilter('');
    setMembershipFilter('');
    setSourceFilter('');
    setTab('all');
  };

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tabs: Array<{ key: ClientCategoryTab; label: string; count: number }> = [
    { key: 'all', label: 'Все клиенты', count: counts.all },
    { key: 'trial', label: 'Пробные', count: counts.trial },
    { key: 'active', label: 'Активные', count: counts.active },
    { key: 'inactive', label: 'Неактивные', count: counts.inactive },
    { key: 'new', label: 'Новые', count: counts.neu },
    { key: 'vip', label: 'VIP', count: counts.vip },
  ];

  const kpi = [
    {
      title: 'Всего клиентов',
      value: counts.all,
      delta: '+12%',
      deltaUp: true,
      hint: 'за последний месяц',
      icon: <PeopleAltOutlined sx={{ fontSize: 20 }} />,
      iconBg: '#EEF4FF',
      iconFg: colors.primary,
      spark: colors.primary,
    },
    {
      title: 'Активные',
      value: counts.active,
      delta: '+8%',
      deltaUp: true,
      hint: 'с действующим абонементом',
      icon: <CheckCircleOutline sx={{ fontSize: 20 }} />,
      iconBg: '#D1FAE5',
      iconFg: '#059669',
      spark: '#12B981',
    },
    {
      title: 'Пробные занятия',
      value: counts.trial,
      delta: '+6%',
      deltaUp: true,
      hint: 'за последний месяц',
      icon: <PersonOutline sx={{ fontSize: 20 }} />,
      iconBg: '#EDE9FE',
      iconFg: '#7C3AED',
      spark: '#8B5CF6',
    },
    {
      title: 'Неактивные',
      value: counts.inactive,
      delta: '−4%',
      deltaUp: false,
      hint: 'более 30 дней',
      icon: <Close sx={{ fontSize: 18 }} />,
      iconBg: '#FEE2E2',
      iconFg: '#DC2626',
      spark: '#EF4444',
    },
  ];

  const filteredGroups = groups.filter((g) => g.isActive !== false && (!branchId || g.branchId === branchId));

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, md: 26 }, color: '#1B2438', letterSpacing: '-0.03em' }}>
            Клиенты
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: '#8B93A7', fontWeight: 600, mt: 0.35 }}>
            Управление клиентской базой, абонементами и посещаемостью
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {!isPromoter && (
            <>
              <Button
                startIcon={<MoreHoriz />}
                onClick={(e) => setMoreEl(e.currentTarget)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '1px solid #EEF1F6',
                  color: '#5A6275',
                  bgcolor: '#fff',
                }}
              >
                Еще действия
              </Button>
              <Menu anchorEl={moreEl} open={Boolean(moreEl)} onClose={() => setMoreEl(null)}>
                {onExport && (
                  <MenuItem
                    onClick={() => {
                      setMoreEl(null);
                      onExport();
                    }}
                  >
                    Экспорт в Excel
                  </MenuItem>
                )}
                {onImport && (
                  <MenuItem
                    onClick={() => {
                      setMoreEl(null);
                      onImport();
                    }}
                  >
                    Импорт из Excel
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            endIcon={<Box component="span" sx={{ fontSize: 10, opacity: 0.8 }}>▾</Box>}
            onClick={(e) => setAddEl(e.currentTarget)}
            sx={{
              textTransform: 'none',
              fontWeight: 750,
              borderRadius: `${radii.button}px`,
              bgcolor: colors.primary,
              boxShadow: 'none',
              px: 2,
              '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
            }}
            data-onboarding="add-client-button"
          >
            Добавить клиента
          </Button>
          <Menu anchorEl={addEl} open={Boolean(addEl)} onClose={() => setAddEl(null)}>
            <MenuItem
              onClick={() => {
                setAddEl(null);
                onAdd();
              }}
            >
              Новый клиент
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {/* KPI */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2,
        }}
      >
        {kpi.map((k) => (
          <Box key={k.title} sx={{ ...cardSx, p: 1.75 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: k.iconBg,
                  color: k.iconFg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {k.icon}
              </Box>
              <Sparkline color={k.spark} />
            </Stack>
            <Typography sx={{ mt: 1.25, fontSize: 12.5, fontWeight: 700, color: '#8B93A7' }}>
              {k.title}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 22, color: '#1B2438', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {k.value}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: k.deltaUp ? '#059669' : '#DC2626',
                }}
              >
                {k.deltaUp ? '↑' : '↓'}
                {k.delta}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8B93A7' }}>{k.hint}</Typography>
            </Stack>
          </Box>
        ))}
      </Box>

      {/* Filters */}
      <Box sx={{ ...cardSx, p: 1.5, mb: 1.5 }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1}
          alignItems={{ lg: 'flex-end' }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            size="small"
            placeholder="Поиск по ФИО, телефону, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              flex: { lg: '1 1 220px' },
              minWidth: { xs: '100%', lg: 220 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',
                bgcolor: '#F7F8FB',
                '& fieldset': { borderColor: 'transparent' },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
          />
          {!isPromoter && (
            <>
              <FilterSelect
                label="Филиал"
                value={branchId}
                onChange={setBranchId}
                options={[
                  { value: '', label: 'Все филиалы' },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
              <FilterSelect
                label="Группа"
                value={groupId}
                onChange={setGroupId}
                options={[
                  { value: '', label: 'Все группы' },
                  ...filteredGroups.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
              <FilterSelect
                label="Статус"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: '', label: 'Все статусы' },
                  { value: 'active', label: 'Активен' },
                  { value: 'trial', label: 'Пробное' },
                  { value: 'inactive', label: 'Неактивен' },
                ]}
              />
              <FilterSelect
                label="Абонемент"
                value={membershipFilter}
                onChange={setMembershipFilter}
                options={[
                  { value: '', label: 'Все типы' },
                  { value: 'active', label: 'Действующий' },
                  { value: 'expired', label: 'Истек' },
                  { value: 'none', label: 'Нет абонемента' },
                ]}
              />
              <FilterSelect
                label="Источник"
                value={sourceFilter}
                onChange={setSourceFilter}
                options={[
                  { value: '', label: 'Все источники' },
                  { value: 'manual', label: 'Вручную' },
                  { value: 'promoter', label: 'Промоутер' },
                ]}
              />
            </>
          )}
          <Button
            startIcon={<Refresh />}
            onClick={resetFilters}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: '#8B93A7',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
            }}
          >
            Сбросить
          </Button>
        </Stack>
      </Box>

      {/* Tabs + view controls */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1.25 }}
      >
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Box
                key={t.key}
                onClick={() => setTab(t.key)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.85,
                  borderRadius: '999px',
                  cursor: 'pointer',
                  bgcolor: active ? colors.primary : 'transparent',
                  color: active ? '#fff' : '#5A6275',
                  fontWeight: 750,
                  fontSize: 13,
                  border: active ? 'none' : '1px solid transparent',
                  '&:hover': { bgcolor: active ? colors.primary : '#F0F2F7' },
                }}
              >
                {t.label}
                <Box
                  component="span"
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    px: 0.7,
                    py: 0.15,
                    borderRadius: '999px',
                    bgcolor: active ? 'rgba(255,255,255,0.22)' : '#EEF1F6',
                    color: active ? '#fff' : '#8B93A7',
                  }}
                >
                  {t.count}
                </Box>
              </Box>
            );
          })}
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <IconButton size="small" sx={{ border: '1px solid #EEF1F6', borderRadius: '8px', color: colors.primary }}>
            <ViewListOutlined fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ border: '1px solid #EEF1F6', borderRadius: '8px', color: '#8B93A7' }}>
            <GridViewOutlined fontSize="small" />
          </IconButton>
          {onExport && (
            <Button
              size="small"
              startIcon={<FileDownloadOutlined />}
              onClick={onExport}
              sx={{ textTransform: 'none', fontWeight: 700, color: '#5A6275' }}
            >
              Экспорт
            </Button>
          )}
          <IconButton size="small" sx={{ color: '#8B93A7' }}>
            <SettingsOutlined fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* Table */}
      <Box sx={{ ...cardSx, overflow: 'auto' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns:
              '40px minmax(180px,1.3fr) minmax(150px,1.1fr) 100px minmax(120px,1fr) minmax(110px,0.95fr) minmax(110px,0.9fr) 90px minmax(100px,0.85fr) 88px',
            gap: 1,
            px: 1.5,
            py: 1.1,
            borderBottom: '1px solid #EEF1F6',
            bgcolor: '#FAFBFD',
            minWidth: 1100,
            alignItems: 'center',
          }}
        >
          <Checkbox size="small" checked={allSelected} onChange={toggleAll} sx={{ p: 0.5 }} />
          {[
            'Клиент',
            'Контакты',
            'Статус',
            'Группа / Филиал',
            'Абонемент',
            'Посещаемость',
            'Баланс',
            'Следующее занятие',
            'Действия',
          ].map((h) => (
            <Typography key={h} sx={{ fontSize: 11.5, fontWeight: 800, color: '#8B93A7', letterSpacing: '0.02em' }}>
              {h}
            </Typography>
          ))}
        </Box>

        {filtered.map((c, idx) => {
          const st = STATUS_CHIP[clientStatus(c)];
          const grp = primaryGroup(c);
          const mem = membershipInfo(c);
          const att = attendanceInfo(c);
          const next = nextLessonLabel(c);
          const bal = Number(c.balance ?? 0);
          const age = ageLabel(c);
          const vip = isVipClient(c);

          return (
            <Box
              key={c.id}
              sx={{
                display: 'grid',
                gridTemplateColumns:
                  '40px minmax(180px,1.3fr) minmax(150px,1.1fr) 100px minmax(120px,1fr) minmax(110px,0.95fr) minmax(110px,0.9fr) 90px minmax(100px,0.85fr) 88px',
                gap: 1,
                px: 1.5,
                py: 1.15,
                minWidth: 1100,
                alignItems: 'center',
                borderBottom: '1px solid #F1F3F7',
                bgcolor: idx % 2 === 1 ? '#FAFBFD' : '#fff',
                '&:hover': { bgcolor: '#F5F8FF' },
                cursor: 'pointer',
              }}
              onClick={() => onEdit(c)}
            >
              <Checkbox
                size="small"
                checked={selected.has(c.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggleOne(c.id)}
                sx={{ p: 0.5 }}
              />

              <Stack direction="row" spacing={1.1} alignItems="center" minWidth={0}>
                <Avatar
                  src={c.photo || undefined}
                  sx={{
                    width: 36,
                    height: 36,
                    fontSize: 12,
                    fontWeight: 800,
                    bgcolor: '#E8EEFF',
                    color: colors.primary,
                  }}
                >
                  {initials(c)}
                </Avatar>
                <Box minWidth={0}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography
                      sx={{
                        fontWeight: 750,
                        fontSize: 13.5,
                        color: '#1B2438',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {fullName(c)}
                    </Typography>
                    {vip && (
                      <Chip
                        size="small"
                        icon={<Star sx={{ fontSize: '12px !important', color: '#fff !important' }} />}
                        label="VIP"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 800,
                          bgcolor: '#F59E0B',
                          color: '#fff',
                          '& .MuiChip-icon': { ml: 0.5 },
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    )}
                  </Stack>
                  {age && (
                    <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: '#8B93A7' }}>{age}</Typography>
                  )}
                </Box>
              </Stack>

              <Box minWidth={0}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: '#1B2438', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.phone || '—'}
                </Typography>
                <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#8B93A7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.email || '—'}
                </Typography>
              </Box>

              <Chip
                size="small"
                label={st.label}
                sx={{
                  height: 24,
                  fontWeight: 750,
                  fontSize: 11.5,
                  bgcolor: st.bg,
                  color: st.fg,
                  borderRadius: '999px',
                  width: 'fit-content',
                }}
              />

              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  onGroupClick?.(c);
                }}
                sx={{ minWidth: 0 }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#1B2438', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {grp.name}
                </Typography>
                <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#8B93A7' }}>
                  {grp.branch ? `Филиал: ${grp.branch}` : '—'}
                </Typography>
              </Box>

              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  onMembershipClick?.(c);
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 750,
                    color: mem.expired ? '#DC2626' : '#1B2438',
                  }}
                >
                  {mem.title}
                </Typography>
                <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#8B93A7' }}>{mem.sub}</Typography>
              </Box>

              <Box>
                {att ? (
                  <>
                    <LinearProgress
                      variant="determinate"
                      value={att.pct}
                      sx={{
                        height: 6,
                        borderRadius: 99,
                        bgcolor: '#EEF1F6',
                        mb: 0.5,
                        '& .MuiLinearProgress-bar': {
                          bgcolor: att.danger ? '#EF4444' : '#12B981',
                          borderRadius: 99,
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#8B93A7' }}>
                      {att.label}
                    </Typography>
                  </>
                ) : (
                  <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: '#8B93A7' }}>—</Typography>
                )}
              </Box>

              <Typography
                sx={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: bal < 0 ? '#DC2626' : '#1B2438',
                }}
              >
                {formatBalance(bal)}
              </Typography>

              <Box>
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 750,
                    color: next.accent || (next.main === 'Нет записей' ? '#8B93A7' : '#1B2438'),
                  }}
                >
                  {next.main}
                </Typography>
                {next.sub && (
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#8B93A7' }}>{next.sub}</Typography>
                )}
              </Box>

              <Stack direction="row" spacing={0.25} onClick={(e) => e.stopPropagation()}>
                <IconButton size="small" sx={{ color: colors.primary }} onClick={() => onEdit(c)}>
                  <CalendarMonthOutlined fontSize="small" />
                </IconButton>
                <IconButton size="small" sx={{ color: '#8B93A7' }}>
                  <ChatBubbleOutline fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  sx={{ color: '#8B93A7' }}
                  onClick={(e) => setRowMenu({ el: e.currentTarget, client: c })}
                >
                  <MoreVert fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          );
        })}

        {!filtered.length && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#8B93A7', fontWeight: 650, mb: 1.5 }}>Клиенты не найдены</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={onAdd} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Добавить клиента
            </Button>
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={rowMenu?.el}
        open={Boolean(rowMenu)}
        onClose={() => setRowMenu(null)}
      >
        <MenuItem
          onClick={() => {
            if (rowMenu) onEdit(rowMenu.client);
            setRowMenu(null);
          }}
        >
          Открыть карточку
        </MenuItem>
        {onGroupClick && (
          <MenuItem
            onClick={() => {
              if (rowMenu) onGroupClick(rowMenu.client);
              setRowMenu(null);
            }}
          >
            Группы
          </MenuItem>
        )}
        {onMembershipClick && (
          <MenuItem
            onClick={() => {
              if (rowMenu) onMembershipClick(rowMenu.client);
              setRowMenu(null);
            }}
          >
            Абонемент
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem
            onClick={() => {
              if (rowMenu) onDelete(rowMenu.client.id);
              setRowMenu(null);
            }}
            sx={{ color: '#DC2626' }}
          >
            Удалить
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 140, flex: '0 0 auto' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 750, color: '#8B93A7', mb: 0.35 }}>{label}</Typography>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        displayEmpty
        sx={{
          borderRadius: '10px',
          fontWeight: 650,
          fontSize: 13,
          bgcolor: '#F7F8FB',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
        }}
      >
        {options.map((o) => (
          <MenuItem key={o.value || 'all'} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default ClientsBoard;
