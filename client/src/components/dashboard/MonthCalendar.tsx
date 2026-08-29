import React from 'react';
import { Box, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { colors, radii, typography } from '../../theme/tokens';

export interface CalendarDayMark {
  /** ISO-дата (YYYY-MM-DD). */
  date: string;
  /** Цвет метки события. */
  color?: string | null;
}

interface MonthCalendarProps {
  /** Любая дата внутри отображаемого месяца. */
  month: Date;
  onMonthChange?: (next: Date) => void;
  /** Отмеченные дни. */
  marks?: CalendarDayMark[];
  /** Выбранный день. */
  selected?: string | null;
  onSelect?: (isoDate: string) => void;
  /** Заглушка: сетка без данных, клики отключены. */
  placeholder?: boolean;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Сетка 6x7, начинающаяся с понедельника. */
function buildGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Календарь месяца из макета: подсветка дней с тренировками. */
const MonthCalendar: React.FC<MonthCalendarProps> = ({
  month,
  onMonthChange,
  marks = [],
  selected,
  onSelect,
  placeholder,
}) => {
  const grid = React.useMemo(() => buildGrid(month), [month]);
  const marksByDate = React.useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    marks.forEach((m) => {
      if (!map.has(m.date)) map.set(m.date, m.color);
    });
    return map;
  }, [marks]);

  const todayIso = toIso(new Date());

  const shift = (delta: number) => {
    if (!onMonthChange) return;
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  };

  return (
    <Box sx={{ opacity: placeholder ? 0.55 : 1, userSelect: placeholder ? 'none' : 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography sx={{ fontSize: typography.label, fontWeight: 600, color: colors.text }}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Typography>

        {!placeholder && onMonthChange && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[
              { icon: <ChevronLeft />, delta: -1, label: 'Предыдущий месяц' },
              { icon: <ChevronRight />, delta: 1, label: 'Следующий месяц' },
            ].map((btn) => (
              <Box
                key={btn.label}
                component="button"
                type="button"
                aria-label={btn.label}
                onClick={() => shift(btn.delta)}
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '10px',
                  border: 'none',
                  bgcolor: colors.surface,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': { bgcolor: colors.divider },
                }}
              >
                {btn.icon}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: { xs: 0.75, md: 1 } }}>
        {WEEKDAYS.map((w) => (
          <Typography
            key={w}
            sx={{
              textAlign: 'center',
              fontSize: typography.hint,
              color: colors.textMuted,
              fontWeight: 600,
              pb: 0.5,
            }}
          >
            {w}
          </Typography>
        ))}

        {grid.map((day) => {
          const iso = toIso(day);
          const inMonth = day.getMonth() === month.getMonth();
          const mark = marksByDate.has(iso);
          const isSelected = selected === iso;
          const isToday = iso === todayIso;

          return (
            <Box
              key={iso}
              component={placeholder || !onSelect ? 'div' : 'button'}
              type={placeholder || !onSelect ? undefined : 'button'}
              onClick={placeholder || !onSelect ? undefined : () => onSelect(iso)}
              aria-current={isToday ? 'date' : undefined}
              sx={{
                border: 'none',
                fontFamily: 'inherit',
                cursor: placeholder || !onSelect ? 'default' : 'pointer',
                aspectRatio: '1 / 0.86',
                borderRadius: `${radii.cell}px`,
                bgcolor: isSelected
                  ? colors.primary
                  : mark
                  ? colors.primarySoft
                  : inMonth
                  ? colors.surface
                  : 'transparent',
                color: isSelected ? colors.white : inMonth ? colors.text : colors.textHint,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                fontSize: typography.label,
                fontWeight: isToday ? 700 : 500,
                outline: isToday && !isSelected ? `2px solid ${colors.primary}` : 'none',
                outlineOffset: -2,
                transition: 'background-color 160ms ease',
                '&:hover':
                  placeholder || !onSelect
                    ? undefined
                    : { bgcolor: isSelected ? colors.primary : colors.primarySoft },
              }}
            >
              <Box component="span">{day.getDate()}</Box>
              {mark && !placeholder && (
                <Box
                  aria-hidden
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: isSelected ? colors.white : colors.primary,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default MonthCalendar;
export { toIso };
