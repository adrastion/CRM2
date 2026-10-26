import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add,
  CalendarMonthOutlined,
  CampaignOutlined,
  EditOutlined,
  EmailOutlined,
  FileUploadOutlined,
  FilterList,
  MoreVert,
  PeopleAltOutlined,
  PersonOutline,
  PhoneOutlined,
  Search,
  SettingsOutlined,
  SupervisorAccountOutlined,
} from '@mui/icons-material';
import {
  employeeRoleLabel,
  isEmployeeAdmin,
  isEmployeePromoter,
} from './TrainerCard';
import { colors, radii, typography } from '../../theme/tokens';

export type StaffTab = 'all' | 'trainers' | 'admins' | 'promoters' | 'other';

type Props = {
  employees: any[];
  canPickRole?: boolean;
  onAdd: () => void;
  onImport?: () => void;
  onOpen: (employee: any) => void;
  onEdit?: (employee: any) => void;
  onDelete?: (employee: any) => void;
  onOpenCalendar?: (employee: any) => void;
};

function empUser(e: any) {
  return e?.user || e || {};
}

function fullName(e: any) {
  const u = empUser(e);
  return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ').trim() || '—';
}

function initials(e: any) {
  const u = empUser(e);
  return `${(u.lastName || '')[0] || ''}${(u.firstName || '')[0] || ''}`.toUpperCase() || '?';
}

function roleKey(e: any): 'trainer' | 'admin' | 'promoter' | 'other' {
  if (isEmployeePromoter(e)) return 'promoter';
  if (isEmployeeAdmin(e)) return 'admin';
  if (e?.employeeType === 'trainer' || e?.user?.role === 'TRAINER' || e?.user?.role === 'OWNER') {
    return 'trainer';
  }
  return 'other';
}

function yearsLabel(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const years = Math.max(0, Math.round(Number(n)));
  const mod10 = years % 10;
  const mod100 = years % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'год'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? 'года'
        : 'лет';
  return `${years} ${word}`;
}

function groupsLabel(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'группа'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? 'группы'
        : 'групп';
  return `${n} ${word}`;
}

function workloadColor(pct: number) {
  if (pct >= 85) return '#8B5CF6';
  if (pct >= 65) return '#12B981';
  if (pct >= 40) return '#F59E0B';
  return colors.primary;
}

const ROLE_CHIP = {
  trainer: { bg: '#FCE7F3', fg: '#DB2777', label: 'Тренер' },
  admin: { bg: '#DBEAFE', fg: '#2563EB', label: 'Администратор' },
  promoter: { bg: '#EDE9FE', fg: '#7C3AED', label: 'Промоутер' },
  other: { bg: '#EEF1F6', fg: '#64748B', label: 'Другое' },
} as const;

const cardSx = {
  bgcolor: '#fff',
  borderRadius: `${radii.panel}px`,
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
};

function Sparkline({ color }: { color: string }) {
  return (
    <Box component="svg" viewBox="0 0 80 28" sx={{ width: 72, height: 28 }} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="0,18 14,14 28,16 42,8 56,12 70,5 80,7"
      />
    </Box>
  );
}

const EmployeesBoard: React.FC<Props> = ({
  employees,
  canPickRole,
  onAdd,
  onImport,
  onOpen,
  onEdit,
  onDelete,
  onOpenCalendar,
}) => {
  const [tab, setTab] = useState<StaffTab>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addEl, setAddEl] = useState<null | HTMLElement>(null);
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; employee: any } | null>(null);
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  const counts = useMemo(() => {
    let trainers = 0;
    let admins = 0;
    let promoters = 0;
    let other = 0;
    for (const e of employees) {
      const k = roleKey(e);
      if (k === 'trainer') trainers += 1;
      else if (k === 'admin') admins += 1;
      else if (k === 'promoter') promoters += 1;
      else other += 1;
    }
    return { all: employees.length, trainers, admins, promoters, other };
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const k = roleKey(e);
      if (tab === 'trainers' && k !== 'trainer') return false;
      if (tab === 'admins' && k !== 'admin') return false;
      if (tab === 'promoters' && k !== 'promoter') return false;
      if (tab === 'other' && k !== 'other') return false;
      if (!q) return true;
      const u = empUser(e);
      const hay = [fullName(e), u.email || '', u.phone || '', e.qualification || '']
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [employees, tab, search]);

  const tabs: Array<{ key: StaffTab; label: string; count: number }> = [
    { key: 'all', label: 'Все сотрудники', count: counts.all },
    { key: 'trainers', label: 'Тренеры', count: counts.trainers },
    { key: 'admins', label: 'Администраторы', count: counts.admins },
    { key: 'promoters', label: 'Промоутеры', count: counts.promoters },
    { key: 'other', label: 'Другие', count: counts.other },
  ];

  const kpi = [
    {
      title: 'Всего сотрудников',
      value: counts.all,
      delta: '+2',
      hint: 'за последний месяц',
      icon: <PeopleAltOutlined sx={{ fontSize: 20 }} />,
      iconBg: '#EEF4FF',
      iconFg: colors.primary,
      spark: colors.primary,
    },
    {
      title: 'Тренеры',
      value: counts.trainers,
      delta: '+1',
      hint: 'за последний месяц',
      icon: <PersonOutline sx={{ fontSize: 20 }} />,
      iconBg: '#FCE7F3',
      iconFg: '#DB2777',
      spark: '#EC4899',
    },
    {
      title: 'Администраторы',
      value: counts.admins,
      delta: '+1',
      hint: 'за последний месяц',
      icon: <SupervisorAccountOutlined sx={{ fontSize: 20 }} />,
      iconBg: '#DBEAFE',
      iconFg: '#2563EB',
      spark: colors.primary,
    },
    {
      title: 'Промоутеры',
      value: counts.promoters,
      delta: '0%',
      hint: 'без изменений',
      icon: <CampaignOutlined sx={{ fontSize: 20 }} />,
      iconBg: '#D1FAE5',
      iconFg: '#059669',
      spark: '#12B981',
    },
  ];

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(String(e.id || empUser(e).id)));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => String(e.id || empUser(e).id))));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const gridCols =
    '40px minmax(200px,1.4fr) 120px minmax(150px,1.1fr) minmax(120px,1fr) 80px minmax(100px,0.9fr) 90px minmax(100px,0.95fr) 100px 100px';

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md }, color: '#1B2438', letterSpacing: '-0.03em' }}>
            Сотрудники
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: '#8B93A7', fontWeight: 600, mt: 0.35 }}>
            Команда вашей организации. Управляйте ролями, доступами и загрузкой сотрудников.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {onImport && (
            <Button
              startIcon={<FileUploadOutlined />}
              onClick={onImport}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                border: '1px solid #C9D7FF',
                color: colors.primary,
                bgcolor: '#fff',
              }}
            >
              Импорт из Excel
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            endIcon={<Box component="span" sx={{ fontSize: typography.hint, opacity: 0.8 }}>▾</Box>}
            onClick={(e) => (canPickRole ? setAddEl(e.currentTarget) : onAdd())}
            sx={{
              textTransform: 'none',
              fontWeight: 750,
              borderRadius: `${radii.button}px`,
              bgcolor: colors.primary,
              boxShadow: 'none',
              px: 2,
              '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
            }}
            data-onboarding="add-trainer-button"
          >
            Добавить сотрудника
          </Button>
          <Menu anchorEl={addEl} open={Boolean(addEl)} onClose={() => setAddEl(null)}>
            <MenuItem
              onClick={() => {
                setAddEl(null);
                onAdd();
              }}
            >
              Новый сотрудник
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

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
            <Typography sx={{ mt: 1.25, fontSize: typography.label, fontWeight: 700, color: '#8B93A7' }}>
              {k.title}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 22, color: '#1B2438', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {k.value}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: typography.label, fontWeight: 800, color: k.delta === '0%' ? '#8B93A7' : '#059669' }}>
                {k.delta === '0%' ? k.delta : `↑${k.delta}`}
              </Typography>
              <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: '#8B93A7' }}>{k.hint}</Typography>
            </Stack>
          </Box>
        ))}
      </Box>

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        alignItems={{ lg: 'center' }}
        justifyContent="space-between"
        spacing={1.25}
        sx={{ mb: 1.5 }}
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
                  fontSize: typography.label,
                  '&:hover': { bgcolor: active ? colors.primary : '#F0F2F7' },
                }}
              >
                {t.label}
                <Box
                  component="span"
                  sx={{
                    fontSize: typography.label,
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

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Поиск по ФИО, email, телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              minWidth: { xs: '100%', sm: 260 },
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
          <Button
            startIcon={<FilterList />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              border: '1px solid #EEF1F6',
              color: '#5A6275',
              bgcolor: '#fff',
            }}
          >
            Фильтры
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: colors.primary,
                ml: 0.75,
              }}
            />
          </Button>
          <IconButton size="small" sx={{ border: '1px solid #EEF1F6', borderRadius: '8px', color: colors.primary }}>
            <SettingsOutlined fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Box sx={{ ...cardSx, overflowX: mobile ? 'hidden' : 'auto', maxWidth: '100%', minWidth: 0 }}>
        <Box
          sx={{
            display: mobile ? 'none' : 'grid',
            gridTemplateColumns: gridCols,
            gap: 1,
            px: 1.5,
            py: 1.1,
            borderBottom: '1px solid #EEF1F6',
            bgcolor: '#FAFBFD',
            minWidth: 1180,
            alignItems: 'center',
          }}
        >
          <Checkbox size="small" checked={allSelected} onChange={toggleAll} sx={{ p: 0.5 }} />
          {[
            'Сотрудник',
            'Роль',
            'Контакты',
            'Квалификация',
            'Стаж',
            'Филиалы',
            'Группы',
            'Загрузка',
            'Статус',
            'Действия',
          ].map((h) => (
            <Typography key={h} sx={{ fontSize: typography.label, fontWeight: 800, color: '#8B93A7' }}>
              {h}
            </Typography>
          ))}
        </Box>

        {filtered.map((e, idx) => {
          const id = String(e.id || empUser(e).id);
          const u = empUser(e);
          const rk = roleKey(e);
          const chip = ROLE_CHIP[rk];
          const isAdmin = isEmployeeAdmin(e) || isEmployeePromoter(e);
          const groupsCount = Number(e.groupsCount ?? e._count?.groups ?? 0);
          const workload = Number(
            e.workloadPct ??
              Math.min(100, Math.round(groupsCount * 22 + (e.experience ? Math.min(20, Number(e.experience) * 2) : 0)))
          );
          const branches =
            (e.branches || [])
              .map((tb: any) => tb.branch?.name)
              .filter(Boolean)
              .join(', ') || '—';
          const active = e.isActive !== false && u.isActive !== false;
          const barColor = workloadColor(workload);
          const roleLabel = employeeRoleLabel(e) || chip.label;

          if (mobile) {
            return (
              <Box
                key={id}
                onClick={() => onOpen(e)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 1.1,
                  minWidth: 0,
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  borderBottom: '1px solid #F1F3F7',
                  bgcolor: idx % 2 === 1 ? '#FAFBFD' : '#fff',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
                  <Checkbox
                    size="small"
                    checked={selected.has(id)}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={() => toggleOne(id)}
                    sx={{ p: 0.25, flexShrink: 0 }}
                  />
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      fontSize: typography.label,
                      fontWeight: 800,
                      bgcolor: '#E8EEFF',
                      color: colors.primary,
                    }}
                  >
                    {initials(e)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontWeight: 750,
                        fontSize: typography.label,
                        color: '#1B2438',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {fullName(e)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#8B93A7',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {u.phone || u.email || 'нет контакта'}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    sx={{ color: '#8B93A7', flexShrink: 0 }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setRowMenu({ el: ev.currentTarget, employee: e });
                    }}
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pl: 0.5, minWidth: 0, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={roleLabel}
                    sx={{
                      height: 22,
                      fontWeight: 750,
                      fontSize: 11,
                      bgcolor: chip.bg,
                      color: chip.fg,
                      borderRadius: '999px',
                      maxWidth: '100%',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                  <Chip
                    size="small"
                    label={active ? 'Активен' : 'В отпуске'}
                    sx={{
                      height: 22,
                      fontWeight: 750,
                      fontSize: 11,
                      bgcolor: active ? '#12B981' : '#FFEDD5',
                      color: active ? '#fff' : '#EA580C',
                      borderRadius: '999px',
                    }}
                  />
                </Stack>
              </Box>
            );
          }

          return (
            <Box
              key={id}
              onClick={() => onOpen(e)}
              sx={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: 1,
                px: 1.5,
                py: 1.15,
                minWidth: 1180,
                alignItems: 'center',
                borderBottom: '1px solid #F1F3F7',
                bgcolor: idx % 2 === 1 ? '#FAFBFD' : '#fff',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#F5F8FF' },
              }}
            >
              <Checkbox
                size="small"
                checked={selected.has(id)}
                onClick={(ev) => ev.stopPropagation()}
                onChange={() => toggleOne(id)}
                sx={{ p: 0.5 }}
              />

              <Stack direction="row" spacing={1.1} alignItems="center" minWidth={0}>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    fontSize: typography.label,
                    fontWeight: 800,
                    bgcolor: '#E8EEFF',
                    color: colors.primary,
                  }}
                >
                  {initials(e)}
                </Avatar>
                <Typography
                  sx={{
                    fontWeight: 750,
                    fontSize: typography.label,
                    color: '#1B2438',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {fullName(e)}
                </Typography>
              </Stack>

              <Chip
                size="small"
                label={roleLabel}
                sx={{
                  height: 24,
                  fontWeight: 750,
                  fontSize: typography.label,
                  bgcolor: chip.bg,
                  color: chip.fg,
                  borderRadius: '999px',
                  width: 'fit-content',
                }}
              />

              <Box minWidth={0}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PhoneOutlined sx={{ fontSize: 16, color: colors.primary }} />
                  <Typography sx={{ fontSize: typography.label, fontWeight: 650, color: '#1B2438', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.phone || '—'}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <EmailOutlined sx={{ fontSize: 16, color: colors.primary }} />
                  <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: '#8B93A7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email || '—'}
                  </Typography>
                </Stack>
              </Box>

              <Typography sx={{ fontSize: typography.label, fontWeight: 650, color: '#1B2438', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isAdmin ? '—' : e.qualification || '—'}
              </Typography>

              <Typography sx={{ fontSize: typography.label, fontWeight: 700, color: '#1B2438' }}>
                {isAdmin ? '—' : yearsLabel(e.experience)}
              </Typography>

              <Typography sx={{ fontSize: typography.label, fontWeight: 650, color: '#1B2438', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isAdmin ? '—' : branches}
              </Typography>

              <Typography sx={{ fontSize: typography.label, fontWeight: 700, color: '#1B2438' }}>
                {isAdmin ? '—' : groupsLabel(groupsCount)}
              </Typography>

              <Box>
                {isAdmin ? (
                  <Typography sx={{ fontSize: typography.label, color: '#8B93A7' }}>—</Typography>
                ) : (
                  <>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
                      <Typography sx={{ fontSize: typography.label, fontWeight: 800, color: barColor }}>{workload}%</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={workload}
                      sx={{
                        height: 6,
                        borderRadius: 99,
                        bgcolor: '#EEF1F6',
                        '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 99 },
                      }}
                    />
                  </>
                )}
              </Box>

              <Chip
                size="small"
                label={active ? 'Активен' : 'В отпуске'}
                sx={{
                  height: 24,
                  fontWeight: 750,
                  fontSize: typography.label,
                  bgcolor: active ? '#12B981' : '#FFEDD5',
                  color: active ? '#fff' : '#EA580C',
                  borderRadius: '999px',
                  width: 'fit-content',
                }}
              />

              <Stack direction="row" spacing={0.25} onClick={(ev) => ev.stopPropagation()}>
                <IconButton
                  size="small"
                  sx={{ color: colors.primary }}
                  onClick={() => (onOpenCalendar ? onOpenCalendar(e) : onOpen(e))}
                >
                  <CalendarMonthOutlined fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  sx={{ color: colors.primary }}
                  onClick={() => (onEdit ? onEdit(e) : onOpen(e))}
                >
                  <EditOutlined fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  sx={{ color: colors.primary }}
                  onClick={(ev) => setRowMenu({ el: ev.currentTarget, employee: e })}
                >
                  <MoreVert fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          );
        })}

        {!filtered.length && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#8B93A7', fontWeight: 650, mb: 1.5 }}>Сотрудники не найдены</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={onAdd} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Добавить сотрудника
            </Button>
          </Box>
        )}
      </Box>

      <Menu anchorEl={rowMenu?.el} open={Boolean(rowMenu)} onClose={() => setRowMenu(null)}>
        <MenuItem
          onClick={() => {
            if (rowMenu) onOpen(rowMenu.employee);
            setRowMenu(null);
          }}
        >
          Открыть карточку
        </MenuItem>
        {onDelete && (
          <MenuItem
            onClick={() => {
              if (rowMenu) onDelete(rowMenu.employee);
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

export default EmployeesBoard;
