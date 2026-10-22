import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  Check,
  Close,
  GroupsOutlined,
  InfoOutlined,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  addMonths,
  addWeeks,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  format,
  isValid,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/tokens';

export type CycleFrequency = 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export type CycleGroupOpt = {
  id: string;
  name: string;
  ageMin?: number | null;
  ageMax?: number | null;
  branch?: { id?: string; name: string } | null;
  color?: string | null;
};

type Preview = {
  total: number;
  byWeek?: Record<string, number>;
  byMonth?: Record<string, number>;
};

type Props = {
  open: boolean;
  groups: CycleGroupOpt[];
  onClose: () => void;
  onCreated: (cycleId: string) => void;
  onError?: (message: string) => void;
};

const DESC_MAX = 500;

const STEP_SUBTITLES = [
  'Укажите основную информацию о цикле тренировок.',
  'Выберите период действия цикла.',
  'Проверьте параметры цикла перед созданием.',
];

function groupLabel(g: CycleGroupOpt): string {
  const age =
    g.ageMin != null || g.ageMax != null
      ? `${g.ageMin ?? '?'}-${g.ageMax ?? '?'} лет`
      : null;
  const parts = [g.name, age, g.branch?.name].filter(Boolean);
  if (parts.length <= 1) return g.name;
  return `${g.name} (${parts.slice(1).join(', ')})`;
}

function toIsoDate(d: Date | null): string {
  if (!d || !isValid(d)) return '';
  return format(d, 'yyyy-MM-dd');
}

function calcEnd(from: Date, frequency: CycleFrequency, quantity: number): Date {
  if (frequency === 'MONTHLY') return addMonths(from, Math.max(1, quantity));
  if (frequency === 'WEEKLY') return addWeeks(from, Math.max(1, quantity));
  return from;
}

function calcQuantity(from: Date, to: Date, frequency: CycleFrequency): number {
  if (frequency === 'MONTHLY') {
    return Math.max(1, differenceInCalendarMonths(to, from) || 1);
  }
  if (frequency === 'WEEKLY') {
    return Math.max(1, differenceInCalendarWeeks(to, from) || 1);
  }
  return 1;
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#fff',
    fontWeight: 600,
  },
  '& .MuiInputLabel-root': { fontWeight: 700 },
};

const CreateCycleWizardDialog: React.FC<Props> = ({
  open,
  groups,
  onClose,
  onCreated,
  onError,
}) => {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<CycleGroupOpt[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | null>(new Date());
  const [dateTo, setDateTo] = useState<Date | null>(() => addWeeks(new Date(), 12));
  const [frequency, setFrequency] = useState<CycleFrequency>('WEEKLY');
  const [quantity, setQuantity] = useState(12);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  /** Skip qty→dateTo sync when dateTo was edited manually. */
  const skipQtySyncRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTitle('');
    setDescription('');
    setSelectedGroups([]);
    const from = new Date();
    setDateFrom(from);
    setDateTo(addWeeks(from, 12));
    setFrequency('WEEKLY');
    setQuantity(12);
    setPreview(null);
    setLoadingPreview(false);
    setCreating(false);
    skipQtySyncRef.current = false;
  }, [open]);

  // quantity / dateFrom / frequency → dateTo
  useEffect(() => {
    if (!open || frequency === 'CUSTOM' || !dateFrom || !isValid(dateFrom)) return;
    if (skipQtySyncRef.current) {
      skipQtySyncRef.current = false;
      return;
    }
    setDateTo(calcEnd(dateFrom, frequency, quantity));
  }, [open, frequency, quantity, dateFrom]);

  const stepOk1 = title.trim().length > 0 && selectedGroups.length > 0;
  const stepOk2 =
    Boolean(dateFrom && isValid(dateFrom) && dateTo && isValid(dateTo)) &&
    (dateTo as Date) >= (dateFrom as Date) &&
    (frequency === 'CUSTOM' || quantity >= 1);

  const unitLabel = frequency === 'MONTHLY' ? 'месяцев' : 'недель';
  const blockLabel =
    frequency === 'MONTHLY' ? 'месячных' : frequency === 'WEEKLY' ? 'недельных' : '';

  const infoText = useMemo(() => {
    if (frequency === 'CUSTOM') {
      return 'Цикл будет создан на выбранный произвольный период. Планы тренировок настраиваются по занятиям из расписания.';
    }
    return `Будет создано ${quantity} ${blockLabel} блоков с возможностью настройки планов тренировок для каждой ${
      frequency === 'MONTHLY' ? 'месяца' : 'недели'
    }.`;
  }, [frequency, quantity, blockLabel]);

  const handleDateToChange = (value: Date | null) => {
    setDateTo(value);
    if (frequency === 'CUSTOM' || !dateFrom || !value || !isValid(value)) return;
    skipQtySyncRef.current = true;
    setQuantity(calcQuantity(dateFrom, value, frequency));
  };

  const goNextFrom1 = () => {
    if (!stepOk1) return;
    setStep(1);
  };

  const goNextFrom2 = async () => {
    if (!stepOk2 || !dateFrom || !dateTo) return;
    try {
      setLoadingPreview(true);
      const data = await apiService.previewTrainingCycleDraft({
        dateFrom: toIsoDate(dateFrom),
        dateTo: toIsoDate(dateTo),
        groupIds: selectedGroups.map((g) => g.id),
      });
      setPreview(data);
      setStep(2);
    } catch (e: any) {
      onError?.(e?.response?.data?.error || 'Не удалось посчитать статистику');
    } finally {
      setLoadingPreview(false);
    }
  };

  const create = async () => {
    if (!dateFrom || !dateTo || !title.trim()) return;
    try {
      setCreating(true);
      const created = await apiService.createTrainingCycle({
        title: title.trim(),
        description: description.trim() || null,
        frequency,
        quantity: frequency === 'CUSTOM' ? null : quantity,
        dateFrom: toIsoDate(dateFrom),
        dateTo: toIsoDate(dateTo),
        groupIds: selectedGroups.map((g) => g.id),
      });
      onCreated(created.id);
    } catch (e: any) {
      onError?.(e?.response?.data?.error || 'Не удалось создать цикл');
    } finally {
      setCreating(false);
    }
  };

  const periodLabel =
    dateFrom && dateTo && isValid(dateFrom) && isValid(dateTo)
      ? `${format(dateFrom, 'dd.MM.yyyy')} — ${format(dateTo, 'dd.MM.yyyy')}`
      : '—';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: `${radii.panel}px` },
          bgcolor: '#fff',
          boxShadow: '0 16px 48px rgba(27, 36, 56, 0.18)',
        },
      }}
    >
      <Box sx={{ px: 3, pt: 2.5, pb: 1, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: colors.primary,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {step + 1}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#1B2438', lineHeight: 1.3 }}>
            Новый цикл · шаг {step + 1} из 3
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#8B93A7', fontWeight: 600, mt: 0.35 }}>
            {STEP_SUBTITLES[step]}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#8B93A7' }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pt: 1.5, pb: 1 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
          {step === 0 && (
            <Stack spacing={2}>
              <TextField
                required
                label="Название цикла"
                placeholder="Например: Подготовка к соревнованиям"
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={fieldSx}
              />
              <Box>
                <TextField
                  label="Описание"
                  placeholder="Цели, задачи и особенности цикла..."
                  fullWidth
                  multiline
                  minRows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  sx={fieldSx}
                />
                <Typography
                  sx={{
                    mt: 0.5,
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#8B93A7',
                  }}
                >
                  {description.length} / {DESC_MAX}
                </Typography>
              </Box>
              <Autocomplete
                multiple
                options={groups}
                getOptionLabel={(g) => groupLabel(g)}
                value={selectedGroups}
                onChange={(_, v) => setSelectedGroups(v)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      size="small"
                      label={groupLabel(option)}
                      sx={{ fontWeight: 700 }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label="Группы"
                    placeholder={
                      selectedGroups.length === 0 ? 'Выберите одну или несколько групп' : undefined
                    }
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start" sx={{ ml: 0.5 }}>
                            <GroupsOutlined sx={{ fontSize: 20, color: colors.primary }} />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                    sx={fieldSx}
                  />
                )}
              />
            </Stack>
          )}

          {step === 1 && (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <DatePicker
                  label="Дата начала *"
                  value={dateFrom}
                  onChange={(v) => setDateFrom(v)}
                  format="dd.MM.yyyy"
                  slotProps={{
                    textField: { fullWidth: true, sx: fieldSx },
                  }}
                />
                <DatePicker
                  label="Дата окончания *"
                  value={dateTo}
                  onChange={handleDateToChange}
                  format="dd.MM.yyyy"
                  minDate={dateFrom || undefined}
                  slotProps={{
                    textField: { fullWidth: true, sx: fieldSx },
                  }}
                />
              </Stack>

              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B2438', mb: 1 }}>
                  Периодичность
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={frequency}
                  onChange={(_, v) => {
                    if (!v) return;
                    setFrequency(v);
                    if (v !== 'CUSTOM' && quantity < 1) setQuantity(1);
                  }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                    gap: 1,
                    '& .MuiToggleButtonGroup-grouped': {
                      border: '1px solid #D9D9D9 !important',
                      borderRadius: '10px !important',
                      m: 0,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#8B93A7',
                      py: 1,
                      '&.Mui-selected': {
                        bgcolor: '#EEF4FF',
                        color: colors.primary,
                        borderColor: `${colors.primary} !important`,
                      },
                    },
                  }}
                >
                  <ToggleButton value="WEEKLY">По неделям</ToggleButton>
                  <ToggleButton value="MONTHLY">По месяцам</ToggleButton>
                  <ToggleButton value="CUSTOM">Произвольный период</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {frequency !== 'CUSTOM' && (
                <TextField
                  label="Количество"
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setQuantity(Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
                  }}
                  inputProps={{ min: 1 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography sx={{ fontWeight: 700, color: '#8B93A7', fontSize: 13 }}>
                          {unitLabel}
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...fieldSx, maxWidth: 220 }}
                />
              )}

              <Alert
                severity="info"
                icon={<InfoOutlined />}
                sx={{
                  borderRadius: '12px',
                  bgcolor: '#EEF4FF',
                  color: '#1B2438',
                  border: '1px solid #C9D7FF',
                  '& .MuiAlert-icon': { color: colors.primary },
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {infoText}
              </Alert>
            </Stack>
          )}

          {step === 2 && preview && (
            <Box
              sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: '#F7F8FB',
                border: '1px solid #EEF1F6',
              }}
            >
              <Stack spacing={1.5}>
                <SummaryRow label="Название цикла" value={title.trim()} />
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7', mb: 0.75 }}>
                    Группы
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {selectedGroups.map((g) => (
                      <Chip
                        key={g.id}
                        size="small"
                        label={groupLabel(g)}
                        sx={{
                          fontWeight: 700,
                          bgcolor: '#EEF4FF',
                          color: colors.primary,
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
                <SummaryRow label="Период" value={periodLabel} />
                <SummaryRow label="Найдено тренировок" value={String(preview.total)} />
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7', mb: 0.5 }}>
                    Структура цикла
                  </Typography>
                  {Object.keys(preview.byWeek || {}).length > 0 && (
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1B2438', mb: 0.5 }}>
                      По неделям:{' '}
                      {Object.entries(preview.byWeek || {})
                        .slice(0, 8)
                        .map(([k, v]) => `${k} (${v})`)
                        .join('; ')}
                      {Object.keys(preview.byWeek || {}).length > 8 ? '…' : ''}
                    </Typography>
                  )}
                  {Object.keys(preview.byMonth || {}).length > 0 && (
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#1B2438' }}>
                      По месяцам:{' '}
                      {Object.entries(preview.byMonth || {})
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('; ')}
                    </Typography>
                  )}
                  {preview.total === 0 && (
                    <Alert severity="warning" sx={{ mt: 1.5, borderRadius: '10px' }}>
                      В выбранном диапазоне нет тренировок выбранных групп. Цикл всё равно можно
                      создать.
                    </Alert>
                  )}
                </Box>
              </Stack>
            </Box>
          )}
        </LocalizationProvider>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          pt: 1.5,
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none', fontWeight: 700, color: '#8B93A7' }}
        >
          Отмена
        </Button>
        <Stack direction="row" spacing={1}>
          {step > 0 && (
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => setStep((s) => s - 1)}
              disabled={loadingPreview || creating}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                borderColor: '#C9D7FF',
                color: colors.primary,
              }}
            >
              Назад
            </Button>
          )}
          {step === 0 && (
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              disabled={!stepOk1}
              onClick={goNextFrom1}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                bgcolor: colors.primary,
                boxShadow: 'none',
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
            >
              Далее
            </Button>
          )}
          {step === 1 && (
            <Button
              variant="contained"
              endIcon={
                loadingPreview ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ArrowForward />
                )
              }
              disabled={!stepOk2 || loadingPreview}
              onClick={goNextFrom2}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                bgcolor: colors.primary,
                boxShadow: 'none',
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
            >
              Далее
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="contained"
              startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <Check />}
              disabled={creating || !preview}
              onClick={create}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                bgcolor: colors.primary,
                boxShadow: 'none',
                '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
              }}
            >
              Создать цикл
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7' }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1B2438', mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default CreateCycleWizardDialog;
