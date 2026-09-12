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

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
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
            sx={{ textTransform: 'none' }}
          >
            {pushBusy ? 'Обработка…' : subscribed ? 'Отключить' : 'Включить уведомления'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            Статус браузера: {permission}
          </Typography>
        </Box>
        <FormControlLabel
          sx={{ mt: 2, display: 'block' }}
          control={
            <Switch
              checked={prefs.pushMasterEnabled}
              onChange={(_, v) => patchLocal({ pushMasterEnabled: v })}
              color="primary"
            />
          }
          label="Получать браузерные уведомления"
        />
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Типы уведомлений
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={prefs.chatMessagesEnabled}
              onChange={(_, v) => patchLocal({ chatMessagesEnabled: v })}
              color="primary"
            />
          }
          label="Новые сообщения в чатах"
        />
        {showChangelog && (
          <FormControlLabel
            sx={{ display: 'block' }}
            control={
              <Switch
                checked={prefs.changelogEnabled}
                onChange={(_, v) => patchLocal({ changelogEnabled: v })}
                color="primary"
              />
            }
            label="Новые публикации в «Изменения»"
          />
        )}
        {actor === 'school' && (schoolRole === 'OWNER' || schoolRole === 'ADMIN') && (
          <>
            <FormControlLabel
              sx={{ display: 'block' }}
              control={
                <Switch
                  checked={prefs.athleteCreatedEnabled !== false}
                  onChange={(_, v) => patchLocal({ athleteCreatedEnabled: v })}
                  color="primary"
                />
              }
              label="Новый спортсмен"
            />
            {schoolRole === 'OWNER' && (
              <>
                <FormControlLabel
                  sx={{ display: 'block' }}
                  control={
                    <Switch
                      checked={prefs.financeEnabled !== false}
                      onChange={(_, v) => patchLocal({ financeEnabled: v })}
                      color="primary"
                    />
                  }
                  label="Финансы"
                />
                <FormControlLabel
                  sx={{ display: 'block' }}
                  control={
                    <Switch
                      checked={prefs.offersEnabled !== false}
                      onChange={(_, v) => patchLocal({ offersEnabled: v })}
                      color="primary"
                    />
                  }
                  label="Предложения платформы"
                />
              </>
            )}
            {schoolRole === 'ADMIN' && (
              <FormControlLabel
                sx={{ display: 'block' }}
                control={
                  <Switch
                    checked={prefs.attendanceEnabled !== false}
                    onChange={(_, v) => patchLocal({ attendanceEnabled: v })}
                    color="primary"
                  />
                }
                label="Посещаемость и начало тренировок"
              />
            )}
          </>
        )}
        {actor === 'school' && schoolRole === 'TRAINER' && (
          <FormControlLabel
            sx={{ display: 'block' }}
            control={
              <Switch
                checked={prefs.salaryEnabled !== false}
                onChange={(_, v) => patchLocal({ salaryEnabled: v })}
                color="primary"
              />
            }
            label="Зарплата (начисление / выплата)"
          />
        )}
        {actor === 'portal' && (
          <>
            <FormControlLabel
              sx={{ display: 'block' }}
              control={
                <Switch
                  checked={prefs.paymentsEnabled !== false}
                  onChange={(_, v) => patchLocal({ paymentsEnabled: v })}
                  color="primary"
                />
              }
              label="Оплата и задолженность"
            />
            <FormControlLabel
              sx={{ display: 'block' }}
              control={
                <Switch
                  checked={prefs.trainingRemindersEnabled !== false}
                  onChange={(_, v) => patchLocal({ trainingRemindersEnabled: v })}
                  color="primary"
                />
              }
              label="Напоминания о тренировках"
            />
            <FormControlLabel
              sx={{ display: 'block' }}
              control={
                <Switch
                  checked={prefs.scheduleChangesEnabled !== false}
                  onChange={(_, v) => patchLocal({ scheduleChangesEnabled: v })}
                  color="primary"
                />
              }
              label="Перенос и отмена тренировок"
            />
          </>
        )}
      </Paper>

      {showSchedule && (
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
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
        sx={{ textTransform: 'none' }}
      >
        {saving ? 'Сохранение…' : 'Сохранить настройки'}
      </Button>
    </Box>
  );
};

export default NotificationSettingsPanel;
