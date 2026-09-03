import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Alert,
  Button,
  TextField,
  CircularProgress,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Memory,
  Speed,
  Storage,
  Timeline,
  NotificationsActive,
  NotificationsOff,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiService } from '../services/api';
import {
  subscribeSuperAdminPushNotifications,
  unsubscribeSuperAdminPushNotifications,
  checkNotificationPermission,
} from '../utils/superAdminPushNotifications';

type HistoryRange = '1h' | '6h' | '24h' | '7d' | '30d';

interface LiveMetrics {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  load1: number;
  load5: number;
  load15: number;
  diskPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  cpuCores: number;
  processUptimeSec: number;
  hostUptimeSec: number;
  critical: boolean;
  criticalReasons: string[];
}

interface AlertSettings {
  alertsEnabled: boolean;
  alertCpuPercent: number;
  alertMemoryPercent: number;
  alertDiskPercent: number;
  alertLoadPerCore: number;
  alertCooldownMinutes: number;
  lastAlertAt: string | null;
}

interface HistoryPoint {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  load1: number;
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  return `${m}м ${s}с`;
}

function formatChartTime(iso: string, range: HistoryRange): string {
  const d = new Date(iso);
  if (range === '7d' || range === '30d') {
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function metricColor(value: number, warnAt: number, criticalAt: number): 'success' | 'warning' | 'error' {
  if (value >= criticalAt) return 'error';
  if (value >= warnAt) return 'warning';
  return 'success';
}

const MetricCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  percent?: number;
  color?: 'success' | 'warning' | 'error' | 'primary';
  icon: React.ReactNode;
}> = ({ title, value, subtitle, percent, color = 'primary', icon }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Typography color="text.secondary" variant="body2">
          {title}
        </Typography>
        <Box color={`${color}.main`}>{icon}</Box>
      </Box>
      <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}
      {typeof percent === 'number' && (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, percent))}
          color={color === 'primary' ? 'primary' : color}
          sx={{ mt: 1.5, height: 8, borderRadius: 1 }}
        />
      )}
    </CardContent>
  </Card>
);

const ServerLoadMonitoringTab: React.FC = () => {
  const [live, setLive] = useState<LiveMetrics | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>('1h');
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    alertsEnabled: true,
    alertCpuPercent: '90',
    alertMemoryPercent: '90',
    alertDiskPercent: '90',
    alertLoadPerCore: '1',
    alertCooldownMinutes: '15',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [vapidConfigured, setVapidConfigured] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    try {
      const data = await apiService.getServerMetricsLive();
      setLive(data);
      setLiveError(null);
    } catch (err: any) {
      setLiveError(err.response?.data?.error || 'Ошибка загрузки метрик');
    }
  }, []);

  const loadHistory = useCallback(async (range: HistoryRange) => {
    try {
      setHistoryLoading(true);
      const data = await apiService.getServerMetricsHistory(range);
      setHistoryPoints(data.points || []);
    } catch (err: any) {
      console.error('History load error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadAlertSettings = useCallback(async () => {
    try {
      const settings = await apiService.getServerAlertSettings();
      setAlertSettings(settings);
      setSettingsForm({
        alertsEnabled: settings.alertsEnabled,
        alertCpuPercent: String(settings.alertCpuPercent),
        alertMemoryPercent: String(settings.alertMemoryPercent),
        alertDiskPercent: String(settings.alertDiskPercent),
        alertLoadPerCore: String(settings.alertLoadPerCore),
        alertCooldownMinutes: String(settings.alertCooldownMinutes),
      });
    } catch (err) {
      console.error('Alert settings load error:', err);
    }
  }, []);

  const loadPushStatus = useCallback(async () => {
    try {
      const status = await apiService.getSuperAdminPushStatus();
      setPushSubscribed(status.subscribed);
      setVapidConfigured(status.vapidConfigured);
    } catch (err) {
      console.error('Push status error:', err);
    }
  }, []);

  useEffect(() => {
    loadLive();
    loadAlertSettings();
    loadPushStatus();

    const interval = setInterval(() => {
      loadLive();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadLive, loadAlertSettings, loadPushStatus]);

  useEffect(() => {
    loadHistory(historyRange);
  }, [historyRange, loadHistory]);

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const updated = await apiService.updateServerAlertSettings({
        alertsEnabled: settingsForm.alertsEnabled,
        alertCpuPercent: parseFloat(settingsForm.alertCpuPercent),
        alertMemoryPercent: parseFloat(settingsForm.alertMemoryPercent),
        alertDiskPercent: parseFloat(settingsForm.alertDiskPercent),
        alertLoadPerCore: parseFloat(settingsForm.alertLoadPerCore),
        alertCooldownMinutes: parseInt(settingsForm.alertCooldownMinutes, 10),
      });
      setAlertSettings(updated);
      setPushMessage('Настройки алертов сохранены');
    } catch (err: any) {
      setPushMessage(err.response?.data?.error || 'Ошибка сохранения настроек');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubscribePush = async () => {
    try {
      setPushBusy(true);
      setPushMessage(null);
      const ok = await subscribeSuperAdminPushNotifications();
      if (ok) {
        setPushSubscribed(true);
        setPushMessage('Браузерные уведомления включены');
      } else {
        const perm = checkNotificationPermission();
        if (perm === 'denied') {
          setPushMessage('Разрешение на уведомления запрещено в браузере');
        } else {
          setPushMessage('Не удалось подписаться на уведомления');
        }
      }
      await loadPushStatus();
    } finally {
      setPushBusy(false);
    }
  };

  const handleUnsubscribePush = async () => {
    try {
      setPushBusy(true);
      const ok = await unsubscribeSuperAdminPushNotifications();
      if (ok) {
        setPushSubscribed(false);
        setPushMessage('Подписка на уведомления отменена');
      }
      await loadPushStatus();
    } finally {
      setPushBusy(false);
    }
  };

  const cpuColor = live
    ? metricColor(live.cpuPercent, 70, alertSettings?.alertCpuPercent ?? 90)
    : 'primary';
  const memColor = live
    ? metricColor(live.memoryPercent, 70, alertSettings?.alertMemoryPercent ?? 90)
    : 'primary';
  const diskColor = live
    ? metricColor(live.diskPercent, 70, alertSettings?.alertDiskPercent ?? 90)
    : 'primary';
  const loadThreshold = live && alertSettings
    ? alertSettings.alertLoadPerCore * live.cpuCores
    : live
      ? live.cpuCores
      : 1;
  const loadColor = live
    ? metricColor(live.load1, loadThreshold * 0.7, loadThreshold)
    : 'primary';

  const chartData = historyPoints.map((p) => ({
    ...p,
    time: formatChartTime(p.timestamp, historyRange),
  }));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight="bold">
          Нагрузка сервера
        </Typography>
        <Chip
          size="small"
          label={live ? `Обновлено: ${new Date(live.timestamp).toLocaleTimeString('ru-RU')}` : 'Загрузка…'}
          color="primary"
          variant="outlined"
        />
      </Box>

      {liveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {liveError}
        </Alert>
      )}

      {live?.critical && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Критическая нагрузка: {live.criticalReasons.join('; ')}
        </Alert>
      )}

      {!live && !liveError ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : live ? (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="CPU"
              value={`${live.cpuPercent}%`}
              subtitle={`${live.cpuCores} ядер`}
              percent={live.cpuPercent}
              color={cpuColor}
              icon={<Speed />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="RAM"
              value={`${live.memoryPercent}%`}
              subtitle={`${live.memoryUsedMb} / ${live.memoryTotalMb} МБ`}
              percent={live.memoryPercent}
              color={memColor}
              icon={<Memory />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Диск /"
              value={`${live.diskPercent}%`}
              subtitle={`${live.diskUsedGb} / ${live.diskTotalGb} ГБ`}
              percent={live.diskPercent}
              color={diskColor}
              icon={<Storage />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Load Average"
              value={String(live.load1)}
              subtitle={`5м: ${live.load5} · 15м: ${live.load15}`}
              color={loadColor}
              icon={<Timeline />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Uptime процесса Node.js
              </Typography>
              <Typography variant="h6">{formatUptime(live.processUptimeSec)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Uptime хоста
              </Typography>
              <Typography variant="h6">{formatUptime(live.hostUptimeSec)}</Typography>
            </Paper>
          </Grid>
        </Grid>
      ) : null}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
          <Typography variant="h6" fontWeight="bold">
            Графики
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={historyRange}
            onChange={(_, v) => v && setHistoryRange(v)}
          >
            <ToggleButton value="1h">1ч</ToggleButton>
            <ToggleButton value="6h">6ч</ToggleButton>
            <ToggleButton value="24h">24ч</ToggleButton>
            <ToggleButton value="7d">7д</ToggleButton>
            <ToggleButton value="30d">30д</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {historyLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : chartData.length === 0 ? (
          <Alert severity="info">
            Пока нет данных за выбранный период. Сэмплы собираются каждые 30 секунд.
          </Alert>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" minTickGap={40} />
              <YAxis yAxisId="pct" domain={[0, 100]} unit="%" />
              <YAxis yAxisId="load" orientation="right" />
              <RechartsTooltip />
              <Legend />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="cpuPercent"
                name="CPU %"
                stroke="#1976d2"
                dot={false}
                strokeWidth={2}
              />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="memoryPercent"
                name="RAM %"
                stroke="#9c27b0"
                dot={false}
                strokeWidth={2}
              />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="diskPercent"
                name="Диск %"
                stroke="#ed6c02"
                dot={false}
                strokeWidth={2}
              />
              <Line
                yAxisId="load"
                type="monotone"
                dataKey="load1"
                name="Load1"
                stroke="#2e7d32"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Уведомления о критической нагрузке
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Push приходит только авторизованному супер-админу с включённой подпиской в этом браузере.
        </Typography>

        {pushMessage && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            onClose={() => setPushMessage(null)}
          >
            {pushMessage}
          </Alert>
        )}

        {!vapidConfigured && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            VAPID ключи не настроены на сервере — браузерные push недоступны.
          </Alert>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={settingsForm.alertsEnabled}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, alertsEnabled: e.target.checked }))
              }
            />
          }
          label="Включить алерты критической нагрузки"
        />

        <Grid container spacing={2} sx={{ mt: 1, mb: 2 }}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Порог CPU %"
              type="number"
              value={settingsForm.alertCpuPercent}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, alertCpuPercent: e.target.value }))
              }
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Порог RAM %"
              type="number"
              value={settingsForm.alertMemoryPercent}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, alertMemoryPercent: e.target.value }))
              }
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Порог диска %"
              type="number"
              value={settingsForm.alertDiskPercent}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, alertDiskPercent: e.target.value }))
              }
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Load на ядро"
              type="number"
              value={settingsForm.alertLoadPerCore}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, alertLoadPerCore: e.target.value }))
              }
              inputProps={{ min: 0.1, step: 0.1 }}
              helperText="Порог Load1 = значение × число ядер"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Cooldown (мин)"
              type="number"
              value={settingsForm.alertCooldownMinutes}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, alertCooldownMinutes: e.target.value }))
              }
              inputProps={{ min: 1, max: 1440 }}
              helperText="Минимальный интервал между push"
            />
          </Grid>
        </Grid>

        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? <CircularProgress size={22} /> : 'Сохранить пороги'}
          </Button>
          {pushSubscribed ? (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<NotificationsOff />}
              onClick={handleUnsubscribePush}
              disabled={pushBusy || !vapidConfigured}
            >
              Отключить уведомления браузера
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<NotificationsActive />}
              onClick={handleSubscribePush}
              disabled={pushBusy || !vapidConfigured}
            >
              Включить уведомления браузера
            </Button>
          )}
        </Box>

        <Divider sx={{ my: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Статус подписки: {pushSubscribed ? 'активна' : 'нет'}
          {alertSettings?.lastAlertAt
            ? ` · Последний алерт: ${new Date(alertSettings.lastAlertAt).toLocaleString('ru-RU')}`
            : ''}
        </Typography>
      </Paper>
    </Box>
  );
};

export default ServerLoadMonitoringTab;
