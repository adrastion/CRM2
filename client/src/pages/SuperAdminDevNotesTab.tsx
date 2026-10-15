import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Add, AttachFile, Delete, Download, Edit, NoteAlt, Restore } from '@mui/icons-material';
import { apiService } from '../services/api';

export type DevNoteStatus =
  | 'REQUIRED'
  | 'IDEA'
  | 'NEEDS_DISCUSSION'
  | 'AWAITING_FEEDBACK'
  | 'AWAITING_DESIGN'
  | 'IN_PROGRESS'
  | 'SHELVED'
  | 'DONE'
  | 'LIKE_OTHERS';

type Bucket = 'active' | 'archive' | 'trash';
type Priority = 'URGENT' | 'IMPORTANT' | null;

interface Person {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}

interface DevNoteAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface DevNoteComment {
  id: string;
  body: string;
  createdAt: string;
  author?: Person;
}

interface DevNote {
  id: string;
  title: string;
  description?: string | null;
  status: DevNoteStatus;
  priority?: Priority;
  createdAt: string;
  updatedAt: string;
  activityAt?: string;
  doneAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  dueFrom?: string | null;
  dueTo?: string | null;
  unread?: boolean;
  commentCount?: number;
  createdBy?: Person;
  lastEditedBy?: Person | null;
  attachments?: DevNoteAttachment[];
  comments?: DevNoteComment[];
  readers?: { id: string; name: string; readAt: string; current: boolean }[];
}

const STATUS_LABELS: Record<DevNoteStatus, string> = {
  REQUIRED: 'Необходимо',
  IDEA: 'Идея',
  NEEDS_DISCUSSION: 'Требует обсуждения',
  AWAITING_FEEDBACK: 'Ожидание обратной связи',
  AWAITING_DESIGN: 'Ожидает дизайна',
  IN_PROGRESS: 'В работе',
  SHELVED: 'На долгую полку',
  DONE: 'Готово',
  LIKE_OTHERS: 'Как у других',
};

const STATUS_ORDER = Object.keys(STATUS_LABELS) as DevNoteStatus[];

function personName(u?: Person | null) {
  if (!u) return '—';
  const name = `${u.lastName || ''} ${u.firstName || ''}`.trim();
  return name || u.email || '—';
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

function dateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function isImage(mime?: string) {
  return Boolean(mime && mime.startsWith('image/'));
}

const DevNoteImage: React.FC<{ noteId: string; attachment: DevNoteAttachment }> = ({ noteId, attachment }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = '';
    let cancelled = false;
    (async () => {
      try {
        const { blob } = await apiService.downloadDevNoteAttachment(noteId, attachment.id);
        if (cancelled) return;
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [noteId, attachment.id]);
  if (!url) return null;
  return (
    <Box sx={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Box
        component="img"
        src={url}
        alt={attachment.originalName}
        sx={{
          display: 'block',
          width: 'auto',
          height: 'auto',
          maxWidth: '100%',
          maxHeight: 360,
          objectFit: 'contain',
          borderRadius: 1,
        }}
      />
    </Box>
  );
};

const SuperAdminDevNotesTab: React.FC = () => {
  const [bucket, setBucket] = useState<Bucket>('active');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [notes, setNotes] = useState<DevNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<DevNote | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    status: 'IDEA' as DevNoteStatus,
    priority: null as Priority,
    dueFrom: '',
    dueTo: '',
  });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiService.getDevNotes({
        bucket,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setNotes(rows);
    } finally {
      setLoading(false);
    }
  }, [bucket, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openNote = async (note: DevNote) => {
    setOpen(note);
    setEditing(false);
    setCreating(false);
    setComment('');
    if (note.deletedAt) return;
    try {
      const fresh = await apiService.markDevNoteRead(note.id);
      setOpen(fresh);
      setNotes((prev) => prev.map((n) => (n.id === fresh.id ? fresh : n)));
    } catch {
      /* карточка всё равно открыта */
    }
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(true);
    setOpen(null);
    setDraft({ title: '', description: '', status: 'IDEA', priority: null, dueFrom: '', dueTo: '' });
  };

  const startEdit = () => {
    if (!open) return;
    setDraft({
      title: open.title,
      description: open.description || '',
      status: open.status,
      priority: open.priority || null,
      dueFrom: dateInput(open.dueFrom),
      dueTo: dateInput(open.dueTo),
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        status: draft.status,
        priority: draft.priority,
        dueFrom: draft.dueFrom || null,
        dueTo: draft.dueTo || null,
      };
      if (creating) {
        await apiService.createDevNote(payload);
        setCreating(false);
        setEditing(false);
      } else if (open) {
        const fresh = await apiService.updateDevNote(open.id, payload);
        setOpen(fresh);
        setEditing(false);
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (note: DevNote) => {
    await apiService.deleteDevNote(note.id);
    setOpen(null);
    await load();
  };

  const restore = async (note: DevNote) => {
    await apiService.restoreDevNote(note.id);
    setOpen(null);
    await load();
  };

  const sendComment = async () => {
    if (!open || !comment.trim()) return;
    const fresh = await apiService.addDevNoteComment(open.id, comment.trim());
    setOpen(fresh);
    setComment('');
    setNotes((prev) => prev.map((n) => (n.id === fresh.id ? fresh : n)));
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!open || !files?.length) return;
    await apiService.uploadDevNoteAttachments(open.id, Array.from(files));
    const rows = await apiService.getDevNotes({ bucket });
    const fresh = rows.find((n: DevNote) => n.id === open.id);
    if (fresh) setOpen(fresh);
    setNotes(rows);
  };

  const downloadFile = async (noteId: string, file: DevNoteAttachment) => {
    const { blob, filename } = await apiService.downloadDevNoteAttachment(noteId, file.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || file.originalName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const images = (open?.attachments || []).filter((a) => isImage(a.mimeType));
  const files = (open?.attachments || []).filter((a) => !isImage(a.mimeType));

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Разработка</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={startCreate}>
          Заметка
        </Button>
      </Stack>
      <Tabs value={bucket} onChange={(_, v) => setBucket(v)} sx={{ mb: 2 }}>
        <Tab value="active" label="Актуальные" />
        <Tab value="archive" label="Архив" />
        <Tab value="trash" label="Корзина" />
      </Tabs>
      <FormControl size="small" sx={{ minWidth: 240, mb: 2 }}>
        <InputLabel>Статус</InputLabel>
        <Select label="Статус" value={statusFilter} onChange={(e) => setStatusFilter(String(e.target.value))}>
          <MenuItem value="">Все</MenuItem>
          {STATUS_ORDER.map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Заметка</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Сроки</TableCell>
                <TableCell>Последний редактор</TableCell>
                <TableCell>Прочтение</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notes.map((note) => (
                <TableRow
                  key={note.id}
                  hover
                  onClick={() => openNote(note)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor:
                      note.priority === 'URGENT'
                        ? 'rgba(211, 47, 47, 0.12)'
                        : note.priority === 'IMPORTANT'
                          ? 'rgba(237, 180, 0, 0.18)'
                          : undefined,
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <NoteAlt fontSize="small" />
                      <span>{note.title}</span>
                      {note.priority === 'URGENT' && <Chip size="small" color="error" label="Срочно" />}
                      {note.priority === 'IMPORTANT' && <Chip size="small" color="warning" label="Важно" />}
                    </Stack>
                  </TableCell>
                  <TableCell>{STATUS_LABELS[note.status] || note.status}</TableCell>
                  <TableCell>
                    {note.dueFrom || note.dueTo
                      ? `${fmtDate(note.dueFrom)} — ${fmtDate(note.dueTo)}`
                      : '—'}
                  </TableCell>
                  <TableCell>{personName(note.lastEditedBy || note.createdBy)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={note.unread ? 'error' : 'success'}
                      label={note.unread ? 'Не прочитано' : 'Прочитано'}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!notes.length && (
                <TableRow>
                  <TableCell colSpan={5}>Заметок нет</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={creating || Boolean(open)} onClose={() => { setOpen(null); setCreating(false); setEditing(false); }} fullWidth maxWidth="md">
        <DialogTitle>{creating ? 'Новая заметка' : open?.title}</DialogTitle>
        <DialogContent>
          {(creating || editing) && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Заголовок" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <TextField
                label="Описание"
                multiline
                minRows={4}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <FormControl>
                <InputLabel>Статус</InputLabel>
                <Select
                  label="Статус"
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as DevNoteStatus })}
                >
                  {STATUS_ORDER.map((s) => (
                    <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <ToggleButtonGroup
                exclusive
                value={draft.priority}
                onChange={(_, v) => setDraft({ ...draft, priority: v })}
              >
                <ToggleButton value="URGENT">Срочно</ToggleButton>
                <ToggleButton value="IMPORTANT">Важно</ToggleButton>
              </ToggleButtonGroup>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Срок с"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={draft.dueFrom}
                  onChange={(e) => setDraft({ ...draft, dueFrom: e.target.value })}
                />
                <TextField
                  label="Срок по"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={draft.dueTo}
                  onChange={(e) => setDraft({ ...draft, dueTo: e.target.value })}
                />
              </Stack>
            </Stack>
          )}
          {open && !editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={STATUS_LABELS[open.status] || open.status} />
                {open.priority === 'URGENT' && <Chip color="error" label="Срочно" />}
                {open.priority === 'IMPORTANT' && <Chip color="warning" label="Важно" />}
                <Chip variant="outlined" label={open.unread ? 'Не прочитано' : 'Прочитано'} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Примерные сроки: {fmtDate(open.dueFrom)} — {fmtDate(open.dueTo)}
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{open.description || 'Без описания'}</Typography>
              <Typography variant="body2">
                Прочитали: {(open.readers || []).filter((r) => r.current).map((r) => r.name).join(', ') || 'пока никто'}
              </Typography>
              {images.map((img) => (
                <DevNoteImage key={img.id} noteId={open.id} attachment={img} />
              ))}
              {files.map((file) => (
                <Stack key={file.id} direction="row" alignItems="center" spacing={1}>
                  <AttachFile fontSize="small" />
                  <Typography variant="body2" sx={{ flex: 1 }}>{file.originalName}</Typography>
                  <IconButton size="small" onClick={() => downloadFile(open.id, file)}><Download fontSize="small" /></IconButton>
                </Stack>
              ))}
              <Typography variant="subtitle2">Обсуждение</Typography>
              {(open.comments || []).map((c) => (
                <Box key={c.id}>
                  <Typography variant="caption" color="text.secondary">
                    {personName(c.author)} · {new Date(c.createdAt).toLocaleString('ru-RU')}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.body}</Typography>
                </Box>
              ))}
              {!open.deletedAt && (
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Сообщение"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button variant="contained" onClick={sendComment}>Отправить</Button>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {open && !editing && !open.deletedAt && (
            <>
              <Button component="label" startIcon={<AttachFile />}>
                Файл
                <input hidden type="file" multiple onChange={(e) => uploadFiles(e.target.files)} />
              </Button>
              <Button startIcon={<Edit />} onClick={startEdit}>Редактировать</Button>
              <Button color="error" startIcon={<Delete />} onClick={() => remove(open)}>В корзину</Button>
            </>
          )}
          {open?.deletedAt && (
            <>
              <Button startIcon={<Restore />} onClick={() => restore(open)}>Восстановить</Button>
              <Button color="error" onClick={() => remove(open)}>Удалить навсегда</Button>
            </>
          )}
          {(creating || editing) && (
            <Button variant="contained" disabled={saving || !draft.title.trim()} onClick={save}>
              Сохранить
            </Button>
          )}
          <Button onClick={() => { setOpen(null); setCreating(false); setEditing(false); }}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminDevNotesTab;
