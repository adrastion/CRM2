import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AssignmentTurnedInOutlined,
  AttachFileOutlined,
  CalendarMonthOutlined,
  Check,
  Close,
  CloudUploadOutlined,
  DescriptionOutlined,
  DragIndicator,
  InfoOutlined,
  LinkOutlined,
  NotesOutlined,
  NotificationsNoneOutlined,
  AccessTimeOutlined,
  ChatBubbleOutline,
} from '@mui/icons-material';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';

export type StaffTaskUser = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role?: string;
  email?: string;
  avatarUrl?: string | null;
};

export type StaffTaskSubtask = {
  id: string;
  title: string;
  done: boolean;
};

export type StaffTaskLinkOption = {
  key: string;
  kind: 'client' | 'group' | 'training' | 'branch';
  label: string;
  relatedTrainingId?: string | null;
};

export type CreateStaffTaskPayload = {
  title: string;
  body: string;
  dueAt: string | null;
  assigneeIds: string[];
  createChat: boolean;
  notifyAssignees: boolean;
  status: string;
  priority: string;
  subtasks: StaffTaskSubtask[];
  relatedTrainingId?: string | null;
  relatedSchoolEventId?: string | null;
};

type InitialTask = {
  id: string;
  title: string;
  body: string;
  dueAt: string | null;
  status?: string;
  priority?: string;
  subtasks?: StaffTaskSubtask[] | null;
  notifyAssignees?: boolean;
  relatedTrainingId?: string | null;
  assignees: Array<{ userId: string; user: StaffTaskUser }>;
  chatThread?: { id: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  staffUsers?: StaffTaskUser[];
  initialTask?: InitialTask | null;
  /** Prefill deadline when opening from calendar */
  defaultDueAt?: Date | null;
};

const BODY_MAX = 2000;

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#fff',
    fontSize: 14,
    '& fieldset': { borderColor: '#E3E6EE' },
    '&:hover fieldset': { borderColor: '#C8CEDA' },
    '&.Mui-focused fieldset': { borderColor: colors.primary, borderWidth: 1.5 },
  },
};

const labelSx = {
  fontSize: 13,
  fontWeight: 600,
  color: '#1B2438',
  mb: 0.75,
  display: 'block',
};

function personName(u: Pick<StaffTaskUser, 'lastName' | 'firstName' | 'middleName'>) {
  return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
}

function initials(u: Pick<StaffTaskUser, 'lastName' | 'firstName'>) {
  const a = (u.lastName || '').trim().charAt(0);
  const b = (u.firstName || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function combineDateTime(date: Date | null, time: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (time) {
    d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  } else {
    d.setHours(18, 0, 0, 0);
  }
  return d.toISOString();
}

function parseDue(iso: string | null | undefined): { date: Date | null; time: Date | null } {
  if (!iso) return { date: null, time: null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  return { date: d, time: d };
}

const PRIORITIES: Array<{ value: string; label: string; color: string }> = [
  { value: 'LOW', label: 'Низкий', color: '#00B69B' },
  { value: 'MEDIUM', label: 'Средний', color: '#FF9F43' },
  { value: 'HIGH', label: 'Высокий', color: '#F93C65' },
];

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Открыта', color: '#2F6BFF' },
  { value: 'DONE', label: 'Выполнена', color: '#00B69B' },
  { value: 'CANCELLED', label: 'Отменена', color: '#8B8C8F' },
  { value: 'DRAFT', label: 'Черновик', color: '#8B8C8F' },
];

let subtaskSeq = 0;
function newSubtaskId() {
  subtaskSeq += 1;
  return `st-${Date.now()}-${subtaskSeq}`;
}

const CreateStaffTaskDialog: React.FC<Props> = ({
  open,
  onClose,
  onSaved,
  staffUsers: staffUsersProp,
  initialTask = null,
  defaultDueAt = null,
}) => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [staffUsers, setStaffUsers] = useState<StaffTaskUser[]>(staffUsersProp || []);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assignees, setAssignees] = useState<StaffTaskUser[]>([]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [status, setStatus] = useState('OPEN');
  const [priority, setPriority] = useState('MEDIUM');
  const [linkValue, setLinkValue] = useState<StaffTaskLinkOption | null>(null);
  const [linkOptions, setLinkOptions] = useState<StaffTaskLinkOption[]>([]);
  const [subtasks, setSubtasks] = useState<StaffTaskSubtask[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [createChat, setCreateChat] = useState(true);
  const [notifyAssignees, setNotifyAssignees] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const isEdit = Boolean(initialTask?.id);

  const creatorLabel = useMemo(() => {
    if (!user) return '—';
    return personName({
      lastName: (user as any).lastName || '',
      firstName: (user as any).firstName || '',
      middleName: (user as any).middleName,
    });
  }, [user]);

  const creatorInitial = useMemo(() => {
    const ln = ((user as any)?.lastName || '').charAt(0);
    return (ln || '?').toUpperCase();
  }, [user]);

  const resetForm = useCallback(() => {
    if (initialTask) {
      setTitle(initialTask.title || '');
      setBody(initialTask.body || '');
      setAssignees(initialTask.assignees?.map((a) => a.user) || []);
      const parsed = parseDue(initialTask.dueAt);
      setDueDate(parsed.date);
      setDueTime(parsed.time);
      setStatus(initialTask.status || 'OPEN');
      setPriority((initialTask.priority || 'MEDIUM').toUpperCase());
      setSubtasks(
        Array.isArray(initialTask.subtasks)
          ? initialTask.subtasks.map((s, i) => ({
              id: s.id || `st-${i}`,
              title: s.title || '',
              done: Boolean(s.done),
            }))
          : []
      );
      setCreateChat(false);
      setNotifyAssignees(initialTask.notifyAssignees !== false);
      setLinkValue(null);
      setFiles([]);
    } else {
      setTitle('');
      setBody('');
      setAssignees([]);
      const base = defaultDueAt ? new Date(defaultDueAt) : null;
      if (base) {
        setDueDate(base);
        setDueTime(base);
      } else {
        setDueDate(null);
        setDueTime(null);
      }
      setStatus('OPEN');
      setPriority('MEDIUM');
      setSubtasks([]);
      setCreateChat(true);
      setNotifyAssignees(true);
      setLinkValue(null);
      setFiles([]);
    }
    setError(null);
  }, [initialTask, defaultDueAt]);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    if (staffUsersProp) setStaffUsers(staffUsersProp);
  }, [staffUsersProp]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        if (!staffUsersProp || staffUsersProp.length === 0) {
          const users = await apiService.listStaffWorkspaceUsers();
          if (!cancelled) setStaffUsers(users || []);
        }
        const [clientsRes, groupsRes, trainingsRes, branchesRes] = await Promise.all([
          apiService.getClients({ limit: 40 }, undefined, false).catch(() => ({ data: [] })),
          apiService.getGroups({ limit: 40 }, undefined, false).catch(() => ({ data: [] })),
          apiService.getTrainings({ limit: 40 }).catch(() => ({ data: [] })),
          apiService.getBranches({ limit: 40 }, undefined, false).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        const opts: StaffTaskLinkOption[] = [];
        (clientsRes?.data || []).forEach((c: any) => {
          const name = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ');
          if (name) opts.push({ key: `client:${c.id}`, kind: 'client', label: `Клиент: ${name}` });
        });
        (groupsRes?.data || []).forEach((g: any) => {
          if (g.name) opts.push({ key: `group:${g.id}`, kind: 'group', label: `Группа: ${g.name}` });
        });
        (trainingsRes?.data || []).forEach((t: any) => {
          const when = t.startTime ? new Date(t.startTime).toLocaleString('ru-RU') : '';
          const label = t.title || t.group?.name || 'Тренировка';
          opts.push({
            key: `training:${t.id}`,
            kind: 'training',
            label: `Тренировка: ${label}${when ? ` (${when})` : ''}`,
            relatedTrainingId: t.id,
          });
        });
        (branchesRes?.data || []).forEach((b: any) => {
          if (b.name) opts.push({ key: `branch:${b.id}`, kind: 'branch', label: `Филиал: ${b.name}` });
        });
        setLinkOptions(opts);
      } catch {
        /* ignore link load errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, staffUsersProp]);

  const canSubmit = title.trim().length > 0 && assignees.length > 0 && Boolean(dueDate);

  const buildPayload = (asDraft: boolean): CreateStaffTaskPayload => ({
    title: title.trim(),
    body: body.trim(),
    dueAt: combineDateTime(dueDate, dueTime),
    assigneeIds: assignees.map((u) => u.id),
    createChat: asDraft ? false : createChat,
    notifyAssignees: asDraft ? false : notifyAssignees,
    status: asDraft ? 'DRAFT' : status === 'DRAFT' ? 'OPEN' : status,
    priority,
    subtasks: subtasks.filter((s) => s.title.trim()),
    relatedTrainingId: linkValue?.relatedTrainingId || null,
  });

  const submit = async (asDraft: boolean) => {
    if (!asDraft && !canSubmit) {
      setError('Заполните заголовок, исполнителей и срок выполнения');
      return;
    }
    if (asDraft && !title.trim()) {
      setError('Укажите заголовок для черновика');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(asDraft);
      if (isEdit && initialTask) {
        await apiService.updateStaffTask(initialTask.id, {
          title: payload.title,
          body: payload.body,
          dueAt: payload.dueAt,
          assigneeIds: payload.assigneeIds,
          status: payload.status,
          priority: payload.priority,
          subtasks: payload.subtasks,
          notifyAssignees: payload.notifyAssignees,
          createChat: payload.createChat,
          relatedTrainingId: payload.relatedTrainingId ?? null,
        });
      } else {
        await apiService.createStaffTask(payload);
      }
      await onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить задачу');
    } finally {
      setSaving(false);
    }
  };

  const addSubtask = () => {
    setSubtasks((prev) => [...prev, { id: newSubtaskId(), title: '', done: false }]);
  };

  const onFilesPicked = (list: FileList | null) => {
    if (!list?.length) return;
    const next = Array.from(list).filter((f) => f.size <= 10 * 1024 * 1024);
    setFiles((prev) => [...prev, ...next].slice(0, 20));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        fullScreen={isNarrow}
        scroll="body"
        BackdropProps={{
          sx: {
            bgcolor: 'rgba(27, 36, 56, 0.48)',
            backdropFilter: 'blur(3px)',
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: '20px' },
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(27, 36, 56, 0.24)',
            maxWidth: 760,
            width: '100%',
            m: { xs: 0, sm: 2 },
            maxHeight: { xs: '100%', sm: '92vh' },
          },
        }}
      >
        <Box sx={{ position: 'relative', px: { xs: 2.25, sm: 3 }, pt: { xs: 2.25, sm: 2.75 }, pb: 1.5 }}>
          <IconButton
            aria-label="Закрыть"
            onClick={onClose}
            sx={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 36,
              height: 36,
              bgcolor: '#F1F3F7',
              color: colors.textMuted,
              '&:hover': { bgcolor: '#E6E8EF' },
            }}
          >
            <Close sx={{ fontSize: 18 }} />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pr: 5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: '#EAF0FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AssignmentTurnedInOutlined sx={{ color: colors.primary, fontSize: 24 }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: { xs: 20, sm: 22 },
                  fontWeight: 800,
                  color: '#1B2438',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {isEdit ? 'Редактировать задачу' : 'Новая задача'}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: 13, color: colors.textMuted, lineHeight: 1.45, maxWidth: 520 }}>
                Назначьте задачу сотруднику или тренеру, укажите срок и при необходимости создайте чат по задаче.
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 2.25, sm: 3 },
            pb: 2.5,
            overflowY: 'auto',
            maxHeight: { xs: 'calc(100vh - 120px)', sm: 'calc(92vh - 100px)' },
          }}
        >
          {/* Title */}
          <Box sx={{ mb: 1.75 }}>
            <Typography component="label" sx={labelSx}>
              Заголовок <Box component="span" sx={{ color: colors.danger }}>*</Box>
            </Typography>
            <TextField
              fullWidth
              placeholder="Введите название задачи..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ maxLength: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DescriptionOutlined sx={{ fontSize: 18, color: colors.textHint }} />
                  </InputAdornment>
                ),
              }}
              sx={fieldSx}
            />
          </Box>

          {/* Description */}
          <Box sx={{ mb: 1.75 }}>
            <Typography component="label" sx={labelSx}>
              Описание задачи
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                maxRows={8}
                placeholder="Опишите задачу, детали и ожидаемый результат..."
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.25 }}>
                      <NotesOutlined sx={{ fontSize: 18, color: colors.textHint }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...fieldSx,
                  '& .MuiOutlinedInput-root': {
                    ...fieldSx['& .MuiOutlinedInput-root'],
                    alignItems: 'flex-start',
                    pb: 3,
                  },
                }}
              />
              <Typography
                sx={{
                  position: 'absolute',
                  right: 12,
                  bottom: 8,
                  fontSize: 11,
                  color: colors.textHint,
                  pointerEvents: 'none',
                }}
              >
                {body.length}/{BODY_MAX}
              </Typography>
            </Box>
          </Box>

          {/* Two columns */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: { xs: 1.5, sm: 2 },
              mb: 1.75,
            }}
          >
            {/* Assignees */}
            <Box>
              <Typography component="label" sx={labelSx}>
                Исполнители <Box component="span" sx={{ color: colors.danger }}>*</Box>
              </Typography>
              <Autocomplete
                multiple
                open={assigneeOpen}
                onOpen={() => setAssigneeOpen(true)}
                onClose={() => setAssigneeOpen(false)}
                options={staffUsers}
                value={assignees}
                onChange={(_, v) => setAssignees(v)}
                getOptionLabel={(o) => personName(o)}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                disableCloseOnSelect
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        {...tagProps}
                        size="small"
                        avatar={
                          <Avatar
                            src={option.avatarUrl || undefined}
                            sx={{ width: 22, height: 22, fontSize: 10, bgcolor: '#D6E2FF', color: colors.primary }}
                          >
                            {initials(option)}
                          </Avatar>
                        }
                        label={personName(option)}
                        sx={{
                          bgcolor: '#F1F4FA',
                          borderRadius: '8px',
                          height: 28,
                          '& .MuiChip-label': { fontSize: 12, fontWeight: 600, color: '#1B2438' },
                        }}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={assignees.length ? '' : 'Выберите исполнителей...'}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {params.InputProps.endAdornment}
                          <Button
                            size="small"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setAssigneeOpen(true);
                            }}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 12,
                              color: colors.primary,
                              minWidth: 0,
                              px: 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            + Добавить
                          </Button>
                        </>
                      ),
                    }}
                    sx={fieldSx}
                  />
                )}
              />
            </Box>

            {/* Creator */}
            <Box>
              <Typography component="label" sx={labelSx}>
                Постановщик
              </Typography>
              <TextField
                fullWidth
                value={creatorLabel}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: '#E8EAF0', color: '#5A6275' }}>
                        {creatorInitial}
                      </Avatar>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...fieldSx,
                  '& .MuiOutlinedInput-root': {
                    ...fieldSx['& .MuiOutlinedInput-root'],
                    bgcolor: '#F7F8FB',
                  },
                }}
              />
            </Box>

            {/* Deadline */}
            <Box>
              <Typography component="label" sx={labelSx}>
                Срок выполнения <Box component="span" sx={{ color: colors.danger }}>*</Box>
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <DatePicker
                  value={dueDate}
                  onChange={(v) => setDueDate(v)}
                  format="dd.MM.yyyy"
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      placeholder: 'ДД.ММ.ГГГГ',
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.textHint }} />
                          </InputAdornment>
                        ),
                      },
                      sx: { ...fieldSx, flex: 1.2 },
                    },
                  }}
                />
                <TimePicker
                  value={dueTime}
                  onChange={(v) => setDueTime(v)}
                  ampm={false}
                  format="HH:mm"
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      placeholder: '18:00',
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTimeOutlined sx={{ fontSize: 18, color: colors.textHint }} />
                          </InputAdornment>
                        ),
                      },
                      sx: { ...fieldSx, flex: 1 },
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Priority */}
            <Box>
              <Typography component="label" sx={labelSx}>
                Приоритет <Box component="span" sx={{ color: colors.danger }}>*</Box>
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 0.75,
                  p: 0.5,
                  borderRadius: '10px',
                  border: '1px solid #E3E6EE',
                  bgcolor: '#fff',
                }}
              >
                {PRIORITIES.map((p) => {
                  const selected = priority === p.value;
                  return (
                    <Button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: 13,
                        borderRadius: '8px',
                        py: 0.85,
                        color: selected ? colors.primary : '#1B2438',
                        bgcolor: selected ? '#EAF0FF' : 'transparent',
                        border: selected ? `1.5px solid ${colors.primary}` : '1.5px solid transparent',
                        boxShadow: 'none',
                        '&:hover': {
                          bgcolor: selected ? '#EAF0FF' : '#F5F6FA',
                          boxShadow: 'none',
                        },
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: p.color,
                          mr: 0.75,
                          display: 'inline-block',
                        }}
                      />
                      {p.label}
                    </Button>
                  );
                })}
              </Box>
            </Box>

            {/* Status */}
            <Box>
              <Typography component="label" sx={labelSx}>
                Статус
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={status}
                  onChange={(e) => setStatus(String(e.target.value))}
                  sx={{
                    borderRadius: '10px',
                    fontSize: 14,
                    fontWeight: 600,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E3E6EE' },
                  }}
                  renderValue={(v) => {
                    const opt = STATUS_OPTIONS.find((o) => o.value === v) || STATUS_OPTIONS[0];
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: opt.color }} />
                        {opt.label}
                      </Box>
                    );
                  }}
                >
                  {STATUS_OPTIONS.filter((o) => o.value !== 'DRAFT' || isEdit).map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: o.color }} />
                        {o.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Link */}
            <Box>
              <Typography component="label" sx={labelSx}>
                Связать с
              </Typography>
              <Autocomplete
                options={linkOptions}
                value={linkValue}
                onChange={(_, v) => setLinkValue(v)}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(a, b) => a.key === b.key}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Выберите клиента, группу, тренировку или филиал..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <LinkOutlined sx={{ fontSize: 18, color: colors.textHint }} />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                    sx={fieldSx}
                  />
                )}
              />
            </Box>
          </Box>

          {/* Subtasks + Files */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: { xs: 1.5, sm: 2 },
              mb: 2,
            }}
          >
            <Box>
              <Typography component="label" sx={labelSx}>
                Подзадачи
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {subtasks.map((st, idx) => (
                  <Box
                    key={st.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.35,
                      borderRadius: '10px',
                      border: '1px solid #E3E6EE',
                      bgcolor: '#fff',
                    }}
                  >
                    <DragIndicator sx={{ fontSize: 18, color: colors.textHint, cursor: 'grab' }} />
                    <Checkbox
                      size="small"
                      checked={st.done}
                      onChange={(_, checked) =>
                        setSubtasks((prev) => prev.map((x, i) => (i === idx ? { ...x, done: checked } : x)))
                      }
                      sx={{ p: 0.5 }}
                    />
                    <TextField
                      fullWidth
                      variant="standard"
                      placeholder="Название подзадачи"
                      value={st.title}
                      onChange={(e) =>
                        setSubtasks((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x))
                        )
                      }
                      InputProps={{ disableUnderline: true }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: 13,
                          fontWeight: 500,
                          textDecoration: st.done ? 'line-through' : 'none',
                          color: st.done ? colors.textHint : '#1B2438',
                        },
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                      sx={{ color: colors.textHint }}
                    >
                      <Close sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  onClick={addSubtask}
                  fullWidth
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    color: colors.primary,
                    border: `1.5px dashed ${colors.primary}`,
                    borderRadius: '10px',
                    py: 1,
                    bgcolor: 'rgba(47,107,255,0.04)',
                    '&:hover': { bgcolor: 'rgba(47,107,255,0.08)', borderStyle: 'dashed' },
                  }}
                >
                  + Добавить подзадачу
                </Button>
              </Box>
            </Box>

            <Box>
              <Typography component="label" sx={labelSx}>
                Файлы
              </Typography>
              <Box
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFilesPicked(e.dataTransfer.files);
                }}
                sx={{
                  border: '1.5px dashed #A8C0FF',
                  borderRadius: '12px',
                  bgcolor: '#F5F8FF',
                  minHeight: 148,
                  px: 2,
                  py: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: '#EEF3FF' },
                }}
              >
                <CloudUploadOutlined sx={{ fontSize: 32, color: colors.primary, mb: 1 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1B2438', mb: 0.5 }}>
                  Перетащите файлы сюда или нажмите для выбора
                </Typography>
                <Typography sx={{ fontSize: 11, color: colors.textHint, lineHeight: 1.4, maxWidth: 280 }}>
                  Поддерживаются файлы: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX (до 10 МБ)
                </Typography>
                {files.length > 0 && (
                  <Box sx={{ mt: 1.25, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                    {files.map((f) => (
                      <Chip
                        key={`${f.name}-${f.size}`}
                        size="small"
                        icon={<AttachFileOutlined sx={{ fontSize: '14px !important' }} />}
                        label={f.name}
                        onDelete={() => setFiles((prev) => prev.filter((x) => x !== f))}
                        sx={{ bgcolor: '#fff', fontSize: 11 }}
                      />
                    ))}
                  </Box>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                  }}
                />
              </Box>
            </Box>
          </Box>

          {error && (
            <Typography sx={{ color: colors.danger, fontSize: 13, mb: 1.5, fontWeight: 600 }}>{error}</Typography>
          )}

          {/* Footer */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              pt: 0.5,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  checked={createChat}
                  onChange={(_, v) => setCreateChat(v)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.primary },
                  }}
                />
                <ChatBubbleOutline sx={{ fontSize: 16, color: colors.primary }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1B2438' }}>
                  Создать чат по задаче
                </Typography>
                <Tooltip title="Будет создан чат с исполнителями по этой задаче">
                  <InfoOutlined sx={{ fontSize: 15, color: colors.textHint }} />
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  checked={notifyAssignees}
                  onChange={(_, v) => setNotifyAssignees(v)}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.primary },
                  }}
                />
                <NotificationsNoneOutlined sx={{ fontSize: 16, color: colors.primary }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1B2438' }}>
                  Уведомить исполнителей сразу
                </Typography>
                <Tooltip title="Исполнители получат уведомление сразу после создания">
                  <InfoOutlined sx={{ fontSize: 15, color: colors.textHint }} />
                </Tooltip>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: { xs: 'stretch', sm: 'flex-end' },
                gap: 1,
              }}
            >
              {!isEdit && (
                <Button
                  onClick={() => void submit(true)}
                  disabled={saving || !title.trim()}
                  startIcon={<DescriptionOutlined sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    color: colors.textMuted,
                    bgcolor: '#F1F3F7',
                    borderRadius: `${radii.button}px`,
                    px: 1.75,
                    '&:hover': { bgcolor: '#E6E8EF' },
                  }}
                >
                  Сохранить как черновик
                </Button>
              )}
              <Button
                onClick={onClose}
                disabled={saving}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  color: colors.textMuted,
                  bgcolor: '#F1F3F7',
                  borderRadius: `${radii.button}px`,
                  px: 2,
                  '&:hover': { bgcolor: '#E6E8EF' },
                }}
              >
                Отмена
              </Button>
              <Button
                variant="contained"
                onClick={() => void submit(false)}
                disabled={saving || (!isEdit && !canSubmit)}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Check sx={{ fontSize: 18 }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: `${radii.button}px`,
                  bgcolor: colors.primary,
                  boxShadow: 'none',
                  px: 2.25,
                  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                }}
              >
                {isEdit ? 'Сохранить' : 'Создать задачу'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateStaffTaskDialog;
