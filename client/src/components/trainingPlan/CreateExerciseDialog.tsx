import React, { useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Check,
  Close,
  CloudUploadOutlined,
  FitnessCenter,
  InfoOutlined,
  Link as LinkIcon,
  LocalOfferOutlined,
  PlayCircleOutline,
  Replay,
  SportsTennis,
  TimerOutlined,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';

export const EXERCISE_CATEGORIES = [
  'Силовые упражнения',
  'Кардио',
  'Растяжка и мобильность',
  'Разминка',
  'Координация',
  'Ударная техника',
  'Бросковая техника',
  'ОФП',
  'Другое',
] as const;

export const EXERCISE_TYPES = [
  'Силовое',
  'Кардио',
  'Растяжка',
  'Плиометрика',
  'Техническое',
  'Игровое',
] as const;

export const INVENTORY_OPTIONS = [
  'Не требуется',
  'Гантели',
  'Штанга',
  'Резинка',
  'Медбол',
  'Скакалка',
  'Турник',
  'Скамейка',
  'Коврик',
] as const;

export const DIFFICULTY_OPTIONS = ['Начальный', 'Средний', 'Продвинутый'] as const;
export const TEMPO_OPTIONS = ['Медленный', 'Средний', 'Быстрый'] as const;

export const TAG_SUGGESTIONS = [
  'ноги',
  'руки',
  'корпус',
  'выносливость',
  'сила',
  'гибкость',
  'начальный уровень',
  'разминка',
  'кардио',
] as const;

const DESC_MAX = 1000;

type MediaRow = {
  id: string;
  kind: string;
  mimeType: string;
  originalName?: string;
};

type ExerciseEdit = {
  id: string;
  title: string;
  description?: string;
  category?: string | null;
  exerciseType?: string | null;
  sets?: number | null;
  reps?: number | null;
  restSec?: number | null;
  difficulty?: string | null;
  inventory?: string | null;
  tempo?: string | null;
  videoUrl?: string | null;
  tags?: string | string[] | null;
  media?: MediaRow[];
};

type PendingFile = {
  key: string;
  file: File;
  previewUrl: string;
};

type Props = {
  open: boolean;
  editing?: ExerciseEdit | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError?: (message: string) => void;
};

function parseTags(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    /* ignore */
  }
  return String(raw)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff', fontWeight: 600 },
  '& .MuiInputLabel-root': { fontWeight: 700 },
};

function SectionHead({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25, mt: 0.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: '#EEF4FF',
          color: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1B2438' }}>{title}</Typography>
    </Stack>
  );
}

const CreateExerciseDialog: React.FC<Props> = ({
  open,
  editing,
  onClose,
  onSaved,
  onError,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [exerciseType, setExerciseType] = useState<string>(EXERCISE_TYPES[0]);
  const [inventory, setInventory] = useState<string>(INVENTORY_OPTIONS[0]);
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTY_OPTIONS[0]);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('12');
  const [restSec, setRestSec] = useState('60');
  const [tempo, setTempo] = useState<string>(TEMPO_OPTIONS[1]);
  const [videoUrl, setVideoUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [addToTemplates, setAddToTemplates] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaRow[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title || '');
      setCategory(editing.category || '');
      setDescription(editing.description || '');
      setExerciseType(editing.exerciseType || EXERCISE_TYPES[0]);
      setInventory(editing.inventory || INVENTORY_OPTIONS[0]);
      setDifficulty(editing.difficulty || DIFFICULTY_OPTIONS[0]);
      setSets(editing.sets != null ? String(editing.sets) : '3');
      setReps(editing.reps != null ? String(editing.reps) : '12');
      setRestSec(editing.restSec != null ? String(editing.restSec) : '60');
      setTempo(editing.tempo || TEMPO_OPTIONS[1]);
      setVideoUrl(editing.videoUrl || '');
      setTags(parseTags(editing.tags));
      setAddToTemplates(false);
      setExistingMedia(editing.media || []);
      setRemovedMediaIds([]);
    } else {
      setTitle('');
      setCategory('');
      setDescription('');
      setExerciseType(EXERCISE_TYPES[0]);
      setInventory(INVENTORY_OPTIONS[0]);
      setDifficulty(DIFFICULTY_OPTIONS[0]);
      setSets('3');
      setReps('12');
      setRestSec('60');
      setTempo(TEMPO_OPTIONS[1]);
      setVideoUrl('');
      setTags([]);
      setAddToTemplates(true);
      setExistingMedia([]);
      setRemovedMediaIds([]);
    }
    setPendingFiles((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setSaving(false);
  }, [open, editing]);

  useEffect(
    () => () => {
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next: PendingFile[] = [];
    Array.from(list).forEach((file) => {
      const ok =
        /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) ||
        /^video\/(mp4|webm)$/i.test(file.type);
      if (!ok || file.size > 50 * 1024 * 1024) return;
      next.push({
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });
    if (next.length) setPendingFiles((prev) => [...prev, ...next]);
  };

  const removePending = (key: string) => {
    setPendingFiles((prev) => {
      const hit = prev.find((p) => p.key === key);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  };

  const payload = () => ({
    title: title.trim(),
    description: description.slice(0, DESC_MAX),
    category: category.trim(),
    exerciseType: exerciseType || null,
    sets: sets === '' ? null : Number(sets),
    reps: reps === '' ? null : Number(reps),
    restSec: restSec === '' ? null : Number(restSec),
    difficulty: difficulty || null,
    inventory: inventory || null,
    tempo: tempo || null,
    videoUrl: videoUrl.trim() || null,
    tags,
  });

  const canSave = Boolean(title.trim() && category.trim());

  const save = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      let exerciseId = editing?.id;
      if (editing) {
        await apiService.updateExercise(editing.id, payload());
        for (const mid of removedMediaIds) {
          try {
            await apiService.deleteExerciseMedia(editing.id, mid);
          } catch {
            /* continue */
          }
        }
      } else {
        const created = await apiService.createExercise(payload());
        exerciseId = created.id;
      }

      if (exerciseId && pendingFiles.length) {
        for (const pf of pendingFiles) {
          try {
            await apiService.uploadExerciseMedia(exerciseId, pf.file);
          } catch {
            /* continue */
          }
        }
      }

      if (!editing && addToTemplates && exerciseId) {
        try {
          await apiService.createWorkoutTemplate({
            title: title.trim(),
            kind: 'WORKOUT',
            items: [
              {
                exerciseId,
                sortOrder: 0,
                sets: sets === '' ? null : Number(sets),
                reps: reps === '' ? null : Number(reps),
                durationSec: null,
                notes: null,
              },
            ],
          });
        } catch {
          /* non-blocking */
        }
      }

      await onSaved();
      onClose();
    } catch (e: any) {
      onError?.(e?.response?.data?.error || 'Не удалось сохранить упражнение');
    } finally {
      setSaving(false);
    }
  };

  const visibleExisting = existingMedia.filter((m) => !removedMediaIds.includes(m.id));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: `${radii.panel}px` },
          bgcolor: '#fff',
          boxShadow: '0 16px 48px rgba(27, 36, 56, 0.18)',
          maxHeight: '92vh',
        },
      }}
    >
      <Box sx={{ px: 3, pt: 2.5, pb: 1, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: '#EEF4FF',
            color: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FitnessCenter />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438' }}>
            {editing ? 'Редактировать упражнение' : 'Новое упражнение'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#8B93A7', fontWeight: 600, mt: 0.25 }}>
            Создайте упражнение для тренировочного плана. Его можно будет использовать в планах
            тренировок и в шаблонах.
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#8B93A7' }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pt: 1.5, pb: 1 }}>
        <SectionHead icon={<InfoOutlined sx={{ fontSize: 16 }} />} title="Основная информация" />
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            required
            fullWidth
            label="Название упражнения"
            placeholder="Например: Приседания с собственным весом"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={fieldSx}
          />
          <Box>
            <Typography sx={{ mb: 0.5, fontSize: 13, fontWeight: 700, color: '#1B2438' }}>
              Категория *
            </Typography>
            <FormControl fullWidth required>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                displayEmpty
                renderValue={(selected) =>
                  selected ? (
                    String(selected)
                  ) : (
                    <Typography component="span" sx={{ color: '#8B93A7', fontStyle: 'italic' }}>
                      Выберите категорию
                    </Typography>
                  )
                }
                sx={{ borderRadius: '10px', fontWeight: 600 }}
              >
                {EXERCISE_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Описание"
              placeholder="Подробное описание техники выполнения, цели и рекомендации..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
              sx={fieldSx}
            />
            <Typography
              sx={{ mt: 0.5, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#8B93A7' }}
            >
              {description.length} / {DESC_MAX}
            </Typography>
          </Box>
        </Stack>

        <SectionHead
          icon={<SportsTennis sx={{ fontSize: 16 }} />}
          title="Параметры выполнения"
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
          <FormControl fullWidth>
            <InputLabel>Тип упражнения</InputLabel>
            <Select
              label="Тип упражнения"
              value={exerciseType}
              onChange={(e) => setExerciseType(e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {EXERCISE_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Инвентарь</InputLabel>
            <Select
              label="Инвентарь"
              value={inventory}
              onChange={(e) => setInventory(e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {INVENTORY_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Уровень сложности</InputLabel>
            <Select
              label="Уровень сложности"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {DIFFICULTY_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            type="number"
            label="Подходы"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FitnessCenter sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
          <TextField
            fullWidth
            type="number"
            label="Повторения"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Replay sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
          <TextField
            fullWidth
            type="number"
            label="Отдых между подходами (сек)"
            value={restSec}
            onChange={(e) => setRestSec(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <TimerOutlined sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={fieldSx}
          />
          <FormControl fullWidth>
            <InputLabel>Темп выполнения</InputLabel>
            <Select
              label="Темп выполнения"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 600 }}
            >
              {TEMPO_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <SectionHead icon={<PlayCircleOutline sx={{ fontSize: 16 }} />} title="Медиа и файлы" />
        <Box
          onClick={() => fileRef.current?.click()}
          sx={{
            border: '1px dashed #C9D7FF',
            borderRadius: '12px',
            bgcolor: '#F7F8FB',
            py: 2.5,
            px: 2,
            textAlign: 'center',
            cursor: 'pointer',
            mb: 1.5,
            '&:hover': { bgcolor: '#EEF4FF', borderColor: colors.primary },
          }}
        >
          <CloudUploadOutlined sx={{ fontSize: 32, color: colors.primary, mb: 0.5 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 14, color: colors.primary }}>
            Загрузить фото или видео
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 600 }}>
            JPG, PNG, MP4 до 50 МБ
          </Typography>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </Box>

        {(pendingFiles.length > 0 || visibleExisting.length > 0) && (
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }} useFlexGap>
            {visibleExisting.map((m) => (
              <Box
                key={m.id}
                sx={{
                  width: 120,
                  height: 88,
                  borderRadius: '10px',
                  bgcolor: '#1B2438',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'flex-end',
                  p: 1,
                }}
              >
                <PlayCircleOutline sx={{ color: '#fff', fontSize: 20, mr: 0.5 }} />
                <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
                  {m.kind === 'video' ? 'Видео' : 'Фото'}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setRemovedMediaIds((prev) => [...prev, m.id])}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    width: 22,
                    height: 22,
                    '&:hover': { bgcolor: '#fff' },
                  }}
                >
                  <Close sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
            {pendingFiles.map((pf) => (
              <Box
                key={pf.key}
                sx={{
                  width: 120,
                  height: 88,
                  borderRadius: '10px',
                  bgcolor: '#EEF1F6',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {pf.file.type.startsWith('video/') ? (
                  <Box
                    component="video"
                    src={pf.previewUrl}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Box
                    component="img"
                    src={pf.previewUrl}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <IconButton
                  size="small"
                  onClick={() => removePending(pf.key)}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    width: 22,
                    height: 22,
                  }}
                >
                  <Close sx={{ fontSize: 14 }} />
                </IconButton>
                <Typography
                  sx={{
                    position: 'absolute',
                    left: 6,
                    bottom: 4,
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  {pf.file.type.startsWith('video/') ? 'Видео' : 'Фото'}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        <TextField
          fullWidth
          label="Ссылка на видео (YouTube, Rutube и др.)"
          placeholder="https://"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LinkIcon sx={{ fontSize: 18, color: '#8B93A7' }} />
              </InputAdornment>
            ),
          }}
          sx={{ ...fieldSx, mb: 2 }}
        />

        <SectionHead
          icon={<LocalOfferOutlined sx={{ fontSize: 16 }} />}
          title="Метки и дополнительные настройки"
        />
        <Autocomplete
          multiple
          freeSolo
          options={[...TAG_SUGGESTIONS]}
          value={tags}
          onChange={(_, v) => setTags(v.map(String))}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={`${option}-${index}`}
                size="small"
                label={option}
                sx={{ fontWeight: 700 }}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Теги"
              placeholder={tags.length ? undefined : 'Например: ноги, выносливость, начальный уровень...'}
              sx={fieldSx}
            />
          )}
          sx={{ mb: 1.5 }}
        />
        {!editing && (
          <FormControlLabel
            control={
              <Switch
                checked={addToTemplates}
                onChange={(e) => setAddToTemplates(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Добавить в шаблоны</Typography>
                <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 600 }}>
                  Упражнение будет доступно в библиотеке шаблонов
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0, gap: 1 }}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={saving}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            borderColor: '#C9D7FF',
            color: colors.primary,
          }}
        >
          Отмена
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={() => void save()}
          variant="contained"
          disabled={!canSave || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Check />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '10px',
            bgcolor: colors.primary,
            boxShadow: 'none',
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          Сохранить упражнение
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateExerciseDialog;
