import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Paper,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { apiService, NotificationPrefs } from '../../services/api';
import {
  ActorPushChannel,
  browserNotificationPermission,
  checkActorPushStatus,
  subscribeActorPush,
  unsubscribeActorPush,
} from '../../utils/actorPush';
import { colors, radii } from '../../theme/tokens';

const panelPaperSx = {
  p: { xs: 2, sm: 2.5 },
  mb: 2,
  borderRadius: `${radii.panel}px`,
  border: `1px solid ${colors.divider}`,
  boxShadow: '0 2px 10px rgba(32, 34, 36, 0.05)',
};

const DAY_LABELS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
];

function minutesToTimeInput(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '09:00';
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

function parseDays(csv: string | null | undefined): number[] {
  if (!csv) return [1, 2, 3, 4, 5, 6, 7];
  const days = csv
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((d) => d >= 1 && d <= 7);
  return days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7];
}

export type NotificationPrefsActor = 'school' | 'portal' | 'superAdmin' | 'tester';

type Props = {
  actor: NotificationPrefsActor;
  /** Показывать расписание (OWNER/ADMIN/TRAINER) */
  showSchedule?: boolean;
  /** Показывать тумблер changelog (SA/Tester) */
  showChangelog?: boolean;
  /** Роль школьного пользователя — какие категории показывать */
  schoolRole?: 'OWNER' | 'ADMIN' | 'TRAINER' | string;
};

/**
 * Общая панель: браузерный push + типы уведомлений (+ расписание для школьного staff).
 */
const NotificationSettingsPanel: React.FC<Props> = ({
  actor,
  showSchedule = false,
  showChangelog = false,
  schoolRole,
}) => {
  const channel: ActorPushChannel =
    actor === 'school'
      ? 'school'
      : actor === 'portal'
        ? 'portal'
        : actor === 'tester'
          ? 'tester'
          : 'superAdmin';

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [everyDay, setEveryDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('21:00');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: NotificationPrefs;
      if (actor === 'school') data = await apiService.getSchoolNotificationPrefs();
      else if (actor === 'portal') data = await apiService.getPortalNotificationPrefs();
      else if (actor === 'tester') data = await apiService.getTesterNotificationPrefs();
      else data = await apiService.getSuperAdminNotificationPrefs();

      setPrefs(data);
      const days = parseDays(data.daysOfWeek);
      setSelectedDays(days);
      setEveryDay(!data.daysOfWeek || days.length === 7);
      setStartTime(minutesToTimeInput(data.windowStartMinutes ?? 9 * 60));
      setEndTime(minutesToTimeInput(data.windowEndMinutes ?? 21 * 60));
      setSubscribed(await checkActorPushStatus(channel));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить настройки уведомлений');
    } finally {
      setLoading(false);
    }
  }, [actor, channel]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchLocal = (patch: Partial<NotificationPrefs>) => {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Partial<NotificationPrefs> = {
        chatMessagesEnabled: prefs.chatMessagesEnabled,
        pushMasterEnabled: prefs.pushMasterEnabled,
        athleteCreatedEnabled: prefs.athleteCreatedEnabled,
        financeEnabled: prefs.financeEnabled,
        attendanceEnabled: prefs.attendanceEnabled,
        offersEnabled: prefs.offersEnabled,
        salaryEnabled: prefs.salaryEnabled,
        paymentsEnabled: prefs.paymentsEnabled,
        trainingRemindersEnabled: prefs.trainingRemindersEnabled,
        scheduleChangesEnabled: prefs.scheduleChangesEnabled,
        taskRemindersEnabled: prefs.taskRemindersEnabled,
      };
      if (showChangelog) {
        body.changelogEnabled = prefs.changelogEnabled;
      }
      if (showSchedule) {
        body.scheduleMode = prefs.scheduleMode;
        body.timezone = prefs.timezone || 'Europe/Moscow';
        if (prefs.scheduleMode === 'WINDOW') {
          body.windowStartMinutes = timeInputToMinutes(startTime);
          body.windowEndMinutes = timeInputToMinutes(endTime);
          body.daysOfWeek = everyDay || selectedDays.length === 7 ? null : selectedDays.join(',');
        } else {
          body.windowStartMinutes = null;
          body.windowEndMinutes = null;
          body.daysOfWeek = null;
        }
      }

      let data: NotificationPrefs;
      if (actor === 'school') data = await apiService.updateSchoolNotificationPrefs(body);
      else if (actor === 'portal') data = await apiService.updatePortalNotificationPrefs(body);
      else if (actor === 'tester') data = await apiService.updateTesterNotificationPrefs(body);
      else data = await apiService.updateSuperAdminNotificationPrefs(body);

      setPrefs(data);
      setSuccess('Настройки сохранены');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePush = async () => {
    setPushBusy(true);
    setError(null);
    try {
      if (subscribed) {
        const ok = await unsubscribeActorPush(channel);
        if (!ok) throw new Error('unsubscribe failed');
        setSubscribed(false);
        patchLocal({ pushMasterEnabled: false });
        try {
          const body = { pushMasterEnabled: false };
          if (actor === 'school') await apiService.updateSchoolNotificationPrefs(body);
          else if (actor === 'portal') await apiService.updatePortalNotificationPrefs(body);
          else if (actor === 'tester') await apiService.updateTesterNotificationPrefs(body);
          else await apiService.updateSuperAdminNotificationPrefs(body);
        } catch {
          /* ignore */
        }
      } else {
        const ok = await subscribeActorPush(channel);
        if (!ok) {
          setError(
            browserNotificationPermission() === 'denied'
              ? 'Уведомления запрещены в настройках браузера'
              : 'Не удалось включить уведомления'
          );
          return;
        }
        setSubscribed(true);
        patchLocal({ pushMasterEnabled: true });
        try {
          const body = { pushMasterEnabled: true };
          if (actor === 'school') await apiService.updateSchoolNotificationPrefs(body);
          else if (actor === 'portal') await apiService.updatePortalNotificationPrefs(body);
          else if (actor === 'tester') await apiService.updateTesterNotificationPrefs(body);
          else await apiService.updateSuperAdminNotificationPrefs(body);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  const permission = browserNotificationPermission();

  if (loading) {
    return <Typography color="text.secondary">Загрузка…</Typography>;
  }

  if (!prefs) {
    return <Alert severity="error">{error || 'Нет данных'}</Alert>;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper elevation={0} sx={panelPaperSx}>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Браузерные уведомления
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {permission === 'denied'
            ? 'Разрешение отклонено в браузере. Включите уведомления в настройках сайта.'
            : permission === 'unsupported'
              ? 'Этот браузер не поддерживает уведомления.'
              : subscribed
                ? 'Подписка активна. Вы можете отключить получение на этом устройстве.'
                : 'Включите уведомления, чтобы получать сообщения (и изменения) в браузере.'}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Button
            variant={subscribed ? 'outlined' : 'contained'}
            color={subscribed ? 'error' : 'primary'}
            onClick={handleTogglePush}
            disabled={pushBusy || permission === 'denied' || permission === 'unsupported'}
            sx={{
              textTransform: 'none',
              borderRadius: `${radii.button}px`,
              fontWeight: 600,
              ...(subscribed
                ? {}
                : {
                    bgcolor: colors.primary,
                    boxShadow: 'none',
                    '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
                  }),
            }}
          >
            {pushBusy ? 'Обработка…' : subscribed ? 'Отключить' : 'Включить уведомления'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Статус браузера: {permission}
          </Typography>
        </Box>
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: colors.text, fontWeight: 500 }}>
            Получать браузерные уведомления
          </Typography>
          <Switch
            checked={prefs.pushMasterEnabled}
            onChange={(_, v) => patchLocal({ pushMasterEnabled: v })}
            color="primary"
          />
        </Box>
      </Paper>

      <Paper elevation={0} sx={panelPaperSx}>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Типы уведомлений
        </Typography>
        {(
          [
            {
              key: 'chat',
              label: 'Новые сообщения в чатах',
              checked: prefs.chatMessagesEnabled,
              onChange: (v: boolean) => patchLocal({ chatMessagesEnabled: v }),
              show: true,
            },
            {
              key: 'changelog',
              label: 'Новые публикации в «Новости»',
              checked: prefs.changelogEnabled,
              onChange: (v: boolean) => patchLocal({ changelogEnabled: v }),
              show: Boolean(showChangelog),
            },
            {
              key: 'athlete',
              label: 'Новый спортсмен',
              checked: prefs.athleteCreatedEnabled !== false,
              onChange: (v: boolean) => patchLocal({ athleteCreatedEnabled: v }),
              show: actor === 'school' && (schoolRole === 'OWNER' || schoolRole === 'ADMIN'),
            },
            {
              key: 'finance',
              label: 'Финансы',
              checked: prefs.financeEnabled !== false,
              onChange: (v: boolean) => patchLocal({ financeEnabled: v }),
              show: actor === 'school' && schoolRole === 'OWNER',
            },
            {
              key: 'offers',
              label: 'Предложения платформы',
              checked: prefs.offersEnabled !== false,
              onChange: (v: boolean) => patchLocal({ offersEnabled: v }),
              show: actor === 'school' && schoolRole === 'OWNER',
            },
            {
              key: 'attendance',
              label: 'Посещаемость и начало тренировок',
              checked: prefs.attendanceEnabled !== false,
              onChange: (v: boolean) => patchLocal({ attendanceEnabled: v }),
              show: actor === 'school' && schoolRole === 'ADMIN',
            },
            {
              key: 'salary',
              label: 'Зарплата (начисление / выплата)',
              checked: prefs.salaryEnabled !== false,
              onChange: (v: boolean) => patchLocal({ salaryEnabled: v }),
              show: actor === 'school' && schoolRole === 'TRAINER',
            },
            {
              key: 'tasks',
              label: 'Напоминания о дедлайнах задач',
              checked: prefs.taskRemindersEnabled !== false,
              onChange: (v: boolean) => patchLocal({ taskRemindersEnabled: v }),
              show: actor === 'school',
            },
            {
              key: 'payments',
              label: 'Оплата и задолженность',
              checked: prefs.paymentsEnabled !== false,
              onChange: (v: boolean) => patchLocal({ paymentsEnabled: v }),
              show: actor === 'portal',
            },
            {
              key: 'trainingReminders',
              label: 'Напоминания о тренировках',
              checked: prefs.trainingRemindersEnabled !== false,
              onChange: (v: boolean) => patchLocal({ trainingRemindersEnabled: v }),
              show: actor === 'portal',
            },
            {
              key: 'scheduleChanges',
              label: 'Перенос и отмена тренировок',
              checked: prefs.scheduleChangesEnabled !== false,
              onChange: (v: boolean) => patchLocal({ scheduleChangesEnabled: v }),
              show: actor === 'portal',
            },
          ] as const
        )
          .filter((row) => row.show)
          .map((row) => (
            <Box
              key={row.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                py: 0.75,
                borderBottom: `1px solid ${colors.divider}`,
                '&:last-of-type': { borderBottom: 'none' },
              }}
            >
              <Typography variant="body2" sx={{ color: colors.text, fontWeight: 500 }}>
                {row.label}
              </Typography>
              <Switch checked={row.checked} onChange={(_, v) => row.onChange(v)} color="primary" />
            </Box>
          ))}
      </Paper>

      {showSchedule && (
        <Paper elevation={0} sx={panelPaperSx}>
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            Расписание доставки
          </Typography>
          <RadioGroup
            value={prefs.scheduleMode}
            onChange={(e) =>
              patchLocal({ scheduleMode: e.target.value === 'WINDOW' ? 'WINDOW' : 'ALWAYS' })
            }
          >
            <FormControlLabel value="ALWAYS" control={<Radio />} label="Круглосуточно" />
            <FormControlLabel value="WINDOW" control={<Radio />} label="Только в интервале" />
          </RadioGroup>

          {prefs.scheduleMode === 'WINDOW' && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <TextField
                  label="С"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                />
                <TextField
                  label="До"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                />
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={everyDay}
                    onChange={(_, v) => {
                      setEveryDay(v);
                      if (v) setSelectedDays([1, 2, 3, 4, 5, 6, 7]);
                    }}
                  />
                }
                label="Каждый день"
              />
              {!everyDay && (
                <FormGroup row sx={{ mt: 1 }}>
                  {DAY_LABELS.map((d) => (
                    <FormControlLabel
                      key={d.value}
                      control={
                        <Checkbox
                          checked={selectedDays.includes(d.value)}
                          onChange={(_, checked) => {
                            setSelectedDays((prev) =>
                              checked
                                ? [...prev, d.value].sort((a, b) => a - b)
                                : prev.filter((x) => x !== d.value)
                            );
                          }}
                        />
                      }
                      label={d.label}
                    />
                  ))}
                </FormGroup>
              )}
              <TextField
                sx={{ mt: 2, maxWidth: 320 }}
                fullWidth
                label="Часовой пояс"
                value={prefs.timezone || 'Europe/Moscow'}
                onChange={(e) => patchLocal({ timezone: e.target.value })}
                helperText="Например Europe/Moscow"
              />
            </Box>
          )}
        </Paper>
      )}

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving}
        sx={{
          textTransform: 'none',
          borderRadius: `${radii.button}px`,
          bgcolor: colors.primary,
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
        }}
      >
        {saving ? 'Сохранение…' : 'Сохранить настройки'}
      </Button>
    </Box>
  );
};

export default NotificationSettingsPanel;
