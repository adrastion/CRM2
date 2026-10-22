import React, { useMemo, useState } from 'react';
import {
  Add,
  ApartmentOutlined,
  CalendarTodayOutlined,
  EditOutlined,
  FileDownloadOutlined,
  GroupsOutlined,
  LocationOnOutlined,
  MoreHoriz,
  PeopleOutline,
  Search,
  SettingsOutlined,
  TrendingUp,
  WarningAmberOutlined,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Branch, Group, GroupScheduleItem, Trainer } from '../../types';
import { colors, radii } from '../../theme/tokens';

type Section = {
  key: string;
  branch: Branch | null;
  groups: Group[];
};

type Props = {
  sections: Section[];
  branches: Branch[];
  trainers: Trainer[];
  canManageBranches: boolean;
  onAddBranch: () => void;
  onAddGroup: (branchId?: string) => void;
  onEditBranch: (branch: Branch) => void;
  onDeleteBranch: (branchId: string) => void;
  onEditGroup: (group: Group) => void;
  onDeleteGroup: (groupId: string) => void;
  onOpenMembers: (group: Group) => void;
  onOpenTraining: (group: Group) => void;
  onEditTrainer: (group: Group) => void;
};

type StatusTab = 'ALL' | 'OK' | 'PROBLEM';

const DAY_SHORT: Record<number, string> = {
  0: 'Вс',
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
};

function occupancy(group: Group) {
  const current = group.memberships?.filter((m) => m.isActive).length || 0;
  const max = group.maxMembers ?? null;
  if (max == null || max <= 0) return { current, max, ratio: null as number | null, pct: null as number | null };
  const ratio = current / max;
  return { current, max, ratio, pct: Math.round(ratio * 100) };
}

function problemsOf(group: Group): Array<{ label: string; tone: 'red' | 'orange' }> {
  const occ = occupancy(group);
  const out: Array<{ label: string; tone: 'red' | 'orange' }> = [];
  if (occ.ratio != null) {
    if (occ.ratio > 1) out.push({ label: 'Переполнена', tone: 'red' });
    else if (occ.ratio >= 0.85) out.push({ label: 'Почти заполнена', tone: 'orange' });
    else if (occ.ratio < 0.4) out.push({ label: 'Недобор', tone: 'red' });
  }
  if (!group.isActive) out.push({ label: 'Неактивна', tone: 'orange' });
  return out;
}

function hasProblems(group: Group) {
  return problemsOf(group).length > 0;
}

function trainerShort(trainer?: Trainer | null) {
  if (!trainer?.user) return '—';
  const ln = trainer.user.lastName || '';
  const fi = (trainer.user.firstName || '').charAt(0);
  const mi = (trainer.user.middleName || '').charAt(0);
  return [ln, fi ? `${fi}.` : '', mi ? `${mi}.` : ''].filter(Boolean).join(' ');
}

function trainerFull(trainer?: Trainer | null) {
  if (!trainer?.user) return '—';
  return [trainer.user.lastName, trainer.user.firstName, trainer.user.middleName].filter(Boolean).join(' ');
}

function ageLabel(group: Group) {
  if (group.ageMin != null && group.ageMax != null) return `${group.ageMin}-${group.ageMax}`;
  if (group.ageMin != null) return `от ${group.ageMin}`;
  if (group.ageMax != null) return `до ${group.ageMax}`;
  return '—';
}

function scheduleLabel(schedule?: GroupScheduleItem[]) {
  if (!schedule?.length) return '—';
  const byTime = new Map<string, number[]>();
  schedule.forEach((s) => {
    const key = `${s.startTime}-${s.endTime}`;
    const days = byTime.get(key) || [];
    days.push(s.dayOfWeek);
    byTime.set(key, days);
  });
  return Array.from(byTime.entries())
    .map(([time, days]) => {
      const [start, end] = time.split('-');
      const dayStr = days
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => DAY_SHORT[d] || String(d))
        .join(', ');
      return `${dayStr} ${start}–${end}`;
    })
    .join('; ');
}

function fillColor(pct: number | null) {
  if (pct == null) return colors.primary;
  if (pct < 40) return '#F93C65';
  if (pct < 70) return '#FF9F43';
  if (pct < 90) return colors.primary;
  return '#00B69B';
}

function Spark({ color }: { color: string }) {
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden>
      <path
        d="M2 18 C 10 16, 14 14, 20 15 S 28 8, 36 10 S 48 4, 56 7 S 64 3, 70 5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Donut({ pct, color }: { pct: number; color: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <Box sx={{ position: 'relative', width: 52, height: 52 }}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} stroke="#EEF1F6" strokeWidth="5" fill="none" />
        <circle
          cx="26"
          cy="26"
          r={r}
          stroke={color}
          strokeWidth="5"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
      </svg>
      <Typography
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
          color: '#1B2438',
        }}
      >
        {pct}%
      </Typography>
    </Box>
  );
}

function BranchThumb({ name }: { name: string }) {
  const hue = (name.charCodeAt(0) * 37) % 360;
  return (
    <Box
      sx={{
        width: 52,
        height: 52,
        borderRadius: '12px',
        flexShrink: 0,
        background: `linear-gradient(145deg, hsl(${hue} 55% 62%), hsl(${(hue + 40) % 360} 45% 42%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ApartmentOutlined sx={{ color: '#fff', fontSize: 24 }} />
    </Box>
  );
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: `${radii.panel}px`,
  border: '1px solid #EEF1F6',
  boxShadow: '0 8px 24px rgba(27, 36, 56, 0.05)',
};

const BranchesGroupsBoard: React.FC<Props> = ({
  sections,
  branches,
  trainers,
  canManageBranches,
  onAddBranch,
  onAddGroup,
  onEditBranch,
  onDeleteBranch,
  onEditGroup,
  onDeleteGroup,
  onOpenMembers,
  onOpenTraining,
  onEditTrainer,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [query, setQuery] = useState('');
  const [branchId, setBranchId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ageKey, setAgeKey] = useState('');
  const [tab, setTab] = useState<StatusTab>('ALL');

  const ages = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((s) => s.groups.forEach((g) => {
      const a = ageLabel(g);
      if (a !== '—') set.add(a);
    }));
    return Array.from(set);
  }, [sections]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .map((section) => {
        if (branchId && section.branch?.id !== branchId) return null;
        const groups = section.groups.filter((g) => {
          if (trainerId && (g.trainerId || g.trainer?.id) !== trainerId) return false;
          if (statusFilter === 'active' && !g.isActive) return false;
          if (statusFilter === 'inactive' && g.isActive) return false;
          if (ageKey && ageLabel(g) !== ageKey) return false;
          if (tab === 'OK' && hasProblems(g)) return false;
          if (tab === 'PROBLEM' && !hasProblems(g)) return false;
          if (q) {
            const blob = [
              g.name,
              g.description,
              section.branch?.name,
              section.branch?.address,
              trainerFull(g.trainer),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            if (!blob.includes(q)) return false;
          }
          return true;
        });
        if (!groups.length && (q || trainerId || ageKey || tab !== 'ALL' || statusFilter !== 'all')) {
          return null;
        }
        return { ...section, groups };
      })
      .filter(Boolean) as Section[];
  }, [sections, branchId, trainerId, statusFilter, ageKey, tab, query]);

  const allGroups = useMemo(() => sections.flatMap((s) => s.groups), [sections]);
  const activeGroups = allGroups.filter((g) => g.isActive);
  const problemGroups = allGroups.filter(hasProblems);

  const avgLoad = useMemo(() => {
    const ratios = allGroups
      .map((g) => occupancy(g).ratio)
      .filter((r): r is number => r != null);
    if (!ratios.length) return 0;
    return Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100);
  }, [allGroups]);

  const counts = {
    all: allGroups.length,
    ok: allGroups.length - problemGroups.length,
    problem: problemGroups.length,
  };

  return (
    <Box data-onboarding="groups-page">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          gap: 2,
          mb: 2.25,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: '#1B2438', letterSpacing: '-0.02em' }}>
            Филиалы и группы
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: '#6B7280', mt: 0.5 }}>
            Контролируйте филиалы, группы, загрузку и проблемные зоны.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {canManageBranches && (
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={onAddBranch}
              data-onboarding="add-branch-button"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '12px',
                borderColor: '#C9D7FF',
                color: colors.primary,
                bgcolor: '#fff',
                height: 40,
                px: 1.75,
              }}
            >
              Добавить филиал
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => onAddGroup()}
            data-onboarding="add-group-button"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '12px',
              bgcolor: colors.primary,
              boxShadow: 'none',
              height: 40,
              px: 1.75,
              '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
            }}
          >
            Добавить группу
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 2,
        }}
      >
        <Metric
          icon={<ApartmentOutlined sx={{ color: colors.primary, fontSize: 20 }} />}
          tint="#EAF0FF"
          value={String(branches.length)}
          title="Филиалы"
          hint="в организации"
          hintColor="#00B69B"
          spark={colors.primary}
        />
        <Metric
          icon={<GroupsOutlined sx={{ color: '#7E57C2', fontSize: 20 }} />}
          tint="#F3EEFF"
          value={String(activeGroups.length)}
          title="Активные группы"
          hint="сейчас работают"
          hintColor="#7E57C2"
          spark="#7E57C2"
        />
        <Metric
          icon={<TrendingUp sx={{ color: '#00B69B', fontSize: 20 }} />}
          tint="#E7F8F2"
          value={`${avgLoad}%`}
          title="Средняя загрузка"
          hint="по всем группам"
          hintColor="#00B69B"
          spark="#00B69B"
        />
        <Metric
          icon={<WarningAmberOutlined sx={{ color: '#F93C65', fontSize: 20 }} />}
          tint="#FFE8EE"
          value={String(problemGroups.length)}
          title="Требуют внимания"
          hint="проблемные группы"
          hintColor="#F93C65"
          spark="#F93C65"
          valueColor={problemGroups.length ? '#F93C65' : '#1B2438'}
        />
      </Box>

      <Box
        sx={{
          ...cardSx,
          p: 1.5,
          mb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Поиск по названию группы, филиалу, тренеру..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{
              flex: '1 1 240px',
              minWidth: 200,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: '#F7F8FB',
                fontSize: 13,
                '& fieldset': { borderColor: 'transparent' },
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
          <FilterSelect
            label="Филиал"
            value={branchId}
            empty="Все филиалы"
            onChange={setBranchId}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <FilterSelect
            label="Тренер"
            value={trainerId}
            empty="Все тренеры"
            onChange={setTrainerId}
            options={trainers.map((t) => ({ value: t.id, label: trainerShort(t) }))}
          />
          <FilterSelect
            label="Статус"
            value={statusFilter}
            empty="Все статусы"
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Все статусы' },
              { value: 'active', label: 'Активные' },
              { value: 'inactive', label: 'Неактивные' },
            ]}
            hideEmpty
          />
          <FilterSelect
            label="Возраст"
            value={ageKey}
            empty="Все возраста"
            onChange={setAgeKey}
            options={ages.map((a) => ({ value: a, label: a }))}
          />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {(
            [
              ['ALL', 'Все', counts.all, colors.primary, '#EAF0FF'],
              ['OK', 'Нормально', counts.ok, '#00B69B', '#E7F8F2'],
              ['PROBLEM', 'Проблемы', counts.problem, '#F93C65', '#FFE8EE'],
            ] as const
          ).map(([key, label, n, fg, bg]) => {
            const on = tab === key;
            return (
              <Chip
                key={key}
                label={`${label} ${n}`}
                onClick={() => setTab(key)}
                sx={{
                  height: 32,
                  borderRadius: '999px',
                  fontWeight: 800,
                  fontSize: 13,
                  bgcolor: on ? fg : bg,
                  color: on ? '#fff' : fg,
                  '&:hover': { bgcolor: on ? fg : bg, opacity: 0.92 },
                }}
              />
            );
          })}
          <Box sx={{ flex: 1 }} />
          <Button
            startIcon={<FileDownloadOutlined sx={{ fontSize: 18 }} />}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#5A6275', fontSize: 13 }}
            onClick={() => undefined}
          >
            Экспорт в Excel
          </Button>
          <Button
            startIcon={<SettingsOutlined sx={{ fontSize: 18 }} />}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#5A6275', fontSize: 13 }}
            onClick={() => undefined}
          >
            Настройка вида
          </Button>
        </Box>
      </Box>

      {filteredSections.length === 0 ? (
        <Typography sx={{ textAlign: 'center', color: '#8B8C8F', py: 6, fontWeight: 600 }}>
          Филиалы и группы не найдены
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredSections.map((section) => {
            const seatsTotal = section.groups.reduce((s, g) => s + (g.maxMembers || 0), 0);
            const seatsTaken = section.groups.reduce(
              (s, g) => s + (g.memberships?.filter((m) => m.isActive).length || 0),
              0
            );
            const loadPct = seatsTotal > 0 ? Math.round((seatsTaken / seatsTotal) * 100) : 0;
            const senior = section.branch?.seniorTrainer;
            const seniorName = senior?.user
              ? trainerShort({ id: senior.id, user: senior.user } as Trainer)
              : trainerShort(section.groups[0]?.trainer);

            return (
              <Box key={section.key} sx={{ ...cardSx, overflow: 'hidden' }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    alignItems: 'center',
                    px: 2,
                    py: 1.75,
                    borderBottom: '1px solid #F0F2F6',
                  }}
                >
                  <BranchThumb name={section.branch?.name || 'Без филиала'} />
                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#1B2438' }}>
                      {section.branch?.name || 'Без филиала'}
                    </Typography>
                    {section.branch?.address && (
                      <Typography sx={{ fontSize: 12, color: '#8B8C8F', display: 'flex', alignItems: 'center', gap: 0.35, mt: 0.2 }}>
                        <LocationOnOutlined sx={{ fontSize: 14 }} />
                        {section.branch.address}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 140 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: '#EAF0FF', color: colors.primary }}>
                      {(seniorName || '?').charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#8B8C8F', fontWeight: 600 }}>Ответственный</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1B2438' }}>{seniorName}</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ textAlign: 'right', minWidth: 90 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#1B2438' }}>
                      {section.groups.length} групп
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#8B8C8F' }}>
                      {seatsTaken} / {seatsTotal || '∞'} участников
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Donut pct={loadPct} color={fillColor(loadPct)} />
                    <Typography sx={{ fontSize: 11, color: '#8B8C8F', fontWeight: 600, maxWidth: 72, lineHeight: 1.2 }}>
                      заполняемость
                    </Typography>
                  </Box>

                  <Chip
                    label={section.branch?.isActive === false ? 'Неактивен' : 'Активен'}
                    size="small"
                    sx={{
                      height: 24,
                      fontWeight: 800,
                      fontSize: 11,
                      bgcolor: section.branch?.isActive === false ? '#F4F6FA' : '#E7F8F2',
                      color: section.branch?.isActive === false ? '#8B8C8F' : '#00997A',
                    }}
                  />

                  {canManageBranches && section.branch && (
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <IconButton
                        size="small"
                        title="Редактировать филиал"
                        onClick={() => onEditBranch(section.branch!)}
                        sx={{ color: colors.primary }}
                      >
                        <EditOutlined sx={{ fontSize: 18 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Удалить филиал"
                        onClick={() => onDeleteBranch(section.branch!.id)}
                        sx={{ color: '#9AA3B5' }}
                      >
                        <MoreHoriz sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  )}
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => onAddGroup(section.branch?.id)}
                    sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}
                  >
                    Группа
                  </Button>
                </Box>

                {isMobile ? (
                  <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {section.groups.length === 0 ? (
                      <Typography sx={{ textAlign: 'center', color: '#8B8C8F', py: 2, fontSize: 13 }}>
                        В этом филиале пока нет групп
                      </Typography>
                    ) : (
                      section.groups.map((group) => (
                        <MobileGroupCard
                          key={group.id}
                          group={group}
                          onEdit={() => onEditGroup(group)}
                          onMembers={() => onOpenMembers(group)}
                          onTraining={() => onOpenTraining(group)}
                          onDelete={() => onDeleteGroup(group.id)}
                        />
                      ))
                    )}
                  </Box>
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 1100 }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F7F8FB' }}>
                          {[
                            'Группа',
                            'Описание / направление',
                            'Тренер',
                            'Возраст',
                            'Лимит',
                            'Участников',
                            'Заполняемость',
                            'Расписание',
                            'Статус',
                            'Проблемы',
                            'Действия',
                          ].map((h) => (
                            <TableCell
                              key={h}
                              sx={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#8B8C8F',
                                borderBottom: '1px solid #EEF1F6',
                                whiteSpace: 'nowrap',
                                py: 1.1,
                              }}
                            >
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {section.groups.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} align="center" sx={{ py: 3, color: '#8B8C8F' }}>
                              В этом филиале пока нет групп
                            </TableCell>
                          </TableRow>
                        ) : (
                          section.groups.map((group) => {
                            const occ = occupancy(group);
                            const pct = occ.pct;
                            const bar = fillColor(pct);
                            const probs = problemsOf(group);
                            return (
                              <TableRow key={group.id} hover sx={{ '& td': { borderBottom: '1px solid #F3F5F8' } }}>
                                <TableCell sx={{ py: 1.25 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                      sx={{
                                        width: 4,
                                        height: 28,
                                        borderRadius: 99,
                                        bgcolor: group.color || colors.primary,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <Typography
                                      onClick={() => onEditGroup(group)}
                                      sx={{
                                        fontWeight: 800,
                                        fontSize: 13,
                                        color: '#1B2438',
                                        cursor: 'pointer',
                                        '&:hover': { color: colors.primary },
                                      }}
                                    >
                                      {group.name}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: 12, color: '#5A6275', maxWidth: 180 }}>
                                  {group.description || '—'}
                                </TableCell>
                                <TableCell>
                                  <Box
                                    onClick={() => onEditTrainer(group)}
                                    sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.75,
                                      cursor: 'pointer',
                                      '&:hover .name': { color: colors.primary },
                                    }}
                                  >
                                    <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: '#EAF0FF', color: colors.primary }}>
                                      {trainerShort(group.trainer).charAt(0)}
                                    </Avatar>
                                    <Typography className="name" sx={{ fontSize: 12, fontWeight: 700, color: '#1B2438' }}>
                                      {trainerShort(group.trainer)}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#1B2438' }}>{ageLabel(group)}</TableCell>
                                <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#1B2438' }}>
                                  {group.maxMembers ?? '∞'}
                                </TableCell>
                                <TableCell sx={{ fontSize: 12, fontWeight: 800, color: '#1B2438' }}>{occ.current}</TableCell>
                                <TableCell sx={{ minWidth: 120 }}>
                                  {pct == null ? (
                                    <Typography sx={{ fontSize: 12, color: '#8B8C8F' }}>—</Typography>
                                  ) : (
                                    <Box>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.35 }}>
                                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: bar }}>{pct}%</Typography>
                                      </Box>
                                      <LinearProgress
                                        variant="determinate"
                                        value={Math.min(100, pct)}
                                        sx={{
                                          height: 6,
                                          borderRadius: 99,
                                          bgcolor: '#EEF1F6',
                                          '& .MuiLinearProgress-bar': { bgcolor: bar, borderRadius: 99 },
                                        }}
                                      />
                                    </Box>
                                  )}
                                </TableCell>
                                <TableCell sx={{ fontSize: 11, color: '#5A6275', maxWidth: 160, whiteSpace: 'nowrap' }}>
                                  {scheduleLabel(group.schedule)}
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    sx={{
                                      fontSize: 12,
                                      fontWeight: 800,
                                      color: group.isActive ? '#00B69B' : '#8B8C8F',
                                    }}
                                  >
                                    {group.isActive ? 'Активна' : 'Неактивна'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {probs.length === 0 ? (
                                      <Typography sx={{ fontSize: 12, color: '#8B8C8F' }}>—</Typography>
                                    ) : (
                                      probs.map((p) => (
                                        <Chip
                                          key={p.label}
                                          size="small"
                                          icon={<WarningAmberOutlined sx={{ fontSize: '14px !important' }} />}
                                          label={p.label}
                                          sx={{
                                            height: 22,
                                            fontSize: 10,
                                            fontWeight: 800,
                                            bgcolor: p.tone === 'red' ? '#FFE8EE' : '#FFF4E8',
                                            color: p.tone === 'red' ? '#E23B5A' : '#E07A12',
                                            '& .MuiChip-icon': {
                                              color: p.tone === 'red' ? '#E23B5A' : '#E07A12',
                                            },
                                          }}
                                        />
                                      ))
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                                    <IconButton size="small" title="Расписание" onClick={() => onOpenTraining(group)} sx={{ color: colors.primary }}>
                                      <CalendarTodayOutlined sx={{ fontSize: 18 }} />
                                    </IconButton>
                                    <IconButton size="small" title="Участники" onClick={() => onOpenMembers(group)} sx={{ color: colors.primary }}>
                                      <PeopleOutline sx={{ fontSize: 18 }} />
                                    </IconButton>
                                    <IconButton size="small" title="Редактировать" onClick={() => onEditGroup(group)} sx={{ color: colors.primary }}>
                                      <EditOutlined sx={{ fontSize: 18 }} />
                                    </IconButton>
                                    <IconButton size="small" title="Удалить" onClick={() => onDeleteGroup(group.id)} sx={{ color: '#9AA3B5' }}>
                                      <MoreHoriz sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
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
  valueColor,
}: {
  icon: React.ReactNode;
  tint: string;
  value: string;
  title: string;
  hint: string;
  hintColor: string;
  spark: string;
  valueColor?: string;
}) {
  return (
    <Box sx={{ ...cardSx, p: '14px 16px', display: 'flex', gap: 1.25, alignItems: 'center', minHeight: 92 }}>
      <Avatar sx={{ bgcolor: tint, width: 36, height: 36 }}>{icon}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: valueColor || '#1B2438', lineHeight: 1 }}>{value}</Typography>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#1B2438', mt: 0.35 }}>{title}</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: hintColor }}>{hint}</Typography>
      </Box>
      <Spark color={spark} />
    </Box>
  );
}

function FilterSelect({
  label,
  value,
  empty,
  options,
  onChange,
  hideEmpty,
}: {
  label: string;
  value: string;
  empty: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  hideEmpty?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Select
      size="small"
      value={value}
      displayEmpty
      onChange={(e) => onChange(String(e.target.value))}
      renderValue={() => (
        <Box sx={{ py: 0.1 }}>
          <Typography sx={{ fontSize: 10, color: '#8B8C8F', lineHeight: 1.1 }}>{label}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', lineHeight: 1.25 }}>
            {current?.label || empty}
          </Typography>
        </Box>
      )}
      sx={{
        minWidth: 140,
        flex: '1 1 140px',
        borderRadius: '12px',
        bgcolor: '#F7F8FB',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
        '& .MuiSelect-select': { py: 0.7 },
      }}
    >
      {!hideEmpty && <MenuItem value="">{empty}</MenuItem>}
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </Select>
  );
}

function MobileGroupCard({
  group,
  onEdit,
  onMembers,
  onTraining,
  onDelete,
}: {
  group: Group;
  onEdit: () => void;
  onMembers: () => void;
  onTraining: () => void;
  onDelete: () => void;
}) {
  const occ = occupancy(group);
  const probs = problemsOf(group);
  return (
    <Box sx={{ bgcolor: '#F7F8FB', borderRadius: '14px', p: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Box sx={{ width: 4, height: 24, borderRadius: 99, bgcolor: group.color || colors.primary }} />
        <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }} onClick={onEdit}>
          {group.name}
        </Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: group.isActive ? '#00B69B' : '#8B8C8F' }}>
          {group.isActive ? 'Активна' : 'Неактивна'}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: '#5A6275', mb: 0.5 }}>{group.description || '—'}</Typography>
      <Typography sx={{ fontSize: 12, color: '#1B2438', fontWeight: 700, mb: 0.5 }}>
        {trainerShort(group.trainer)} · {ageLabel(group)} · {occ.current}/{occ.max ?? '∞'}
      </Typography>
      {probs.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
          {probs.map((p) => (
            <Chip key={p.label} size="small" label={p.label} sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton size="small" onClick={onTraining}><CalendarTodayOutlined fontSize="small" /></IconButton>
        <IconButton size="small" onClick={onMembers}><PeopleOutline fontSize="small" /></IconButton>
        <IconButton size="small" onClick={onEdit}><EditOutlined fontSize="small" /></IconButton>
        <IconButton size="small" onClick={onDelete}><MoreHoriz fontSize="small" /></IconButton>
      </Box>
    </Box>
  );
}

export default BranchesGroupsBoard;
