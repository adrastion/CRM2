import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessTime,
  Add,
  CategoryOutlined,
  Close,
  ContentCopyOutlined,
  EditOutlined,
  FitnessCenter,
  Inventory2Outlined,
  Search,
  SignalCellularAlt,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';

type Media = { id: string; kind: string; mimeType: string };
export type CatalogExercise = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  sets?: number | null;
  reps?: number | null;
  restSec?: number | null;
  difficulty?: string | null;
  inventory?: string | null;
  updatedAt?: string;
  media?: Media[];
};

type Template = { id: string; updatedAt?: string };

type Props = {
  exercises: CatalogExercise[];
  templates: Template[];
  loading: boolean;
  query: string;
  onQuery: (q: string) => void;
  onCreate: () => void;
  onEdit: (ex: CatalogExercise) => void;
  onDuplicate: (ex: CatalogExercise) => void;
  onAddToTemplate: (ex: CatalogExercise) => void;
  onUpload: (exerciseId: string, file: File | null) => void;
  onSwitchCycles: () => void;
};

const PREFERRED = [
  'Разминка',
  'Координация',
  'Сила',
  'Выносливость',
  'Скорость',
  'Гибкость',
  'Техника',
  'Игровые упражнения',
  'Восстановление',
  'Другое',
];

const CAT_STYLE: Record<string, { bg: string; fg: string }> = {
  Разминка: { bg: '#FFE8EE', fg: '#E23B5A' },
  Координация: { bg: '#F3EEFF', fg: '#7E57C2' },
  Сила: { bg: '#FFF3E6', fg: '#E07A12' },
  Скорость: { bg: '#EAF0FF', fg: '#2F6BFF' },
  Гибкость: { bg: '#E7F8F2', fg: '#00997A' },
  Техника: { bg: '#EAF0FF', fg: '#2F6BFF' },
  Реакция: { bg: '#FFE8EE', fg: '#E23B5A' },
  Игровое: { bg: '#FFF3E6', fg: '#E07A12' },
  Восстановление: { bg: '#E7F8F2', fg: '#00997A' },
};

function styleOf(name?: string | null) {
  if (!name) return { bg: '#F4F6FA', fg: '#5A6275' };
  return CAT_STYLE[name] || { bg: '#F4F6FA', fg: '#5A6275' };
}

function Spark({ color }: { color: string }) {
  return (
    <svg width="72" height="28" viewBox="0 0 72 28" aria-hidden>
      <path
        d="M2 18 C 12 16, 16 12, 24 14 S 36 6, 44 9 S 56 4, 70 6"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Thumb({ media, tall }: { media?: Media; tall?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!media?.id || media.kind === 'video') return;
    let revoked: string | null = null;
    let stop = false;
    (async () => {
      try {
        const blob = await apiService.getExerciseMediaBlob(media.id);
        if (stop) return;
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      stop = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [media?.id, media?.kind]);
  return (
    <Box
      sx={{
        height: tall ? 168 : 132,
        borderRadius: tall ? 0 : '12px',
        bgcolor: '#E8EEF8',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: url ? undefined : 'linear-gradient(160deg, #7EB6FF 0%, #3CB371 70%)',
      }}
    >
      {url ? (
        <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <FitnessCenter sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 36 }} />
      )}
    </Box>
  );
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '16px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 8px 24px rgba(27, 36, 56, 0.05)',
};

const ExerciseCatalog: React.FC<Props> = ({
  exercises,
  templates,
  loading,
  query,
  onQuery,
  onCreate,
  onEdit,
  onDuplicate,
  onAddToTemplate,
  onUpload,
  onSwitchCycles,
}) => {
  const [category, setCategory] = useState('ALL');
  const [level, setLevel] = useState('');
  const [inventory, setInventory] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState('popular');

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    exercises.forEach((ex) => {
      const key = ex.category?.trim() || 'Другое';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const names = Array.from(new Set([...PREFERRED, ...Array.from(counts.keys())]));
    return names
      .map((name) => ({ name, count: counts.get(name) || 0 }))
      .filter((row) => row.count > 0 || PREFERRED.includes(row.name));
  }, [exercises]);

  const levels = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((ex) => {
      if (ex.difficulty) set.add(ex.difficulty);
    });
    return Array.from(set);
  }, [exercises]);

  const inventories = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((ex) => {
      if (ex.inventory) set.add(ex.inventory);
    });
    return Array.from(set);
  }, [exercises]);

  const filtered = useMemo(() => {
    let rows = exercises.filter((ex) => {
      const cat = ex.category?.trim() || 'Другое';
      if (category !== 'ALL' && cat !== category) return false;
      if (level && (ex.difficulty || '') !== level) return false;
      if (inventory === '__none__' && ex.inventory) return false;
      if (inventory && inventory !== '__none__' && (ex.inventory || '') !== inventory) return false;
      return true;
    });
    if (sort === 'name') rows = [...rows].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    if (sort === 'new') {
      rows = [...rows].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    }
    return rows;
  }, [exercises, category, level, inventory, sort]);

  const selected = filtered.find((ex) => ex.id === selectedId) || filtered[0] || null;

  const recent = useMemo(() => {
    const edge = Date.now() - 7 * 24 * 3600 * 1000;
    return exercises.filter((ex) => ex.updatedAt && new Date(ex.updatedAt).getTime() >= edge).length;
  }, [exercises]);

  const categoryCount = categories.filter((c) => c.count > 0).length;

  const reset = () => {
    setCategory('ALL');
    setLevel('');
    setInventory('');
    onQuery('');
  };

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
        <Metric icon={<FitnessCenter sx={{ color: colors.primary }} />} tint="#EAF0FF" value={String(exercises.length)} title="Всего упражнений" hint="в каталоге" hintColor="#00B69B" spark={colors.primary} />
        <Metric icon={<CategoryOutlined sx={{ color: '#7E57C2' }} />} tint="#F3EEFF" value={String(categoryCount)} title="Категории" hint="с упражнениями" hintColor="#7E57C2" spark="#7E57C2" />
        <Metric icon={<FitnessCenter sx={{ color: '#00B69B' }} />} tint="#E7F8F2" value={String(templates.length)} title="Шаблоны" hint="разминки и тренировок" hintColor="#00B69B" spark="#00B69B" />
        <Metric icon={<AccessTime sx={{ color: '#FF9F43' }} />} tint="#FFF4E8" value={String(recent)} title="Недавно обновлены" hint="за последние 7 дней" hintColor="#FF9F43" spark="#FF9F43" />
      </Box>

      <Box sx={{ display: 'flex', gap: 2.5, mb: 1.5, borderBottom: '1px solid #EEF1F6' }}>
        <TabBtn active label="Упражнения" />
        <TabBtn label="Циклы" onClick={onSwitchCycles} />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Поиск упражнений по названию, описанию или тегам..."
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          sx={{
            flex: '1 1 280px',
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
        <MiniFilter label="Все категории" value={category === 'ALL' ? '' : category} empty="Все категории" onChange={(v) => setCategory(v || 'ALL')} options={categories.filter((c) => c.count).map((c) => ({ value: c.name, label: c.name }))} />
        <MiniFilter label="Уровень" value={level} empty="Уровень" onChange={setLevel} options={levels.map((l) => ({ value: l, label: l }))} />
        <MiniFilter label="Инвентарь" value={inventory} empty="Инвентарь" onChange={setInventory} options={[{ value: '__none__', label: 'Без инвентаря' }, ...inventories.map((i) => ({ value: i, label: i }))]} />
        <Button onClick={reset} sx={{ textTransform: 'none', fontWeight: 700, color: '#8B8C8F' }}>
          Сбросить
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: selected ? '240px minmax(0,1fr) 300px' : '240px minmax(0,1fr)' },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ ...cardSx, p: 1.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#8B8C8F', mb: 1, letterSpacing: '0.04em' }}>
            КАТЕГОРИИ УПРАЖНЕНИЙ
          </Typography>
          <SideRow
            active={category === 'ALL'}
            label="Все упражнения"
            count={exercises.length}
            onClick={() => setCategory('ALL')}
          />
          {categories.filter((c) => c.count > 0).map((c) => (
            <SideRow
              key={c.name}
              active={category === c.name}
              label={c.name}
              count={c.count}
              onClick={() => setCategory(c.name)}
            />
          ))}
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#8B8C8F', mt: 2, mb: 1, letterSpacing: '0.04em' }}>
            СОХРАНЁННЫЕ ФИЛЬТРЫ
          </Typography>
          <SideRow label="Разминка" count={categories.find((c) => c.name === 'Разминка')?.count || 0} onClick={() => setCategory('Разминка')} />
          <SideRow label="Без инвентаря" onClick={() => setInventory('__none__')} />
          <SideRow label="Силовая подготовка" onClick={() => setCategory('Сила')} />
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25, gap: 1 }}>
            <Typography sx={{ fontWeight: 800, color: '#1B2438', flex: 1 }}>
              {loading ? 'Загрузка…' : `Найдено упражнений: ${filtered.length}`}
            </Typography>
            <Select
              size="small"
              value={sort}
              onChange={(e) => setSort(String(e.target.value))}
              sx={{ borderRadius: '10px', fontSize: 13, fontWeight: 700, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E9F0' } }}
            >
              <MenuItem value="popular">По популярности</MenuItem>
              <MenuItem value="name">По названию</MenuItem>
              <MenuItem value="new">Сначала новые</MenuItem>
            </Select>
          </Box>

          {filtered.length === 0 ? (
            <Box sx={{ ...cardSx, p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#8B8C8F', mb: 1.5 }}>Каталог пуст — добавьте первое упражнение</Typography>
              <Button variant="contained" startIcon={<Add />} onClick={onCreate} sx={primaryBtn}>
                Упражнение
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.25 }}>
              {filtered.map((ex) => {
                const cat = ex.category || 'Другое';
                const st = styleOf(cat);
                const on = selected?.id === ex.id;
                return (
                  <Box
                    key={ex.id}
                    onClick={() => setSelectedId(ex.id)}
                    sx={{
                      ...cardSx,
                      p: 1.25,
                      cursor: 'pointer',
                      borderColor: on ? colors.primary : '#EEF1F6',
                    }}
                  >
                    <Thumb media={ex.media?.[0]} />
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438', flex: 1 }}>{ex.title}</Typography>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(ex); }}>
                        <EditOutlined sx={{ fontSize: 16, color: '#9AA3B5' }} />
                      </IconButton>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: '#6B7280',
                        minHeight: 32,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {ex.description || 'Без описания'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', my: 0.75 }}>
                      <Chip size="small" label={cat} sx={{ height: 20, fontSize: 10, fontWeight: 800, bgcolor: st.bg, color: st.fg }} />
                      {ex.difficulty && (
                        <Chip size="small" label={ex.difficulty} sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#F4F6FA', color: '#5A6275' }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.25, color: '#8B8C8F', fontSize: 11, fontWeight: 700 }}>
                      {ex.difficulty && <span>{ex.difficulty}</span>}
                      <span>{ex.inventory || 'Без инвентаря'}</span>
                      {ex.restSec ? <span>{ex.restSec >= 60 ? `${Math.round(ex.restSec / 60)} мин` : `${ex.restSec} сек`}</span> : null}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {selected && (
          <Box sx={{ ...cardSx, overflow: 'hidden', position: { lg: 'sticky' }, top: 12 }}>
            <Box sx={{ position: 'relative' }}>
              <Thumb media={selected.media?.[0]} tall />
              <IconButton
                size="small"
                onClick={() => setSelectedId(null)}
                sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)' }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <Box sx={{ p: 1.75 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438' }}>{selected.title}</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', my: 1 }}>
                <Chip size="small" label={selected.category || 'Другое'} sx={{ height: 22, fontWeight: 800, fontSize: 11, bgcolor: styleOf(selected.category).bg, color: styleOf(selected.category).fg }} />
                {selected.difficulty && <Chip size="small" label={selected.difficulty} sx={{ height: 22, fontWeight: 700, fontSize: 11, bgcolor: '#F4F6FA' }} />}
              </Box>
              <Typography sx={{ fontSize: 13, color: '#5A6275', lineHeight: 1.45, mb: 1.5 }}>
                {selected.description || 'Описание не заполнено.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
                <Meta icon={<SignalCellularAlt sx={{ fontSize: 16 }} />} label="Уровень" value={selected.difficulty || '—'} />
                <Meta icon={<AccessTime sx={{ fontSize: 16 }} />} label="Отдых" value={selected.restSec ? `${selected.restSec} сек` : '—'} />
                <Meta icon={<Inventory2Outlined sx={{ fontSize: 16 }} />} label="Инвентарь" value={selected.inventory || 'Не требуется'} />
              </Box>
              {(selected.sets || selected.reps) && (
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', mb: 1.5 }}>
                  {selected.sets ? `${selected.sets} подхода` : ''}{selected.sets && selected.reps ? ' · ' : ''}{selected.reps ? `${selected.reps} повторений` : ''}
                </Typography>
              )}
              <Button fullWidth variant="contained" startIcon={<Add />} onClick={() => onAddToTemplate(selected)} sx={{ ...primaryBtn, mb: 1 }}>
                Добавить в шаблон
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="outlined" startIcon={<EditOutlined />} onClick={() => onEdit(selected)} sx={ghostBtn}>
                  Редактировать
                </Button>
                <Button fullWidth variant="outlined" startIcon={<ContentCopyOutlined />} onClick={() => onDuplicate(selected)} sx={ghostBtn}>
                  Дублировать
                </Button>
              </Box>
              <Button component="label" fullWidth sx={{ mt: 1, textTransform: 'none', fontWeight: 700, color: colors.primary }}>
                Загрузить фото или видео
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                  onChange={(e) => onUpload(selected.id, e.target.files?.[0] || null)}
                />
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

function Metric(props: {
  icon: React.ReactNode;
  tint: string;
  value: string;
  title: string;
  hint: string;
  hintColor: string;
  spark: string;
}) {
  return (
    <Box sx={{ ...cardSx, p: '14px 16px', display: 'flex', gap: 1.25, alignItems: 'center', minHeight: 92 }}>
      <Avatar sx={{ bgcolor: props.tint, width: 42, height: 42 }}>{props.icon}</Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#1B2438', lineHeight: 1 }}>{props.value}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', mt: 0.35 }}>{props.title}</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: props.hintColor }}>{props.hint}</Typography>
      </Box>
      <Spark color={props.spark} />
    </Box>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <Button
      onClick={onClick}
      sx={{
        textTransform: 'none',
        fontWeight: 800,
        fontSize: 15,
        color: active ? colors.primary : '#8B8C8F',
        borderRadius: 0,
        px: 0.5,
        pb: 1,
        minWidth: 0,
        borderBottom: active ? `3px solid ${colors.primary}` : '3px solid transparent',
      }}
    >
      {label}
    </Button>
  );
}

function MiniFilter({
  label,
  value,
  empty,
  options,
  onChange,
}: {
  label: string;
  value: string;
  empty: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Select
      size="small"
      value={value}
      displayEmpty
      onChange={(e) => onChange(String(e.target.value))}
      renderValue={() => (
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438' }}>{current?.label || empty || label}</Typography>
      )}
      sx={{
        minWidth: 130,
        borderRadius: '12px',
        bgcolor: '#fff',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E9F0' },
      }}
    >
      <MenuItem value="">{empty}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
      ))}
    </Select>
  );
}

function SideRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1,
        py: 0.7,
        borderRadius: '10px',
        cursor: 'pointer',
        bgcolor: active ? '#EAF0FF' : 'transparent',
        color: active ? colors.primary : '#1B2438',
        '&:hover': { bgcolor: active ? '#EAF0FF' : '#F7F8FB' },
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{label}</Typography>
      {count != null && (
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: active ? colors.primary : '#8B8C8F' }}>{count}</Typography>
      )}
    </Box>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 72 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: '#8B8C8F' }}>
        {icon}
        <Typography sx={{ fontSize: 11 }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#1B2438' }}>{value}</Typography>
    </Box>
  );
}

const primaryBtn = {
  textTransform: 'none' as const,
  fontWeight: 700,
  borderRadius: '12px',
  bgcolor: colors.primary,
  boxShadow: 'none',
  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
};

const ghostBtn = {
  textTransform: 'none' as const,
  fontWeight: 700,
  borderRadius: '12px',
  borderColor: '#E3E6EE',
  color: '#1B2438',
};

export default ExerciseCatalog;
