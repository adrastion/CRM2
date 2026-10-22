import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForwardIos,
  CalendarMonthOutlined,
  Close,
  GroupsOutlined,
  PersonOutline,
  PersonAddAlt1,
  ChecklistRtlOutlined,
  EventRepeatOutlined,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { addMonths, isBefore, startOfDay } from 'date-fns';
import { apiService } from '../../services/api';
import { Branch, Client, Group, Trainer } from '../../types';
import { colors, radii } from '../../theme/tokens';
import CreateClientDialog from '../client/CreateClientDialog';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';

const DESC_MAX = 500;

const TRAINING_TYPES_GROUP = ['Групповая', 'ОФП', 'Техника', 'Спарринг', 'Другое'] as const;
const TRAINING_TYPES_INDIVIDUAL = ['Индивидуальная', 'Техника', 'ОФП', 'Другое'] as const;
const LEVELS = ['Начальная', 'Базовый', 'Средний', 'Продвинутый', 'Спортивный'] as const;

const WEEK_DAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

type FlowKind = 'group' | 'individual' | 'recurring';
type Step = 'type' | FlowKind;

type FormState = {
  groupId: string;
  clientId: string;
  branchId: string;
  date: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  recurrenceStart: Date | null;
  recurrenceEnd: Date | null;
  daysOfWeek: number[];
  trainerId: string;
  topic: string;
  trainingKind: string;
  level: string;
  description: string;
};

const atTime = (h: number, m: number): Date => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const emptyForm = (initialDate?: Date | null): FormState => ({
  groupId: '',
  clientId: '',
  branchId: '',
  date: initialDate ? new Date(initialDate) : new Date(),
  startTime: atTime(10, 0),
  endTime: atTime(11, 0),
  recurrenceStart: initialDate ? new Date(initialDate) : new Date(),
  recurrenceEnd: addMonths(initialDate ? new Date(initialDate) : new Date(), 2),
  daysOfWeek: [1, 3, 5],
  trainerId: '',
  topic: '',
  trainingKind: '',
  level: '',
  description: '',
});

const trainerLabel = (t: Trainer) =>
  t.user
    ? `${t.user.lastName} ${t.user.firstName} ${t.user.middleName || ''}`.trim()
    : `Тренер #${t.id}`;

const groupLabel = (g: Group) => {
  const age =
    g.ageMin != null || g.ageMax != null
      ? ` (${[g.ageMin, g.ageMax].filter((x) => x != null).join('-')} лет)`
      : '';
  const level = g.skillLevel ? `, ${g.skillLevel}` : '';
  return `${g.name}${age}${level}`;
};

const clientLabel = (c: Client) =>
  [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ').trim() ||
  `${c.firstName} ${c.lastName}`;

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

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, mt: 0.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '8px',
          bgcolor: '#EEF4FF',
          color: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438' }}>{title}</Typography>
    </Stack>
  );
}

function IconSelect({
  label,
  required,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Box>
      <FieldLabel required={required}>{label}</FieldLabel>
      <FormControl fullWidth size="small">
        <Select
          value={value}
          displayEmpty
          onChange={(e) => onChange(e.target.value)}
          sx={{ borderRadius: '10px', fontWeight: 650 }}
          renderValue={(v) => {
            if (!v) return <span style={{ color: '#8B93A7' }}>{placeholder}</span>;
            return options.find((o) => o.value === v)?.label || v;
          }}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

export interface CreateTrainingFlowDialogsProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Предзаполненная дата (клик по дню календаря). */
  initialDate?: Date | null;
}

const dialogPaper = {
  borderRadius: '16px',
  boxShadow: '0 24px 64px rgba(27, 36, 56, 0.2)',
  overflow: 'hidden',
  maxWidth: 720,
};

const CreateTrainingFlowDialogs: React.FC<CreateTrainingFlowDialogsProps> = ({
  open,
  onClose,
  onSuccess,
  initialDate = null,
}) => {
  const [step, setStep] = useState<Step>('type');
  const [form, setForm] = useState<FormState>(() => emptyForm(initialDate));
  const [baseline, setBaseline] = useState<FormState>(() => emptyForm(initialDate));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetAll = useCallback(() => {
    const next = emptyForm(initialDate);
    setStep('type');
    setForm(next);
    setBaseline(next);
    setSaving(false);
    setLocalError(null);
    setCreateClientOpen(false);
  }, [initialDate]);

  const closeFlow = useCallback(() => {
    resetAll();
    onClose();
  }, [onClose, resetAll]);

  useEffect(() => {
    if (!open) {
      resetAll();
      return;
    }
    resetAll();
    setRefsLoading(true);
    const abort = new AbortController();
    Promise.all([
      apiService.getGroups({ limit: 1000, page: 1 }, abort.signal),
      apiService.getTrainers({ limit: 1000, page: 1 }, abort.signal),
      apiService.getBranches({ limit: 1000, page: 1 }, abort.signal),
      apiService.getClients({ limit: 1000 }, abort.signal).catch(() => ({ data: [] as Client[] })),
    ])
      .then(([g, t, b, c]) => {
        if (abort.signal.aborted) return;
        setGroups(g.data || []);
        setTrainers(t.data || []);
        setBranches(b.data || []);
        setClients(c?.data || []);
      })
      .catch(() => {
        if (!abort.signal.aborted) setLocalError('Не удалось загрузить справочники');
      })
      .finally(() => {
        if (!abort.signal.aborted) setRefsLoading(false);
      });
    return () => abort.abort();
  }, [open, resetAll]);

  const pickKind = (kind: FlowKind) => {
    const next = emptyForm(initialDate);
    if (kind === 'group') {
      next.trainingKind = 'Групповая';
      next.level = 'Начальная';
      next.startTime = atTime(10, 0);
      next.endTime = atTime(11, 0);
    } else if (kind === 'individual') {
      next.trainingKind = 'Индивидуальная';
      next.level = 'Базовый';
      next.startTime = atTime(14, 0);
      next.endTime = atTime(14, 50);
    } else {
      next.trainingKind = 'Групповая';
      next.level = 'Начальная';
      next.startTime = atTime(10, 0);
      next.endTime = atTime(11, 0);
    }
    setForm(next);
    setBaseline(next);
    setLocalError(null);
    setStep(kind);
  };

  const onGroupChange = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    setForm((prev) => ({
      ...prev,
      groupId,
      branchId: g?.branchId || prev.branchId,
      trainerId: g?.trainerId || prev.trainerId,
    }));
  };

  const resolveTitle = () => {
    if (form.topic.trim()) return form.topic.trim();
    if (step === 'individual') return 'Индивидуальная тренировка';
    const g = groups.find((x) => x.id === form.groupId);
    return g ? `Тренировка: ${g.name}` : 'Тренировка группы';
  };

  const buildDescription = () => {
    const parts: string[] = [];
    if (form.trainingKind) parts.push(`Тип: ${form.trainingKind}`);
    if (form.level) parts.push(`Уровень: ${form.level}`);
    if (form.description.trim()) parts.push(form.description.trim());
    return parts.join('\n') || undefined;
  };

  const formDirty = open && step !== 'type' && isDirtyValue(form, baseline);

  const submitOneOff = async (kind: 'group' | 'individual') => {
    if (kind === 'group' && !form.groupId) {
      setLocalError('Выберите группу');
      return false;
    }
    if (kind === 'individual' && !form.clientId) {
      setLocalError('Выберите клиента');
      return false;
    }
    if (!form.branchId || !form.trainerId || !form.date || !form.startTime || !form.endTime) {
      setLocalError('Заполните обязательные поля');
      return false;
    }

    const start = new Date(form.date);
    start.setHours(form.startTime.getHours(), form.startTime.getMinutes(), 0, 0);
    const end = new Date(form.date);
    end.setHours(form.endTime.getHours(), form.endTime.getMinutes(), 0, 0);
    if (!isBefore(start, end)) {
      setLocalError('Время окончания должно быть позже начала');
      return false;
    }

    const payload: Record<string, unknown> = {
      title: resolveTitle(),
      description: buildDescription(),
      trainerId: form.trainerId,
      branchId: form.branchId,
      isRecurring: false,
      recurrence: 'weekly',
      daysOfWeek: [],
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      groupId: kind === 'group' ? form.groupId : null,
    };

    setSaving(true);
    setLocalError(null);
    try {
      const created = await apiService.createTraining(payload);
      const trainingId = created?.id || created?.data?.id;
      if (kind === 'individual' && form.clientId && trainingId) {
        try {
          await new Promise((r) => setTimeout(r, 250));
          await apiService.bulkUpdateAttendance(trainingId, [
            { clientId: form.clientId, status: 'PRESENT', notes: '', shouldCharge: false },
          ]);
        } catch {
          /* тренировка уже создана */
        }
      }
      onSuccess?.();
      closeFlow();
      return true;
    } catch (e: any) {
      setLocalError(e?.response?.data?.error || 'Не удалось создать тренировку');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitRecurring = async () => {
    if (!form.groupId || !form.branchId || !form.trainerId) {
      setLocalError('Заполните группу, филиал и тренера');
      return false;
    }
    if (!form.recurrenceStart || !form.recurrenceEnd || !form.startTime || !form.endTime) {
      setLocalError('Укажите период и время');
      return false;
    }
    if (form.daysOfWeek.length === 0) {
      setLocalError('Выберите хотя бы один день недели');
      return false;
    }
    if (isBefore(form.recurrenceEnd, form.recurrenceStart)) {
      setLocalError('Дата окончания не может быть раньше начала');
      return false;
    }

    const trainingData = {
      title: resolveTitle(),
      description: buildDescription(),
      trainerId: form.trainerId,
      branchId: form.branchId,
      groupId: form.groupId,
      isRecurring: true,
      recurrence: 'weekly',
      daysOfWeek: form.daysOfWeek,
    };

    const trainings: Array<Record<string, unknown>> = [];
    const cursor = startOfDay(form.recurrenceStart);
    const endDate = startOfDay(form.recurrenceEnd);
    const daySet = new Set(form.daysOfWeek);

    while (cursor.getTime() <= endDate.getTime()) {
      if (daySet.has(cursor.getDay())) {
        const s = new Date(cursor);
        s.setHours(form.startTime.getHours(), form.startTime.getMinutes(), 0, 0);
        const e = new Date(cursor);
        e.setHours(form.endTime.getHours(), form.endTime.getMinutes(), 0, 0);
        if (isBefore(s, e)) {
          trainings.push({
            ...trainingData,
            startTime: s.toISOString(),
            endTime: e.toISOString(),
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (trainings.length === 0) {
      setLocalError('В выбранном периоде нет подходящих дней');
      return false;
    }

    setSaving(true);
    setLocalError(null);
    try {
      if (trainings.length === 1) {
        await apiService.createTraining(trainings[0]);
      } else {
        const chunkSize = 50;
        let createdCount = 0;
        let failedCount = 0;
        for (let i = 0; i < trainings.length; i += chunkSize) {
          const chunk = trainings.slice(i, i + chunkSize);
          const result = await apiService.createTrainingsBatch(chunk);
          createdCount += result.createdCount || 0;
          failedCount += result.failedCount || 0;
        }
        if (failedCount > 0 && createdCount === 0) {
          setLocalError('Не удалось создать серию тренировок');
          return false;
        }
      }
      onSuccess?.();
      closeFlow();
      return true;
    } catch (e: any) {
      setLocalError(e?.response?.data?.error || 'Не удалось создать серию тренировок');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitCurrent = async (): Promise<boolean> => {
    if (step === 'group') return submitOneOff('group');
    if (step === 'individual') return submitOneOff('individual');
    if (step === 'recurring') return submitRecurring();
    return false;
  };

  const discardForm = useCallback(() => {
    if (step !== 'type') {
      setStep('type');
      const next = emptyForm(initialDate);
      setForm(next);
      setBaseline(next);
      setLocalError(null);
      return;
    }
    closeFlow();
  }, [closeFlow, initialDate, step]);

  const unsaved = useUnsavedClose({
    isDirty: Boolean(formDirty),
    onDiscard: closeFlow,
    onSave: submitCurrent,
  });

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: groupLabel(g) })),
    [groups]
  );
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b.id, label: b.name })),
    [branches]
  );
  const trainerOptions = useMemo(
    () => trainers.map((t) => ({ value: t.id, label: trainerLabel(t) })),
    [trainers]
  );
  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id, label: clientLabel(c) })),
    [clients]
  );

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => ((a === 0 ? 7 : a) - (b === 0 ? 7 : b))),
    }));
  };

  const footer = (primaryLabel: string, onPrimary: () => void) => (
    <Box
      sx={{
        px: 2.75,
        py: 1.75,
        borderTop: '1px solid #EEF1F6',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 1,
      }}
    >
      <Button
        onClick={() => (!saving ? discardForm() : undefined)}
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
        disabled={saving || refsLoading}
        onClick={() => void onPrimary()}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
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
        {primaryLabel}
      </Button>
    </Box>
  );

  const additionalFields = (kinds: readonly string[]) => (
    <>
      <SectionHead icon={<ChecklistRtlOutlined sx={{ fontSize: 18 }} />} title="Дополнительно" />
      <Box sx={{ display: 'grid', gap: 1.25, mb: 1 }}>
        <Box>
          <FieldLabel>Тема тренировки</FieldLabel>
          <TextField
            size="small"
            fullWidth
            placeholder="Например: Техника базовых ударов"
            value={form.topic}
            onChange={(e) => set('topic', e.target.value)}
            sx={fieldSx}
          />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
          }}
        >
          <IconSelect
            label="Тип тренировки"
            value={form.trainingKind}
            onChange={(v) => set('trainingKind', v)}
            placeholder="Выберите тип"
            options={kinds.map((k) => ({ value: k, label: k }))}
          />
          <IconSelect
            label="Уровень подготовки"
            value={form.level}
            onChange={(v) => set('level', v)}
            placeholder="Выберите уровень"
            options={LEVELS.map((k) => ({ value: k, label: k }))}
          />
        </Box>
        <Box>
          <FieldLabel>Описание (необязательно)</FieldLabel>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Кратко о содержании занятия…"
            value={form.description}
            onChange={(e) => set('description', e.target.value.slice(0, DESC_MAX))}
            sx={fieldSx}
          />
          <Typography sx={{ textAlign: 'right', fontSize: 11.5, fontWeight: 650, color: '#8B93A7', mt: 0.5 }}>
            {form.description.length} / {DESC_MAX}
          </Typography>
        </Box>
      </Box>
    </>
  );

  const trainerSection = (
    <>
      <SectionHead icon={<PersonOutline sx={{ fontSize: 18 }} />} title="Тренер" />
      <Box sx={{ mb: 2 }}>
        <IconSelect
          label="Тренер"
          required
          value={form.trainerId}
          onChange={(v) => set('trainerId', v)}
          placeholder="Выберите тренера"
          options={trainerOptions}
        />
      </Box>
    </>
  );

  const dateTimeRow = (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr 1fr' },
        gap: 1.25,
        mb: 1.25,
      }}
    >
      <Box>
        <FieldLabel required>Дата</FieldLabel>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
          <DatePicker
            value={form.date}
            onChange={(d) => set('date', d)}
            format="dd.MM.yyyy"
            slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
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
            slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
          />
        </LocalizationProvider>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Выбор типа */}
      <Dialog
        open={open && step === 'type'}
        onClose={() => closeFlow()}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { ...dialogPaper, maxWidth: 560 } }}
      >
        <Box sx={{ px: 2.75, pt: 2.25, pb: 1, position: 'relative' }}>
          <IconButton
            onClick={() => closeFlow()}
            sx={{ position: 'absolute', top: 12, right: 12, color: '#8B93A7' }}
          >
            <Close />
          </IconButton>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#1B2438', pr: 4 }}>
            Какое занятие вы хотите добавить?
          </Typography>
        </Box>
        <Box sx={{ px: 2.75, pb: 1.5 }}>
          {refsLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
              mb: 1.5,
            }}
          >
            {[
              {
                kind: 'group' as const,
                title: 'Тренировка группы',
                subtitle: 'Создать тренировку для существующей группы',
                icon: <GroupsOutlined sx={{ fontSize: 28 }} />,
              },
              {
                kind: 'individual' as const,
                title: 'Индивидуальная тренировка',
                subtitle: 'Создать разовую тренировку для выбранного клиента',
                icon: <PersonOutline sx={{ fontSize: 28 }} />,
              },
            ].map((card) => (
              <Box
                key={card.kind}
                onClick={() => !refsLoading && pickKind(card.kind)}
                sx={{
                  p: 2,
                  borderRadius: '14px',
                  border: '1px solid #EEF1F6',
                  bgcolor: '#fff',
                  cursor: refsLoading ? 'default' : 'pointer',
                  position: 'relative',
                  minHeight: 128,
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  '&:hover': {
                    borderColor: '#C9D7FF',
                    boxShadow: '0 8px 24px rgba(47, 107, 255, 0.12)',
                  },
                }}
              >
                <Box sx={{ color: colors.primary, mb: 1 }}>{card.icon}</Box>
                <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1B2438', mb: 0.5 }}>
                  {card.title}
                </Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#8B93A7', pr: 2 }}>
                  {card.subtitle}
                </Typography>
                <ArrowForwardIos
                  sx={{ position: 'absolute', right: 14, bottom: 14, fontSize: 14, color: colors.primary }}
                />
              </Box>
            ))}
          </Box>
          <Box
            onClick={() => !refsLoading && pickKind('recurring')}
            sx={{
              p: 2,
              borderRadius: '14px',
              border: '1px solid #EEF1F6',
              bgcolor: '#F8FAFF',
              cursor: refsLoading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              '&:hover': { borderColor: '#C9D7FF' },
            }}
          >
            <Box sx={{ color: colors.primary }}>
              <EventRepeatOutlined sx={{ fontSize: 26 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: '#1B2438' }}>
                Регулярная тренировка группы
              </Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#8B93A7' }}>
                Создать серию занятий по выбранным дням недели
              </Typography>
            </Box>
            <ArrowForwardIos sx={{ fontSize: 14, color: colors.primary }} />
          </Box>
        </Box>
        <Box sx={{ px: 2.75, py: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            onClick={() => closeFlow()}
            sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary }}
          >
            Отмена
          </Button>
        </Box>
      </Dialog>

      {/* Групповая разовая */}
      <Dialog
        open={open && step === 'group'}
        onClose={(_e, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') unsaved.requestClose(reason);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: dialogPaper }}
      >
        <Box sx={{ px: 2.75, pt: 2.25, pb: 1, position: 'relative' }}>
          <IconButton
            onClick={() => (!saving ? discardForm() : undefined)}
            sx={{ position: 'absolute', top: 12, right: 12, color: '#8B93A7' }}
          >
            <Close />
          </IconButton>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', pr: 4 }}>
            Создать тренировку группы
          </Typography>
        </Box>
        <Box sx={{ px: 2.75, pb: 1, maxHeight: '70vh', overflow: 'auto' }}>
          {localError && (
            <Typography sx={{ color: '#DC2626', fontWeight: 650, fontSize: 13, mb: 1.5 }}>
              {localError}
            </Typography>
          )}
          <SectionHead icon={<GroupsOutlined sx={{ fontSize: 18 }} />} title="Основная информация" />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.25,
              mb: 1.25,
            }}
          >
            <IconSelect
              label="Группа"
              required
              value={form.groupId}
              onChange={onGroupChange}
              placeholder="Выберите группу"
              options={groupOptions}
            />
            <IconSelect
              label="Филиал"
              required
              value={form.branchId}
              onChange={(v) => set('branchId', v)}
              placeholder="Выберите филиал"
              options={branchOptions}
            />
          </Box>
          {dateTimeRow}
          {trainerSection}
          {additionalFields(TRAINING_TYPES_GROUP)}
        </Box>
        {footer('Создать тренировку', () => void submitOneOff('group'))}
      </Dialog>

      {/* Индивидуальная */}
      <Dialog
        open={open && step === 'individual'}
        onClose={(_e, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') unsaved.requestClose(reason);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: dialogPaper }}
      >
        <Box sx={{ px: 2.75, pt: 2.25, pb: 1, position: 'relative' }}>
          <IconButton
            onClick={() => (!saving ? discardForm() : undefined)}
            sx={{ position: 'absolute', top: 12, right: 12, color: '#8B93A7' }}
          >
            <Close />
          </IconButton>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', pr: 4 }}>
            Создать индивидуальную тренировку
          </Typography>
        </Box>
        <Box sx={{ px: 2.75, pb: 1, maxHeight: '70vh', overflow: 'auto' }}>
          {localError && (
            <Typography sx={{ color: '#DC2626', fontWeight: 650, fontSize: 13, mb: 1.5 }}>
              {localError}
            </Typography>
          )}
          <SectionHead icon={<PersonOutline sx={{ fontSize: 18 }} />} title="Основная информация" />
          <Box sx={{ mb: 1.25 }}>
            <FieldLabel required>Клиент</FieldLabel>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <FormControl fullWidth size="small" sx={{ flex: 1 }}>
                <Select
                  value={form.clientId}
                  displayEmpty
                  onChange={(e) => set('clientId', e.target.value)}
                  sx={{ borderRadius: '10px', fontWeight: 650 }}
                  renderValue={(v) => {
                    if (!v) return <span style={{ color: '#8B93A7' }}>Выберите клиента</span>;
                    return clientOptions.find((o) => o.value === v)?.label || v;
                  }}
                >
                  {clientOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                startIcon={<PersonAddAlt1 />}
                onClick={() => setCreateClientOpen(true)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 750,
                  color: colors.primary,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Создать клиента
              </Button>
            </Stack>
          </Box>
          <Box sx={{ mb: 1.25 }}>
            <IconSelect
              label="Филиал"
              required
              value={form.branchId}
              onChange={(v) => set('branchId', v)}
              placeholder="Выберите филиал"
              options={branchOptions}
            />
          </Box>
          {dateTimeRow}
          {trainerSection}
          {additionalFields(TRAINING_TYPES_INDIVIDUAL)}
        </Box>
        {footer('Создать тренировку', () => void submitOneOff('individual'))}
      </Dialog>

      {/* Регулярная серия */}
      <Dialog
        open={open && step === 'recurring'}
        onClose={(_e, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') unsaved.requestClose(reason);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: dialogPaper }}
      >
        <Box sx={{ px: 2.75, pt: 2.25, pb: 1, position: 'relative' }}>
          <IconButton
            onClick={() => (!saving ? discardForm() : undefined)}
            sx={{ position: 'absolute', top: 12, right: 12, color: '#8B93A7' }}
          >
            <Close />
          </IconButton>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#1B2438', pr: 4 }}>
            Создать регулярную тренировку группы
          </Typography>
        </Box>
        <Box sx={{ px: 2.75, pb: 1, maxHeight: '70vh', overflow: 'auto' }}>
          {localError && (
            <Typography sx={{ color: '#DC2626', fontWeight: 650, fontSize: 13, mb: 1.5 }}>
              {localError}
            </Typography>
          )}
          <SectionHead icon={<GroupsOutlined sx={{ fontSize: 18 }} />} title="Основная информация" />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.25,
              mb: 2,
            }}
          >
            <IconSelect
              label="Группа"
              required
              value={form.groupId}
              onChange={onGroupChange}
              placeholder="Выберите группу"
              options={groupOptions}
            />
            <IconSelect
              label="Филиал"
              required
              value={form.branchId}
              onChange={(v) => set('branchId', v)}
              placeholder="Выберите филиал"
              options={branchOptions}
            />
          </Box>

          <SectionHead icon={<CalendarMonthOutlined sx={{ fontSize: 18 }} />} title="Расписание" />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.25,
              mb: 1.25,
            }}
          >
            <Box>
              <FieldLabel required>Дата начала</FieldLabel>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                <DatePicker
                  value={form.recurrenceStart}
                  onChange={(d) => set('recurrenceStart', d)}
                  format="dd.MM.yyyy"
                  slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
                />
              </LocalizationProvider>
            </Box>
            <Box>
              <FieldLabel required>Дата окончания</FieldLabel>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                <DatePicker
                  value={form.recurrenceEnd}
                  onChange={(d) => set('recurrenceEnd', d)}
                  format="dd.MM.yyyy"
                  slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
                />
              </LocalizationProvider>
            </Box>
          </Box>

          <Box sx={{ mb: 1.5 }}>
            <FieldLabel required>Дни недели</FieldLabel>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {WEEK_DAYS.map((d) => {
                const on = form.daysOfWeek.includes(d.value);
                return (
                  <Box
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontWeight: 750,
                      fontSize: 13,
                      bgcolor: on ? colors.primary : '#F0F3F9',
                      color: on ? '#fff' : '#5A6478',
                      border: on ? 'none' : '1px solid #E5E9F2',
                      userSelect: 'none',
                    }}
                  >
                    {d.label}
                  </Box>
                );
              })}
            </Stack>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.25,
              mb: 2,
            }}
          >
            <Box>
              <FieldLabel required>Время начала</FieldLabel>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
                <TimePicker
                  value={form.startTime}
                  onChange={(d) => set('startTime', d)}
                  ampm={false}
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
                  slotProps={{ textField: { size: 'small', fullWidth: true, sx: fieldSx } }}
                />
              </LocalizationProvider>
            </Box>
          </Box>

          {trainerSection}
          {additionalFields(TRAINING_TYPES_GROUP)}
        </Box>
        {footer('Создать серию тренировок', () => void submitRecurring())}
      </Dialog>

      <CreateClientDialog
        open={createClientOpen}
        onClose={() => setCreateClientOpen(false)}
        onSuccess={(client) => {
          setCreateClientOpen(false);
          if (client?.id) {
            setClients((prev) => {
              if (prev.some((c) => c.id === client.id)) return prev;
              return [client, ...prev];
            });
            set('clientId', client.id);
          } else {
            void apiService.getClients({ limit: 1000 }).then((res) => setClients(res.data || []));
          }
        }}
      />

      <UnsavedChangesDialog
        open={unsaved.confirmOpen}
        saving={unsaved.saving}
        onSave={unsaved.save}
        onDiscard={unsaved.discard}
        onStay={unsaved.stay}
      />
    </>
  );
};

export default CreateTrainingFlowDialogs;
