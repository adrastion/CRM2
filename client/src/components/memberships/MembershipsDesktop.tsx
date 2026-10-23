import React, { useMemo, useState } from 'react';
import {
  ArchiveOutlined,
  ContentCopyOutlined,
  EditOutlined,
  GroupsOutlined,
  MoreHoriz,
  PersonAddAlt1Outlined,
  Replay,
  Search,
  SellOutlined,
  TimerOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  OutlinedInput,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Membership } from '../../types';
import { colors, radii, typography } from '../../theme/tokens';
import MetricCard from '../dashboard/MetricCard';

interface MembershipStats {
  total: number;
  active: number;
  expiringSoon: number;
  assignedClients: number;
  deltas?: Partial<Record<'total' | 'active' | 'expiringSoon' | 'assignedClients', number | null>>;
}

interface BranchOption {
  id: string;
  name: string;
}

interface MembershipsDesktopProps {
  items: Membership[];
  stats: MembershipStats;
  branches: BranchOption[];
  loading: boolean;
  mergeTargetId: string;
  mergeSourceIds: string[];
  merging: boolean;
  onMergeTargetChange: (id: string) => void;
  onMergeSourcesChange: (ids: string[]) => void;
  onMerge: () => void;
  onCreate: () => void;
  onEdit: (membership: Membership) => void;
  onAssign: (membership: Membership) => void;
  onDuplicate: (membership: Membership) => void;
  onArchive: (membership: Membership) => void;
  onRestore: (membership: Membership) => void;
  onDelete: (membership: Membership) => void;
}

type CategoryTab = 'ALL' | 'CLIENT' | 'GROUP' | 'PERSONAL' | 'ARCHIVE';

const categoryLabel = (category?: string) => {
  if (category === 'GROUP') return 'Групповой';
  if (category === 'PERSONAL') return 'Персональный';
  return 'Клиентский';
};

const categoryColors = (category?: string) => {
  if (category === 'GROUP') return { bg: '#F1E9FF', fg: '#7E57C2' };
  if (category === 'PERSONAL') return { bg: '#FFE8F0', fg: '#E83E78' };
  return { bg: '#E8F1FF', fg: colors.primary };
};

const periodLabel = (membership: Membership) => {
  if (membership.category === 'GROUP') return '1 месяц';
  if (membership.periodMonths) {
    return `${membership.periodMonths} ${membership.periodMonths === 1 ? 'месяц' : 'мес.'}`;
  }
  const days = membership.validityDays ?? membership.duration;
  if (days) return `${days} дней`;
  return membership.visits == null ? 'Без срока' : '—';
};

const statusOf = (membership: Membership) => {
  if (membership.archivedAt) return 'archive';
  if ((membership.expiringSoonCount || 0) > 0) return 'expiring';
  return membership.isActive === false ? 'inactive' : 'active';
};

const statusMeta = (membership: Membership) => {
  const status = statusOf(membership);
  if (status === 'archive') return { label: 'Архив', bg: '#ECEEF2', fg: '#737983' };
  if (status === 'expiring') return { label: 'Скоро истекает', bg: '#FFF2D9', fg: '#E68A00' };
  if (status === 'inactive') return { label: 'Неактивен', bg: '#FFE9EE', fg: colors.danger };
  return { label: 'Активен', bg: '#E3F8F2', fg: colors.success };
};

const groupsAndBranches = (membership: Membership) => {
  const groupNames = (membership.membershipGroups || [])
    .map((binding) => binding.group?.name)
    .filter(Boolean);
  const branchNames = Array.from(
    new Set(
      (membership.membershipGroups || [])
        .map((binding) => binding.group?.branch?.name)
        .filter(Boolean)
    )
  );
  return [...branchNames, ...groupNames].join(' · ') || 'Все филиалы';
};

const KPI_ICON_SX = (background: string, color: string) => ({
  width: 36,
  height: 36,
  borderRadius: '10px',
  bgcolor: background,
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': { fontSize: 20 },
});

const MembershipsDesktop: React.FC<MembershipsDesktopProps> = ({
  items,
  stats,
  branches,
  loading,
  mergeTargetId,
  mergeSourceIds,
  merging,
  onMergeTargetChange,
  onMergeSourcesChange,
  onMerge,
  onCreate,
  onEdit,
  onAssign,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuMembership, setMenuMembership] = useState<Membership | null>(null);

  const counts = useMemo(
    () => ({
      ALL: items.length,
      CLIENT: items.filter((item) => item.category !== 'GROUP' && item.category !== 'PERSONAL' && !item.archivedAt).length,
      GROUP: items.filter((item) => item.category === 'GROUP' && !item.archivedAt).length,
      PERSONAL: items.filter((item) => item.category === 'PERSONAL' && !item.archivedAt).length,
      ARCHIVE: items.filter((item) => Boolean(item.archivedAt)).length,
    }),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((membership) => {
      if (categoryTab === 'ARCHIVE' && !membership.archivedAt) return false;
      if (categoryTab !== 'ALL' && categoryTab !== 'ARCHIVE') {
        const category = membership.category || 'CLIENT';
        if (category !== categoryTab || membership.archivedAt) return false;
      }
      if (typeFilter !== 'ALL' && (membership.category || 'CLIENT') !== typeFilter) return false;
      if (
        branchFilter !== 'ALL' &&
        !(membership.membershipGroups || []).some(
          (binding) => binding.group?.branchId === branchFilter
        )
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && statusOf(membership) !== statusFilter) return false;
      if (periodFilter === 'SHORT' && (membership.validityDays || membership.duration || 999) > 14) return false;
      if (
        periodFilter === 'MONTH' &&
        membership.periodMonths !== 1 &&
        !((membership.validityDays || membership.duration || 0) >= 15 &&
          (membership.validityDays || membership.duration || 0) <= 31)
      ) {
        return false;
      }
      if (
        periodFilter === 'LONG' &&
        !((membership.periodMonths || 0) > 1 || (membership.validityDays || membership.duration || 0) > 31)
      ) {
        return false;
      }
      if (
        periodFilter === 'UNLIMITED' &&
        !(membership.visits == null && !membership.validityDays && !membership.periodMonths)
      ) {
        return false;
      }
      if (
        query &&
        !membership.name.toLowerCase().includes(query) &&
        !(membership.description || '').toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [items, search, categoryTab, typeFilter, branchFilter, statusFilter, periodFilter]);

  const resetFilters = () => {
    setSearch('');
    setCategoryTab('ALL');
    setTypeFilter('ALL');
    setBranchFilter('ALL');
    setStatusFilter('ALL');
    setPeriodFilter('ALL');
  };

  const exportRows = async () => {
    const XLSX = await import('xlsx');
    const rows = filteredItems.map((membership) => ({
      Название: membership.name,
      Тип: categoryLabel(membership.category),
      Цена: Number(membership.price),
      'Срок действия': periodLabel(membership),
      Занятий: membership.visits == null ? 'Безлимит' : membership.visits,
      'Назначено клиентам': membership.assignedClientsCount || 0,
      'Филиалы / группы': groupsAndBranches(membership),
      Статус: statusMeta(membership).label,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Абонементы');
    XLSX.writeFile(workbook, `Абонементы_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const selectableVisibleItems = filteredItems.filter((item) => item.id !== mergeTargetId);
  const allVisibleSelected =
    selectableVisibleItems.length > 0 &&
    selectableVisibleItems.every((item) => mergeSourceIds.includes(item.id));

  const toggleAll = () => {
    const visibleIds = selectableVisibleItems.map((item) => item.id);
    if (allVisibleSelected) {
      onMergeSourcesChange(mergeSourceIds.filter((id) => !visibleIds.includes(id)));
    } else {
      onMergeSourcesChange(Array.from(new Set([...mergeSourceIds, ...visibleIds])));
    }
  };

  const tabs: Array<{ id: CategoryTab; label: string }> = [
    { id: 'ALL', label: 'Все' },
    { id: 'CLIENT', label: 'Клиентские' },
    { id: 'GROUP', label: 'Групповые' },
    { id: 'PERSONAL', label: 'Персональные' },
    { id: 'ARCHIVE', label: 'Архив' },
  ];

  return (
    <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md }, fontWeight: 800, lineHeight: 1.2, color: '#1B2438', letterSpacing: '-0.02em' }}>
            Абонементы
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: typography.label, color: '#8B93A7', fontWeight: 600 }}>
            Создавайте тарифы, управляйте сроками действия и назначайте абонементы клиентам.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Box component="span" sx={{ fontSize: 18, lineHeight: 1 }}>+</Box>}
          onClick={onCreate}
          sx={{
            minHeight: 40,
            px: 1.75,
            borderRadius: `${radii.button}px`,
            textTransform: 'none',
            fontSize: typography.label,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(47,107,255,0.25)',
          }}
        >
          Создать абонемент
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1.25 }}>
        <MetricCard
          label="Всего абонементов"
          value={stats.total}
          icon={<Box sx={KPI_ICON_SX('#E7F0FF', colors.primary)}><SellOutlined /></Box>}
          designIcon
          trend={stats.deltas?.total}
          trendLabel="за последний месяц"
          sparkline
          sparkColor={colors.primary}
        />
        <MetricCard
          label="Активные"
          value={stats.active}
          icon={<Box sx={KPI_ICON_SX('#DDF8EE', colors.success)}><PersonAddAlt1Outlined /></Box>}
          designIcon
          trend={stats.deltas?.active}
          trendLabel="за последний месяц"
          sparkline
          sparkColor={colors.success}
        />
        <MetricCard
          label="Скоро истекают"
          value={stats.expiringSoon}
          icon={<Box sx={KPI_ICON_SX('#FFF1DD', '#F28C28')}><TimerOutlined /></Box>}
          designIcon
          trend={stats.deltas?.expiringSoon}
          trendLabel="в течение 7 дней"
          sparkline
          sparkColor="#F28C28"
        />
        <MetricCard
          label="Назначено клиентам"
          value={stats.assignedClients}
          icon={<Box sx={KPI_ICON_SX('#F0E8FF', '#8A48D7')}><GroupsOutlined /></Box>}
          designIcon
          trend={stats.deltas?.assignedClients}
          trendLabel="за последний месяц"
          sparkline
          sparkColor="#8A48D7"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(205px, 2fr) repeat(4, minmax(95px, 1fr)) auto auto',
          gap: 0.75,
          alignItems: 'center',
        }}
      >
        <TextField
          size="small"
          placeholder="Поиск по названию абонемента…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment>,
          }}
          sx={{ '& .MuiOutlinedInput-root': { height: 40, bgcolor: colors.card, fontSize: typography.label } }}
        />
        <Select size="small" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} sx={{ height: 40, bgcolor: colors.card, fontSize: typography.label }}>
          <MenuItem value="ALL">Все типы</MenuItem>
          <MenuItem value="CLIENT">Клиентские</MenuItem>
          <MenuItem value="GROUP">Групповые</MenuItem>
          <MenuItem value="PERSONAL">Персональные</MenuItem>
        </Select>
        <Select size="small" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} sx={{ height: 40, bgcolor: colors.card, fontSize: typography.label }}>
          <MenuItem value="ALL">Все филиалы</MenuItem>
          {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
        </Select>
        <Select size="small" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ height: 40, bgcolor: colors.card, fontSize: typography.label }}>
          <MenuItem value="ALL">Все статусы</MenuItem>
          <MenuItem value="active">Активные</MenuItem>
          <MenuItem value="expiring">Скоро истекают</MenuItem>
          <MenuItem value="inactive">Неактивные</MenuItem>
          <MenuItem value="archive">Архив</MenuItem>
        </Select>
        <Select size="small" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} sx={{ height: 40, bgcolor: colors.card, fontSize: typography.label }}>
          <MenuItem value="ALL">Все периоды</MenuItem>
          <MenuItem value="SHORT">До 14 дней</MenuItem>
          <MenuItem value="MONTH">1 месяц</MenuItem>
          <MenuItem value="LONG">Больше месяца</MenuItem>
          <MenuItem value="UNLIMITED">Без срока</MenuItem>
        </Select>
        <Button onClick={exportRows} variant="outlined" sx={{ height: 40, px: 1.25, minWidth: 72, textTransform: 'none', fontSize: typography.label, fontWeight: 600 }}>
          Экспорт
        </Button>
        <Button onClick={resetFilters} startIcon={<Replay sx={{ fontSize: 18 }} />} sx={{ height: 40, px: 1.25, minWidth: 72, textTransform: 'none', fontSize: typography.label, fontWeight: 600, color: colors.textMuted }}>
          Сбросить
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {tabs.map((tab) => {
          const active = categoryTab === tab.id;
          return (
            <Button
              key={tab.id}
              onClick={() => setCategoryTab(tab.id)}
              sx={{
                minWidth: 0,
                px: 1.5,
                height: 32,
                borderRadius: '12px',
                textTransform: 'none',
                fontSize: typography.label,
                fontWeight: 600,
                bgcolor: active ? colors.primary : '#EEF0F5',
                color: active ? colors.white : colors.textMuted,
                '&:hover': { bgcolor: active ? colors.primaryDark : '#E5E8EF' },
              }}
            >
              {tab.label}
              <Box component="span" sx={{ ml: 0.65, px: 0.65, py: 0.05, borderRadius: 99, bgcolor: active ? 'rgba(255,255,255,0.2)' : '#E2E6EE', fontSize: typography.label, fontWeight: 700 }}>
                {counts[tab.id]}
              </Box>
            </Button>
          );
        })}
      </Box>

      {items.length >= 2 && (
        <Box sx={{ p: 1.25, border: `1px solid ${colors.divider}`, borderRadius: `${radii.panel}px`, bgcolor: colors.card }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.75 }}>
            <Box sx={KPI_ICON_SX('#F0E8FF', '#8A48D7')}><SellOutlined /></Box>
            <Box>
              <Typography sx={{ fontSize: typography.label, fontWeight: 700 }}>Объединить абонементы</Typography>
              <Typography sx={{ fontSize: typography.label, color: colors.textHint }}>Клиенты и группы перенесутся на выбранный целевой абонемент.</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr auto', gap: 0.75 }}>
            <FormControl size="small">
              <Select displayEmpty value={mergeTargetId} onChange={(event) => onMergeTargetChange(String(event.target.value))} sx={{ height: 40, fontSize: typography.label }}>
                <MenuItem value=""><em>Выберите целевой абонемент…</em></MenuItem>
                {items.filter((item) => !item.archivedAt && !mergeSourceIds.includes(item.id)).map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select
                multiple
                displayEmpty
                value={mergeSourceIds}
                onChange={(event) => onMergeSourcesChange(event.target.value as string[])}
                input={<OutlinedInput />}
                renderValue={(selected) => selected.length ? `${selected.length} выбрано` : <em>Выберите абонементы для объединения…</em>}
                sx={{ height: 40, fontSize: typography.label }}
              >
                {items.filter((item) => item.id !== mergeTargetId).map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    <Checkbox size="small" checked={mergeSourceIds.includes(item.id)} />
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={onMerge} disabled={merging || !mergeTargetId || mergeSourceIds.length === 0} sx={{ height: 40, textTransform: 'none', fontSize: typography.label, fontWeight: 600 }}>
              {merging ? 'Объединение…' : 'Объединить'}
            </Button>
          </Box>
        </Box>
      )}

      <TableContainer sx={{ bgcolor: colors.card, borderRadius: `${radii.panel}px`, border: `1px solid ${colors.divider}`, overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1060 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F7F8FB' }}>
              <TableCell padding="checkbox"><Checkbox size="small" checked={allVisibleSelected} onChange={toggleAll} /></TableCell>
              {['Название абонемента', 'Тип', 'Цена', 'Срок действия', 'Занятий', 'Применён к клиентам', 'Филиалы / Группы', 'Статус', 'Действия'].map((label) => (
                <TableCell key={label} sx={{ py: 1, px: 1, fontSize: typography.label, fontWeight: 800, color: '#8B93A7', whiteSpace: 'nowrap' }}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}>Загрузка…</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: colors.textHint }}>Ничего не найдено</TableCell></TableRow>
            ) : filteredItems.map((membership) => {
              const category = categoryColors(membership.category);
              const status = statusMeta(membership);
              const selected = mergeSourceIds.includes(membership.id);
              return (
                <TableRow key={membership.id} hover selected={selected}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected}
                      disabled={membership.id === mergeTargetId}
                      onChange={() =>
                        onMergeSourcesChange(
                          selected
                            ? mergeSourceIds.filter((id) => id !== membership.id)
                            : [...mergeSourceIds, membership.id]
                        )
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1, px: 1, maxWidth: 220 }}>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 700, color: '#1B2438' }}>{membership.name}</Typography>
                    <Typography noWrap sx={{ maxWidth: 210, fontSize: typography.label, color: '#8B93A7' }}>{membership.description || 'Без описания'}</Typography>
                  </TableCell>
                  <TableCell sx={{ px: 1 }}>
                    <Box component="span" sx={{ px: 0.85, py: 0.35, borderRadius: '8px', bgcolor: category.bg, color: category.fg, fontSize: typography.label, fontWeight: 700 }}>{categoryLabel(membership.category)}</Box>
                  </TableCell>
                  <TableCell sx={{ px: 1, fontSize: typography.label, fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(membership.price).toLocaleString('ru-RU')} ₽</TableCell>
                  <TableCell sx={{ px: 1, fontSize: typography.label, whiteSpace: 'nowrap' }}>{periodLabel(membership)}</TableCell>
                  <TableCell sx={{ px: 1, fontSize: typography.label, fontWeight: 700 }}>{membership.visits == null ? '∞' : membership.visits}</TableCell>
                  <TableCell sx={{ px: 1 }}>
                    <Typography sx={{ fontSize: typography.label, fontWeight: 700 }}>{membership.assignedClientsCount || 0}</Typography>
                    <Typography sx={{ fontSize: typography.label, color: '#8B93A7' }}>клиентов</Typography>
                  </TableCell>
                  <TableCell sx={{ px: 1, maxWidth: 160 }}>
                    <Typography sx={{ fontSize: typography.label, color: colors.textMuted, lineHeight: 1.35 }}>{groupsAndBranches(membership)}</Typography>
                  </TableCell>
                  <TableCell sx={{ px: 1 }}>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.85, py: 0.35, borderRadius: '8px', bgcolor: status.bg, color: status.fg, fontSize: typography.label, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: status.fg }} />
                      {status.label}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ px: 0.75, whiteSpace: 'nowrap' }}>
                    {membership.category !== 'GROUP' && !membership.archivedAt && (
                      <Button size="small" variant="contained" onClick={() => onAssign(membership)} sx={{ mr: 0.5, minWidth: 0, px: 1, py: 0.45, fontSize: typography.label, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}>Назначить</Button>
                    )}
                    <IconButton size="small" onClick={() => onEdit(membership)}><EditOutlined sx={{ fontSize: 18 }} /></IconButton>
                    <IconButton size="small" onClick={() => onDuplicate(membership)}><ContentCopyOutlined sx={{ fontSize: 18 }} /></IconButton>
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        setMenuAnchor(event.currentTarget);
                        setMenuMembership(membership);
                      }}
                    >
                      <MoreHoriz sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {menuMembership?.archivedAt ? (
          <MenuItem onClick={() => { onRestore(menuMembership); setMenuAnchor(null); }}>
            <Replay sx={{ mr: 1, fontSize: 18 }} /> Восстановить
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { if (menuMembership) onArchive(menuMembership); setMenuAnchor(null); }}>
            <ArchiveOutlined sx={{ mr: 1, fontSize: 18 }} /> В архив
          </MenuItem>
        )}
        <MenuItem sx={{ color: colors.danger }} onClick={() => { if (menuMembership) onDelete(menuMembership); setMenuAnchor(null); }}>
          Удалить
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MembershipsDesktop;
