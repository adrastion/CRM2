import React, { useMemo } from 'react';
import {
  Add,
  CalendarMonthOutlined,
  ChevronLeft,
  ChevronRight,
  EmojiEvents,
  EventNote,
  FitnessCenter,
  KeyboardArrowDown,
  TaskAlt,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  Menu,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import MonthCalendar, { CalendarDayMark, toIso } from '../dashboard/MonthCalendar';
import { Branch, Competition, Group, Hall, Trainer, Training } from '../../types';
import { colors, radii } from '../../theme/tokens';
import { buildCalendarItems } from './calendarAdapter';
import {
  CALENDAR_LAYER_COLORS,
  CalendarItem,
  CalendarViewMode,
  ScheduleLayers,
  ScheduleSummaryCounts,
} from './calendarTypes';
import { SchoolEventLike, StaffTaskLike } from './calendarTypes';
import ScheduleEventDrawer from './ScheduleEventDrawer';
import ScheduleWeekGrid, { navigateCalendarDate } from './ScheduleWeekGrid';

interface ScheduleDesktopProps {
  selectedDate: Date;
  viewMode: CalendarViewMode;
  sectionTab: 'schedule' | 'competitions';
  layers: ScheduleLayers;
  filters: {
    branchId: string;
    hallId: string;
    trainerId: string;
    groupId: string;
  };
  summary: ScheduleSummaryCounts | null;
  trainings: Training[];
  competitions: Competition[];
  events: SchoolEventLike[];
  tasks: StaffTaskLike[];
  branches: Branch[];
  halls: Hall[];
  trainers: Trainer[];
  groups: Group[];
  staffTaskColor?: string;
  selectedItem: CalendarItem | null;
  staffUsers: Array<{ id: string; firstName: string; lastName: string }>;
  createMenuAnchor: HTMLElement | null;
  onCreateMenuOpen: (el: HTMLElement) => void;
  onCreateMenuClose: () => void;
  onCreateTraining: () => void;
  onCreateEvent: () => void;
  onCreateTask: () => void;
  onSectionTabChange: (tab: 'schedule' | 'competitions') => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onSelectedDateChange: (date: Date) => void;
  onLayersChange: (layers: ScheduleLayers) => void;
  onFiltersChange: (filters: ScheduleDesktopProps['filters']) => void;
  onSelectItem: (item: CalendarItem | null) => void;
  onEditItem: (item: CalendarItem) => void;
  onCopyItem: (item: CalendarItem) => void;
  onDeleteItem: (item: CalendarItem) => void;
  onRefresh?: () => void;
  competitionsPanel?: React.ReactNode;
}

const KPI_META = [
  {
    key: 'trainings' as const,
    label: 'Тренировки',
    color: CALENDAR_LAYER_COLORS.training,
    icon: FitnessCenter,
  },
  {
    key: 'competitions' as const,
    label: 'Соревнования',
    color: CALENDAR_LAYER_COLORS.competition,
    icon: EmojiEvents,
  },
  {
    key: 'tasks' as const,
    label: 'Задачи',
    color: CALENDAR_LAYER_COLORS.task,
    icon: TaskAlt,
  },
  {
    key: 'events' as const,
    label: 'События',
    color: CALENDAR_LAYER_COLORS.event,
    icon: EventNote,
  },
];

const ScheduleDesktop: React.FC<ScheduleDesktopProps> = (props) => {
  const {
    selectedDate,
    viewMode,
    sectionTab,
    layers,
    filters,
    summary,
    trainings,
    competitions,
    events,
    tasks,
    branches,
    halls,
    trainers,
    groups,
    staffTaskColor,
    selectedItem,
    staffUsers,
    createMenuAnchor,
    onCreateMenuOpen,
    onCreateMenuClose,
    onCreateTraining,
    onCreateEvent,
    onCreateTask,
    onSectionTabChange,
    onViewModeChange,
    onSelectedDateChange,
    onLayersChange,
    onFiltersChange,
    onSelectItem,
    onEditItem,
    onCopyItem,
    onDeleteItem,
    onRefresh,
    competitionsPanel,
  } = props;

  const items = useMemo(
    () =>
      buildCalendarItems({
        trainings,
        competitions,
        events,
        tasks,
        layers,
        taskColor: staffTaskColor,
        filters,
      }),
    [trainings, competitions, events, tasks, layers, staffTaskColor, filters]
  );

  const monthMarks: CalendarDayMark[] = useMemo(() => {
    const marks: CalendarDayMark[] = [];
    items.forEach((item) => {
      const d = new Date(item.start);
      const end = new Date(item.end);
      const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cur <= last) {
        marks.push({ date: toIso(cur), color: item.color });
        cur.setDate(cur.getDate() + 1);
      }
    });
    return marks;
  }, [items]);

  const kpi = summary || {
    trainings: { count: 0, delta: 0 },
    competitions: { count: 0, delta: 0 },
    tasks: { count: 0, delta: 0 },
    events: { count: 0, delta: 0 },
  };

  return (
    <Box data-onboarding="schedule-desktop">
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
          gap: 2,
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{ fontWeight: 800, fontSize: { xs: 22, md: 26 }, color: '#1B2438', letterSpacing: '-0.02em', lineHeight: 1.2 }}
          >
            Календарный план
          </Typography>
          <Typography sx={{ fontSize: 13, color: colors.textMuted, mt: 0.5, maxWidth: 720 }}>
            Все тренировки, соревнования, задачи и события в едином расписании. Планируйте, контролируйте и не упускайте важное.
          </Typography>
        </Box>
        <Button
          variant="contained"
          data-onboarding="schedule-create-button"
          onClick={(e) => onCreateMenuOpen(e.currentTarget)}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '12px',
            bgcolor: colors.primary,
            boxShadow: 'none',
            height: 42,
            pl: 1.5,
            pr: 1.25,
            gap: 0.5,
            '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
          }}
        >
          <Add sx={{ fontSize: 18 }} />
          Создать
          <Box sx={{ width: '1px', height: 18, bgcolor: 'rgba(255,255,255,0.35)', mx: 0.5 }} />
          <KeyboardArrowDown sx={{ fontSize: 18 }} />
        </Button>
        <Menu
          anchorEl={createMenuAnchor}
          open={Boolean(createMenuAnchor)}
          onClose={onCreateMenuClose}
        >
          <MenuItem
            onClick={() => {
              onCreateMenuClose();
              onCreateTraining();
            }}
          >
            Тренировка
          </MenuItem>
          <MenuItem
            onClick={() => {
              onCreateMenuClose();
              onCreateEvent();
            }}
          >
            Событие
          </MenuItem>
          <MenuItem
            onClick={() => {
              onCreateMenuClose();
              onCreateTask();
            }}
          >
            Задача
          </MenuItem>
        </Menu>
      </Box>

      {/* KPI */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 1.5,
          mb: 2,
        }}
      >
        {KPI_META.map((card) => {
          const stat = kpi[card.key];
          const color = card.key === 'tasks' ? staffTaskColor || card.color : card.color;
          const Icon = card.icon;
          const up = stat.delta >= 0;
          return (
            <Box
              key={card.key}
              sx={{
                bgcolor: colors.card,
                borderRadius: '16px',
                boxShadow: '0 6px 20px rgba(32, 34, 36, 0.05)',
                border: '1px solid #EEF1F6',
                px: 1.75,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                minHeight: 108,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: `${color}18`,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>
                  {card.label}
                </Typography>
                <Typography sx={{ fontSize: 11, color: colors.textHint, mb: 0.4 }}>
                  на этой неделе
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: colors.text }}>
                    {stat.count}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: stat.delta === 0 ? colors.textHint : up ? '#16A34A' : colors.danger,
                    }}
                  >
                    {stat.delta > 0 ? '+' : ''}
                    {stat.delta}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 10, color: colors.textHint, mt: 0.35 }}>
                  по сравнению с прошлой неделей
                </Typography>
              </Box>
              <BarSpark color={color} up={up} />
            </Box>
          );
        })}
      </Box>

      {/* Tabs + layers + view mode */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 1.25,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {(
            [
              ['schedule', 'Расписание', <CalendarMonthOutlined key="c" sx={{ fontSize: 18 }} />],
              ['competitions', 'Соревнования', <EmojiEvents key="e" sx={{ fontSize: 18 }} />],
            ] as const
          ).map(([value, label, icon]) => {
            const active = sectionTab === value;
            return (
              <Button
                key={value}
                data-onboarding={value === 'competitions' ? 'schedule-competitions-tab' : undefined}
                onClick={() => onSectionTabChange(value)}
                startIcon={icon}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: '12px',
                  px: 1.5,
                  height: 36,
                  bgcolor: active ? colors.primary : colors.card,
                  color: active ? '#fff' : colors.text,
                  border: `1px solid ${active ? colors.primary : '#E6E8EF'}`,
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: active ? colors.primaryDark : colors.surface,
                    boxShadow: 'none',
                  },
                }}
              >
                {label}
              </Button>
            );
          })}
        </Box>

        {sectionTab === 'schedule' && <Box sx={{ flex: 1 }} />}

        {sectionTab === 'schedule' && (
        <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap' }}>
          {(
            [
              ['trainings', 'Тренировки', CALENDAR_LAYER_COLORS.training],
              ['competitions', 'Соревнования', CALENDAR_LAYER_COLORS.competition],
              ['tasks', 'Задачи', staffTaskColor || CALENDAR_LAYER_COLORS.task],
              ['events', 'События', CALENDAR_LAYER_COLORS.event],
            ] as const
          ).map(([key, label, color]) => (
            <Box
              key={key}
              component="label"
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 0.5 }}
            >
              <Checkbox
                size="small"
                checked={layers[key]}
                onChange={(e) => onLayersChange({ ...layers, [key]: e.target.checked })}
                sx={{
                  p: 0.4,
                  color,
                  '&.Mui-checked': { color },
                }}
              />
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(
            [
              ['day', 'День'],
              ['week', 'Неделя'],
              ['month', 'Месяц'],
            ] as const
          ).map(([value, label]) => {
            const active = viewMode === value;
            return (
              <Button
                key={value}
                onClick={() => onViewModeChange(value)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  minWidth: 0,
                  height: 34,
                  px: 1.5,
                  borderRadius: '10px',
                  bgcolor: active ? colors.primary : colors.card,
                  color: active ? '#fff' : colors.text,
                  border: `1px solid ${active ? colors.primary : '#E6E8EF'}`,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: active ? colors.primaryDark : colors.surface, boxShadow: 'none' },
                }}
              >
                {label}
              </Button>
            );
          })}
        </Box>
        </>
        )}
      </Box>

      {sectionTab === 'competitions' ? (
        competitionsPanel
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1.25,
              flexWrap: 'wrap',
            }}
          >
            <FilterSelect
              caption="Филиал"
              empty="Все филиалы"
              value={filters.branchId}
              onChange={(branchId) => onFiltersChange({ ...filters, branchId, hallId: '' })}
              options={branches.map((b) => ({ id: b.id, label: b.name }))}
            />
            <FilterSelect
              caption="Зал"
              empty="Все залы"
              value={filters.hallId}
              onChange={(hallId) => onFiltersChange({ ...filters, hallId })}
              options={halls
                .filter((h) => h.isActive && (!filters.branchId || h.branchId === filters.branchId))
                .map((h) => ({ id: h.id, label: h.name }))}
            />
            <FilterSelect
              caption="Тренер"
              empty="Все тренеры"
              value={filters.trainerId}
              onChange={(trainerId) => onFiltersChange({ ...filters, trainerId })}
              options={trainers.map((t) => ({
                id: t.id,
                label: t.user
                  ? `${t.user.lastName} ${t.user.firstName.charAt(0)}.`
                  : `Тренер #${t.id}`,
              }))}
            />
            <FilterSelect
              caption="Группа"
              empty="Все группы"
              value={filters.groupId}
              onChange={(groupId) => onFiltersChange({ ...filters, groupId })}
              options={groups.map((g) => ({ id: g.id, label: g.name }))}
            />

            {viewMode !== 'month' && (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.75, minWidth: 280 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.text }}>
                  {rangeTitle(selectedDate, viewMode)}
                </Typography>
                <NavIcon onClick={() => onSelectedDateChange(navigateCalendarDate(selectedDate, viewMode, -1))}>
                  <ChevronLeft fontSize="small" />
                </NavIcon>
                <Button
                  onClick={() => onSelectedDateChange(new Date())}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    height: 34,
                    borderRadius: '10px',
                    color: colors.text,
                    border: '1px solid #E6E8EF',
                    bgcolor: colors.card,
                    px: 1.5,
                    minWidth: 0,
                  }}
                >
                  Сегодня
                </Button>
                <NavIcon onClick={() => onSelectedDateChange(navigateCalendarDate(selectedDate, viewMode, 1))}>
                  <ChevronRight fontSize="small" />
                </NavIcon>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {viewMode === 'month' ? (
                <Box
                  sx={{
                    bgcolor: colors.card,
                    border: `1px solid ${colors.divider}`,
                    borderRadius: `${radii.panel}px`,
                    p: 2,
                  }}
                >
                  <MonthCalendar
                    month={selectedDate}
                    onMonthChange={onSelectedDateChange}
                    marks={monthMarks}
                    selected={toIso(selectedDate)}
                    onSelect={(iso) => {
                      const [y, m, d] = iso.split('-').map(Number);
                      onSelectedDateChange(new Date(y, m - 1, d));
                      onViewModeChange('day');
                    }}
                    multiColor
                  />
                </Box>
              ) : (
                <ScheduleWeekGrid
                  selectedDate={selectedDate}
                  viewMode={viewMode}
                  items={items}
                  selectedItemId={selectedItem?.id}
                  hideNavigation
                  onSelectDate={onSelectedDateChange}
                  onSelectItem={onSelectItem}
                  onNavigate={(delta) =>
                    onSelectedDateChange(navigateCalendarDate(selectedDate, viewMode, delta))
                  }
                  onToday={() => onSelectedDateChange(new Date())}
                />
              )}
            </Box>

            {selectedItem && (
              <ScheduleEventDrawer
                open={Boolean(selectedItem)}
                item={selectedItem}
                onClose={() => onSelectItem(null)}
                onEdit={onEditItem}
                onCopy={onCopyItem}
                onDelete={onDeleteItem}
                staffUsers={staffUsers}
                onRefresh={onRefresh}
              />
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export function getScheduleRange(selectedDate: Date, viewMode: CalendarViewMode) {
  if (viewMode === 'day') {
    const from = new Date(selectedDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(selectedDate);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (viewMode === 'month') {
    const from = startOfMonth(selectedDate);
    from.setHours(0, 0, 0, 0);
    const to = endOfMonth(selectedDate);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  const from = startOfWeek(selectedDate, { weekStartsOn: 1 });
  from.setHours(0, 0, 0, 0);
  const to = endOfWeek(selectedDate, { weekStartsOn: 1 });
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/** 7-day window for KPI (aligned to selected week). */
export function getSummaryRange(selectedDate: Date) {
  const from = startOfWeek(selectedDate, { weekStartsOn: 1 });
  from.setHours(0, 0, 0, 0);
  const to = endOfWeek(selectedDate, { weekStartsOn: 1 });
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function rangeTitle(selectedDate: Date, viewMode: CalendarViewMode) {
  if (viewMode === 'day') {
    return format(selectedDate, 'd MMMM yyyy', { locale: ru });
  }
  const from = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const to = endOfWeek(selectedDate, { weekStartsOn: 1 });
  return `${format(from, 'd MMMM', { locale: ru })} — ${format(to, 'd MMMM yyyy', { locale: ru })}`;
}

const FilterSelect: React.FC<{
  caption: string;
  empty: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}> = ({ caption, empty, value, onChange, options }) => {
  const current = options.find((o) => o.id === value);
  return (
    <FormControl size="small" sx={{ minWidth: 148 }}>
      <Select
        displayEmpty
        value={value}
        onChange={(e) => onChange(String(e.target.value))}
        renderValue={() => (
          <Box sx={{ lineHeight: 1.05, py: 0.15 }}>
            <Typography sx={{ fontSize: 10, color: colors.textHint }}>{caption}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
              {current?.label || empty}
            </Typography>
          </Box>
        )}
        sx={{
          height: 46,
          borderRadius: '12px',
          bgcolor: colors.card,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E6E8EF' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#D5D8E0' },
        }}
      >
        <MenuItem value="">{empty}</MenuItem>
        {options.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const NavIcon: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      width: 34,
      height: 34,
      borderRadius: '10px',
      border: '1px solid #E6E8EF',
      bgcolor: colors.card,
      color: colors.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    }}
  >
    {children}
  </Box>
);

const BarSpark: React.FC<{ color: string; up: boolean }> = ({ color, up }) => {
  const heights = up ? [8, 12, 9, 15, 13, 18, 16, 24] : [24, 18, 20, 14, 16, 11, 13, 8];
  return (
    <Box aria-hidden sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 28, flexShrink: 0 }}>
      {heights.map((h, i) => (
        <Box
          key={i}
          sx={{
            width: 5,
            height: h,
            borderRadius: '2px',
            bgcolor: color,
            opacity: 0.28 + (i / (heights.length - 1)) * 0.72,
          }}
        />
      ))}
    </Box>
  );
};

export default ScheduleDesktop;
