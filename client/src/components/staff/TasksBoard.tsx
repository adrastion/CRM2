import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  ArchiveOutlined,
  CalendarMonthOutlined,
  Close,
  DeleteOutline,
  DownloadOutlined,
  Flag,
  FormatListBulleted,
  GridViewOutlined,
  MoreHoriz,
  PersonOutline,
  PictureAsPdf,
  DescriptionOutlined,
  RepeatOutlined,
  Search,
  Send,
  Star,
  StarBorder,
  TableRowsOutlined,
  ViewListOutlined,
} from '@mui/icons-material';
import {
  addDays,
  endOfDay,
  format,
  isToday,
  isTomorrow,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { colors } from '../../theme/tokens';

export type StaffUserLite = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
};

export type StaffTaskRow = {
  id: string;
  title: string;
  body: string;
  dueAt: string | null;
  status: string;
  priority?: string;
  projectKey?: string;
  favorite?: boolean;
  archived?: boolean;
  recurrence?: string;
  subtasks?: Array<{ id: string; title: string; done: boolean }> | null;
  notifyAssignees?: boolean;
  createdByUserId: string;
  createdAt?: string;
  createdBy: StaffUserLite;
  assignees: Array<{ userId: string; user: StaffUserLite }>;
  chatThread?: { id: string; threadKey: string; type: string } | null;
  attachments?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  comments?: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorId: string;
    author: StaffUserLite;
  }>;
};

type NavKey = 'all' | 'mine' | 'byMe' | 'toMe' | 'favorites' | 'archive';
type ProjectKey = 'general' | 'growth' | 'meetings' | 'ideas' | 'personal';
type SortKey = 'created' | 'due' | 'priority';

const PROJECTS: Array<{ key: ProjectKey; label: string; color: string }> = [
  { key: 'general', label: 'Общие', color: '#94A3B8' },
  { key: 'growth', label: 'Развитие', color: '#8B5CF6' },
  { key: 'meetings', label: 'Планерки', color: '#12B981' },
  { key: 'ideas', label: 'Идеи', color: '#F59E0B' },
  { key: 'personal', label: 'Личные', color: '#2F6BFF' },
];

const RECURRENCE_LABEL: Record<string, string> = {
  none: 'Не повторять',
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
};

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: 'Высокий приоритет',
  MEDIUM: 'Средний приоритет',
  LOW: 'Низкий приоритет',
};

type Props = {
  tasks: StaffTaskRow[];
  staffUsers: StaffUserLite[];
  currentUserId?: string;
  isOwner?: boolean;
  onReload: () => void | Promise<void>;
  onError: (msg: string) => void;
  onCreate: () => void;
  initialSelectedId?: string | null;
};

function personName(u: StaffUserLite) {
  return [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ');
}

function initials(u: StaffUserLite) {
  return `${(u.lastName || '')[0] || ''}${(u.firstName || '')[0] || ''}`.toUpperCase() || '?';
}

function projectMeta(key?: string) {
  return PROJECTS.find((p) => p.key === key) || PROJECTS[0];
}

function parseSubtasks(raw: StaffTaskRow['subtasks']): Array<{ id: string; title: string; done: boolean }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, i) => ({
      id: String(s?.id || `st-${i}`),
      title: String(s?.title || '').trim(),
      done: Boolean(s?.done),
    }))
    .filter((s) => s.title);
}

function formatDue(iso: string | null | undefined) {
  if (!iso) return 'Без срока';
  const d = new Date(iso);
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Сегодня, ${time}`;
  if (isTomorrow(d)) return `Завтра, ${time}`;
  return format(d, 'd MMM, HH:mm', { locale: ru });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatFileDate(iso: string) {
  return format(new Date(iso), 'd MMM yyyy', { locale: ru });
}

const cardSx = {
  bgcolor: '#fff',
  borderRadius: '14px',
  border: '1px solid #EEF1F6',
  boxShadow: '0 2px 10px rgba(27, 36, 56, 0.04)',
};

const TasksBoard: React.FC<Props> = ({
  tasks,
  staffUsers,
  currentUserId,
  isOwner,
  onReload,
  onError,
  onCreate,
  initialSelectedId,
}) => {
  const [nav, setNav] = useState<NavKey>('all');
  const [projectFilter, setProjectFilter] = useState<ProjectKey | null>(null);
  const [staffFilter, setStaffFilter] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('created');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [commentDraft, setCommentDraft] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const active = tasks.filter((t) => !t.archived);
    const uid = currentUserId;
    return {
      all: active.length,
      mine: active.filter(
        (t) => t.createdByUserId === uid || t.assignees.some((a) => a.userId === uid)
      ).length,
      byMe: active.filter((t) => t.createdByUserId === uid).length,
      toMe: active.filter((t) => t.assignees.some((a) => a.userId === uid)).length,
      favorites: active.filter((t) => t.favorite).length,
      archive: tasks.filter((t) => t.archived).length,
      projects: PROJECTS.reduce(
        (acc, p) => {
          acc[p.key] = active.filter((t) => (t.projectKey || 'general') === p.key).length;
          return acc;
        },
        {} as Record<ProjectKey, number>
      ),
    };
  }, [tasks, currentUserId]);

  const filtered = useMemo(() => {
    let list = tasks.slice();
    if (nav === 'archive') list = list.filter((t) => t.archived);
    else list = list.filter((t) => !t.archived);

    if (nav === 'mine' && currentUserId) {
      list = list.filter(
        (t) => t.createdByUserId === currentUserId || t.assignees.some((a) => a.userId === currentUserId)
      );
    } else if (nav === 'byMe' && currentUserId) {
      list = list.filter((t) => t.createdByUserId === currentUserId);
    } else if (nav === 'toMe' && currentUserId) {
      list = list.filter((t) => t.assignees.some((a) => a.userId === currentUserId));
    } else if (nav === 'favorites') {
      list = list.filter((t) => t.favorite);
    }

    if (projectFilter) {
      list = list.filter((t) => (t.projectKey || 'general') === projectFilter);
    }

    if (staffFilter.length) {
      list = list.filter((t) => t.assignees.some((a) => staffFilter.includes(a.userId)));
    }

    list.sort((a, b) => {
      if (sortBy === 'due') {
        const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      }
      if (sortBy === 'priority') {
        const rank = (p?: string) => (p === 'HIGH' ? 0 : p === 'MEDIUM' ? 1 : 2);
        return rank(a.priority) - rank(b.priority);
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return list;
  }, [tasks, nav, projectFilter, staffFilter, sortBy, currentUserId]);

  const groups = useMemo(() => {
    const today: StaffTaskRow[] = [];
    const tomorrow: StaffTaskRow[] = [];
    const thisWeek: StaffTaskRow[] = [];
    const later: StaffTaskRow[] = [];
    const noDue: StaffTaskRow[] = [];
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    for (const t of filtered) {
      if (!t.dueAt) {
        noDue.push(t);
        continue;
      }
      const d = new Date(t.dueAt);
      if (isToday(d)) today.push(t);
      else if (isTomorrow(d)) tomorrow.push(t);
      else if (
        isWithinInterval(d, { start: startOfDay(addDays(now, 2)), end: endOfDay(weekEnd) }) &&
        d >= weekStart
      ) {
        thisWeek.push(t);
      } else if (d > weekEnd) later.push(t);
      else thisWeek.push(t);
    }

    return [
      { key: 'today', title: 'Сегодня', items: today },
      { key: 'tomorrow', title: 'Завтра', items: tomorrow },
      { key: 'week', title: 'На этой неделе', items: thisWeek },
      { key: 'later', title: 'Позже', items: later },
      { key: 'nodue', title: 'Без срока', items: noDue },
    ].filter((g) => g.items.length);
  }, [filtered]);

  const selected = useMemo(
    () =>
      filtered.find((t) => t.id === selectedId) ||
      tasks.find((t) => t.id === selectedId) ||
      null,
    [filtered, tasks, selectedId]
  );

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      setDetailOpen(true);
    }
  }, [initialSelectedId]);

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
      setDetailOpen(true);
    }
    if (selectedId && !filtered.some((t) => t.id === selectedId) && !tasks.some((t) => t.id === selectedId)) {
      setSelectedId(filtered[0]?.id || null);
    }
  }, [filtered, selectedId, tasks]);

  const canEdit =
    selected &&
    (isOwner ||
      selected.createdByUserId === currentUserId ||
      selected.assignees.some((a) => a.userId === currentUserId));

  const persist = async (patch: Record<string, unknown>) => {
    if (!selected || !canEdit) return;
    try {
      await apiService.updateStaffTask(selected.id, patch as any);
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось сохранить');
    }
  };

  const toggleDone = async (task: StaffTaskRow) => {
    try {
      await apiService.updateStaffTaskStatus(task.id, task.status === 'DONE' ? 'OPEN' : 'DONE');
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось обновить статус');
    }
  };

  const toggleFavorite = async (task: StaffTaskRow) => {
    try {
      await apiService.updateStaffTask(task.id, { favorite: !task.favorite });
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось обновить');
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file || !selected || !canEdit) return;
    try {
      await apiService.uploadStaffTaskAttachment(selected.id, file);
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Ошибка загрузки файла');
    }
  };

  const onDeleteAttachment = async (attachmentId: string) => {
    if (!selected || !canEdit) return;
    try {
      await apiService.deleteStaffTaskAttachment(selected.id, attachmentId);
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось удалить файл');
    }
  };

  const onSendComment = async () => {
    if (!selected || !commentDraft.trim()) return;
    try {
      await apiService.createStaffTaskComment(selected.id, commentDraft.trim());
      setCommentDraft('');
      await onReload();
    } catch (e: any) {
      onError(e?.response?.data?.error || 'Не удалось отправить комментарий');
    }
  };

  const updateSubtasks = async (next: Array<{ id: string; title: string; done: boolean }>) => {
    await persist({ subtasks: next });
  };

  const subtasks = parseSubtasks(selected?.subtasks);
  const subDone = subtasks.filter((s) => s.done).length;

  const navItems: Array<{ key: NavKey; label: string; count: number; icon?: React.ReactNode }> = [
    { key: 'all', label: 'Все задачи', count: counts.all },
    { key: 'mine', label: 'Мои задачи', count: counts.mine },
    { key: 'byMe', label: 'Порученные мной', count: counts.byMe },
    { key: 'toMe', label: 'Мне поручили', count: counts.toMe },
    { key: 'favorites', label: 'Избранные', count: counts.favorites, icon: <Star sx={{ fontSize: 16, color: '#F59E0B' }} /> },
    { key: 'archive', label: 'Архив', count: counts.archive, icon: <ArchiveOutlined sx={{ fontSize: 16 }} /> },
  ];

  const listTitle =
    nav === 'all'
      ? 'Все задачи'
      : nav === 'mine'
        ? 'Мои задачи'
        : nav === 'byMe'
          ? 'Порученные мной'
          : nav === 'toMe'
            ? 'Мне поручили'
            : nav === 'favorites'
              ? 'Избранные'
              : 'Архив';

  const filteredStaff = staffUsers.filter((u) => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return true;
    return personName(u).toLowerCase().includes(q);
  });

  const allStaffChecked = staffFilter.length === 0;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          lg: detailOpen
            ? 'minmax(220px,0.7fr) minmax(0,1.15fr) minmax(300px,0.95fr)'
            : 'minmax(220px,0.7fr) minmax(0,1.8fr)',
        },
        gap: 1.5,
        alignItems: 'start',
        minHeight: 520,
      }}
    >
      {/* Left filters */}
      <Box
        sx={{
          ...cardSx,
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxHeight: { lg: 'calc(100vh - 220px)' },
          overflow: 'auto',
        }}
      >
        <Stack spacing={0.35}>
          {navItems.map((item) => {
            const active = nav === item.key;
            return (
              <Box
                key={item.key}
                onClick={() => {
                  setNav(item.key);
                  if (item.key === 'archive') setProjectFilter(null);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.9,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  bgcolor: active ? '#EEF3FF' : 'transparent',
                  color: active ? colors.primary : '#1B2438',
                  fontWeight: active ? 800 : 600,
                  fontSize: 13.5,
                  '&:hover': { bgcolor: active ? '#EEF3FF' : '#F7F8FB' },
                }}
              >
                {item.icon}
                <Box flex={1}>{item.label}</Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: active ? colors.primary : '#8B93A7' }}>
                  {item.count}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#8B93A7', letterSpacing: '0.04em' }}>
              ПРОЕКТЫ / КАТЕГОРИИ
            </Typography>
            <IconButton size="small" sx={{ color: colors.primary }}>
              <Add fontSize="small" />
            </IconButton>
          </Stack>
          <Stack spacing={0.25}>
            {PROJECTS.map((p) => {
              const active = projectFilter === p.key;
              return (
                <Box
                  key={p.key}
                  onClick={() => setProjectFilter(active ? null : p.key)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    bgcolor: active ? '#F7F8FB' : 'transparent',
                    '&:hover': { bgcolor: '#F7F8FB' },
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color, flexShrink: 0 }} />
                  <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 650, color: '#1B2438' }}>
                    {p.label}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#8B93A7' }}>
                    {counts.projects[p.key]}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#8B93A7', letterSpacing: '0.04em', mb: 1 }}>
            СОТРУДНИКИ
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Поиск"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: '#8B93A7' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',
                bgcolor: '#F7F8FB',
                '& fieldset': { borderColor: 'transparent' },
              },
            }}
          />
          <Stack spacing={0.15}>
            <Box
              onClick={() => setStaffFilter([])}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 0.5,
                py: 0.35,
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <Checkbox size="small" checked={allStaffChecked} sx={{ p: 0.5 }} />
              <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>Все сотрудники</Typography>
            </Box>
            {filteredStaff.map((u) => {
              const checked = staffFilter.includes(u.id);
              return (
                <Box
                  key={u.id}
                  onClick={() => {
                    setStaffFilter((prev) =>
                      prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                    );
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0.5,
                    py: 0.35,
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Checkbox size="small" checked={checked} sx={{ p: 0.5 }} />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#1B2438' }}>
                    {personName(u)}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Box>

      {/* Middle list */}
      <Box
        sx={{
          ...cardSx,
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          maxHeight: { lg: 'calc(100vh - 220px)' },
          overflow: 'auto',
          minHeight: 420,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#1B2438' }}>
            {listTitle} ({filtered.length})
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                sx={{
                  borderRadius: '10px',
                  fontSize: 13,
                  fontWeight: 650,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#EEF1F6' },
                }}
              >
                <MenuItem value="created">Сортировка: По дате создания</MenuItem>
                <MenuItem value="due">Сортировка: По сроку</MenuItem>
                <MenuItem value="priority">Сортировка: По приоритету</MenuItem>
              </Select>
            </FormControl>
            <IconButton size="small" sx={{ border: '1px solid #EEF1F6', borderRadius: '8px', color: colors.primary }}>
              <ViewListOutlined fontSize="small" />
            </IconButton>
            <IconButton size="small" sx={{ border: '1px solid #EEF1F6', borderRadius: '8px', color: '#8B93A7' }}>
              <GridViewOutlined fontSize="small" />
            </IconButton>
            <IconButton size="small" sx={{ border: '1px solid #EEF1F6', borderRadius: '8px', color: '#8B93A7' }}>
              <TableRowsOutlined fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {!filtered.length && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              Пока нет задач
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={onCreate} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Новая задача
            </Button>
          </Box>
        )}

        {groups.map((g) => (
          <Box key={g.key}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 800,
                color: '#8B93A7',
                letterSpacing: '0.04em',
                mb: 0.75,
                mt: 0.5,
              }}
            >
              {g.title.toUpperCase()}
            </Typography>
            <Stack spacing={0.75}>
              {g.items.map((t) => {
                const proj = projectMeta(t.projectKey);
                const active = t.id === selectedId && detailOpen;
                const high = t.priority === 'HIGH';
                return (
                  <Box
                    key={t.id}
                    onClick={() => {
                      setSelectedId(t.id);
                      setDetailOpen(true);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.25,
                      py: 1.1,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      bgcolor: active ? '#EEF4FF' : '#fff',
                      border: active ? '1px solid #D6E4FF' : '1px solid #EEF1F6',
                      '&:hover': { bgcolor: active ? '#EEF4FF' : '#F7F8FB' },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={t.status === 'DONE'}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => void toggleDone(t)}
                      sx={{ p: 0.5 }}
                    />
                    <Box flex={1} minWidth={0}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: t.status === 'DONE' ? '#8B93A7' : '#1B2438',
                          textDecoration: t.status === 'DONE' ? 'line-through' : 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.title}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={proj.label}
                      sx={{
                        height: 22,
                        fontSize: 11.5,
                        fontWeight: 700,
                        bgcolor: `${proj.color}18`,
                        color: proj.color,
                        borderRadius: '6px',
                      }}
                    />
                    <Stack direction="row" spacing={-0.6} sx={{ ml: 0.5 }}>
                      {t.assignees.slice(0, 3).map((a) => (
                        <Avatar
                          key={a.userId}
                          sx={{
                            width: 24,
                            height: 24,
                            fontSize: 10,
                            fontWeight: 800,
                            bgcolor: '#E8EEFF',
                            color: colors.primary,
                            border: '2px solid #fff',
                          }}
                        >
                          {initials(a.user)}
                        </Avatar>
                      ))}
                    </Stack>
                    {high && <Flag sx={{ fontSize: 16, color: '#EF4444' }} />}
                    <Typography sx={{ fontSize: 12, fontWeight: 650, color: high ? '#EF4444' : '#8B93A7', whiteSpace: 'nowrap' }}>
                      {formatDue(t.dueAt)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Box>

      {/* Right detail */}
      {detailOpen && selected && (
        <Box
          sx={{
            ...cardSx,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
            maxHeight: { lg: 'calc(100vh - 220px)' },
            overflow: 'auto',
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Checkbox
              checked={selected.status === 'DONE'}
              onChange={() => void toggleDone(selected)}
              sx={{ p: 0.5, mt: 0.25 }}
            />
            <Typography sx={{ flex: 1, fontWeight: 800, fontSize: 18, color: '#1B2438', lineHeight: 1.3 }}>
              {selected.title}
            </Typography>
            <IconButton size="small" onClick={() => void toggleFavorite(selected)}>
              {selected.favorite ? (
                <Star sx={{ color: '#F59E0B', fontSize: 20 }} />
              ) : (
                <StarBorder sx={{ fontSize: 20 }} />
              )}
            </IconButton>
            <IconButton size="small">
              <MoreHoriz />
            </IconButton>
            <IconButton size="small" onClick={() => setDetailOpen(false)}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={projectMeta(selected.projectKey).label}
              sx={{
                height: 24,
                fontWeight: 700,
                bgcolor: `${projectMeta(selected.projectKey).color}18`,
                color: projectMeta(selected.projectKey).color,
              }}
            />
            <Chip
              size="small"
              icon={<Flag sx={{ fontSize: '14px !important' }} />}
              label={PRIORITY_LABEL[selected.priority || 'MEDIUM'] || 'Приоритет'}
              sx={{
                height: 24,
                fontWeight: 700,
                bgcolor: selected.priority === 'HIGH' ? '#FEE2E2' : '#F1F5F9',
                color: selected.priority === 'HIGH' ? '#DC2626' : '#64748B',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          </Stack>

          <Typography sx={{ fontSize: 14, color: '#4B5568', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {selected.body || 'Без описания'}
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
            }}
          >
            <MetaTile
              icon={<CalendarMonthOutlined sx={{ fontSize: 18, color: colors.primary }} />}
              label="Дата и время"
              value={formatDue(selected.dueAt)}
            />
            <MetaTile
              icon={<RepeatOutlined sx={{ fontSize: 18, color: colors.primary }} />}
              label="Повтор"
              value={RECURRENCE_LABEL[selected.recurrence || 'none'] || 'Не повторять'}
            />
            <Box sx={metaTileSx}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <PersonOutline sx={{ fontSize: 18, color: colors.primary }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7' }}>Исполнители</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                {selected.assignees.map((a) => (
                  <Avatar
                    key={a.userId}
                    sx={{
                      width: 28,
                      height: 28,
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: '#E8EEFF',
                      color: colors.primary,
                    }}
                    title={personName(a.user)}
                  >
                    {initials(a.user)}
                  </Avatar>
                ))}
                {canEdit && (
                  <IconButton
                    size="small"
                    sx={{
                      width: 28,
                      height: 28,
                      border: '1px dashed #C9D7FF',
                      color: colors.primary,
                    }}
                    onClick={() => onCreate()}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Box>
            <Box sx={metaTileSx}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <FormatListBulleted sx={{ fontSize: 18, color: colors.primary }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7' }}>
                  Проект / Категория
                </Typography>
              </Stack>
              <FormControl size="small" fullWidth disabled={!canEdit}>
                <Select
                  value={selected.projectKey || 'general'}
                  onChange={(e) => void persist({ projectKey: e.target.value })}
                  sx={{ borderRadius: '10px', fontWeight: 700 }}
                  renderValue={(v) => {
                    const p = projectMeta(String(v));
                    return (
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
                        <span>{p.label}</span>
                      </Stack>
                    );
                  }}
                >
                  {PROJECTS.map((p) => (
                    <MenuItem key={p.key} value={p.key}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
                        <span>{p.label}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Subtasks */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                Подзадачи ({subDone}/{subtasks.length || 0})
              </Typography>
            </Stack>
            {subtasks.length > 0 && (
              <LinearProgress
                variant="determinate"
                value={subtasks.length ? (subDone / subtasks.length) * 100 : 0}
                sx={{
                  height: 6,
                  borderRadius: 99,
                  mb: 1.25,
                  bgcolor: '#EEF1F6',
                  '& .MuiLinearProgress-bar': { bgcolor: colors.primary, borderRadius: 99 },
                }}
              />
            )}
            <Stack spacing={0.5}>
              {subtasks.map((s) => (
                <Stack key={s.id} direction="row" alignItems="center" spacing={0.5}>
                  <Checkbox
                    size="small"
                    checked={s.done}
                    disabled={!canEdit}
                    onChange={() => {
                      const next = subtasks.map((x) =>
                        x.id === s.id ? { ...x, done: !x.done } : x
                      );
                      void updateSubtasks(next);
                    }}
                    sx={{ p: 0.5 }}
                  />
                  <Typography
                    sx={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: s.done ? '#8B93A7' : '#1B2438',
                      textDecoration: s.done ? 'line-through' : 'none',
                      flex: 1,
                    }}
                  >
                    {s.title}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            {canEdit && (
              addingSubtask ? (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    autoFocus
                    placeholder="Название подзадачи"
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && subtaskDraft.trim()) {
                        void updateSubtasks([
                          ...subtasks,
                          { id: `st-${Date.now()}`, title: subtaskDraft.trim(), done: false },
                        ]);
                        setSubtaskDraft('');
                        setAddingSubtask(false);
                      }
                      if (e.key === 'Escape') {
                        setAddingSubtask(false);
                        setSubtaskDraft('');
                      }
                    }}
                  />
                  <Button
                    size="small"
                    onClick={() => {
                      if (!subtaskDraft.trim()) return;
                      void updateSubtasks([
                        ...subtasks,
                        { id: `st-${Date.now()}`, title: subtaskDraft.trim(), done: false },
                      ]);
                      setSubtaskDraft('');
                      setAddingSubtask(false);
                    }}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    OK
                  </Button>
                </Stack>
              ) : (
                <Button
                  startIcon={<Add />}
                  onClick={() => setAddingSubtask(true)}
                  sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, color: colors.primary, px: 0 }}
                >
                  Добавить подзадачу
                </Button>
              )
            )}
          </Box>

          {/* Files */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                Файлы ({selected.attachments?.length || 0})
              </Typography>
              {canEdit && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    onChange={(e) => {
                      void onUpload(e.target.files?.[0] || null);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    startIcon={<Add />}
                    onClick={() => fileRef.current?.click()}
                    sx={{ textTransform: 'none', fontWeight: 700, color: colors.primary, px: 0 }}
                  >
                    Загрузить файл
                  </Button>
                </>
              )}
            </Stack>
            <Stack spacing={0.75}>
              {(selected.attachments || []).map((f) => {
                const isPdf = (f.mimeType || '').includes('pdf') || f.originalName.toLowerCase().endsWith('.pdf');
                return (
                  <Stack
                    key={f.id}
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{
                      p: 1,
                      borderRadius: '12px',
                      border: '1px solid #EEF1F6',
                      bgcolor: '#FAFBFD',
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        bgcolor: isPdf ? '#FEE2E2' : '#DBEAFE',
                        color: isPdf ? '#DC2626' : '#2563EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isPdf ? <PictureAsPdf fontSize="small" /> : <DescriptionOutlined fontSize="small" />}
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {f.originalName}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#8B93A7', fontWeight: 600 }}>
                        {formatBytes(f.sizeBytes)} · {formatFileDate(f.createdAt)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      component="a"
                      href={apiService.staffTaskAttachmentUrl(selected.id, f.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <DownloadOutlined fontSize="small" />
                    </IconButton>
                    {canEdit && (
                      <IconButton size="small" onClick={() => void onDeleteAttachment(f.id)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Box>

          {/* Comments */}
          {(selected.comments || []).length > 0 && (
            <Stack spacing={1}>
              {(selected.comments || []).map((c) => (
                <Stack key={c.id} direction="row" spacing={1} alignItems="flex-start">
                  <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: '#E8EEFF', color: colors.primary }}>
                    {initials(c.author)}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7' }}>
                      {personName(c.author)} · {format(new Date(c.createdAt), 'd MMM, HH:mm', { locale: ru })}
                    </Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{c.body}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 'auto', pt: 1 }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: '#E8EEFF', color: colors.primary }}>
              {currentUserId
                ? initials(staffUsers.find((u) => u.id === currentUserId) || selected.createdBy)
                : '?'}
            </Avatar>
            <TextField
              size="small"
              fullWidth
              placeholder="Написать комментарий..."
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onSendComment();
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => void onSendComment()}
                      disabled={!commentDraft.trim()}
                      sx={{ color: colors.primary }}
                    >
                      <Send fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: '#F7F8FB',
                  '& fieldset': { borderColor: 'transparent' },
                },
              }}
            />
          </Stack>

          {canEdit && (isOwner || selected.createdByUserId === currentUserId) && (
            <Button
              startIcon={<DeleteOutline />}
              color="error"
              onClick={async () => {
                if (!window.confirm('Удалить задачу?')) return;
                try {
                  await apiService.deleteStaffTask(selected.id);
                  setSelectedId(null);
                  await onReload();
                } catch (e: any) {
                  onError(e?.response?.data?.error || 'Не удалось удалить');
                }
              }}
              sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
            >
              Удалить задачу
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

const metaTileSx = {
  p: 1.25,
  borderRadius: '12px',
  border: '1px solid #EEF1F6',
  bgcolor: '#FAFBFD',
};

function MetaTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Box sx={metaTileSx}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
        {icon}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8B93A7' }}>{label}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#1B2438' }}>{value}</Typography>
    </Box>
  );
}

export default TasksBoard;
