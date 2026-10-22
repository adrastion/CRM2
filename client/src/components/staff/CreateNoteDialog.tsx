import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AttachFile,
  CalendarMonthOutlined,
  Close,
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatUnderlined,
  ImageOutlined,
  InsertLink,
  Link as LinkIcon,
  NoteAltOutlined,
  PersonOutline,
  Redo,
  SaveOutlined,
  Undo,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';

const BODY_MAX = 5000;

export const NOTE_CATEGORIES = [
  { key: 'general', label: 'Общее', color: '#2F6BFF' },
  { key: 'work', label: 'Работа', color: '#8B5CF6' },
  { key: 'ideas', label: 'Идеи', color: '#F59E0B' },
  { key: 'personal', label: 'Личное', color: '#12B981' },
  { key: 'important', label: 'Важно', color: '#EF4444' },
] as const;

export const NOTE_PRESET_TAGS = [
  { label: 'Важно', bgcolor: '#FEE2E2', color: '#DC2626' },
  { label: 'Клиент', bgcolor: '#DBEAFE', color: '#2563EB' },
  { label: 'Тренировка', bgcolor: '#D1FAE5', color: '#059669' },
  { label: 'Оплата', bgcolor: '#FFEDD5', color: '#EA580C' },
  { label: 'Документы', bgcolor: '#EDE9FE', color: '#7C3AED' },
] as const;

const TEMPLATES = [
  {
    id: 'meeting',
    label: 'Итоги планерки',
    body: 'Участники:\n\nОбсудили:\n• \n\nРешения:\n• \n\nДальнейшие шаги:\n• ',
  },
  {
    id: 'client',
    label: 'Заметка по клиенту',
    body: 'Клиент:\nКонтакт:\n\nСуть обращения:\n\nДоговорённости:\n',
  },
  {
    id: 'todo',
    label: 'Чек-лист',
    body: '□ \n□ \n□ \n',
  },
] as const;

const REMINDERS = [
  { key: 'none', label: 'Нет' },
  { key: 'in_1h', label: 'Через 1 час' },
  { key: 'tomorrow', label: 'Завтра утром' },
  { key: 'in_1d', label: 'Через 1 день' },
  { key: 'in_1w', label: 'Через неделю' },
] as const;

type LinkOption = {
  key: string;
  type: 'client' | 'group' | 'training';
  id: string;
  label: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (note: any, opts: { createTask: boolean }) => void | Promise<void>;
  onError?: (msg: string) => void;
};

function categoryColor(key: string) {
  return NOTE_CATEGORIES.find((c) => c.key === key)?.color || NOTE_CATEGORIES[0].color;
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#E5E9F2' },
    '&:hover fieldset': { borderColor: '#C9D7FF' },
    '&.Mui-focused fieldset': { borderColor: colors.primary },
  },
};

const CreateNoteDialog: React.FC<Props> = ({ open, onClose, onSaved, onError }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryKey, setCategoryKey] = useState('general');
  const [visibility, setVisibility] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');
  const [reminderKey, setReminderKey] = useState('none');
  const [linkKey, setLinkKey] = useState('none');
  const [linkOptions, setLinkOptions] = useState<LinkOption[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tplEl, setTplEl] = useState<null | HTMLElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const history = useRef<string[]>(['']);
  const histIdx = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setBody('');
    setCategoryKey('general');
    setVisibility('PERSONAL');
    setReminderKey('none');
    setLinkKey('none');
    setTags([]);
    setTagDraft('');
    setCreateTask(false);
    setPendingFile(null);
    history.current = [''];
    histIdx.current = 0;

    void (async () => {
      try {
        const [clientsRes, groupsRes, trainingsRes] = await Promise.all([
          apiService.getClients({ limit: 40 }, undefined, false).catch(() => ({ data: [] })),
          apiService.getGroups({ limit: 40 }, undefined, false).catch(() => ({ data: [] })),
          apiService.getTrainings({ limit: 30 }).catch(() => ({ data: [] })),
        ]);
        const opts: LinkOption[] = [];
        (clientsRes?.data || []).forEach((c: any) => {
          const name = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ');
          if (c.id && name) {
            opts.push({ key: `client:${c.id}`, type: 'client', id: c.id, label: `Клиент: ${name}` });
          }
        });
        (groupsRes?.data || []).forEach((g: any) => {
          if (g.id && g.name) {
            opts.push({ key: `group:${g.id}`, type: 'group', id: g.id, label: `Группа: ${g.name}` });
          }
        });
        (trainingsRes?.data || []).forEach((t: any) => {
          if (!t.id) return;
          const when = t.startTime ? new Date(t.startTime).toLocaleString('ru-RU') : '';
          const label = t.title || t.group?.name || 'Тренировка';
          opts.push({
            key: `training:${t.id}`,
            type: 'training',
            id: t.id,
            label: `Тренировка: ${label}${when ? ` (${when})` : ''}`,
          });
        });
        setLinkOptions(opts);
      } catch {
        setLinkOptions([]);
      }
    })();
  }, [open]);

  const pushHistory = (next: string) => {
    history.current = history.current.slice(0, histIdx.current + 1);
    history.current.push(next);
    histIdx.current = history.current.length - 1;
  };

  const setBodyTracked = (next: string) => {
    const clipped = next.slice(0, BODY_MAX);
    setBody(clipped);
    pushHistory(clipped);
  };

  const wrapSelection = (before: string, after = before) => {
    const el = bodyRef.current;
    if (!el) {
      setBodyTracked(before + body + after);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + before + body.slice(start, end) + after + body.slice(end);
    setBodyTracked(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const undo = () => {
    if (histIdx.current <= 0) return;
    histIdx.current -= 1;
    setBody(history.current[histIdx.current] || '');
  };

  const redo = () => {
    if (histIdx.current >= history.current.length - 1) return;
    histIdx.current += 1;
    setBody(history.current[histIdx.current] || '');
  };

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagDraft('');
  };

  const togglePreset = (label: string) => {
    setTags((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
  };

  const canSave = title.trim().length > 0 && body.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const link = linkOptions.find((o) => o.key === linkKey);
      const created = await apiService.createStaffNote({
        title: title.trim(),
        body: body.trim(),
        visibility,
        color: categoryColor(categoryKey),
        categoryKey,
        reminderKey,
        tags,
        relatedLink: link
          ? { type: link.type, id: link.id, label: link.label }
          : null,
      });
      if (pendingFile && created?.id) {
        try {
          await apiService.uploadStaffNoteAttachment(created.id, pendingFile);
        } catch {
          /* note already created */
        }
      }
      await onSaved(created, { createTask });
      onClose();
    } catch (e: any) {
      onError?.(e?.response?.data?.error || 'Не удалось сохранить заметку');
    } finally {
      setSaving(false);
    }
  };

  const selectedLink = useMemo(
    () => linkOptions.find((o) => o.key === linkKey) || null,
    [linkOptions, linkKey]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(27, 36, 56, 0.18)',
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          pt: 2,
          pb: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: colors.primary,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <NoteAltOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Typography sx={{ flex: 1, fontWeight: 800, fontSize: 18, color: '#1B2438' }}>
          Создание заметки
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#8B93A7' }}>
          <Close />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 2.5, pt: 0.5, pb: 2 }}>
        <Stack spacing={1.75}>
          <Box>
            <FieldLabel required>Заголовок</FieldLabel>
            <TextField
              fullWidth
              size="small"
              placeholder="Введите краткий заголовок заметки..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={fieldSx}
            />
          </Box>

          <Box>
            <FieldLabel required>Текст</FieldLabel>
            <Box
              sx={{
                border: '1px solid #E5E9F2',
                borderRadius: '12px',
                overflow: 'hidden',
                bgcolor: '#fff',
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.25}
                sx={{
                  px: 1,
                  py: 0.5,
                  borderBottom: '1px solid #EEF1F6',
                  bgcolor: '#FAFBFD',
                  flexWrap: 'wrap',
                }}
              >
                <ToolBtn title="Жирный" onClick={() => wrapSelection('**', '**')}>
                  <FormatBold fontSize="small" />
                </ToolBtn>
                <ToolBtn title="Курсив" onClick={() => wrapSelection('_', '_')}>
                  <FormatItalic fontSize="small" />
                </ToolBtn>
                <ToolBtn title="Подчёркнутый" onClick={() => wrapSelection('<u>', '</u>')}>
                  <FormatUnderlined fontSize="small" />
                </ToolBtn>
                <ToolBtn title="Маркированный список" onClick={() => wrapSelection('\n• ', '')}>
                  <FormatListBulleted fontSize="small" />
                </ToolBtn>
                <ToolBtn title="Нумерованный список" onClick={() => wrapSelection('\n1. ', '')}>
                  <FormatListNumbered fontSize="small" />
                </ToolBtn>
                <ToolBtn
                  title="Ссылка"
                  onClick={() => wrapSelection('[', '](https://)')}
                >
                  <InsertLink fontSize="small" />
                </ToolBtn>
                <ToolBtn title="Изображение" onClick={() => fileRef.current?.click()}>
                  <ImageOutlined fontSize="small" />
                </ToolBtn>
                <ToolBtn title="Вложение" onClick={() => fileRef.current?.click()}>
                  <AttachFile fontSize="small" />
                </ToolBtn>
                <Box flex={1} />
                <ToolBtn title="Отменить" onClick={undo}>
                  <Undo fontSize="small" />
                </ToolBtn>
                <ToolBtn title="Повторить" onClick={redo}>
                  <Redo fontSize="small" />
                </ToolBtn>
                <Button
                  size="small"
                  endIcon={<Box component="span" sx={{ fontSize: 10, ml: -0.5 }}>▾</Box>}
                  onClick={(e) => setTplEl(e.currentTarget)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: '#5A6275',
                    ml: 0.5,
                  }}
                >
                  Шаблоны
                </Button>
                <Menu anchorEl={tplEl} open={Boolean(tplEl)} onClose={() => setTplEl(null)}>
                  {TEMPLATES.map((t) => (
                    <MenuItem
                      key={t.id}
                      onClick={() => {
                        setBodyTracked(t.body);
                        setTplEl(null);
                      }}
                    >
                      {t.label}
                    </MenuItem>
                  ))}
                </Menu>
              </Stack>

              <TextField
                inputRef={bodyRef}
                fullWidth
                multiline
                minRows={5}
                maxRows={10}
                placeholder="Введите текст заметки..."
                value={body}
                onChange={(e) => setBodyTracked(e.target.value)}
                InputProps={{ disableUnderline: true }}
                variant="standard"
                sx={{
                  px: 1.5,
                  py: 1,
                  '& .MuiInputBase-input': {
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  },
                }}
              />
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ px: 1.5, pb: 1 }}
              >
                {pendingFile ? (
                  <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: colors.primary }}>
                    📎 {pendingFile.name}
                  </Typography>
                ) : (
                  <span />
                )}
                <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: '#8B93A7' }}>
                  {body.length} / {BODY_MAX}
                </Typography>
              </Stack>
            </Box>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                setPendingFile(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            <Box>
              <FieldLabel>Категория</FieldLabel>
              <FormControl fullWidth size="small">
                <Select
                  value={categoryKey}
                  onChange={(e) => setCategoryKey(e.target.value)}
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                  renderValue={(v) => {
                    const c = NOTE_CATEGORIES.find((x) => x.key === v) || NOTE_CATEGORIES[0];
                    return (
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color }} />
                        <span>{c.label}</span>
                      </Stack>
                    );
                  }}
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <MenuItem key={c.key} value={c.key}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color }} />
                        <span>{c.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FieldLabel>Видимость</FieldLabel>
              <FormControl fullWidth size="small">
                <Select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'PERSONAL' | 'SHARED')}
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                  startAdornment={
                    <InputAdornment position="start">
                      <PersonOutline sx={{ fontSize: 18, color: '#8B93A7' }} />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="PERSONAL">Личная</MenuItem>
                  <MenuItem value="SHARED">Общая</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FieldLabel>Связать с</FieldLabel>
              <FormControl fullWidth size="small">
                <Select
                  value={linkKey}
                  onChange={(e) => setLinkKey(e.target.value)}
                  displayEmpty
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                  startAdornment={
                    <InputAdornment position="start">
                      <LinkIcon sx={{ fontSize: 18, color: '#8B93A7' }} />
                    </InputAdornment>
                  }
                  renderValue={(v) => {
                    if (!v || v === 'none') return <span style={{ color: '#8B93A7' }}>Не выбрано</span>;
                    return selectedLink?.label || 'Не выбрано';
                  }}
                >
                  <MenuItem value="none">Не выбрано</MenuItem>
                  {linkOptions.map((o) => (
                    <MenuItem key={o.key} value={o.key}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <FieldLabel>Напоминание</FieldLabel>
              <FormControl fullWidth size="small">
                <Select
                  value={reminderKey}
                  onChange={(e) => setReminderKey(e.target.value)}
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                  startAdornment={
                    <InputAdornment position="start">
                      <CalendarMonthOutlined sx={{ fontSize: 18, color: '#8B93A7' }} />
                    </InputAdornment>
                  }
                >
                  {REMINDERS.map((r) => (
                    <MenuItem key={r.key} value={r.key}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box>
            <FieldLabel>Теги</FieldLabel>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField
                size="small"
                placeholder="Добавить тег..."
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(tagDraft);
                  }
                }}
                sx={{
                  width: { xs: '100%', sm: 160 },
                  ...fieldSx,
                }}
              />
              {NOTE_PRESET_TAGS.map((t) => {
                const active = tags.includes(t.label);
                return (
                  <Box
                    key={t.label}
                    onClick={() => togglePreset(t.label)}
                    sx={{
                      px: 1.25,
                      py: 0.55,
                      borderRadius: '999px',
                      bgcolor: active ? t.bgcolor : t.bgcolor,
                      color: t.color,
                      fontSize: 12.5,
                      fontWeight: 750,
                      cursor: 'pointer',
                      border: active ? `1.5px solid ${t.color}` : '1.5px solid transparent',
                      opacity: active ? 1 : 0.85,
                      userSelect: 'none',
                    }}
                  >
                    {t.label}
                  </Box>
                );
              })}
            </Stack>
            {tags.filter((t) => !NOTE_PRESET_TAGS.some((p) => p.label === t)).length > 0 && (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {tags
                  .filter((t) => !NOTE_PRESET_TAGS.some((p) => p.label === t))
                  .map((t) => (
                    <Box
                      key={t}
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                      sx={{
                        px: 1.1,
                        py: 0.4,
                        borderRadius: '999px',
                        bgcolor: '#EEF1F6',
                        color: '#5A6275',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {t} ×
                    </Box>
                  ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          borderTop: '1px solid #EEF1F6',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={createTask}
              onChange={(e) => setCreateTask(e.target.checked)}
              size="small"
              sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
            />
          }
          label={
            <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: '#1B2438' }}>
              Создать задачу на основе заметки
            </Typography>
          }
          sx={{ flex: 1, mr: 0, ml: -0.5 }}
        />
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{
            textTransform: 'none',
            fontWeight: 750,
            borderRadius: `${radii.button}px`,
            px: 2.25,
            bgcolor: '#EEF4FF',
            color: colors.primary,
            '&:hover': { bgcolor: '#E0EAFF' },
          }}
        >
          Отмена
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
          disabled={!canSave}
          onClick={() => void handleSave()}
          sx={{
            textTransform: 'none',
            fontWeight: 750,
            borderRadius: `${radii.button}px`,
            px: 2.5,
            bgcolor: colors.primary,
            boxShadow: 'none',
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          Сохранить
        </Button>
      </Box>
    </Dialog>
  );
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#1B2438', mb: 0.65 }}>
      {children}
      {required && (
        <Box component="span" sx={{ color: '#EF4444', ml: 0.35 }}>
          *
        </Box>
      )}
    </Typography>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <IconButton
      size="small"
      title={title}
      onClick={onClick}
      sx={{ color: '#5A6275', borderRadius: '8px', p: 0.6 }}
    >
      {children}
    </IconButton>
  );
}

export default CreateNoteDialog;
