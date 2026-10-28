import React from 'react';
import { Box, Typography } from '@mui/material';
import { CalendarMonthOutlined, CheckCircleOutline } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';
import ScheduleList, { ScheduleRow } from './ScheduleList';
import { toIso } from './MonthCalendar';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function startOfWeek(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

function buildWeek(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

interface WeekEventCalendarProps {
  /** Якорь недели (любой день внутри). */
  weekAnchor: Date;
  selected?: string | null;
  onSelect?: (isoDate: string) => void;
  /** Дни с событиями (ISO). */
  markedDates?: string[];
  rows: ScheduleRow[];
  placeholder?: boolean;
  emptyText?: string;
}

/**
 * Недельный календарь ЛК клиента: полоска дней + список событий или empty-state.
 */
const WeekEventCalendar: React.FC<WeekEventCalendarProps> = ({
  weekAnchor,
  selected,
  onSelect,
  markedDates = [],
  rows,
  placeholder,
  emptyText = 'На этой неделе пока нет событий',
}) => {
  const days = React.useMemo(() => buildWeek(weekAnchor), [weekAnchor]);
  const marked = React.useMemo(() => new Set(markedDates), [markedDates]);
  const todayIso = toIso(new Date());
  const monthLabel = `${MONTHS[weekAnchor.getMonth()]} ${weekAnchor.getFullYear()}`;

  return (
    <Box sx={{ opacity: placeholder ? 0.55 : 1, userSelect: placeholder ? 'none' : 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
          gap: 1,
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontSize: {
              xs: typography.panelTitle.xs,
              sm: typography.panelTitle.sm,
              md: typography.panelTitle.md,
            },
            fontWeight: 700,
            color: colors.text,
            lineHeight: 1.2,
          }}
        >
          Календарь событий
        </Typography>
        <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, fontWeight: 600 }}>
          {monthLabel}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: { xs: 0.5, md: 0.75 },
          mb: 2.5,
        }}
      >
        {days.map((day, i) => {
          const iso = toIso(day);
          const isSelected = selected === iso;
          const isToday = iso === todayIso;
          const hasMark = marked.has(iso);
          return (
            <Box
              key={iso}
              component="button"
              type="button"
              disabled={placeholder || !onSelect}
              onClick={() => onSelect?.(iso === selected ? '' : iso)}
              aria-pressed={isSelected}
              sx={{
                border: 'none',
                background: 'none',
                cursor: placeholder || !onSelect ? 'default' : 'pointer',
                fontFamily: 'inherit',
                p: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 0,
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: 11, md: 12 },
                  fontWeight: 600,
                  color: colors.textMuted,
                  lineHeight: 1,
                }}
              >
                {WEEKDAYS[i]}
              </Typography>
              <Box
                sx={{
                  width: { xs: 34, md: 40 },
                  height: { xs: 34, md: 40 },
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: { xs: 13, md: 14 },
                  fontWeight: 700,
                  color: isSelected ? colors.white : colors.text,
                  bgcolor: isSelected
                    ? colors.primary
                    : isToday
                      ? colors.primarySoft
                      : 'transparent',
                  boxShadow: isSelected ? '0 4px 12px rgba(47, 107, 255, 0.35)' : 'none',
                  position: 'relative',
                }}
              >
                {day.getDate()}
                {hasMark && !placeholder && (
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      bottom: 3,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      bgcolor: isSelected ? colors.white : colors.primary,
                    }}
                  />
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {placeholder ? (
        <ScheduleList rows={[]} placeholder placeholderRows={4} />
      ) : rows.length > 0 ? (
        <ScheduleList rows={rows} emptyText={emptyText} />
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            py: { xs: 3, md: 4.5 },
            px: 2,
            minHeight: { xs: 180, md: 220 },
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'relative',
              width: 88,
              height: 88,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 3,
                bgcolor: colors.primarySoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.primary,
              }}
            >
              <CalendarMonthOutlined sx={{ fontSize: 40 }} />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                bottom: 4,
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: colors.card,
                boxShadow: '0 2px 8px rgba(32,34,36,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.success,
              }}
            >
              <CheckCircleOutline sx={{ fontSize: 20 }} />
            </Box>
          </Box>
          <Typography
            sx={{ fontSize: typography.label, fontWeight: 700, color: colors.text, mb: 0.75 }}
          >
            {emptyText}
          </Typography>
          <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, maxWidth: 280 }}>
            Когда появятся тренировки или события, они отобразятся здесь
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default WeekEventCalendar;
export { startOfWeek, buildWeek };
