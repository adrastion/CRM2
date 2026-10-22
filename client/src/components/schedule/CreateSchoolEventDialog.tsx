import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  AssignmentOutlined,
  CalendarMonthOutlined,
  Close,
  DoorFrontOutlined,
  EventAvailableOutlined,
  GroupsOutlined,
  MoreHoriz,
  PersonOutline,
  PlaceOutlined,
  SaveOutlined,
  VisibilityOutlined,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { isBefore } from 'date-fns';
import { apiService } from '../../services/api';
import { Branch, Group, Trainer } from '../../types';
import { colors, radii } from '../../theme/tokens';

const DESC_MAX = 500;

export type SchoolEventType =
  | 'parent_meeting'
  | 'attestation'
  | 'activity'
  | 'open_day'
  | 'other';

export type EventVisibility = 'all_staff' | 'selected_staff' | 'admins_only';

const EVENT_TYPE_CARDS: Array<{
  value: SchoolEventType;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'parent_meeting',
    label: 'Родительское собрание',
    icon: <GroupsOutlined sx={{ fontSize: 22 }} />,
  },
  {
    value: 'attestation',
    label: 'Аттестация',
    icon: <AssignmentOutlined sx={{ fontSize: 22 }} />,
  },
  {
    value: 'activity',
    label: 'Мероприятие',
    icon: <EventAvailableOutlined sx={{ fontSize: 22 }} />,
  },
  {
    value: 'open_day',
    label: 'День открытых дверей',
    icon: <DoorFrontOutlined sx={{ fontSize: 22 }} />,
  },
  {
    value: 'other',
    label: 'Другое',
    icon: <MoreHoriz sx={{ fontSize: 22 }} />,
  },
];

const TYPE_LABELS: Record<string, string> = {
  parent_meeting: 'Родительское собрание',
  attestation: 'Аттестация',
  activity: 'Мероприятие',
  open_day: 'День открытых дверей',
  other: 'Другое',
  /** legacy — соревнования создаются отдельно в календаре */
  competition: 'Соревнование',
};

export const schoolEventTypeLabel = (type?: string | null): string =>
  (type && TYPE_LABELS[type]) || 'Мероприятие';

export const normalizeSchoolEventType = (type?: string | null): SchoolEventType => {
  if (type && EVENT_TYPE_CARDS.some((c) => c.value === type)) return type as SchoolEventType;
  return 'other';
};

type FormState = {
  title: string;
  type: SchoolEventType;
  date: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  allDay: boolean;
  repeat: boolean;
  description: string;
  location: string;
  branchId: string;
  groupIds: string[];
  trainerId: string;
  visibility: EventVisibility;
  sendNotifications: boolean;
};

const atHours = (base: Date, h: number, m: number) => {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

const emptyForm = (initialDate?: Date | null): FormState => {
  const base = initialDate ? new Date(initialDate) : new Date();
  return {
    title: '',
    type: 'parent_meeting',
    date: base,
    startTime: atHours(base, 18, 0),
    endTime: atHours(base, 19, 0),
    allDay: false,
    repeat: false,
    description: '',
    location: '',
    branchId: '',
    groupIds: [],
    trainerId: '',
    visibility: 'all_staff',
    sendNotifications: true,
  };
};

const formFromEvent = (event: any): FormState => {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const allDay =
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 23 &&
    end.getMinutes() >= 59;
  const groupIds =
    event.groups?.map((g: any) => g.groupId || g.group?.id).filter(Boolean) ||
    (event.groupId ? [event.groupId] : []);
  const trainerId = event.trainers?.[0]?.trainerId || event.trainers?.[0]?.trainer?.id || '';
  return {
    title: event.title || '',
    type: normalizeSchoolEventType(event.type),
    date: start,
    startTime: start,
    endTime: end,
    allDay,
    repeat: false,
    description: event.description || '',
    location: event.location || '',
    branchId: event.branchId || '',
    groupIds,
    trainerId,
    visibility: 'all_staff',
    sendNotifications: true,
  };
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#E5E9F2' },
    '&:hover fieldset': { borderColor: '#C9D7FF' },
    '&.Mui-focused fieldset': { borderColor: colors.primary },
  },
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

const trainerLabel = (t: Trainer) =>
  t.user
    ? `${t.user.lastName} ${t.user.firstName} ${t.user.middleName || ''}`.trim()
    : `Тренер #${t.id}`;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  initialDate?: Date | null;
  /** Если передан — режим редактирования. */
  event?: any | null;
  branches: Branch[];
  groups: Group[];
  trainers: Trainer[];
};

const CreateSchoolEventDialog: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  initialDate = null,
  event = null,
  branches,
  groups,
  trainers,
}) => {
  const isEdit = Boolean(event?.id);
  const [form, setForm] = useState<FormState>(() => emptyForm(initialDate));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setSaving(false);
    setForm(event?.id ? formFromEvent(event) : emptyForm(initialDate));
  }, [open, event, initialDate]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const activeGroups = useMemo(() => groups.filter((g) => g.isActive !== false), [groups]);

  const combine = (date: Date | null, time: Date | null) => {
    if (!date || !time) return null;
    const r = new Date(date);
    r.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return r;
  };

  const canSubmit = Boolean(form.title.trim() && form.date && form.startTime && form.endTime && !saving);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setLocalError('Укажите название события');
      return;
    }
    if (!form.date || !form.startTime || !form.endTime) {
      setLocalError('Укажите дату и время');
      return;
    }

    let startTime: Date | null;
    let endTime: Date | null;
    if (form.allDay) {
      startTime = atHours(form.date, 0, 0);
      endTime = atHours(form.date, 23, 59);
    } else {
      startTime = combine(form.date, form.startTime);
      endTime = combine(form.date, form.endTime);
    }

    if (!startTime || !endTime) {
      setLocalError('Укажите дату и время');
      return;
    }
    if (!isBefore(startTime, endTime)) {
      setLocalError('Время окончания должно быть позже начала');
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: form.location.trim() || null,
        branchId: form.branchId || null,
        groupIds: form.groupIds,
        trainerIds: form.trainerId ? [form.trainerId] : [],
        participantIds: [],
        parentIds: [],
      };
      if (isEdit && event?.id) {
        await apiService.updateSchoolEvent(event.id, payload);
      } else {
        await apiService.createSchoolEvent(payload);
      }
      await onSuccess?.();
      onClose();
    } catch (e: any) {
      setLocalError(e?.response?.data?.error || 'Не удалось сохранить событие');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(27, 36, 56, 0.2)',
          overflow: 'hidden',
          maxWidth: 760,
        },
      }}
    >
      <Box sx={{ px: 2.75, pt: 2.25, pb: 1.25, position: 'relative' }}>
        <IconButton
          onClick={() => !saving && onClose()}
          sx={{ position: 'absolute', top: 14, right: 14, color: '#8B93A7' }}
        >
          <Close />
        </IconButton>
        <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ pr: 4 }}>
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
            <CalendarMonthOutlined />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', letterSpacing: '-0.02em' }}>
              {isEdit ? 'Редактировать событие' : 'Добавить событие'}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#8B93A7', mt: 0.35 }}>
              Создайте событие в календаре: тренировку, собрание, мероприятие или другое.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: 2.75, pb: 1, maxHeight: '70vh', overflow: 'auto' }}>
        {localError && (
          <Typography sx={{ color: '#DC2626', fontWeight: 650, fontSize: 13, mb: 1.5 }}>
            {localError}
          </Typography>
        )}

        <Box sx={{ mb: 1.75 }}>
          <FieldLabel required>Название события</FieldLabel>
          <TextField
            size="small"
            fullWidth
            placeholder="Например: Родительское собрание, Соревнования, Аттестация"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            sx={fieldSx}
          />
        </Box>

        <Box sx={{ mb: 1.75 }}>
          <FieldLabel required>Тип события</FieldLabel>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr 1fr',
                sm: 'repeat(5, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            {EVENT_TYPE_CARDS.map((card) => {
              const selected = form.type === card.value;
              return (
                <Box
                  key={card.value}
                  onClick={() => set('type', card.value)}
                  sx={{
                    px: 1,
                    py: 1.25,
                    borderRadius: '12px',
                    border: '1.5px solid',
                    borderColor: selected ? colors.primary : '#E5E9F2',
                    bgcolor: selected ? '#F5F8FF' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': { borderColor: '#C9D7FF' },
                  }}
                >
                  <Box sx={{ color: selected ? colors.primary : '#8B93A7', mb: 0.5 }}>{card.icon}</Box>
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      fontWeight: 750,
                      color: selected ? colors.primary : '#1B2438',
                      lineHeight: 1.25,
                    }}
                  >
                    {card.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr 1fr' },
            gap: 1.25,
            mb: 0.5,
          }}
        >
          <Box>
            <FieldLabel required>Дата</FieldLabel>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
              <DatePicker
                value={form.date}
                onChange={(d) => set('date', d)}
                format="dd.MM.yyyy"
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: fieldSx,
                    InputProps: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarMonthOutlined sx={{ fontSize: 18, color: colors.primary }} />
                        </InputAdornment>
                      ),
                    },
                  },
                }}
              />
            </LocalizationProvider>
          </Box>
          <Box>
            <FieldLabel required>Время начала</FieldLabel>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
              <TimePicker
                value={form.startTime}
                onChange={(d) => set('startTime', d)}
                ampm={false}
                disabled={form.allDay}
                slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
              />
            </LocalizationProvider>
          </Box>
          <Box>
            <FieldLabel required>Время окончания</FieldLabel>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
              <TimePicker
                value={form.endTime}
                onChange={(d) => set('endTime', d)}
                ampm={false}
                disabled={form.allDay}
                slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
              />
            </LocalizationProvider>
          </Box>
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 1.75, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.allDay}
                onChange={(e) => set('allDay', e.target.checked)}
                sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
              />
            }
            label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Весь день</Typography>}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.repeat}
                onChange={(e) => set('repeat', e.target.checked)}
                sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
              />
            }
            label={<Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Повторять событие</Typography>}
          />
        </Stack>

        <Box sx={{ mb: 1.75 }}>
          <FieldLabel>Описание</FieldLabel>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Добавьте подробную информацию о событии..."
            value={form.description}
            onChange={(e) => set('description', e.target.value.slice(0, DESC_MAX))}
            sx={fieldSx}
          />
          <Typography sx={{ textAlign: 'right', fontSize: 11.5, fontWeight: 650, color: '#8B93A7', mt: 0.5 }}>
            {form.description.length} / {DESC_MAX}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
            mb: 1.75,
          }}
        >
          <Box>
            <FieldLabel>Место проведения</FieldLabel>
            <TextField
              size="small"
              fullWidth
              placeholder="Например: Зал №1, Конференц-зал, Онлайн"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              sx={fieldSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <PlaceOutlined sx={{ fontSize: 18, color: colors.primary }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Box>
            <FieldLabel>Филиал</FieldLabel>
            <FormControl fullWidth size="small">
              <Select
                value={form.branchId}
                displayEmpty
                onChange={(e) => set('branchId', e.target.value)}
                sx={{ borderRadius: '10px', fontWeight: 650 }}
                renderValue={(v) => {
                  if (!v) return <span style={{ color: '#8B93A7' }}>Выберите филиал</span>;
                  return branches.find((b) => b.id === v)?.name || v;
                }}
              >
                <MenuItem value="">
                  <em>Не выбран</em>
                </MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box sx={{ mb: 1.75 }}>
          <FieldLabel>Группы</FieldLabel>
          <FormControl fullWidth size="small">
            <Select
              multiple
              value={form.groupIds}
              displayEmpty
              onChange={(e) => set('groupIds', e.target.value as string[])}
              sx={{ borderRadius: '10px', fontWeight: 650 }}
              startAdornment={
                <InputAdornment position="start">
                  <GroupsOutlined sx={{ fontSize: 18, color: colors.primary }} />
                </InputAdornment>
              }
              renderValue={(selected) => {
                if (!selected.length) {
                  return <span style={{ color: '#8B93A7' }}>Выберите одну или несколько групп</span>;
                }
                return selected
                  .map((id) => activeGroups.find((g) => g.id === id)?.name || id)
                  .join(', ');
              }}
            >
              {activeGroups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  <Checkbox
                    checked={form.groupIds.includes(g.id)}
                    size="small"
                    sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
                  />
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 1.75 }}>
          <FieldLabel>Привязать к тренеру</FieldLabel>
          <FormControl fullWidth size="small">
            <Select
              value={form.trainerId}
              displayEmpty
              onChange={(e) => set('trainerId', e.target.value)}
              sx={{ borderRadius: '10px', fontWeight: 650 }}
              startAdornment={
                <InputAdornment position="start">
                  <PersonOutline sx={{ fontSize: 18, color: colors.primary }} />
                </InputAdornment>
              }
              renderValue={(v) => {
                if (!v) {
                  return <span style={{ color: '#8B93A7' }}>Выберите тренера (необязательно)</span>;
                }
                const t = trainers.find((x) => x.id === v);
                return t ? trainerLabel(t) : v;
              }}
            >
              <MenuItem value="">
                <em>Не выбран</em>
              </MenuItem>
              {trainers.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {trainerLabel(t)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <VisibilityOutlined sx={{ fontSize: 18, color: colors.primary }} />
            <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#1B2438' }}>
              Видимость события
            </Typography>
          </Stack>
          <RadioGroup
            row
            value={form.visibility}
            onChange={(e) => set('visibility', e.target.value as EventVisibility)}
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            <FormControlLabel
              value="all_staff"
              control={<Radio size="small" sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }} />}
              label={<Typography sx={{ fontSize: 13, fontWeight: 650 }}>Для всех сотрудников</Typography>}
            />
            <FormControlLabel
              value="selected_staff"
              control={<Radio size="small" sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }} />}
              label={
                <Typography sx={{ fontSize: 13, fontWeight: 650 }}>Только для выбранных сотрудников</Typography>
              }
            />
            <FormControlLabel
              value="admins_only"
              control={<Radio size="small" sx={{ color: colors.primary, '&.Mui-checked': { color: colors.primary } }} />}
              label={<Typography sx={{ fontSize: 13, fontWeight: 650 }}>Только для администрации</Typography>}
            />
          </RadioGroup>
        </Box>
      </Box>

      <Box
        sx={{
          px: 2.75,
          py: 1.75,
          borderTop: '1px solid #EEF1F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
          <Switch
            checked={form.sendNotifications}
            onChange={(e) => set('sendNotifications', e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: colors.primary },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: colors.primary },
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#1B2438' }}>
              Отправить уведомления
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#8B93A7' }}>
              Уведомить выбранных сотрудников и участников о событии
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            onClick={() => !saving && onClose()}
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
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
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
            Сохранить событие
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
};

export default CreateSchoolEventDialog;
