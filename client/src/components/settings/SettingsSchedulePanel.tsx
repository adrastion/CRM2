import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessTime,
  CalendarMonthOutlined,
  ExpandMore,
  InfoOutlined,
  PaymentsOutlined,
  Save,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { colors, radii } from '../../theme/tokens';
import {
  DEFAULT_SCHEDULE_CONFIG,
  EVENT_COLOR_LABELS,
  ScheduleConfig,
  ScheduleEventColorKey,
  TIMEZONE_OPTIONS,
  WEEKDAY_LABELS,
  formatNowInTimezone,
  mergeScheduleConfig,
  scheduleConfigWithoutTemplates,
} from './scheduleConfig';

const cardSx = {
  p: { xs: 2, sm: 2.25 },
  borderRadius: '12px',
  border: `1px solid ${colors.divider}`,
  boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
  bgcolor: colors.card,
};

const nestedPanelSx = {
  p: 1.75,
  borderRadius: '12px',
  border: `1px solid ${colors.divider}`,
  bgcolor: '#FAFBFD',
};

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

type Props = {
  defaultTrainingDuration: number;
  salaryPayoutDay: number;
  staffTaskColor: string;
  scheduleConfigRaw: unknown;
  canEditFinance: boolean;
  canEditSchedule: boolean;
  saving: boolean;
  onSave: (payload: {
    defaultTrainingDuration: number;
    salaryPayoutDay?: number;
    staffTaskColor?: string;
    scheduleConfig: ScheduleConfig;
  }) => Promise<void> | void;
};

const SettingsSchedulePanel: React.FC<Props> = ({
  defaultTrainingDuration: durationProp,
  salaryPayoutDay: paydayProp,
  staffTaskColor: taskColorProp,
  scheduleConfigRaw,
  canEditFinance,
  canEditSchedule,
  saving,
  onSave,
}) => {
  const [duration, setDuration] = useState(durationProp || 90);
  const [payday, setPayday] = useState(paydayProp || 25);
  const [cfg, setCfg] = useState<ScheduleConfig>(() =>
    mergeScheduleConfig(scheduleConfigRaw, taskColorProp)
  );
  const [templateId, setTemplateId] = useState('base');
  const [notice, setNotice] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    setDuration(durationProp || 90);
    setPayday(paydayProp || 25);
    const merged = mergeScheduleConfig(scheduleConfigRaw, taskColorProp);
    setCfg(merged);
    if (merged.templates[0]) setTemplateId(merged.templates[0].id);
  }, [durationProp, paydayProp, scheduleConfigRaw, taskColorProp]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const currentTimeLabel = useMemo(() => {
    void nowTick;
    return formatNowInTimezone(cfg.timezone);
  }, [cfg.timezone, nowTick]);

  const patch = (partial: Partial<ScheduleConfig>) => setCfg((c) => ({ ...c, ...partial }));

  const toggleWeekday = (day: number) => {
    setCfg((c) => {
      const has = c.trainingWeekdays.includes(day);
      const next = has
        ? c.trainingWeekdays.filter((d) => d !== day)
        : [...c.trainingWeekdays, day].sort((a, b) => a - b);
      return { ...c, trainingWeekdays: next };
    });
  };

  const setEventColor = (key: ScheduleEventColorKey, color: string) => {
    setCfg((c) => ({
      ...c,
      eventColors: { ...c.eventColors, [key]: color.toUpperCase() },
    }));
  };

  const applyTemplate = () => {
    const tpl = cfg.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setCfg((c) => ({
      ...c,
      ...structuredClone(tpl.config),
      templates: c.templates,
    }));
    if (typeof (tpl.config as any).defaultTrainingDuration === 'number') {
      /* duration is separate field */
    }
    setNotice('Шаблон применён — сохраните настройки');
  };

  const saveAsTemplate = () => {
    const name = window.prompt('Название шаблона', `Шаблон ${cfg.templates.length + 1}`);
    if (!name || !name.trim()) return;
    const id = `tpl_${Date.now()}`;
    const snapshot = scheduleConfigWithoutTemplates(cfg);
    setCfg((c) => ({
      ...c,
      templates: [...c.templates, { id, name: name.trim(), config: structuredClone(snapshot) }],
    }));
    setTemplateId(id);
    setNotice('Шаблон добавлен — сохраните настройки');
  };

  const handleSave = async () => {
    setNotice(null);
    await onSave({
      defaultTrainingDuration: duration,
      ...(canEditFinance
        ? {
            salaryPayoutDay: payday,
            staffTaskColor: cfg.eventColors.task,
          }
        : {}),
      scheduleConfig: cfg,
    });
  };

  const disabled = !canEditSchedule;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {notice && (
        <Alert severity="info" onClose={() => setNotice(null)} sx={{ borderRadius: '12px' }}>
          {notice}
        </Alert>
      )}

      <Grid container spacing={2} alignItems="flex-start">
        {/* Left ~2/3 */}
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            {/* 1. Schedule settings — 2 nested panels */}
            <Box sx={cardSx}>
              <SectionHeader
                icon={<CalendarMonthOutlined sx={{ fontSize: 20 }} />}
                title="Настройки расписания"
                subtitle="Основные параметры для работы с календарём и тренировками"
              />
              <Grid container spacing={1.75}>
                <Grid item xs={12} md={7}>
                  <Box sx={nestedPanelSx}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.text, mb: 0.6 }}>
                      Длительность тренировки по умолчанию
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: colors.textHint, mb: 1.25, lineHeight: 1.45 }}>
                      При создании тренировки все новые занятия будут автоматически устанавливаться на
                      указанное время. Можно будет изменить при необходимости.
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={duration}
                        disabled={disabled}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v)) setDuration(Math.min(480, Math.max(15, v)));
                        }}
                        inputProps={{ min: 15, max: 480, step: 15 }}
                        sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                      />
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select value="min" disabled sx={{ borderRadius: '10px', fontWeight: 600 }}>
                          <MenuItem value="min">минут</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                    <Typography sx={{ fontSize: 12, color: colors.textFaint, mb: 2 }}>
                      Минимум 15 минут, максимум 480 минут (8 часов)
                    </Typography>

                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.text, mb: 0.75 }}>
                      Время начала занятий по умолчанию
                    </Typography>
                    <TextField
                      size="small"
                      type="time"
                      value={cfg.defaultStartTime}
                      disabled={disabled}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) patch({ defaultStartTime: v });
                      }}
                      inputProps={{ step: 1800 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <AccessTime sx={{ fontSize: 18, color: colors.textHint }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        width: 160,
                        '& .MuiOutlinedInput-root': { borderRadius: '10px', fontWeight: 600 },
                        '& input::-webkit-calendar-picker-indicator': { opacity: 0, width: 0 },
                      }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Box sx={{ ...nestedPanelSx, height: '100%' }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: colors.text, mb: 1 }}>
                      Дни недели для тренировок
                    </Typography>
                    <Stack spacing={0.1}>
                      {WEEKDAY_LABELS.map(({ day, label }) => (
                        <FormControlLabel
                          key={day}
                          disabled={disabled}
                          sx={{ ml: 0, mr: 0 }}
                          control={
                            <Checkbox
                              size="small"
                              checked={cfg.trainingWeekdays.includes(day)}
                              onChange={() => toggleWeekday(day)}
                              sx={{
                                color: colors.primary,
                                py: 0.35,
                                '&.Mui-checked': { color: colors.primary },
                              }}
                            />
                          }
                          label={
                            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: colors.text }}>
                              {label}
                            </Typography>
                          }
                        />
                      ))}
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* 2. Salary day */}
            {canEditFinance && (
              <Box sx={cardSx}>
                <SectionHeader
                  icon={<PaymentsOutlined sx={{ fontSize: 20 }} />}
                  title="День выплаты зарплаты"
                  subtitle="День месяца (1–28), когда автоматически формируются выплаты тренерам"
                />
                <Grid container spacing={2} alignItems="stretch">
                  <Grid item xs={12} sm={5}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, mb: 0.5 }}>
                      День месяца
                    </Typography>
                    <FormControl fullWidth size="small">
                      <Select
                        value={payday}
                        disabled={disabled}
                        onChange={(e) => setPayday(Number(e.target.value))}
                        sx={{ borderRadius: '10px', fontWeight: 700 }}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <MenuItem key={d} value={d}>
                            {d}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={7}>
                    <Box
                      sx={{
                        height: '100%',
                        p: 1.5,
                        borderRadius: '10px',
                        bgcolor: '#EEF3FF',
                        border: '1px solid #D6E2FF',
                        display: 'flex',
                        gap: 1,
                      }}
                    >
                      <InfoOutlined sx={{ color: colors.primary, fontSize: 20, mt: 0.15 }} />
                      <Typography sx={{ fontSize: 12.5, color: '#3A4A6B', lineHeight: 1.45 }}>
                        Напоминание о предстоящих выплатах будет отправлено за 3 дня. Расчёт формируется
                        по проведённым тренировкам за период.
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* 3. Work hours — times left, toggles right */}
            <Box sx={cardSx}>
              <SectionHeader
                icon={<AccessTime sx={{ fontSize: 20 }} />}
                title="Рабочие часы и доступность"
                subtitle="Настройте рабочее время вашей организации"
              />
              <Grid container spacing={2.5} alignItems="flex-start">
                <Grid item xs={12} md={6}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>
                    Время работы (будни)
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <TimeSelect
                      value={cfg.workHours.weekdays[0]}
                      disabled={disabled}
                      onChange={(v) =>
                        patch({
                          workHours: { ...cfg.workHours, weekdays: [v, cfg.workHours.weekdays[1]] },
                        })
                      }
                    />
                    <Typography sx={{ color: colors.textHint }}>—</Typography>
                    <TimeSelect
                      value={cfg.workHours.weekdays[1]}
                      disabled={disabled}
                      onChange={(v) =>
                        patch({
                          workHours: { ...cfg.workHours, weekdays: [cfg.workHours.weekdays[0], v] },
                        })
                      }
                    />
                  </Stack>

                  <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>
                    Время работы (выходные)
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TimeSelect
                      value={cfg.workHours.weekends[0]}
                      disabled={disabled}
                      onChange={(v) =>
                        patch({
                          workHours: { ...cfg.workHours, weekends: [v, cfg.workHours.weekends[1]] },
                        })
                      }
                    />
                    <Typography sx={{ color: colors.textHint }}>—</Typography>
                    <TimeSelect
                      value={cfg.workHours.weekends[1]}
                      disabled={disabled}
                      onChange={(v) =>
                        patch({
                          workHours: { ...cfg.workHours, weekends: [cfg.workHours.weekends[0], v] },
                        })
                      }
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <ToggleRow
                    label="Показывать выходные в календаре"
                    hint="Отображать субботу и воскресенье в календарном плане"
                    checked={cfg.showWeekends}
                    disabled={disabled}
                    onChange={(v) => patch({ showWeekends: v })}
                  />
                  <ToggleRow
                    label="Автоматически переносить занятия при праздниках"
                    hint="Система предложит переносить занятия, если день является праздничным"
                    checked={cfg.autoRescheduleHolidays}
                    disabled={disabled}
                    onChange={(v) => patch({ autoRescheduleHolidays: v })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* 4. Event colors */}
            <Box sx={cardSx}>
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: colors.text, mb: 1.5 }}>
                Цвета событий в календаре
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                {EVENT_COLOR_LABELS.map(({ key, label }) => (
                  <Box
                    key={key}
                    component="label"
                    sx={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: '999px',
                      bgcolor: `${cfg.eventColors[key]}18`,
                      border: `1px solid ${cfg.eventColors[key]}55`,
                      cursor: disabled || (key === 'task' && !canEditFinance) ? 'default' : 'pointer',
                      opacity: disabled || (key === 'task' && !canEditFinance) ? 0.7 : 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: cfg.eventColors[key],
                        flexShrink: 0,
                      }}
                    />
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
                      {label}
                    </Typography>
                    <ExpandMore sx={{ fontSize: 16, color: colors.textHint }} />
                    <Box
                      component="input"
                      type="color"
                      disabled={disabled || (key === 'task' && !canEditFinance)}
                      value={cfg.eventColors[key]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEventColor(key, e.target.value)
                      }
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        border: 0,
                        width: '100%',
                        height: '100%',
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </Stack>
        </Grid>

        {/* Right ~1/3 */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Box sx={cardSx}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1.25 }}>Шаблоны параметров</Typography>
              <FormControl fullWidth size="small" sx={{ mb: 1.25 }}>
                <Select
                  value={templateId}
                  disabled={disabled}
                  onChange={(e) => setTemplateId(e.target.value)}
                  sx={{ borderRadius: '10px', fontWeight: 600 }}
                >
                  {cfg.templates.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                fullWidth
                variant="contained"
                disabled={disabled}
                onClick={applyTemplate}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  bgcolor: colors.primary,
                  boxShadow: 'none',
                  mb: 1,
                  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                }}
              >
                Применить шаблон
              </Button>
              <Button
                fullWidth
                variant="outlined"
                disabled={disabled}
                onClick={saveAsTemplate}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  borderColor: '#C9D7FF',
                  color: colors.primary,
                }}
              >
                Сохранить как шаблон
              </Button>
            </Box>

            <Box sx={cardSx}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1.25 }}>Часовой пояс</Typography>
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <Select
                  value={
                    TIMEZONE_OPTIONS.some((o) => o.value === cfg.timezone)
                      ? cfg.timezone
                      : 'Europe/Moscow'
                  }
                  disabled={disabled}
                  onChange={(e) => patch({ timezone: e.target.value })}
                  sx={{ borderRadius: '10px', fontWeight: 600 }}
                >
                  {TIMEZONE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography sx={{ fontSize: 12, color: colors.textHint }}>
                Текущее время: {currentTimeLabel}
              </Typography>
            </Box>

            <Box sx={cardSx}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1.25 }}>Региональные настройки</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl fullWidth size="small">
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: colors.textHint, mb: 0.5 }}>
                    Формат даты
                  </Typography>
                  <Select
                    value={cfg.dateFormat}
                    disabled={disabled}
                    onChange={(e) =>
                      patch({ dateFormat: e.target.value as ScheduleConfig['dateFormat'] })
                    }
                    sx={{ borderRadius: '10px', fontWeight: 600 }}
                  >
                    <MenuItem value="DD.MM.YYYY">ДД.ММ.ГГГГ</MenuItem>
                    <MenuItem value="MM/DD/YYYY">ММ/ДД/ГГГГ</MenuItem>
                    <MenuItem value="YYYY-MM-DD">ГГГГ-ММ-ДД</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: colors.textHint, mb: 0.5 }}>
                    Формат времени
                  </Typography>
                  <Select
                    value={cfg.timeFormat}
                    disabled={disabled}
                    onChange={(e) =>
                      patch({ timeFormat: e.target.value as ScheduleConfig['timeFormat'] })
                    }
                    sx={{ borderRadius: '10px', fontWeight: 600 }}
                  >
                    <MenuItem value="24h">24 часа</MenuItem>
                    <MenuItem value="12h">12 часов</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Box sx={cardSx}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1 }}>Дополнительно</Typography>
              <ExtraRow
                label="Показывать номер занятия"
                checked={cfg.showLessonNumber}
                disabled={disabled}
                onChange={(v) => patch({ showLessonNumber: v })}
              />
              <ExtraRow
                label="Ограничивать запись при переполнении"
                checked={cfg.limitWhenFull}
                disabled={disabled}
                onChange={(v) => patch({ limitWhenFull: v })}
              />
              <ExtraRow
                label="Учитывать праздничные дни"
                checked={cfg.considerHolidays}
                disabled={disabled}
                onChange={(v) => patch({ considerHolidays: v })}
              />
              <Button
                onClick={() => setNotice('Настройка праздничных дней появится в следующем обновлении')}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: colors.primary,
                  px: 0,
                  justifyContent: 'flex-start',
                }}
              >
                Настроить праздничные дни →
              </Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      {canEditSchedule && (
        <Box>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => void handleSave()}
            disabled={saving}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: `${radii.button}px`,
              bgcolor: colors.primary,
              boxShadow: 'none',
              px: 2.5,
              '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
            }}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 110 }}>
      <Select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        sx={{ borderRadius: '10px', fontWeight: 600 }}
      >
        {TIME_OPTIONS.filter((t) => t.endsWith(':00') || t.endsWith(':30')).map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', mb: 1.75 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          bgcolor: '#EEF3FF',
          color: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16, color: colors.text, lineHeight: 1.25 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: colors.textHint, mt: 0.25, lineHeight: 1.4 }}>
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        py: 1.1,
        borderBottom: `1px solid ${colors.divider}`,
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ minWidth: 0, pr: 1 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: colors.text, lineHeight: 1.3 }}>
          {label}
        </Typography>
        {hint && (
          <Typography sx={{ fontSize: 12, color: colors.textHint, mt: 0.35, lineHeight: 1.4 }}>
            {hint}
          </Typography>
        )}
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        color="primary"
        sx={{ mt: -0.25 }}
      />
    </Box>
  );
}

function ExtraRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.85,
        borderBottom: `1px solid ${colors.divider}`,
      }}
    >
      <Checkbox
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        sx={{ p: 0.5, color: colors.primary, '&.Mui-checked': { color: colors.primary } }}
      />
      <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{label}</Typography>
      <Switch
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        color="primary"
      />
    </Box>
  );
}

export default SettingsSchedulePanel;
export { DEFAULT_SCHEDULE_CONFIG };
