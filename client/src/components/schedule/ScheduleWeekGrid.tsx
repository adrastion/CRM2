import React, { useMemo } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { colors, radii } from '../../theme/tokens';
import {
  CalendarItem,
  CalendarViewMode,
  GRID_END_HOUR,
  GRID_START_HOUR,
  HOUR_HEIGHT_PX,
} from './calendarTypes';

interface ScheduleWeekGridProps {
  selectedDate: Date;
  viewMode: CalendarViewMode;
  items: CalendarItem[];
  selectedItemId?: string | null;
  hideNavigation?: boolean;
  onSelectDate: (date: Date) => void;
  onSelectItem: (item: CalendarItem) => void;
  onNavigate: (delta: number) => void;
  onToday: () => void;
}

const WEEKDAY = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function layoutColumns(items: CalendarItem[]) {
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()
  );
  const colEnds: number[] = [];
  const placed = sorted.map((item) => {
    let col = colEnds.findIndex((end) => end <= item.start.getTime());
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.end.getTime());
    } else {
      colEnds[col] = item.end.getTime();
    }
    return { item, col };
  });
  const cols = Math.max(1, colEnds.length);
  return placed.map((p) => ({ ...p, cols }));
}

const hours = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, i) => GRID_START_HOUR + i
);

function clampBlock(start: Date, end: Date): { top: number; height: number } | null {
  const dayStart = new Date(start);
  dayStart.setHours(GRID_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(GRID_END_HOUR, 0, 0, 0);

  const s = Math.max(start.getTime(), dayStart.getTime());
  const e = Math.min(end.getTime(), dayEnd.getTime());
  if (e <= s) return null;

  const topMin = (s - dayStart.getTime()) / 60000;
  const heightMin = Math.max(30, (e - s) / 60000);
  return {
    top: (topMin / 60) * HOUR_HEIGHT_PX,
    height: (heightMin / 60) * HOUR_HEIGHT_PX,
  };
}

/** Неделя/день: фиксированная шкала 08:00–20:00, без схлопывания пустых часов. */
const ScheduleWeekGrid: React.FC<ScheduleWeekGridProps> = ({
  selectedDate,
  viewMode,
  items,
  selectedItemId,
  hideNavigation,
  onSelectDate,
  onSelectItem,
  onNavigate,
  onToday,
}) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const days =
    viewMode === 'day'
      ? [selectedDate]
      : eachDayOfInterval({ start: weekStart, end: weekEnd });

  const rangeLabel =
    viewMode === 'day'
      ? format(selectedDate, 'd MMMM yyyy, EEE', { locale: ru })
      : `${format(weekStart, 'd MMMM', { locale: ru })} — ${format(weekEnd, 'd MMMM yyyy', {
          locale: ru,
        })}`;

  const allDayByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    days.forEach((d) => map.set(format(d, 'yyyy-MM-dd'), []));
    items
      .filter((i) => i.allDay)
      .forEach((item) => {
        days.forEach((d) => {
          if (
            isSameDay(d, item.start) ||
            (item.start <= d && item.end >= d)
          ) {
            const key = format(d, 'yyyy-MM-dd');
            map.get(key)?.push(item);
          }
        });
      });
    return map;
  }, [days, items]);

  const timedByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    days.forEach((d) => map.set(format(d, 'yyyy-MM-dd'), []));
    items
      .filter((i) => !i.allDay)
      .forEach((item) => {
        const key = format(item.start, 'yyyy-MM-dd');
        if (map.has(key)) map.get(key)!.push(item);
      });
    return map;
  }, [days, items]);

  const gridHeight = hours.length * HOUR_HEIGHT_PX;
  const hasAllDay = items.some((item) => item.allDay);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
      {!hideNavigation && (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          mb: 1.5,
        }}
      >
        <IconButton
          size="small"
          onClick={() => onNavigate(-1)}
          sx={{ bgcolor: colors.surface, borderRadius: `${radii.button}px` }}
        >
          <ChevronLeft />
        </IconButton>
        <Button
          size="small"
          onClick={onToday}
          sx={{ textTransform: 'none', fontWeight: 600, color: colors.primary }}
        >
          Сегодня
        </Button>
        <Typography sx={{ fontWeight: 700, fontSize: 15, minWidth: 220, textAlign: 'center' }}>
          {rangeLabel}
        </Typography>
        <IconButton
          size="small"
          onClick={() => onNavigate(1)}
          sx={{ bgcolor: colors.surface, borderRadius: `${radii.button}px` }}
        >
          <ChevronRight />
        </IconButton>
      </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          border: `1px solid ${colors.divider}`,
          borderRadius: `${radii.panel}px`,
          overflow: 'hidden',
          bgcolor: colors.card,
        }}
      >
        {/* Time axis */}
        <Box sx={{ width: 56, flexShrink: 0, borderRight: `1px solid #EEF1F6` }}>
          <Box
            sx={{
              height: 52,
              borderBottom: `1px solid #EEF1F6`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: colors.textHint }}>Время</Typography>
          </Box>
          {hasAllDay && <Box sx={{ minHeight: 28, borderBottom: `1px solid #EEF1F6` }} />}
          {hours.map((h) => (
            <Box
              key={h}
              sx={{
                height: HOUR_HEIGHT_PX,
                borderBottom: `1px solid ${colors.divider}`,
                pr: 1,
                display: 'flex',
                justifyContent: 'flex-end',
                pt: 0.5,
              }}
            >
              <Typography sx={{ fontSize: 11, color: colors.textHint, fontWeight: 600 }}>
                {h}:00
              </Typography>
            </Box>
          ))}
        </Box>

        {days.map((day, dayIndex) => {
          const isToday = isSameDay(day, new Date());
          const key = format(day, 'yyyy-MM-dd');
          const dayAllDay = allDayByDay.get(key) || [];
          const dayTimed = timedByDay.get(key) || [];

          return (
            <Box
              key={key}
              sx={{
                flex: 1,
                minWidth: viewMode === 'day' ? 0 : 110,
                borderRight: dayIndex < days.length - 1 ? `1px solid ${colors.divider}` : 0,
                bgcolor: isToday ? '#F4F7FF' : colors.card,
              }}
            >
              <Box
                onClick={() => onSelectDate(day)}
                sx={{
                  height: 52,
                  borderBottom: `1px solid ${colors.divider}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  bgcolor: isToday ? '#EAF0FF' : colors.card,
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: isToday ? colors.primary : colors.text, lineHeight: 1.1 }}>
                  {WEEKDAY[day.getDay()]}
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: isToday ? colors.primary : colors.textMuted }}>
                  {day.getDate()} {MONTH_SHORT[day.getMonth()]}
                </Typography>
              </Box>

              {hasAllDay && (
              <Box
                sx={{
                  minHeight: 28,
                  borderBottom: `1px solid #EEF1F6`,
                  px: 0.5,
                  py: 0.25,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                }}
              >
                {dayAllDay.map((item) => (
                  <Box
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    sx={{
                      bgcolor: item.color,
                      color: '#fff',
                      borderRadius: '4px',
                      px: 0.5,
                      py: 0.15,
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      outline: selectedItemId === item.id ? `2px solid ${colors.text}` : 'none',
                    }}
                  >
                    {item.title}
                  </Box>
                ))}
              </Box>
              )}

              <Box sx={{ position: 'relative', height: gridHeight }}>
                {hours.map((h) => (
                  <Box
                    key={h}
                    sx={{
                      height: HOUR_HEIGHT_PX,
                      borderBottom: `1px solid ${colors.divider}`,
                    }}
                  />
                ))}

                {layoutColumns(dayTimed).map(({ item, col, cols }) => {
                  const box = clampBlock(item.start, item.end);
                  if (!box) return null;
                  const width = `calc((100% - 6px) / ${cols})`;
                  const left = `calc(3px + ${col} * (100% - 6px) / ${cols})`;
                  const lines = item.lines?.length ? item.lines : [item.subtitle, item.meta].filter(Boolean);
                  return (
                    <Box
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      sx={{
                        position: 'absolute',
                        left,
                        width,
                        top: box.top + 2,
                        height: Math.max(28, box.height - 4),
                        bgcolor: item.color,
                        color: '#fff',
                        borderRadius: '10px',
                        px: 0.75,
                        py: 0.5,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        boxShadow:
                          selectedItemId === item.id
                            ? '0 0 0 2px #202224'
                            : '0 2px 6px rgba(32,34,36,0.12)',
                        zIndex: selectedItemId === item.id ? 3 : 1,
                        '&:hover': { filter: 'brightness(1.06)', zIndex: 4 },
                      }}
                    >
                      <Typography sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1.15 }} noWrap>
                        {item.title}
                      </Typography>
                      {lines.slice(0, box.height > 70 ? 3 : 2).map((line, lineIndex) => (
                        <Typography key={`${item.id}-${lineIndex}`} sx={{ fontSize: 10, lineHeight: 1.2, opacity: 0.95 }} noWrap>
                          {line}
                        </Typography>
                      ))}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ScheduleWeekGrid;

export function navigateCalendarDate(
  date: Date,
  viewMode: CalendarViewMode,
  delta: number
): Date {
  if (viewMode === 'day') return addDays(date, delta);
  if (viewMode === 'month') {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
  }
  return addDays(date, delta * 7);
}
