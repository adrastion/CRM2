import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';

const MarketerCalendar: React.FC = () => {
  const [anchor, setAnchor] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const from = new Date(weekStart);
        from.setHours(0, 0, 0, 0);
        const to = new Date(weekEnd);
        to.setHours(23, 59, 59, 999);
        setTasks(
          await apiService.getMarketerTasks({
            from: from.toISOString(),
            to: to.toISOString(),
          })
        );
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Ошибка календаря');
      } finally {
        setLoading(false);
      }
    })();
  }, [anchor.getTime()]);

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of days) map.set(format(d, 'yyyy-MM-dd'), []);
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const key = format(new Date(t.dueAt), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks, days]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Календарь
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => setAnchor(subDays(anchor, 7))} size="small">
            <ChevronLeft />
          </IconButton>
          <Typography>
            {format(weekStart, 'd MMM', { locale: ru })} — {format(weekEnd, 'd MMM yyyy', { locale: ru })}
          </Typography>
          <IconButton onClick={() => setAnchor(addDays(anchor, 7))} size="small">
            <ChevronRight />
          </IconButton>
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(7, 1fr)' },
            gap: 1,
          }}
        >
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const items = byDay.get(key) || [];
            const today = isSameDay(day, new Date());
            return (
              <Paper
                key={key}
                variant="outlined"
                sx={{ p: 1.5, minHeight: 140, bgcolor: today ? 'action.selected' : undefined }}
              >
                <Typography sx={{ fontWeight: 600, mb: 1, textTransform: 'capitalize' }}>
                  {format(day, 'EEE d', { locale: ru })}
                </Typography>
                <Stack spacing={0.5}>
                  {items.map((t) => (
                    <Chip
                      key={t.id}
                      size="small"
                      label={`${t.kind === 'CALL' ? 'Созвон: ' : ''}${t.title}`}
                      color={t.status === 'DONE' ? 'default' : t.kind === 'CALL' ? 'warning' : 'primary'}
                      sx={{ opacity: t.status === 'DONE' ? 0.6 : 1, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }}
                    />
                  ))}
                  {items.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      —
                    </Typography>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default MarketerCalendar;
