import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessTime,
  Add,
  CalendarMonthOutlined,
  DeleteOutline,
  DescriptionOutlined,
  DragIndicator,
  FitnessCenter,
  GroupsOutlined,
  LocationOnOutlined,
  PersonOutline,
  SaveOutlined,
  Search,
  SendOutlined,
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isWithinInterval,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';

type Media = { id: string; kind: string; mimeType: string };
type Exercise = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  difficulty?: string | null;
  inventory?: string | null;
  media?: Media[];
};
type GroupOpt = {
  id: string;
  name: string;
  ageMin?: number | null;
  ageMax?: number | null;
  branch?: { id?: string; name: string } | null;
  trainer?: { id: string; user?: { firstName?: string; lastName?: string } | null } | null;
};
type Cycle = {
  id: string;
  title: string | null;
  description?: string | null;
  frequency?: string | null;
  quantity?: number | null;
  dateFrom: string;
  dateTo: string;
  updatedAt?: string;
  createdBy?: { firstName?: string; lastName?: string } | null;
  groups: Array<{ groupId: string; group: { id: string; name: string } }>;
  _count?: { sessionPlans: number };
};
type PreviewTraining = {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  group: { id: string; name: string } | null;
  hasPlan: boolean;
};
type Detail = Cycle & { preview?: { total: number; trainings: PreviewTraining[] } };

type Props = {
  cycles: Cycle[];
  groups: GroupOpt[];
  exercises: Exercise[];
  templatesCount: number;
  recentTemplates: number;
  selectedId: string | null;
  detail: Detail | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenExercise: () => void;
  onChanged: () => void;
  onSwitchExercises?: () => void;
};

type StatusKey = 'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVE';

const DAY_TONE: Record<number, string> = {
  0: '#F93C65',
  1: '#00B69B',
  2: '#5B4FD1',
  3: '#7E57C2',
  4: '#2F6BFF',
  5: '#2F6BFF',
  6: '#FF9F43',
};

const CAT_STYLE: Record<string, { bg: string; fg: string; bar: string }> = {
  Разминка: { bg: '#FFE8EE', fg: '#E23B5A', bar: '#F93C65' },
  Координация: { bg: '#F3EEFF', fg: '#7E57C2', bar: '#7E57C2' },
  Сила: { bg: '#FFF3E6', fg: '#E07A12', bar: '#FF9F43' },
  Гибкость: { bg: '#E7F8F2', fg: '#00997A', bar: '#00B69B' },
  Реакция: { bg: '#EAF0FF', fg: '#2F6BFF', bar: '#2F6BFF' },
  Восстановление: { bg: '#E7F8F2', fg: '#00997A', bar: '#00B69B' },
  Скорость: { bg: '#FFE8EE', fg: '#E23B5A', bar: '#F93C65' },
  'Основная часть': { bg: '#EAF0FF', fg: '#2F6BFF', bar: '#2F6BFF' },
  Заминка: { bg: '#E7F8F2', fg: '#00997A', bar: '#00B69B' },
};

function catStyle(name?: string | null) {
  if (!name) return { bg: '#F1F3F7', fg: '#5A6275', bar: '#C5CAD6' };
  return CAT_STYLE[name] || { bg: '#F1F3F7', fg: '#5A6275', bar: '#8AA0FF' };
}

function personShort(u?: { firstName?: string; lastName?: string } | null) {
  if (!u) return '—';
  const ln = u.lastName || '';
  const fi = (u.firstName || '').charAt(0);
  return [ln, fi ? `${fi}.` : ''].filter(Boolean).join(' ') || '—';
}

function ageLabel(g?: GroupOpt | null) {
  if (!g) return '';
  if (g.ageMin != null && g.ageMax != null) return `${g.ageMin}–${g.ageMax} лет`;
  if (g.ageMin != null) return `от ${g.ageMin} лет`;
  if (g.ageMax != null) return `до ${g.ageMax} лет`;
  return '';
}

function cycleStatus(c: Cycle): Exclude<StatusKey, 'ALL'> {
  const now = Date.now();
  if (new Date(c.dateTo).getTime() < now) return 'ARCHIVE';
  if ((c._count?.sessionPlans ?? 0) === 0) return 'DRAFT';
  return 'ACTIVE';
}

function dateProgress(c: Cycle) {
  const from = new Date(c.dateFrom).getTime();
  const to = new Date(c.dateTo).getTime();
  if (!(to > from)) return 0;
  return Math.round(Math.min(100, Math.max(0, ((Date.now() - from) / (to - from)) * 100)));
}

function weeksOf(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  const weeks: Array<{ index: number; start: Date; end: Date }> = [];
  let cursor = startOfWeek(from, { weekStartsOn: 1 });
  let i = 1;
  while (cursor <= to && weeks.length < 16) {
    const end = endOfWeek(cursor, { weekStartsOn: 1 });
    weeks.push({ index: i, start: cursor, end: end > to ? to : end });
    cursor = addDays(end, 1);
    i += 1;
  }
  return weeks;
}

function SceneThumb({ variant = 0, size = 54 }: { variant?: number; size?: number }) {
  const scenes = [
    { sky: '#7EB6FF', ground: '#3CB371', accent: '#FF7A1A' },
    { sky: '#9B8CFF', ground: '#2F6BFF', accent: '#F4C542' },
    { sky: '#6EC8FF', ground: '#1F8A70', accent: '#F93C65' },
    { sky: '#FFD38A', ground: '#3D7A4A', accent: '#2F6BFF' },
  ];
  const s = scenes[variant % scenes.length];
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '12px',
        overflow: 'hidden',
        flexShrink: 0,
        background: `linear-gradient(180deg, ${s.sky} 0 58%, ${s.ground} 58% 100%)`,
        position: 'relative',
      }}
    >
      <Box sx={{ position: 'absolute', left: '18%', top: '62%', width: 8, height: 14, bgcolor: s.accent, borderRadius: '2px 2px 0 0', transform: 'skewX(-8deg)' }} />
      <Box sx={{ position: 'absolute', left: '38%', top: '54%', width: 8, height: 18, bgcolor: '#fff', borderRadius: '2px 2px 0 0' }} />
      <Box sx={{ position: 'absolute', left: '58%', top: '60%', width: 8, height: 15, bgcolor: s.accent, borderRadius: '2px 2px 0 0' }} />
      <Box sx={{ position: 'absolute', right: 6, top: 8, width: 10, height: 10, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.85)' }} />
    </Box>
  );
}

function Spark({ color }: { color: string }) {
  return (
    <svg width="78" height="28" viewBox="0 0 78 28" aria-hidden>
      <path
        d="M2 20 C 10 18, 14 16, 20 17 S 30 10, 38 12 S 50 6, 58 8 S 68 4, 76 6"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExerciseThumb({ media }: { media?: Media }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!media?.id) return;
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiService.getExerciseMediaBlob(media.id);
        if (cancelled) return;
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [media?.id]);
  return (
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: '12px',
        overflow: 'hidden',
        bgcolor: '#EEF2F8',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {url && media?.kind !== 'video' ? (
        <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <FitnessCenter sx={{ color: '#9AA3B5', fontSize: 22 }} />
      )}
    </Box>
  );
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '16px',
  boxShadow: '0 8px 24px rgba(27, 36, 56, 0.06)',
  border: '1px solid #EEF1F6',
};

const CyclesBoard: React.FC<Props> = ({
  cycles,
  groups,
  exercises,
  templatesCount,
  recentTemplates,
  selectedId,
  detail,
  onSelect,
  onCreate,
  onDelete,
  onOpenExercise,
  onChanged,
  onDelete: _onDelete,
  onSwitchExercises,
}) => {
  void _onDelete;
  const [branchId, setBranchId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [ageKey, setAgeKey] = useState('');
  const [period, setPeriod] = useState('all');
  const [trainerId, setTrainerId] = useState('');
  const [status, setStatus] = useState<StatusKey>('ALL');
  const [query, setQuery] = useState('');
  const [libQuery, setLibQuery] = useState('');
  const [libCat, setLibCat] = useState('Все');
  const [weekIdx, setWeekIdx] = useState(0);
  const [plans, setPlans] = useState<Record<string, any>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [addTargetId, setAddTargetId] = useState<string | null>(null);

  const groupById = useMemo(() => {
    const map = new Map<string, GroupOpt>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const branches = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => {
      if (g.branch?.name) map.set(g.branch.id || g.branch.name, g.branch.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [groups]);

  const trainers = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => {
      if (!g.trainer?.id) return;
      map.set(g.trainer.id, personShort(g.trainer.user));
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [groups]);

  const ages = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => {
      const label = ageLabel(g);
      if (label) set.add(label);
    });
    return Array.from(set);
  }, [groups]);

  const counts = useMemo(() => {
    const base = { ALL: cycles.length, ACTIVE: 0, DRAFT: 0, ARCHIVE: 0 };
    cycles.forEach((c) => {
      base[cycleStatus(c)] += 1;
    });
    return base;
  }, [cycles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return cycles.filter((c) => {
      if (status !== 'ALL' && cycleStatus(c) !== status) return false;
      const gids = c.groups.map((g) => g.groupId);
      const linked = gids.map((id) => groupById.get(id)).filter(Boolean) as GroupOpt[];
      if (groupId && !gids.includes(groupId)) return false;
      if (branchId && !linked.some((g) => (g.branch?.id || g.branch?.name) === branchId)) return false;
      if (trainerId && !linked.some((g) => g.trainer?.id === trainerId)) return false;
      if (ageKey && !linked.some((g) => ageLabel(g) === ageKey)) return false;
      if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        if (new Date(c.dateTo) < start || new Date(c.dateFrom) > end) return false;
      }
      if (period === 'quarter') {
        const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), qStartMonth, 1);
        const end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
        if (new Date(c.dateTo) < start || new Date(c.dateFrom) > end) return false;
      }
      if (q) {
        const blob = [
          c.title,
          ...c.groups.map((g) => g.group.name),
          personShort(c.createdBy),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [cycles, status, groupId, branchId, trainerId, ageKey, period, query, groupById]);

  const selected = detail && detail.id === selectedId ? detail : filtered.find((c) => c.id === selectedId) || null;
  const primaryGroup = selected
    ? groupById.get(selected.groups[0]?.groupId) || null
    : null;

  const weeks = useMemo(
    () => (selected ? weeksOf(selected.dateFrom, selected.dateTo) : []),
    [selected]
  );
  const week = weeks[Math.min(weekIdx, Math.max(weeks.length - 1, 0))];

  useEffect(() => {
    setWeekIdx(0);
    setPlans({});
  }, [selectedId]);

  useEffect(() => {
    const trainings = detail?.preview?.trainings || [];
    if (!detail || !trainings.length) return;
    let cancelled = false;
    (async () => {
      const slice = trainings.slice(0, 40);
      const rows = await Promise.all(
        slice.map(async (t) => {
          try {
            const plan = await apiService.getSessionPlanByTraining(t.id);
            return [t.id, plan] as const;
          } catch {
            return [t.id, null] as const;
          }
        })
      );
      if (!cancelled) setPlans(Object.fromEntries(rows));
    })();
    return () => {
      cancelled = true;
    };
  }, [detail]);

  const weekTrainings = useMemo(() => {
    const list = detail?.preview?.trainings || [];
    if (!week) return [];
    return list.filter((t) => {
      const d = new Date(t.startTime);
      return isWithinInterval(d, { start: week.start, end: week.end });
    });
  }, [detail, week]);

  const dayColumns = useMemo(() => {
    const map = new Map<string, { date: Date; items: PreviewTraining[] }>();
    weekTrainings.forEach((t) => {
      const d = new Date(t.startTime);
      const key = format(d, 'yyyy-MM-dd');
      const bucket = map.get(key) || { date: d, items: [] };
      bucket.items.push(t);
      map.set(key, bucket);
    });
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [weekTrainings]);

  const exerciseCount = useMemo(() => {
    return Object.values(plans).reduce((sum, plan: any) => sum + (plan?.items?.length || 0), 0);
  }, [plans]);

  const avgMinutes = useMemo(() => {
    const mins: number[] = [];
    Object.values(plans).forEach((plan: any) => {
      (plan?.items || []).forEach((it: any) => {
        if (it.durationSec) mins.push(Math.round(it.durationSec / 60));
      });
    });
    if (!mins.length) {
      (detail?.preview?.trainings || []).forEach((t) => {
        if (t.endTime) {
          const diff = (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 60000;
          if (diff > 0 && diff < 300) mins.push(diff);
        }
      });
    }
    if (!mins.length) return 0;
    return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
  }, [plans, detail]);

  const fillProgress = useMemo(() => {
    const total = detail?.preview?.total || 0;
    if (!total) return selected ? dateProgress(selected) : 0;
    const withPlan = (detail?.preview?.trainings || []).filter((t) => t.hasPlan || (plans[t.id]?.items?.length > 0)).length;
    return Math.round((withPlan / total) * 100);
  }, [detail, plans, selected]);

  const categories = useMemo(() => {
    const preferred = ['Разминка', 'Координация', 'Сила', 'Гибкость'];
    const set = new Set<string>();
    exercises.forEach((ex) => {
      if (ex.category) set.add(ex.category);
    });
    const extras = Array.from(set).filter((c) => !preferred.includes(c));
    return ['Все', ...preferred.filter((c) => set.size === 0 || set.has(c) || preferred.includes(c)), ...extras].filter(
      (v, i, arr) => arr.indexOf(v) === i
    );
  }, [exercises]);

  const library = useMemo(() => {
    const q = libQuery.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (libCat !== 'Все' && (ex.category || '') !== libCat) return false;
      if (!q) return true;
      return `${ex.title} ${ex.category || ''} ${ex.description || ''}`.toLowerCase().includes(q);
    });
  }, [exercises, libCat, libQuery]);

  const activeGroups = useMemo(() => {
    const ids = new Set<string>();
    cycles.forEach((c) => {
      if (cycleStatus(c) === 'ACTIVE') c.groups.forEach((g) => ids.add(g.groupId));
    });
    return ids.size;
  }, [cycles]);

  const recentCycles = useMemo(() => {
    const edge = Date.now() - 7 * 24 * 3600 * 1000;
    return cycles.filter((c) => c.updatedAt && new Date(c.updatedAt).getTime() >= edge).length;
  }, [cycles]);

  const periodLabel = (c: Cycle) => {
    const days = Math.max(1, differenceInCalendarDays(new Date(c.dateTo), new Date(c.dateFrom)) + 1);
    const weeksN = Math.max(1, Math.round(days / 7));
    return `${weeksN} нед.`;
  };

  const saveItems = async (trainingId: string, items: any[]) => {
    setBusyId(trainingId);
    try {
      const plan = await apiService.upsertSessionPlan(trainingId, {
        cycleId: selectedId,
        items: items.map((it, idx) => ({
          section: it.section || 'MAIN',
          exerciseId: it.exerciseId || it.exercise?.id,
          sortOrder: idx,
          durationSec: it.durationSec ?? null,
          sets: it.sets ?? null,
          reps: it.reps ?? null,
          notes: it.notes ?? null,
        })),
      });
      setPlans((prev) => ({ ...prev, [trainingId]: plan }));
      setNotice('План занятия сохранён');
      onChanged();
    } catch (e: any) {
      setNotice(e?.response?.data?.error || 'Не удалось сохранить упражнение');
    } finally {
      setBusyId(null);
    }
  };

  const addToTraining = async (trainingId: string, exercise: Exercise) => {
    const current = plans[trainingId]?.items || [];
    const section = /размин/i.test(exercise.category || '') ? 'WARMUP' : 'MAIN';
    await saveItems(trainingId, [
      ...current.map((it: any) => ({
        section: it.section,
        exerciseId: it.exerciseId,
        durationSec: it.durationSec,
        sets: it.sets,
        reps: it.reps,
        notes: it.notes,
      })),
      { section, exerciseId: exercise.id, durationSec: 600 },
    ]);
  };

  const removeItem = async (trainingId: string, itemId: string) => {
    const current = (plans[trainingId]?.items || []).filter((it: any) => it.id !== itemId);
    await saveItems(
      trainingId,
      current.map((it: any) => ({
        section: it.section,
        exerciseId: it.exerciseId,
        durationSec: it.durationSec,
        sets: it.sets,
        reps: it.reps,
        notes: it.notes,
      }))
    );
  };

  const targetTrainingId = addTargetId || dayColumns[0]?.items[0]?.id || null;

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 1.75,
        }}
      >
        <Metric
          tint="#EAF0FF"
          icon={<FitnessCenter sx={{ color: colors.primary, fontSize: 20 }} />}
          value={String(counts.ACTIVE)}
          title="Активные циклы"
          hint="в работе сейчас"
          hintColor="#00B69B"
          spark="#2F6BFF"
        />
        <Metric
          tint="#F3EEFF"
          icon={<GroupsOutlined sx={{ color: '#7E57C2', fontSize: 20 }} />}
          value={String(activeGroups)}
          title="Группы в работе"
          hint="с назначенным циклом"
          hintColor="#7E57C2"
          spark="#7E57C2"
        />
        <Metric
          tint="#E7F8F2"
          icon={<DescriptionOutlined sx={{ color: '#00B69B', fontSize: 20 }} />}
          value={String(templatesCount)}
          title="Шаблоны"
          hint="шаблонов циклов"
          hintColor="#00B69B"
          spark="#00B69B"
        />
        <Metric
          tint="#FFF4E8"
          icon={<AccessTime sx={{ color: '#FF9F43', fontSize: 20 }} />}
          value={String(recentCycles || recentTemplates)}
          title="Недавно обновлены"
          hint="за последние 7 дней"
          hintColor="#FF9F43"
          spark="#FF9F43"
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2.5, mb: 1.75, borderBottom: '1px solid #EEF1F6' }}>
        <Button
          onClick={() => onSwitchExercises?.()}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            fontSize: 15,
            color: '#8B8C8F',
            borderRadius: 0,
            px: 0.5,
            pb: 1,
            borderBottom: '3px solid transparent',
            minWidth: 0,
          }}
        >
          Упражнения
        </Button>
        <Button
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            fontSize: 15,
            color: colors.primary,
            borderRadius: 0,
            px: 0.5,
            pb: 1,
            borderBottom: `3px solid ${colors.primary}`,
            minWidth: 0,
          }}
        >
          Циклы
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Filter
          label="Филиал"
          value={branchId}
          empty="Все филиалы"
          onChange={setBranchId}
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />
        <Filter
          label="Группа"
          value={groupId}
          empty="Все группы"
          onChange={setGroupId}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
        <Filter
          label="Возраст"
          value={ageKey}
          empty="Все возраста"
          onChange={setAgeKey}
          options={ages.map((a) => ({ value: a, label: a }))}
        />
        <Filter
          label="Период"
          value={period}
          empty="Все периоды"
          onChange={setPeriod}
          options={[
            { value: 'all', label: 'Все периоды' },
            { value: 'month', label: 'Этот месяц' },
            { value: 'quarter', label: 'Этот квартал' },
          ]}
          hideEmpty
        />
        <Filter
          label="Тренер"
          value={trainerId}
          empty="Все тренеры"
          onChange={setTrainerId}
          options={trainers.map((t) => ({ value: t.id, label: t.name }))}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          mb: 1.75,
        }}
      >
        {(
          [
            ['ALL', 'Все циклы', counts.ALL],
            ['ACTIVE', 'Активные', counts.ACTIVE],
            ['DRAFT', 'Черновики', counts.DRAFT],
            ['ARCHIVE', 'Архив', counts.ARCHIVE],
          ] as const
        ).map(([key, label, n]) => {
          const on = status === key;
          return (
            <Chip
              key={key}
              label={`${label} (${n})`}
              onClick={() => setStatus(key)}
              sx={{
                height: 32,
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: 13,
                bgcolor: on ? colors.primary : '#F1F3F7',
                color: on ? '#fff' : '#1B2438',
                '&:hover': { bgcolor: on ? colors.primaryDark : '#E6E8EF' },
              }}
            />
          );
        })}
        <TextField
          size="small"
          placeholder="Поиск цикла по названию или группе..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{
            ml: { md: 'auto' },
            minWidth: { xs: '100%', md: 280 },
            flex: { md: '0 1 320px' },
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              bgcolor: '#fff',
              fontSize: 13,
              '& fieldset': { borderColor: '#E6E9F0' },
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
      </Box>

      {notice && (
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.primary, mb: 1 }}>{notice}</Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr) 292px' },
          alignItems: 'stretch',
          bgcolor: '#fff',
          borderRadius: '18px',
          border: '1px solid #E8ECF3',
          boxShadow: '0 10px 30px rgba(27, 36, 56, 0.05)',
          overflow: 'hidden',
          minHeight: 620,
        }}
      >
        <Box sx={{ p: 1.5, borderRight: { lg: '1px solid #EEF1F6' }, maxHeight: { lg: 'calc(100vh - 250px)' }, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438' }}>Циклы тренировок</Typography>
            <IconButton
              size="small"
              onClick={onCreate}
              sx={{ bgcolor: '#EAF0FF', color: colors.primary, width: 28, height: 28, '&:hover': { bgcolor: '#DCE7FF' } }}
            >
              <Add sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.length === 0 && (
              <Typography sx={{ fontSize: 13, color: '#8B8C8F', py: 2, textAlign: 'center' }}>
                Циклов нет. Создайте первый цикл для группы.
              </Typography>
            )}
            {filtered.map((c, index) => {
              const st = cycleStatus(c);
              const g = groupById.get(c.groups[0]?.groupId);
              const active = c.id === selectedId;
              const prog = c.id === detail?.id ? fillProgress : dateProgress(c);
              return (
                <Box
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  sx={{
                    display: 'flex',
                    gap: 1,
                    p: 1,
                    borderRadius: '14px',
                    cursor: 'pointer',
                    border: active ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                    bgcolor: active ? '#F5F8FF' : '#fff',
                    boxShadow: active ? 'none' : '0 1px 0 #F0F2F6',
                    '&:hover': { bgcolor: '#F7F9FC' },
                  }}
                >
                  <SceneThumb variant={index} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: 13,
                          color: '#1B2438',
                          lineHeight: 1.25,
                          flex: 1,
                        }}
                      >
                        {c.title || c.groups[0]?.group.name || 'Цикл'}
                      </Typography>
                      <StatusPill status={st} />
                    </Box>
                    <Typography sx={{ fontSize: 11, color: '#8B8C8F', mt: 0.25 }}>
                      {c.groups.map((x) => x.group.name).join(', ') || 'Без группы'}
                      {ageLabel(g) ? ` · ${ageLabel(g)}` : ''}
                    </Typography>
                    {c.description ? (
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: '#8B8C8F',
                          mt: 0.15,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.description}
                      </Typography>
                    ) : null}
                    <Typography sx={{ fontSize: 11, color: '#8B8C8F' }}>
                      {format(new Date(c.dateFrom), 'd MMM', { locale: ru })} –{' '}
                      {format(new Date(c.dateTo), 'd MMM yyyy', { locale: ru })}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={prog}
                      sx={{
                        mt: 0.55,
                        height: 4,
                        borderRadius: 99,
                        bgcolor: '#EEF1F6',
                        '& .MuiLinearProgress-bar': { bgcolor: st === 'ARCHIVE' ? '#C5CAD6' : colors.primary, borderRadius: 99 },
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.45 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1B2438' }}>{prog}%</Typography>
                      <Avatar sx={{ width: 16, height: 16, fontSize: 8, bgcolor: '#E8EAF0', color: '#5A6275' }}>
                        {(c.createdBy?.lastName || g?.trainer?.user?.lastName || '?').charAt(0)}
                      </Avatar>
                      <Typography sx={{ fontSize: 11, color: '#5A6275' }}>
                        {personShort(c.createdBy || g?.trainer?.user)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0, borderRight: { lg: '1px solid #EEF1F6' } }}>
          {!selected ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, color: '#1B2438', mb: 1 }}>Выберите цикл</Typography>
              <Button onClick={onCreate} variant="contained" startIcon={<Add />} sx={primaryBtn}>
                Цикл
              </Button>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', mb: 1.5 }}>
                <SceneThumb variant={Math.max(filtered.findIndex((c) => c.id === selected.id), 0)} size={64} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438', letterSpacing: '-0.02em' }}>
                      {selected.title || primaryGroup?.name || 'Цикл'}
                    </Typography>
                    <StatusPill status={cycleStatus(selected)} />
                    {ageLabel(primaryGroup) && (
                      <Chip
                        size="small"
                        label={ageLabel(primaryGroup)}
                        sx={{ bgcolor: '#EAF0FF', color: colors.primary, fontWeight: 700, height: 22, fontSize: 11 }}
                      />
                    )}
                  </Box>
                  {selected.description ? (
                    <Typography sx={{ fontSize: 13, color: '#5A6275', mt: 0.5, fontWeight: 600 }}>
                      {selected.description}
                    </Typography>
                  ) : null}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 0.6, color: '#5A6275' }}>
                    <Meta icon={<GroupsOutlined sx={{ fontSize: 15 }} />} text={selected.groups.map((g) => g.group.name).join(', ') || '—'} />
                    <Meta icon={<LocationOnOutlined sx={{ fontSize: 15 }} />} text={primaryGroup?.branch?.name || 'Филиал не указан'} />
                    <Meta icon={<PersonOutline sx={{ fontSize: 15 }} />} text={personShort(selected.createdBy || primaryGroup?.trainer?.user)} />
                    <Meta icon={<CalendarMonthOutlined sx={{ fontSize: 15 }} />} text={`Период: ${periodLabel(selected)}`} />
                  </Box>
                </Box>
                <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                  <Button
                    variant="outlined"
                    startIcon={<SaveOutlined sx={{ fontSize: 16 }} />}
                    onClick={() => setNotice('Изменения уже сохранены в планах занятий')}
                    sx={{ ...ghostBtn, color: colors.primary, borderColor: '#C9D7FF', height: 36, px: 1.25 }}
                  >
                    Сохранить
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SendOutlined sx={{ fontSize: 15 }} />}
                    onClick={() => setNotice('Цикл отмечен как опубликованный для команды')}
                    sx={{ ...primaryBtn, height: 36, px: 1.5 }}
                  >
                    Опубликовать
                  </Button>
                </Stack>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Stat iconBg="#F3EEFF" iconColor="#7E57C2" icon={<FitnessCenter sx={{ fontSize: 16 }} />} value={String(detail?.preview?.total ?? selected._count?.sessionPlans ?? 0)} label="Тренировок в цикле" />
                <Stat iconBg="#EAF0FF" iconColor={colors.primary} icon={<DescriptionOutlined sx={{ fontSize: 16 }} />} value={String(exerciseCount)} label="Упражнений" />
                <Stat iconBg="#FFF4E8" iconColor="#FF9F43" icon={<AccessTime sx={{ fontSize: 16 }} />} value={avgMinutes ? `${avgMinutes} мин` : '—'} label="Средняя длительность" />
                <Stat iconBg="#E7F8F2" iconColor="#00B69B" icon={null} ring={fillProgress} value={`${fillProgress}%`} label="Прогресс заполнения" />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.25, overflowX: 'auto' }}>
                {weeks.map((w, i) => {
                  const on = i === Math.min(weekIdx, weeks.length - 1);
                  return (
                    <Button
                      key={w.index}
                      onClick={() => setWeekIdx(i)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: '12px',
                        px: 1.25,
                        py: 0.6,
                        minWidth: 0,
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        bgcolor: on ? '#EAF0FF' : 'transparent',
                        color: on ? colors.primary : '#1B2438',
                        borderBottom: on ? `2px solid ${colors.primary}` : '2px solid transparent',
                        '&:hover': { bgcolor: '#F5F8FF' },
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>Неделя {w.index}</Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: on ? colors.primary : '#8B8C8F' }}>
                        {format(w.start, 'd', { locale: ru })}–{format(w.end, 'd MMM', { locale: ru })}
                      </Typography>
                    </Button>
                  );
                })}
                <Box sx={{ flex: 1 }} />
                <Button
                  onClick={() => setNotice('Дни берутся из занятий группы в периоде цикла')}
                  sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary, whiteSpace: 'nowrap' }}
                >
                  + Добавить день
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
                {dayColumns.length === 0 && (
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 180,
                      borderRadius: '14px',
                      border: '1.5px dashed #D5DCEC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#8B8C8F',
                      fontSize: 13,
                      fontWeight: 600,
                      px: 2,
                      textAlign: 'center',
                    }}
                  >
                    В этой неделе нет занятий. Они появятся из расписания выбранных групп.
                  </Box>
                )}
                {dayColumns.map((col) => {
                  const color = DAY_TONE[col.date.getDay()] || colors.primary;
                  const planMinutes = col.items.reduce((sum: number, t: PreviewTraining) => {
                    const items = plans[t.id]?.items || [];
                    return (
                      sum +
                      items.reduce((inner: number, it: any) => inner + (it.durationSec ? it.durationSec / 60 : 0), 0)
                    );
                  }, 0);
                  const minutes = planMinutes || col.items.reduce((sum: number, t: PreviewTraining) => {
                    if (!t.endTime) return sum;
                    const diff = (new Date(t.endTime).getTime() - new Date(t.startTime).getTime()) / 60000;
                    return sum + (diff > 0 ? diff : 0);
                  }, 0);
                  return (
                    <Box
                      key={format(col.date, 'yyyy-MM-dd')}
                      sx={{
                        minWidth: 220,
                        flex: '1 0 220px',
                        bgcolor: '#F8F9FC',
                        borderRadius: '16px',
                        p: 1.1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1, px: 0.4 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 14, color, textTransform: 'capitalize' }}>
                          {format(col.date, 'EEEE', { locale: ru })}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: '#8B8C8F', fontWeight: 600 }}>
                          {minutes ? `${Math.round(minutes)} мин` : '—'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                        {col.items.flatMap((t: PreviewTraining) => {
                          const items = plans[t.id]?.items || [];
                          return items.map((it: any) => {
                            const category =
                              it.section === 'WARMUP'
                                ? 'Разминка'
                                : /замин|восстанов|гибкост/i.test(String(it.exercise?.category || ''))
                                  ? 'Заминка'
                                  : it.exercise?.category || 'Основная часть';
                            return (
                              <ExerciseCard
                                key={it.id}
                                title={it.exercise?.title || 'Упражнение'}
                                category={category}
                                minutes={it.durationSec ? Math.round(it.durationSec / 60) : undefined}
                                busy={busyId === t.id}
                                onDelete={() => void removeItem(t.id, it.id)}
                              />
                            );
                          });
                        })}
                        <Button
                          fullWidth
                          disabled={!col.items[0]}
                          onClick={() => {
                            setAddTargetId(col.items[0].id);
                            setNotice('Выберите упражнение в библиотеке справа');
                          }}
                          sx={{
                            mt: 0.25,
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 12,
                            color: colors.primary,
                            border: '1.5px dashed #B9CBFF',
                            borderRadius: '12px',
                            py: 1,
                            bgcolor: '#fff',
                          }}
                        >
                          + Добавить упражнение
                        </Button>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </>
          )}
        </Box>

        <Box sx={{ p: 1.5, maxHeight: { lg: 'calc(100vh - 250px)' }, overflow: 'auto', bgcolor: '#FBFCFE' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438', mb: 1 }}>Библиотека упражнений</Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Найти упражнение..."
            value={libQuery}
            onChange={(e) => setLibQuery(e.target.value)}
            sx={{
              mb: 1,
              '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: 13, '& fieldset': { borderColor: '#E6E9F0' } },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: '#9AA3B5' }} />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.25 }}>
            {categories.filter((c) => c !== 'Все').slice(0, 4).map((cat) => {
              const on = libCat === cat;
              const style = catStyle(cat);
              return (
                <Chip
                  key={cat}
                  label={cat}
                  size="small"
                  onClick={() => setLibCat(on ? 'Все' : cat)}
                  sx={{
                    height: 26,
                    fontWeight: 700,
                    fontSize: 12,
                    bgcolor: on ? style.bg : '#F4F6FA',
                    color: on ? style.fg : '#5A6275',
                    border: on ? `1px solid ${style.bar}` : '1px solid transparent',
                  }}
                />
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {library.slice(0, 30).map((ex) => {
              const style = catStyle(ex.category);
              return (
                <Box
                  key={ex.id}
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    p: 0.75,
                    borderRadius: '12px',
                    border: '1px solid #F0F2F6',
                  }}
                >
                  <ExerciseThumb media={ex.media?.[0]} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1B2438', lineHeight: 1.25 }}>
                      {ex.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.4, alignItems: 'center' }}>
                      {ex.category && (
                        <Chip label={ex.category} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: style.bg, color: style.fg }} />
                      )}
                      {ageLabel(primaryGroup) && (
                        <Typography sx={{ fontSize: 10, color: '#8B8C8F', fontWeight: 600 }}>{ageLabel(primaryGroup)}</Typography>
                      )}
                      <Typography sx={{ fontSize: 10, color: '#8B8C8F', fontWeight: 700 }}>10 мин</Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    disabled={!targetTrainingId}
                    onClick={() => targetTrainingId && void addToTraining(targetTrainingId, ex)}
                    sx={{ bgcolor: '#EAF0FF', color: colors.primary, width: 28, height: 28, '&:hover': { bgcolor: '#DCE7FF' } }}
                  >
                    <Add sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              );
            })}
            {library.length === 0 && (
              <Typography sx={{ fontSize: 13, color: '#8B8C8F', textAlign: 'center', py: 2 }}>
                Упражнений не найдено
              </Typography>
            )}
          </Box>
          <Button
            fullWidth
            onClick={onOpenExercise}
            startIcon={<Add />}
            sx={{ ...ghostBtn, mt: 1.25, border: '1.5px dashed #B9CBFF', color: colors.primary }}
          >
            Новое упражнение
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

function Metric({
  tint,
  icon,
  value,
  title,
  hint,
  hintColor,
  spark,
}: {
  tint: string;
  icon: React.ReactNode;
  value: string;
  title: string;
  hint: string;
  hintColor: string;
  spark: string;
}) {
  return (
    <Box sx={{ ...cardSx, p: '14px 16px', display: 'flex', gap: 1.25, alignItems: 'center', minHeight: 92 }}>
      <Avatar sx={{ bgcolor: tint, width: 42, height: 42 }}>{icon}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#1B2438', lineHeight: 1 }}>{value}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', mt: 0.4 }}>{title}</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: hintColor, mt: 0.15 }}>{hint}</Typography>
      </Box>
      <Spark color={spark} />
    </Box>
  );
}

function Filter({
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
        <Box sx={{ py: 0.15 }}>
          <Typography sx={{ fontSize: 10, color: '#8B8C8F', lineHeight: 1.1 }}>{label}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', lineHeight: 1.3 }}>
            {current?.label || empty}
          </Typography>
        </Box>
      )}
      sx={{
        minWidth: 150,
        flex: '1 1 150px',
        borderRadius: '12px',
        bgcolor: '#fff',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E9F0' },
        '& .MuiSelect-select': { py: 0.75 },
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

function StatusPill({ status }: { status: Exclude<StatusKey, 'ALL'> }) {
  const map = {
    ACTIVE: { label: 'Активен', bg: '#E7F8F2', fg: '#00997A' },
    DRAFT: { label: 'Черновик', bg: '#F1F3F7', fg: '#5A6275' },
    ARCHIVE: { label: 'Архив', bg: '#F4F6FA', fg: '#8B8C8F' },
  }[status];
  return (
    <Chip
      label={map.label}
      size="small"
      sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: map.bg, color: map.fg }}
    />
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, fontSize: 12, fontWeight: 600 }}>
      <Box sx={{ color: '#9AA3B5', display: 'flex' }}>{icon}</Box>
      {text}
    </Box>
  );
}

function Ring({ value, color }: { value: number; color: string }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r={r} stroke="#E7F8F2" strokeWidth="4" fill="none" />
      <circle
        cx="17"
        cy="17"
        r={r}
        stroke={color}
        strokeWidth="4"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 17 17)"
      />
    </svg>
  );
}

function Stat({
  iconBg,
  iconColor,
  value,
  label,
  icon,
  ring,
}: {
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  icon: React.ReactNode;
  ring?: number;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: '#F7F8FB', borderRadius: '14px', px: 1.25, py: 1 }}>
      {ring != null ? (
        <Ring value={ring} color={iconColor} />
      ) : (
        <Avatar sx={{ bgcolor: iconBg, color: iconColor, width: 34, height: 34 }}>{icon}</Avatar>
      )}
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438', lineHeight: 1.05 }}>{value}</Typography>
        <Typography sx={{ fontSize: 11, color: '#8B8C8F', lineHeight: 1.25 }}>{label}</Typography>
      </Box>
    </Box>
  );
}

function ExerciseCard({
  title,
  category,
  minutes,
  onDelete,
  hideDelete,
  busy,
}: {
  title: string;
  category: string;
  minutes?: number;
  onDelete: () => void;
  hideDelete?: boolean;
  busy?: boolean;
}) {
  const style = catStyle(category);
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.4,
        alignItems: 'flex-start',
        bgcolor: '#fff',
        borderRadius: '12px',
        px: 0.6,
        py: 0.7,
        borderLeft: `3px solid ${style.bar}`,
        boxShadow: '0 1px 3px rgba(27,36,56,0.04)',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <DragIndicator sx={{ fontSize: 16, color: '#C5CAD6', mt: 0.2 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#1B2438', lineHeight: 1.25, flex: 1 }}>
            {title}
          </Typography>
          {minutes ? (
            <Typography sx={{ fontSize: 11, color: '#8B8C8F', fontWeight: 700, whiteSpace: 'nowrap' }}>{minutes} мин</Typography>
          ) : null}
        </Box>
        <Chip label={category} size="small" sx={{ mt: 0.4, height: 18, fontSize: 10, fontWeight: 700, bgcolor: style.bg, color: style.fg }} />
      </Box>
      {!hideDelete && (
        <IconButton size="small" onClick={onDelete} sx={{ color: '#F93C65', p: 0.2 }}>
          <DeleteOutline sx={{ fontSize: 15 }} />
        </IconButton>
      )}
    </Box>
  );
}

const primaryBtn = {
  textTransform: 'none' as const,
  fontWeight: 700,
  borderRadius: '10px',
  bgcolor: colors.primary,
  boxShadow: 'none',
  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
};

const ghostBtn = {
  textTransform: 'none' as const,
  fontWeight: 700,
  borderRadius: '10px',
  borderColor: '#D5DCEC',
  color: '#1B2438',
  bgcolor: '#fff',
};

export default CyclesBoard;
