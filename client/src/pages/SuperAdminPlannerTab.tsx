import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  ChevronLeft,
  ChevronRight,
  Delete,
  Edit,
  EventNote,
} from '@mui/icons-material';
import { apiService } from '../services/api';

type IntervalUnit = 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

interface PlannerEvent {
  id: string;
  title: string;
  notes?: string | null;
  startAt: string;
  allDay: boolean;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  seriesEndAt?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
}

interface Occurrence {
  occurrenceAt: string;
  event: PlannerEvent;
}

const UNIT_LABELS: Record<IntervalUnit, string> = {
  NONE: 'Разово',
  DAY: 'Дней',
  WEEK: 'Недель',
  MONTH: 'Месяцев',
  YEAR: 'Лет',
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateInputToIso(dateStr: string, allDay: boolean): string {
  if (allDay) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
  }
  return new Date(dateStr).toISOString();
}

function recurrenceLabel(ev: PlannerEvent): string {
  if (ev.intervalUnit === 'NONE') return 'Разово';
  const unit = UNIT_LABELS[ev.intervalUnit].toLowerCase();
  return `Каждые ${ev.intervalCount} ${unit}`;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Календарь супер-админа: разовые и повторяющиеся напоминания (аренда, домен и т.п.).
 */
const SuperAdminPlannerTab: React.FC = () => {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlannerEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('NONE');
  const [intervalCount, setIntervalCount] = useState(1);
  const [seriesEndDate, setSeriesEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();
      const data = await apiService.getPlannerEvents({ from, to });
      setOccurrences(data?.occurrences || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить события');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occ of occurrences) {
      const key = dayKey(occ.occurrenceAt);
      const list = map.get(key) || [];
      list.push(occ);
      map.set(key, list);
    }
    return map;
  }, [occurrences]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...occurrences]
      .filter((o) => new Date(o.occurrenceAt).getTime() >= now - 24 * 60 * 60 * 1000)
      .slice(0, 12);
  }, [occurrences]);

  const calendarCells = useMemo(() => {
    const first = startOfMonth(month);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = endOfMonth(month).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(month.getFullYear(), month.getMonth(), d) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [month]);

  const openCreate = (prefillDate?: Date) => {
    setEditing(null);
    setTitle('');
    setNotes('');
    const d = prefillDate || new Date();
    setStartDate(toDateInput(d.toISOString()));
    setAllDay(true);
    setIntervalUnit('NONE');
    setIntervalCount(1);
    setSeriesEndDate('');
    setDialogOpen(true);
  };

  const openEdit = (ev: PlannerEvent) => {
    setEditing(ev);
    setTitle(ev.title);
    setNotes(ev.notes || '');
    setStartDate(toDateInput(ev.startAt));
    setAllDay(ev.allDay);
    setIntervalUnit(ev.intervalUnit);
    setIntervalCount(ev.intervalCount || 1);
    setSeriesEndDate(ev.seriesEndAt ? toDateInput(ev.seriesEndAt) : '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        notes: notes.trim() || null,
        startAt: dateInputToIso(startDate, allDay),
        allDay,
        intervalUnit,
        intervalCount: intervalUnit === 'NONE' ? 1 : Math.max(1, intervalCount),
        seriesEndAt:
          intervalUnit === 'NONE' || !seriesEndDate
            ? null
            : dateInputToIso(seriesEndDate, true),
      };
      if (editing) {
        await apiService.updatePlannerEvent(editing.id, payload);
      } else {
        await apiService.createPlannerEvent(payload);
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: PlannerEvent) => {
    if (!window.confirm(`Удалить «${ev.title}»${ev.intervalUnit !== 'NONE' ? ' (всю серию)' : ''}?`)) {
      return;
    }
    try {
      await apiService.deletePlannerEvent(ev.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  const monthLabel = month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const todayKey = dayKey(new Date().toISOString());

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h5" fontWeight="bold" display="flex" alignItems="center" gap={1}>
          <EventNote /> Планировщик
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => openCreate()}>
          Событие
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Напоминания по платформе: аренда сервера, домен и т.п. Без сумм — только даты и заметки.
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <IconButton
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center', textTransform: 'capitalize' }}>
          {monthLabel}
        </Typography>
        <IconButton
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Следующий месяц"
        >
          <ChevronRight />
        </IconButton>
        <Button size="small" onClick={() => setMonth(startOfMonth(new Date()))}>
          Сегодня
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', md: '1fr 320px' }}
          gap={2}
        >
          <Paper sx={{ p: 1.5, overflow: 'auto' }}>
            <Box
              display="grid"
              gridTemplateColumns="repeat(7, 1fr)"
              gap={0.5}
              mb={0.5}
            >
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                <Typography
                  key={d}
                  variant="caption"
                  color="text.secondary"
                  textAlign="center"
                  fontWeight={600}
                >
                  {d}
                </Typography>
              ))}
            </Box>
            <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.5}>
              {calendarCells.map((cell, idx) => {
                if (!cell.date) {
                  return <Box key={`e-${idx}`} sx={{ minHeight: 88, bgcolor: 'action.hover', borderRadius: 1 }} />;
                }
                const key = dayKey(cell.date.toISOString());
                const dayOcc = byDay.get(key) || [];
                const isToday = key === todayKey;
                return (
                  <Box
                    key={key}
                    onClick={() => openCreate(cell.date!)}
                    sx={{
                      minHeight: 88,
                      p: 0.75,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: isToday ? 'primary.main' : 'divider',
                      bgcolor: isToday ? 'action.selected' : 'background.paper',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="caption" fontWeight={isToday ? 700 : 500}>
                      {cell.date.getDate()}
                    </Typography>
                    <Box mt={0.5} display="flex" flexDirection="column" gap={0.25}>
                      {dayOcc.slice(0, 3).map((occ) => (
                        <Chip
                          key={`${occ.event.id}-${occ.occurrenceAt}`}
                          size="small"
                          label={occ.event.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(occ.event);
                          }}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            maxWidth: '100%',
                            '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
                          }}
                        />
                      ))}
                      {dayOcc.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{dayOcc.length - 3}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1}>
              Ближайшие в этом месяце
            </Typography>
            {upcoming.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Нет событий
              </Typography>
            ) : (
              <Box display="flex" flexDirection="column" gap={1.5}>
                {upcoming.map((occ) => (
                  <Box
                    key={`${occ.event.id}-${occ.occurrenceAt}`}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      pb: 1,
                    }}
                  >
                    <Typography fontWeight={600} variant="body2">
                      {occ.event.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {new Date(occ.occurrenceAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' · '}
                      {recurrenceLabel(occ.event)}
                    </Typography>
                    {occ.event.notes && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        {occ.event.notes}
                      </Typography>
                    )}
                    <Box mt={0.5}>
                      <IconButton size="small" onClick={() => openEdit(occ.event)} title="Изменить">
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(occ.event)}
                        title="Удалить"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Редактировать событие' : 'Новое событие'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Заголовок"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Оплата аренды сервера"
          />
          <TextField
            margin="dense"
            label="Дата"
            type="date"
            fullWidth
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          <FormControlLabel
            control={<Switch checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />}
            label="Весь день"
            sx={{ mt: 1 }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Повтор</InputLabel>
            <Select
              label="Повтор"
              value={intervalUnit}
              onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
            >
              <MenuItem value="NONE">Разово</MenuItem>
              <MenuItem value="DAY">Каждые N дней</MenuItem>
              <MenuItem value="WEEK">Каждые N недель</MenuItem>
              <MenuItem value="MONTH">Каждые N месяцев</MenuItem>
              <MenuItem value="YEAR">Каждые N лет</MenuItem>
            </Select>
          </FormControl>
          {intervalUnit !== 'NONE' && (
            <>
              <TextField
                margin="dense"
                label={`Интервал (${UNIT_LABELS[intervalUnit].toLowerCase()})`}
                type="number"
                fullWidth
                inputProps={{ min: 1 }}
                value={intervalCount}
                onChange={(e) => setIntervalCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
              <TextField
                margin="dense"
                label="Конец серии (необязательно)"
                type="date"
                fullWidth
                value={seriesEndDate}
                onChange={(e) => setSeriesEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
          <TextField
            margin="dense"
            label="Заметки"
            fullWidth
            multiline
            minRows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          {editing && (
            <Button
              color="error"
              onClick={() => {
                setDialogOpen(false);
                void handleDelete(editing);
              }}
              disabled={saving}
              sx={{ mr: 'auto' }}
            >
              Удалить
            </Button>
          )}
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !title.trim() || !startDate}
          >
            {saving ? <CircularProgress size={22} /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuperAdminPlannerTab;
