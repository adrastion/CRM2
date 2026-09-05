import React from 'react';
import {
  Box,
  CircularProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
} from '@mui/material';
import { CalendarToday, EmojiEvents, SportsMartialArtsOutlined } from '@mui/icons-material';
import { apiService } from '../../services/api';
import Panel from '../dashboard/Panel';
import MonthCalendar, { toIso } from '../dashboard/MonthCalendar';
import ScheduleList, { ScheduleRow } from '../dashboard/ScheduleList';
import { colors, radii, typography } from '../../theme/tokens';

interface Props {
  clientId?: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(iso?: string | Date | null): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

const ClientCalendarPlan: React.FC<Props> = ({ clientId }) => {
  const [section, setSection] = React.useState<'schedule' | 'competitions'>('schedule');
  const [month, setMonth] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [trainings, setTrainings] = React.useState<any[]>([]);
  const [competitions, setCompetitions] = React.useState<any[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const from =
      section === 'competitions'
        ? new Date(month.getFullYear() - 1, 0, 1)
        : new Date(month.getFullYear(), month.getMonth(), 1);
    const to =
      section === 'competitions'
        ? new Date(month.getFullYear() + 2, 0, 1)
        : new Date(month.getFullYear(), month.getMonth() + 1, 1);
    (async () => {
      try {
        const data = await apiService.getClientCalendarPlan({
          clientId,
          from: from.toISOString(),
          to: to.toISOString(),
        });
        if (cancelled) return;
        setTrainings(data.trainings || []);
        setCompetitions(data.competitions || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Не удалось загрузить календарь');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, month, section]);

  const marks = [
    ...trainings.map((e) => ({
      date: toIso(new Date(e.startTime)),
      color: e.color || colors.primary,
    })),
    ...competitions.map((c) => ({
      date: toIso(new Date(c.startDate)),
      color: '#FF9800',
    })),
  ];

  const dayTrainings = selectedDay
    ? trainings.filter((e) => toIso(new Date(e.startTime)) === selectedDay)
    : trainings.filter((e) => {
        const d = new Date(e.startTime);
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return d >= weekStart && d < weekEnd;
      });

  const dayCompetitions = selectedDay
    ? competitions.filter((c) => toIso(new Date(c.startDate)) === selectedDay)
    : [];

  const rows: ScheduleRow[] = [
    ...dayTrainings.map((event) => ({
      id: event.id,
      dateLabel: `${new Date(event.startTime).getDate()}.${String(
        new Date(event.startTime).getMonth() + 1
      ).padStart(2, '0')}`,
      timeLabel: `${timeLabel(event.startTime)}-${timeLabel(event.endTime)}`,
      title: event.groupName || event.title,
      icon: <SportsMartialArtsOutlined sx={{ color: colors.primary, fontSize: 22 }} />,
      color: event.color,
    })),
    ...dayCompetitions.map((c) => ({
      id: `comp-${c.id}`,
      dateLabel: formatDate(c.startDate),
      timeLabel: 'Соревн.',
      title: c.name,
      icon: <EmojiEvents sx={{ color: '#FF9800', fontSize: 22 }} />,
      color: '#FF9800',
    })),
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Tabs
        value={section}
        onChange={(_, v) => setSection(v)}
        sx={{
          minHeight: 40,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 40, py: 0.5, textTransform: 'none', fontSize: 14 },
        }}
      >
        <Tab
          value="schedule"
          label="Расписание"
          icon={<CalendarToday sx={{ fontSize: 18 }} />}
          iconPosition="start"
        />
        <Tab
          value="competitions"
          label="Соревнования"
          icon={<EmojiEvents sx={{ fontSize: 18 }} />}
          iconPosition="start"
        />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : error ? (
        <Typography sx={{ color: colors.danger, fontSize: typography.label }}>{error}</Typography>
      ) : section === 'schedule' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: { xs: 2, md: 3 },
          }}
        >
          <Panel title="Календарь событий" minHeight={420}>
            <MonthCalendar
              month={month}
              onMonthChange={(m) => {
                setMonth(m);
                setSelectedDay(null);
              }}
              marks={marks}
              selected={selectedDay}
              onSelect={(iso) => setSelectedDay(iso === selectedDay ? null : iso)}
            />
          </Panel>
          <Panel
            title={selectedDay ? 'События за день' : 'Расписание на неделю'}
            minHeight={420}
            action={
              selectedDay ? (
                <Typography
                  component="button"
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  sx={{
                    border: 'none',
                    background: colors.surface,
                    borderRadius: `${radii.cell}px`,
                    px: 1.5,
                    py: 0.75,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: typography.hint,
                    color: colors.textMuted,
                  }}
                >
                  Показать неделю
                </Typography>
              ) : undefined
            }
          >
            <ScheduleList
              rows={rows}
              emptyText={
                selectedDay ? 'В этот день событий нет' : 'Нет тренировок на этой неделе'
              }
            />
          </Panel>
        </Box>
      ) : (
        <Panel title="Мои соревнования">
          {competitions.length === 0 ? (
            <Typography sx={{ fontSize: typography.label, color: colors.textEmpty, py: 2 }}>
              Вы пока не зарегистрированы ни на одно соревнование
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell>Место</TableCell>
                    <TableCell>Результат</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {competitions.map((c) => {
                    const result = c.results?.[0];
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EmojiEvents sx={{ color: '#FF9800', fontSize: 18 }} />
                            {c.name}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {formatDate(c.startDate)}
                          {c.endDate && formatDate(c.endDate) !== formatDate(c.startDate)
                            ? ` — ${formatDate(c.endDate)}`
                            : ''}
                        </TableCell>
                        <TableCell>{c.location || '—'}</TableCell>
                        <TableCell>
                          {result?.result ||
                            (result?.resultValue != null ? String(result.resultValue) : (
                              <Chip size="small" label="Зарегистрирован" variant="outlined" />
                            ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Panel>
      )}
    </Box>
  );
};

export default ClientCalendarPlan;
