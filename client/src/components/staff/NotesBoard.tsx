import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
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
  AttachFile,
  Check,
  ContentCopy,
  CreateOutlined,
  DeleteOutline,
  DescriptionOutlined,
  DriveFileMoveOutlined,
  FilterList,
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  FormatUnderlined,
  ImageOutlined,
  InsertLink,
  LightbulbOutlined,
  LockOutlined,
  MoreHoriz,
  NoteAltOutlined,
  PeopleOutline,
  PushPin,
  Search,
  ShareOutlined,
  Title as TitleIcon,
} from '@mui/icons-material';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';

export const NOTE_COLORS = [
  '#8B5CF6',
  '#F59E0B',
  '#2F6BFF',
  '#12B981',
  '#EC4899',
  '#EF4444',
  '#64748B',
] as const;

type StaffUser = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
};

export type StaffNoteRow = {
  id: string;
  title: string;
  body: string;
  visibility: 'PERSONAL' | 'SHARED';
  authorUserId: string;
  author: StaffUser;
  updatedAt: string;
  createdAt?: string;
  color?: string | null;
  pinned?: boolean;
  tags?: string | null;
  relatedTaskIds?: string | null;
  attachments?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  relatedTasks?: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
    assignees: Array<{ userId: string; user: StaffUser }>;
  }>;
};

type Props = {
  notes: StaffNoteRow[];
  currentUserId?: string;
  isOwner?: boolean;
  filter: 'ALL' | 'PERSONAL' | 'SHARED';
  onFilter: (f: 'ALL' | 'PERSONAL' | 'SHARED') => void;
  onReload: () => void | Promise<void>;
  onError: (msg: string) => void;
  onCreateTaskFromNote?: (note: StaffNoteRow) => void;
  onOpenTask?: (taskId: string) => void;
  initialSelectedId?: string | null;
};

function parseTags(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.map(String);
  } catch {
    /* ignore */
  }
  return [];
}

function personName(u: StaffUser) {
  return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
}

function formatNoteTime(iso: string) {
  const d = new Date(iso);
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Сегодня, ${time}`;
  if (isYesterday(d)) return `Вчера, ${time}`;
  return format(d, 'd MMM, HH:mm', { locale: ru });
}

function formatFullStamp(iso: string) {
  return format(new Date(iso), "EEEE, d MMMM yyyy, HH:mm", { locale: ru });
}

function previewBody(body: string) {
  return body.replace(/\s+/g, ' ').trim().slice(0, 90) || 'Без текста';
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function NoteIcon({ color, kind }: { color: string; kind?: number }) {
  const Icon =
    kind === 1 ? LightbulbOutlined : kind === 2 ? DescriptionOutlined : kind === 3 ? PeopleOutline : NoteAltOutlined;
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: '10px',
        bgcolor: `${color}22`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon sx={{ fontSize: 20 }} />
    </Box>
  );
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '14px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
};

const NotesBoard: React.FC<Props> = ({
  notes,
  currentUserId,
  isOwner,
  filter,
  onFilter,
  onReload,
  onError,
  onCreateTaskFromNote,
  onOpenTask,
  initialSelectedId,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [color, setColor] = useState<string>(NOTE_COLORS[0]);
  const [pinned, setPinned] = useState(false);
  const [visibility, setVisibility] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (!q) return true;
      const tagStr = parseTags(n.tags).join(' ').toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        tagStr.includes(q)
      );
    });
  }, [notes, search]);

  const selected = useMemo(
    () => sorted.find((n) => n.id === selectedId) || notes.find((n) => n.id === selectedId) || null,
    [sorted, notes, selectedId]
  );

  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  useEffect(() => {
    if (!selectedId && sorted[0]) setSelectedId(sorted[0].id);
    if (selectedId && !notes.some((n) => n.id === selectedId) && sorted[0]) {
      setSelectedId(sorted[0].id);
    }
  }, [sorted, selectedId, notes]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setBody(selected.body || '');
    setTags(parseTags(selected.tags));
    setColor(selected.color || NOTE_COLORS[0]);
    setPinned(Boolean(selected.pinned));
    setVisibility(selected.visibility);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEdit =
    selected &&
    (selected.authorUserId === currentUserId ||
      (isOwner && selected.visibility === 'SHARED'));

  const persist = async (patch: Record<string, unknown>) => {
    if (!selected || !canEdit) return;
    try {
      setSaving(true);
      await apiService.updateStaffNote(selected.id, patch as any);
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = (patch: Record<string, unknown>) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(patch), 500);
  };

  const wrapSelection = (before: string, after = before) => {
    const el = bodyRef.current;
    if (!el || !canEdit) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next =
      body.slice(0, start) + before + body.slice(start, end) + after + body.slice(end);
    setBody(next);
    scheduleSave({ body: next });
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    setTagDraft('');
    void persist({ tags: next });
  };

  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    void persist({ tags: next });
  };

  const onUpload = async (file: File | null) => {
    if (!file || !selected || !canEdit) return;
    try {
      await apiService.uploadStaffNoteAttachment(selected.id, file);
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Ошибка загрузки файла');
    }
  };

  const onDeleteAttachment = async (attachmentId: string) => {
    if (!selected || !canEdit) return;
    try {
      await apiService.deleteStaffNoteAttachment(selected.id, attachmentId);
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось удалить файл');
    }
  };

  const onDuplicate = async () => {
    if (!selected) return;
    try {
      const copy = await apiService.duplicateStaffNote(selected.id);
      await onReload();
      setSelectedId(copy.id);
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось дублировать');
    }
  };

  const onDelete = async () => {
    if (!selected || !canEdit) return;
    if (!window.confirm('Удалить заметку?')) return;
    try {
      await apiService.deleteStaffNote(selected.id);
      setSelectedId(null);
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  const onShare = async () => {
    if (!selected || !canEdit) return;
    const next = visibility === 'PERSONAL' ? 'SHARED' : 'PERSONAL';
    setVisibility(next);
    await persist({ visibility: next });
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px,0.9fr) minmax(0,1.4fr) minmax(240px,0.75fr)' },
        gap: 1.5,
        alignItems: 'start',
        minHeight: 520,
      }}
    >
      {/* List */}
      <Box
        sx={{
          ...cardSx,
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          position: { lg: 'sticky' },
          top: { lg: 56 },
          maxHeight: { lg: 'calc(100vh - 220px)' },
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            fullWidth
            placeholder="Поиск заметок..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#F7F8FB', fontWeight: 600 },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Фильтр</InputLabel>
            <Select
              label="Фильтр"
              value={filter}
              onChange={(e) => onFilter(e.target.value as any)}
              sx={{ borderRadius: '10px', fontWeight: 700 }}
            >
              <MenuItem value="ALL">Все заметки</MenuItem>
              <MenuItem value="PERSONAL">Личные</MenuItem>
              <MenuItem value="SHARED">Общие</MenuItem>
            </Select>
          </FormControl>
          <IconButton size="small" sx={{ border: '1px solid #EEF1F6', borderRadius: '10px' }}>
            <FilterList fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0, pr: 0.5 }}>
          <Stack spacing={0.75}>
            {sorted.map((n, idx) => {
              const c = n.color || NOTE_COLORS[idx % NOTE_COLORS.length];
              const active = n.id === selectedId;
              const noteTags = parseTags(n.tags);
              return (
                <Box
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  sx={{
                    p: 1.25,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: active ? `1.5px solid ${colors.primary}` : '1px solid transparent',
                    bgcolor: active ? '#EEF4FF' : '#F7F8FB',
                    display: 'flex',
                    gap: 1,
                    '&:hover': { bgcolor: active ? '#EEF4FF' : '#F0F2F7' },
                  }}
                >
                  <NoteIcon color={c} kind={idx % 4} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: 13.5,
                          color: '#1B2438',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.title}
                      </Typography>
                      {n.pinned && <PushPin sx={{ fontSize: 14, color: colors.primary }} />}
                      <MoreHoriz sx={{ fontSize: 16, color: '#C5CAD6' }} />
                    </Stack>
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: '#8B93A7',
                        fontWeight: 600,
                        mt: 0.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {previewBody(n.body)}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                      {noteTags.slice(0, 3).map((t) => (
                        <Chip
                          key={t}
                          size="small"
                          label={t}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            fontWeight: 700,
                            bgcolor: t.toLowerCase() === 'важно' ? '#FEE2E2' : `${c}18`,
                            color: t.toLowerCase() === 'важно' ? '#EF4444' : c,
                          }}
                        />
                      ))}
                      <Box flex={1} />
                      <Typography sx={{ fontSize: 11, color: '#8B93A7', fontWeight: 600 }}>
                        {formatNoteTime(n.updatedAt)}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
            {!sorted.length && (
              <Typography sx={{ color: '#8B93A7', fontWeight: 600, p: 2, textAlign: 'center' }}>
                Нет заметок
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Editor */}
      <Box
        sx={{
          ...cardSx,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          minHeight: 480,
          maxHeight: { lg: 'calc(100vh - 220px)' },
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {!selected ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 800, color: '#1B2438' }}>Выберите заметку</Typography>
            <Typography sx={{ color: '#8B93A7', fontWeight: 600, mt: 0.5 }}>
              или создайте новую запись
            </Typography>
          </Box>
        ) : (
          <>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <NoteIcon color={color} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  fullWidth
                  variant="standard"
                  value={title}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    scheduleSave({ title: e.target.value });
                  }}
                  InputProps={{
                    disableUnderline: true,
                    endAdornment: canEdit ? (
                      <CreateOutlined sx={{ fontSize: 16, color: '#8B93A7' }} />
                    ) : undefined,
                  }}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontWeight: 800,
                      fontSize: 20,
                      color: '#1B2438',
                      py: 0,
                    },
                  }}
                />
                <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 600, mt: 0.35 }}>
                  {formatFullStamp(selected.updatedAt)} · {personName(selected.author)}
                  {saving ? ' · сохранение…' : ''}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
              {tags.map((t) => (
                <Chip
                  key={t}
                  size="small"
                  label={t}
                  onDelete={canEdit ? () => removeTag(t) : undefined}
                  sx={{
                    height: 24,
                    fontWeight: 700,
                    bgcolor: `${color}18`,
                    color,
                  }}
                />
              ))}
              {canEdit && (
                <TextField
                  size="small"
                  placeholder="+ Добавить тег"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  sx={{
                    width: 140,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '999px',
                      height: 28,
                      fontSize: 12,
                      fontWeight: 700,
                    },
                  }}
                />
              )}
            </Stack>

            <Stack
              direction="row"
              spacing={0.25}
              sx={{
                bgcolor: '#F7F8FB',
                borderRadius: '10px',
                p: 0.5,
                flexWrap: 'wrap',
              }}
            >
              {[
                { Icon: TitleIcon, action: () => wrapSelection('## ', '') },
                { Icon: FormatBold, action: () => wrapSelection('**', '**') },
                { Icon: FormatItalic, action: () => wrapSelection('_', '_') },
                { Icon: FormatUnderlined, action: () => wrapSelection('<u>', '</u>') },
                { Icon: FormatListBulleted, action: () => wrapSelection('\n- ', '') },
                { Icon: FormatListNumbered, action: () => wrapSelection('\n1. ', '') },
                { Icon: FormatQuote, action: () => wrapSelection('\n> ', '') },
                { Icon: ImageOutlined, action: () => fileRef.current?.click() },
                { Icon: InsertLink, action: () => wrapSelection('[', '](https://)') },
                { Icon: AttachFile, action: () => fileRef.current?.click() },
              ].map(({ Icon, action }, i) => (
                <IconButton
                  key={i}
                  size="small"
                  disabled={!canEdit}
                  onClick={action}
                  sx={{ borderRadius: '8px', color: '#5A6275' }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </IconButton>
              ))}
            </Stack>

            <TextField
              inputRef={bodyRef}
              fullWidth
              multiline
              minRows={12}
              value={body}
              disabled={!canEdit}
              onChange={(e) => {
                setBody(e.target.value);
                scheduleSave({ body: e.target.value });
              }}
              placeholder="Текст заметки…"
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                '& .MuiOutlinedInput-root': {
                  border: 'none',
                  bgcolor: 'transparent',
                  alignItems: 'flex-start',
                  fontWeight: 600,
                  fontSize: 14,
                  lineHeight: 1.55,
                  height: '100%',
                  overflow: 'auto',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                },
                '& .MuiInputBase-input': {
                  overflow: 'auto !important',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                },
                '& fieldset': { border: 'none' },
              }}
            />

            {(selected.relatedTasks?.length || 0) > 0 && (
              <Box
                sx={{
                  mt: 'auto',
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: '#F5F3FF',
                  border: '1px solid #E9E5FF',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1B2438' }}>
                    Связанные задачи
                  </Typography>
                  <Chip
                    size="small"
                    label={String(selected.relatedTasks!.length)}
                    sx={{ height: 20, fontWeight: 800, bgcolor: colors.primary, color: '#fff' }}
                  />
                </Stack>
                <Stack spacing={0.75}>
                  {selected.relatedTasks!.map((t) => (
                    <Stack
                      key={t.id}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      onClick={() => onOpenTask?.(t.id)}
                      sx={{ cursor: onOpenTask ? 'pointer' : 'default' }}
                    >
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: `2px solid ${t.status === 'DONE' ? '#12B981' : colors.primary}`,
                          bgcolor: t.status === 'DONE' ? '#12B981' : 'transparent',
                        }}
                      />
                      <Typography
                        sx={{
                          flex: 1,
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: t.status === 'DONE' ? 'line-through' : 'none',
                          color: '#1B2438',
                        }}
                      >
                        {t.title}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#8B93A7', fontWeight: 700 }}>
                        {t.dueAt ? format(new Date(t.dueAt), 'd MMM', { locale: ru }) : '—'}
                      </Typography>
                      {t.assignees[0]?.user && (
                        <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: '#E8EAF0', color: '#5A6275' }}>
                          {(t.assignees[0].user.lastName || '?')[0]}
                        </Avatar>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Params */}
      <Stack spacing={1.5}>
        <Box sx={{ ...cardSx, p: 1.75 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.25 }}>Параметры</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7', mb: 1 }}>Цвет</Typography>
          <Stack direction="row" spacing={0.75} sx={{ mb: 1.75 }} flexWrap="wrap" useFlexGap>
            {NOTE_COLORS.map((c) => {
              const sel = color === c;
              return (
                <Box
                  key={c}
                  onClick={() => {
                    if (!canEdit || !selected) return;
                    setColor(c);
                    void persist({ color: c });
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: canEdit ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: sel ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                >
                  {sel && <Check sx={{ fontSize: 14, color: '#fff' }} />}
                </Box>
              );
            })}
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Закрепить заметку</Typography>
            <Switch
              checked={pinned}
              disabled={!canEdit || !selected}
              onChange={(e) => {
                setPinned(e.target.checked);
                void persist({ pinned: e.target.checked });
              }}
              color="primary"
            />
          </Stack>

          <FormControl fullWidth size="small">
            <InputLabel>Доступ</InputLabel>
            <Select
              label="Доступ"
              value={visibility}
              disabled={!canEdit || !selected}
              onChange={(e) => {
                const v = e.target.value as 'PERSONAL' | 'SHARED';
                setVisibility(v);
                void persist({ visibility: v });
              }}
              startAdornment={
                <InputAdornment position="start">
                  <LockOutlined sx={{ fontSize: 16, color: '#8B93A7', ml: 0.5 }} />
                </InputAdornment>
              }
              sx={{ borderRadius: '10px', fontWeight: 700 }}
            >
              <MenuItem value="PERSONAL">Личная (только я)</MenuItem>
              <MenuItem value="SHARED">Общая (сотрудники)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ ...cardSx, p: 1.75 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1 }}>Действия</Typography>
          <Stack spacing={0.25}>
            <ActionRow
              icon={<ShareOutlined sx={{ fontSize: 18 }} />}
              label={visibility === 'PERSONAL' ? 'Поделиться' : 'Сделать личной'}
              onClick={() => void onShare()}
              disabled={!canEdit || !selected}
            />
            <ActionRow
              icon={<CreateOutlined sx={{ fontSize: 18 }} />}
              label="Создать задачу из текста"
              onClick={() => selected && onCreateTaskFromNote?.(selected)}
              disabled={!selected}
            />
            <ActionRow
              icon={<ContentCopy sx={{ fontSize: 18 }} />}
              label="Дублировать"
              onClick={() => void onDuplicate()}
              disabled={!selected}
            />
            <ActionRow
              icon={<DriveFileMoveOutlined sx={{ fontSize: 18 }} />}
              label="Переместить"
              onClick={() => onError('Перемещение между папками появится позже')}
              disabled={!selected}
            />
            <ActionRow
              icon={<DeleteOutline sx={{ fontSize: 18 }} />}
              label="Удалить"
              onClick={() => void onDelete()}
              disabled={!canEdit || !selected}
              danger
            />
          </Stack>
        </Box>

        <Box sx={{ ...cardSx, p: 1.75 }}>
          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }}>Прикреплённые файлы</Typography>
            <IconButton
              size="small"
              disabled={!canEdit || !selected}
              onClick={() => fileRef.current?.click()}
              sx={{ color: colors.primary }}
            >
              <AttachFile fontSize="small" />
            </IconButton>
          </Stack>
          <Stack spacing={0.75}>
            {(selected?.attachments || []).map((a) => (
              <Stack
                key={a.id}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ p: 1, borderRadius: '10px', bgcolor: '#F7F8FB' }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: '#FEE2E2',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 10,
                  }}
                >
                  PDF
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    component="a"
                    href={apiService.staffNoteAttachmentUrl(selected!.id, a.id)}
                    target="_blank"
                    rel="noreferrer"
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#1B2438',
                      textDecoration: 'none',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.originalName}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#8B93A7', fontWeight: 600 }}>
                    {formatBytes(a.sizeBytes)} · {format(new Date(a.createdAt), 'd MMM yyyy', { locale: ru })}
                  </Typography>
                </Box>
                {canEdit && (
                  <IconButton size="small" onClick={() => void onDeleteAttachment(a.id)}>
                    <DeleteOutline sx={{ fontSize: 16, color: '#EF4444' }} />
                  </IconButton>
                )}
              </Stack>
            ))}
            {!selected?.attachments?.length && (
              <Typography sx={{ fontSize: 12, color: '#8B93A7', fontWeight: 600 }}>
                Файлов пока нет
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>

      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={(e) => {
          void onUpload(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />
    </Box>
  );
};

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      fullWidth
      disabled={disabled}
      onClick={onClick}
      startIcon={icon}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        fontWeight: 700,
        color: danger ? '#EF4444' : '#1B2438',
        borderRadius: '10px',
        px: 1,
        py: 0.85,
        '&:hover': { bgcolor: danger ? '#FEF2F2' : '#F7F8FB' },
      }}
    >
      {label}
    </Button>
  );
}

export default NotesBoard;
