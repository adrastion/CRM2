import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiService } from '../services/api';

type Range = 'day' | 'month' | 'quarter' | 'year';

function formatDuration(sec: number): string {
  if (!sec || sec < 0) return '—';
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m} мин ${s} с` : `${m} мин`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} ч ${rm} мин` : `${h} ч`;
}

const ACTOR_LABELS: Record<string, string> = {
  guest: 'Гости',
  school: 'Школа',
  client: 'Клиенты',
  parent: 'Родители',
  unknown: 'Прочие',
};

const SiteTrafficMonitoringTab: React.FC = () => {
  const [range, setRange] = useState<Range>('day');
  const [live, setLive] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [quiet, setQuiet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLive = useCallback(async () => {
    try {
      const data = await apiService.getSiteTrafficLive();
      setLive(data);
    } catch (e: any) {
      /* keep previous */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [l, s, q] = await Promise.all([
        apiService.getSiteTrafficLive(),
        apiService.getSiteTrafficSummary(range),
        apiService.getSiteTrafficQuietHours(30),
      ]);
      setLive(l);
      setSummary(s);
      setQuiet(q);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить статистику посещаемости');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const t = window.setInterval(() => {
      loadLive();
    }, 20000);
    return () => window.clearInterval(t);
  }, [loadLive]);

  const hourlyChart =
    summary?.hourlyProfile?.map((v: number, i: number) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      online: v,
    })) ||
    live?.hourly24h?.map((p: any) => ({
      hour: new Date(p.hour).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
      }),
      online: p.online,
    })) ||
    [];

  const quietChart =
    quiet?.hours?.map((h: any) => ({
      hour: `${String(h.hour).padStart(2, '0')}`,
      avg: h.avgConcurrent,
    })) || [];

  if (loading && !live) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        Посещаемость сайта
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Активность по всему продукту (публичные страницы и кабинеты). Нужна для выбора окна обновлений.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Сейчас онлайн
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {live?.onlineNow ?? '—'}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                {Object.entries(live?.byActor || {}).map(([k, v]) =>
                  Number(v) > 0 ? (
                    <Typography key={k} variant="caption" color="text.secondary">
                      {ACTOR_LABELS[k] || k}: {String(v)}
                    </Typography>
                  ) : null
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Уникальные посетители
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {summary?.uniqueVisitors ?? '—'}
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={range}
                onChange={(_, v) => v && setRange(v)}
                sx={{ mt: 1, flexWrap: 'wrap' }}
              >
                <ToggleButton value="day">День</ToggleButton>
                <ToggleButton value="month">Месяц</ToggleButton>
                <ToggleButton value="quarter">Квартал</ToggleButton>
                <ToggleButton value="year">Год</ToggleButton>
              </ToggleButtonGroup>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Среднее время на сайте
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                {formatDuration(summary?.avgSessionDurationSec || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Сессий в периоде: {summary?.sessionCount ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Пик одновременных
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {summary?.peakConcurrent ?? '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                За выбранный период
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card sx={{ p: 2, height: 360 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              Онлайн по часам (MSK)
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={hourlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="online" name="Онлайн" stroke="#1976d2" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ p: 2, mb: 2 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              Лучшее время для обновлений
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Часы с минимальной средней нагрузкой за {quiet?.days || 30} дн. (MSK)
            </Typography>
            <Stack spacing={1}>
              {(quiet?.bestWindows || []).map((w: any) => (
                <Box
                  key={w.hourMsk}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography fontWeight={600}>{w.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ср. {w.avgConcurrent}
                  </Typography>
                </Box>
              ))}
              {!quiet?.bestWindows?.length && (
                <Typography variant="body2" color="text.secondary">
                  Пока мало данных — зайдите позже, когда накопится статистика.
                </Typography>
              )}
            </Stack>
          </Card>
          <Card sx={{ p: 2, height: 220 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              Профиль суток (ср. онлайн)
            </Typography>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={quietChart}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} width={28} />
                <RechartsTooltip />
                <Bar dataKey="avg" name="Ср. онлайн" fill="#66bb6a" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card sx={{ p: 2 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>
              Сейчас на страницах
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {(live?.topPaths || []).map((p: any) => (
                <Box
                  key={p.path}
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    fontSize: 13,
                  }}
                >
                  <strong>{p.count}</strong> · {p.path}
                </Box>
              ))}
              {!live?.topPaths?.length && (
                <Typography variant="body2" color="text.secondary">
                  Никого онлайн
                </Typography>
              )}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SiteTrafficMonitoringTab;
