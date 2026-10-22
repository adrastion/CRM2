import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessTime,
  Business,
  CalendarToday,
  CheckCircle,
  ContentCopy,
  DeleteOutline,
  Edit,
  Groups,
  LocationOn,
  MoreHoriz,
  Person,
  NoteAdd,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { Attendance, CalendarNote, Client, Training } from '../../types';
import { colors, radii } from '../../theme/tokens';
import { CalendarItem, CALENDAR_LAYER_COLORS } from './calendarTypes';
import { SchoolEventLike, StaffTaskLike } from './calendarTypes';

type AttStatus = 'PRESENT' | 'WAITING' | 'ABSENT' | 'EXCUSED';

const STATUS_META: Record<
  AttStatus,
  { label: string; bg: string; fg: string }
> = {
  PRESENT: { label: 'Присутствует', bg: '#E6F7F3', fg: '#00B69B' },
  WAITING: { label: 'Ожидает', bg: '#FFF4E5', fg: '#ED6C02' },
  ABSENT: { label: 'Отсутствует', bg: '#FDE8EE', fg: '#F93C65' },
  EXCUSED: { label: 'Уважит.', bg: '#EEF2FF', fg: '#5C6BC0' },
};

interface ParticipantRow {
  client: Client;
  attendance: Attendance | null;
}

interface ScheduleEventDrawerProps {
  item: CalendarItem | null;
  open: boolean;
  onClose: () => void;
  onEdit: (item: CalendarItem) => void;
  onCopy: (item: CalendarItem) => void;
  onDelete: (item: CalendarItem) => void;
  staffUsers?: Array<{ id: string; firstName: string; lastName: string }>;
  onRefresh?: () => void;
}

const typeLabel = (t: CalendarItem['type']) => {
  if (t === 'training') return 'Тренировка';
  if (t === 'competition') return 'Соревнование';
  if (t === 'task') return 'Задача';
  return 'Событие';
};

const ScheduleEventDrawer: React.FC<ScheduleEventDrawerProps> = ({
  item,
  open,
  onClose,
  onEdit,
  onCopy,
  onDelete,
  staffUsers = [],
  onRefresh,
}) => {
  const [tab, setTab] = useState(0);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState<StaffTaskLike[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showAllParticipants, setShowAllParticipants] = useState(false);

  const training = item?.type === 'training' ? (item.source as Training) : null;
  const event = item?.type === 'event' ? (item.source as SchoolEventLike) : null;
  const task = item?.type === 'task' ? (item.source as StaffTaskLike) : null;

  const loadParticipants = useCallback(async () => {
    if (!training) {
      setParticipants([]);
      return;
    }
    setLoadingParticipants(true);
    try {
      const res = await apiService.getAttendancesByTraining(training.id);
      setParticipants(res?.clients || []);
    } catch {
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  }, [training]);

  const loadTasks = useCallback(async () => {
    if (!item) return;
    try {
      if (item.type === 'training') {
        const list = await apiService.listStaffTasks({
          relatedTrainingId: (item.source as Training).id,
        });
        setRelatedTasks(Array.isArray(list) ? list : []);
      } else if (item.type === 'event') {
        const list = await apiService.listStaffTasks({
          relatedSchoolEventId: (item.source as SchoolEventLike).id,
        });
        setRelatedTasks(Array.isArray(list) ? list : []);
      } else {
        setRelatedTasks([]);
      }
    } catch {
      setRelatedTasks([]);
    }
  }, [item]);

  const loadNotes = useCallback(async () => {
    if (!item) return;
    try {
      const params =
        item.type === 'training'
          ? { trainingId: (item.source as Training).id }
          : item.type === 'event'
            ? { schoolEventId: (item.source as SchoolEventLike).id }
            : item.type === 'competition'
              ? { competitionId: (item.source as { id: string }).id }
              : null;
      if (!params) {
        setNotes([]);
        return;
      }
      const list = await apiService.listCalendarNotes(params);
      setNotes(Array.isArray(list) ? list : []);
    } catch {
      setNotes([]);
    }
  }, [item]);

  useEffect(() => {
    setTab(0);
    setNoteDraft('');
    setTaskTitle('');
    setShowAllParticipants(false);
    if (open && item) {
      void loadParticipants();
      void loadTasks();
      void loadNotes();
    }
  }, [open, item, loadParticipants, loadTasks, loadNotes]);

  if (!open || !item) return null;

  const occupancy = training?.occupancy;
  const enrolled = occupancy?.enrolled ?? participants.length;
  const capacity = occupancy?.capacity;
  const progress =
    capacity && capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;

  const setStatus = async (clientId: string, status: AttStatus) => {
    if (!training) return;
    setSavingAttendance(true);
    try {
      const payload = participants.map((row) => ({
        clientId: row.client.id,
        status:
          row.client.id === clientId
            ? status
            : ((row.attendance?.status as AttStatus) || 'WAITING'),
        shouldCharge: row.attendance?.shouldCharge ?? false,
        notes: row.attendance?.notes,
      }));
      await apiService.bulkUpdateAttendance(training.id, payload);
      await loadParticipants();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAttendance(false);
    }
  };

  const createRelatedTask = async () => {
    if (!taskTitle.trim() || !taskAssigneeId) return;
    try {
      const due = item.start.toISOString();
      await apiService.createStaffTask({
        title: taskTitle.trim(),
        body: '',
        dueAt: due,
        assigneeIds: [taskAssigneeId],
        relatedTrainingId: training?.id || null,
        relatedSchoolEventId: event?.id || null,
      });
      setTaskTitle('');
      await loadTasks();
      onRefresh?.();
    } catch (e) {
      console.error(e);
    }
  };

  const createNote = async () => {
    if (!noteDraft.trim()) return;
    try {
      await apiService.createCalendarNote({
        body: noteDraft.trim(),
        trainingId: training?.id,
        schoolEventId: event?.id,
        competitionId: item.type === 'competition' ? item.source.id : undefined,
      });
      setNoteDraft('');
      await loadNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await apiService.deleteCalendarNote(id);
      await loadNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const showParticipants = item.type === 'training';
  const showTasks = item.type === 'training' || item.type === 'event';
  const showNotes = item.type !== 'task';

  const tabDefs = [
    showParticipants ? 'Участники' : null,
    showTasks ? 'Задачи' : null,
    showNotes ? 'Заметки' : null,
  ].filter(Boolean) as string[];

  const activeTabName = tabDefs[tab] || tabDefs[0];

  return (
    <Box
        sx={{
        width: { md: 320, lg: 360 },
        flexShrink: 0,
        border: '1px solid #EEF1F6',
        bgcolor: colors.card,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 160px)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(32, 34, 36, 0.06)',
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${colors.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: colors.text, lineHeight: 1.2 }}>
              {item.title}
            </Typography>
            <Chip
              size="small"
              label={typeLabel(item.type)}
              sx={{
                mt: 0.75,
                height: 22,
                fontWeight: 600,
                bgcolor: `${item.color}22`,
                color: item.color,
              }}
            />
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Закрыть">
            ×
          </IconButton>
        </Box>

        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.85 }}>
          <MetaRow
            icon={<CalendarToday sx={{ fontSize: 16 }} />}
            text={format(item.start, 'EEEE, d MMMM yyyy', { locale: ru })}
          />
          <MetaRow
            icon={<AccessTime sx={{ fontSize: 16 }} />}
            text={
              item.allDay
                ? 'Весь день'
                : `${format(item.start, 'HH:mm')} – ${format(item.end, 'HH:mm')} (${formatDuration(item.start, item.end)})`
            }
          />
          {(training?.hall?.name || event?.location) && (
            <MetaRow
              icon={<LocationOn sx={{ fontSize: 16 }} />}
              text={training?.hall?.name || event?.location || ''}
            />
          )}
          {training?.branch?.name && (
            <MetaRow icon={<Business sx={{ fontSize: 16 }} />} text={training.branch.name} />
          )}
          {training?.trainer?.user && (
            <MetaRow
              icon={<Person sx={{ fontSize: 16 }} />}
              text={`${training.trainer.user.lastName} ${training.trainer.user.firstName}`}
              hint="Тренер"
            />
          )}
          {training?.group?.name && (
            <MetaRow
              icon={<Groups sx={{ fontSize: 16 }} />}
              text={training.group.name}
              hint="Группа"
            />
          )}
          {task?.status && (
            <MetaRow icon={<Person sx={{ fontSize: 16 }} />} text={`Статус: ${task.status}`} />
          )}
        </Box>

        {training && capacity != null && (
          <Box sx={{ mt: 1.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
                {enrolled} из {capacity} мест занято
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: colors.primary }}>
                {progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: '#E8EEF9',
                '& .MuiLinearProgress-bar': { bgcolor: CALENDAR_LAYER_COLORS.training, borderRadius: 4 },
              }}
            />
          </Box>
        )}
      </Box>

      {tabDefs.length > 0 && (
        <Tabs
          value={Math.min(tab, tabDefs.length - 1)}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            borderBottom: `1px solid ${colors.divider}`,
          }}
        >
          {tabDefs.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>
      )}

      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {activeTabName === 'Участники' && (
          <>
            {loadingParticipants ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : participants.length === 0 ? (
              <Typography sx={{ color: colors.textHint, fontSize: 13, py: 2 }}>
                Нет участников
              </Typography>
            ) : (
              <>
              {(showAllParticipants ? participants : participants.slice(0, 5)).map((row) => {
                const status = (row.attendance?.status as AttStatus) || 'WAITING';
                const meta = STATUS_META[status] || STATUS_META.WAITING;
                return (
                  <Box
                    key={row.client.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.7,
                    }}
                  >
                    <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: '#E8EEF9', color: colors.primary }}>
                      {(row.client.lastName?.[0] || '') + (row.client.firstName?.[0] || '')}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                        {row.client.lastName} {row.client.firstName}
                      </Typography>
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      disabled={savingAttendance}
                      onClick={() => {
                        const cycle: AttStatus[] = ['WAITING', 'PRESENT', 'ABSENT', 'EXCUSED'];
                        const idx = cycle.indexOf(status);
                        void setStatus(row.client.id, cycle[(idx + 1) % cycle.length]);
                      }}
                      sx={{
                        border: 0,
                        bgcolor: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.4,
                        cursor: 'pointer',
                        color: meta.fg,
                        fontWeight: 700,
                        fontSize: 12,
                        fontFamily: 'inherit',
                      }}
                    >
                      <CheckCircle sx={{ fontSize: 14 }} />
                      {meta.label}
                    </Box>
                  </Box>
                );
              })}
              {participants.length > 5 && (
                <Button
                  fullWidth
                  onClick={() => setShowAllParticipants((v) => !v)}
                  sx={{ textTransform: 'none', fontWeight: 700, mt: 0.5, color: colors.primary }}
                >
                  {showAllParticipants
                    ? 'Свернуть список'
                    : `Показать всех участников (${participants.length})`}
                </Button>
              )}
              </>
            )}
          </>
        )}

        {activeTabName === 'Задачи' && (
          <Box>
            {relatedTasks.map((t) => (
              <Box
                key={t.id}
                sx={{
                  p: 1,
                  mb: 1,
                  borderRadius: `${radii.button}px`,
                  bgcolor: colors.surface,
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t.title}</Typography>
                <Typography sx={{ fontSize: 11, color: colors.textMuted }}>
                  {t.status}
                  {t.dueAt ? ` · ${format(new Date(t.dueAt), 'd MMM HH:mm', { locale: ru })}` : ''}
                </Typography>
              </Box>
            ))}
            <TextField
              size="small"
              fullWidth
              placeholder="Новая задача"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              sx={{ mb: 1, mt: 1 }}
            />
            <TextField
              select
              size="small"
              fullWidth
              label="Исполнитель"
              value={taskAssigneeId}
              onChange={(e) => setTaskAssigneeId(e.target.value)}
              sx={{ mb: 1 }}
            >
              {staffUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.lastName} {u.firstName}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              variant="contained"
              fullWidth
              onClick={() => void createRelatedTask()}
              sx={{ textTransform: 'none', bgcolor: colors.primary }}
            >
              Добавить задачу
            </Button>
          </Box>
        )}

        {activeTabName === 'Заметки' && (
          <Box>
            {notes.map((n) => (
              <Box
                key={n.id}
                sx={{
                  p: 1,
                  mb: 1,
                  borderRadius: `${radii.button}px`,
                  bgcolor: colors.surface,
                  position: 'relative',
                }}
              >
                <Typography sx={{ fontSize: 13, pr: 3 }}>{n.body}</Typography>
                <Typography sx={{ fontSize: 10, color: colors.textHint, mt: 0.5 }}>
                  {n.createdBy
                    ? `${n.createdBy.lastName} ${n.createdBy.firstName}`
                    : ''}
                  {n.createdAt
                    ? ` · ${format(new Date(n.createdAt), 'd MMM HH:mm', { locale: ru })}`
                    : ''}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => void deleteNote(n.id)}
                  sx={{ position: 'absolute', top: 2, right: 2 }}
                >
                  <DeleteOutline sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="Новая заметка"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<NoteAdd />}
              fullWidth
              onClick={() => void createNote()}
              sx={{ textTransform: 'none' }}
            >
              Сохранить заметку
            </Button>
          </Box>
        )}

        {item.type === 'task' && (
          <Box sx={{ py: 1 }}>
            <Typography sx={{ fontSize: 13, color: colors.textMuted, whiteSpace: 'pre-wrap' }}>
              {(item.source as StaffTaskLike).body || 'Нет описания'}
            </Typography>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          p: 1.5,
          borderTop: `1px solid ${colors.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => onEdit(item)}
          sx={{
            flex: 1,
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: colors.primary,
            borderRadius: `${radii.button}px`,
            boxShadow: 'none',
          }}
        >
          Редактировать
        </Button>
        <IconButton onClick={() => onCopy(item)} aria-label="Копировать">
          <ContentCopy fontSize="small" />
        </IconButton>
        <IconButton onClick={() => onDelete(item)} aria-label="Удалить" color="error">
          <DeleteOutline fontSize="small" />
        </IconButton>
        <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="Ещё">
          <MoreHoriz fontSize="small" />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onClose();
            }}
          >
            Закрыть панель
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

function formatDuration(start: Date, end: Date) {
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

const MetaRow: React.FC<{ icon: React.ReactNode; text: string; hint?: string }> = ({
  icon,
  text,
  hint,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: colors.textMuted }}>
    <Box sx={{ mt: 0.15, color: colors.textHint }}>{icon}</Box>
    <Box>
      {hint && (
        <Typography sx={{ fontSize: 10, color: colors.textHint, lineHeight: 1.1 }}>{hint}</Typography>
      )}
      <Typography sx={{ fontSize: 13, color: colors.text, fontWeight: 600, textTransform: 'capitalize' }}>
        {text}
      </Typography>
    </Box>
  </Box>
);

export default ScheduleEventDrawer;
