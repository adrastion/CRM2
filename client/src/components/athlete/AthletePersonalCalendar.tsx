import React from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Event } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import { AthleteCalendarEvent } from './athleteCardTypes';
import { formatDateRu } from './athleteCardUtils';

interface Props {
  events: AthleteCalendarEvent[];
  onOpenFull?: () => void;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const AthletePersonalCalendar: React.FC<Props> = ({ events, onOpenFull }) => {
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = React.useState<AthleteCalendarEvent | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const eventsForDay = (day: Date) =>
    events.filter((e) => {
      const raw = e.startTime || e.startDate;
      if (!raw) return false;
      const ed = new Date(raw);
      return (
        ed.getFullYear() === day.getFullYear() &&
        ed.getMonth() === day.getMonth() &&
        ed.getDate() === day.getDate()
      );
    });

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: colors.card,
        borderRadius: radii.card,
        border: `1px solid ${colors.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700, fontSize: typography.panelTitle }}>Календарный план</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() - 7); return n; })}>
            <ChevronLeft />
          </IconButton>
          <Typography sx={{ fontSize: typography.label, minWidth: 120, textAlign: 'center' }}>
            {formatDateRu(days[0])} — {formatDateRu(days[6])}
          </Typography>
          <IconButton size="small" onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() + 7); return n; })}>
            <ChevronRight />
          </IconButton>
          {onOpenFull && (
            <Button size="small" startIcon={<Event />} onClick={onOpenFull} sx={{ textTransform: 'none', ml: 1 }}>
              Открыть календарь полностью
            </Button>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(72px, 1fr))',
          gap: 0.75,
          overflowX: 'auto',
        }}
      >
        {days.map((day, i) => {
          const list = eventsForDay(day);
          return (
            <Box
              key={day.toISOString()}
              sx={{
                minHeight: 88,
                p: 0.75,
                borderRadius: 1,
                bgcolor: colors.surface,
                border: `1px solid ${colors.divider}`,
              }}
            >
              <Typography sx={{ fontSize: typography.hint, color: colors.textHint, mb: 0.5 }}>
                {DAY_NAMES[i]} {day.getDate()}
              </Typography>
              {list.length === 0 ? (
                <Typography sx={{ fontSize: 11, color: colors.textEmpty }}>—</Typography>
              ) : (
                list.slice(0, 3).map((ev) => (
                  <Chip
                    key={ev.id}
                    size="small"
                    label={ev.title || ev.name || (ev.type === 'competition' ? 'Соревнование' : 'Тренировка')}
                    onClick={() => setSelected(ev)}
                    sx={{
                      mb: 0.35,
                      maxWidth: '100%',
                      height: 22,
                      fontSize: 10,
                      bgcolor: ev.type === 'competition' ? '#FFF3E0' : colors.primarySoft,
                    }}
                  />
                ))
              )}
            </Box>
          );
        })}
      </Box>

      {!events.length && (
        <Typography sx={{ mt: 1.5, fontSize: typography.label, color: colors.textEmpty }}>
          Ближайших событий нет
        </Typography>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{selected?.title || selected?.name || 'Событие'}</DialogTitle>
        <DialogContent>
          {selected && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={{ fontSize: typography.label }}>
                Тип: {selected.type === 'competition' ? 'Соревнование' : 'Тренировка'}
              </Typography>
              <Typography sx={{ fontSize: typography.label }}>
                Дата: {formatDateRu(selected.startTime || selected.startDate)}
              </Typography>
              {selected.groupName && (
                <Typography sx={{ fontSize: typography.label }}>Группа: {selected.groupName}</Typography>
              )}
              {selected.location && (
                <Typography sx={{ fontSize: typography.label }}>Место: {selected.location}</Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AthletePersonalCalendar;
