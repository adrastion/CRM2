import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add,
  AssignmentTurnedInOutlined,
  FilterList,
  FileUploadOutlined,
  MoreHoriz,
  NoteAltOutlined,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { colors, radii, typography } from '../theme/tokens';
import CreateNoteDialog from '../components/staff/CreateNoteDialog';
import CreateStaffTaskDialog from '../components/staff/CreateStaffTaskDialog';
import NotesBoard, { type StaffNoteRow } from '../components/staff/NotesBoard';
import TasksBoard, { type StaffTaskRow } from '../components/staff/TasksBoard';

const btnPrimary = {
  textTransform: 'none' as const,
  borderRadius: `${radii.button}px`,
  bgcolor: colors.primary,
  fontWeight: 700,
  boxShadow: 'none',
  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
};

type StaffUser = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  role: string;
  email?: string;
};

const StaffWorkspace: React.FC = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const [tab, setTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<StaffNoteRow[]>([]);
  const [tasks, setTasks] = useState<StaffTaskRow[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [noteFilter, setNoteFilter] = useState<'ALL' | 'PERSONAL' | 'SHARED'>('ALL');

  const [noteDialog, setNoteDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<StaffTaskRow | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ title: string; body: string } | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [newMenuEl, setNewMenuEl] = useState<null | HTMLElement>(null);
  const [moreMenuEl, setMoreMenuEl] = useState<null | HTMLElement>(null);

  const loadNotes = useCallback(async () => {
    const data = await apiService.listStaffNotes(
      noteFilter === 'ALL' ? undefined : noteFilter
    );
    setNotes(data);
  }, [noteFilter]);

  const loadTasks = useCallback(async () => {
    const data = await apiService.listStaffTasks();
    setTasks(data);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([
        loadNotes(),
        loadTasks(),
        apiService.listStaffWorkspaceUsers().then(setStaffUsers),
      ]);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить данные');
    }
  }, [loadNotes, loadTasks]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNewNote = () => {
    setNewMenuEl(null);
    setTab(0);
    setNoteDialog(true);
  };

  const openNewTask = () => {
    setNewMenuEl(null);
    setEditingTask(null);
    setTaskDraft(null);
    setTab(1);
    setTaskDialog(true);
  };

  const createTaskFromNote = (note: StaffNoteRow) => {
    setEditingTask(null);
    setTaskDraft({ title: note.title, body: note.body || '' });
    setTab(1);
    setTaskDialog(true);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: typography.pageTitle.xs, md: typography.pageTitle.md },
              color: '#1B2438',
              letterSpacing: '-0.03em',
            }}
          >
            Заметки и задачи
          </Typography>
          <Typography sx={{ fontSize: typography.label, color: '#8B93A7', fontWeight: 600, mt: 0.35 }}>
            Фиксируйте идеи, ведите планерки и ставьте задачи себе и команде.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <IconButton
            size="small"
            onClick={(e) => setMoreMenuEl(e.currentTarget)}
            sx={{ border: '1px solid #EEF1F6', borderRadius: '10px' }}
          >
            <MoreHoriz />
          </IconButton>
          {tab === 0 ? (
            <>
              <Button
                variant="outlined"
                startIcon={<FileUploadOutlined />}
                onClick={() => setError('Импорт / экспорт появится в следующем обновлении')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  borderColor: '#C9D7FF',
                  color: colors.primary,
                }}
              >
                Импорт / Экспорт
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                endIcon={<MoreHoriz sx={{ fontSize: 16, opacity: 0.7 }} />}
                onClick={(e) => setNewMenuEl(e.currentTarget)}
                sx={btnPrimary}
              >
                Новая запись
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setError('Расширенные фильтры появятся в следующем обновлении')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  borderColor: '#C9D7FF',
                  color: colors.primary,
                }}
              >
                Фильтры
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                endIcon={<MoreHoriz sx={{ fontSize: 16, opacity: 0.7 }} />}
                onClick={openNewTask}
                sx={btnPrimary}
              >
                Новая задача
              </Button>
            </>
          )}
          <Menu
            anchorEl={newMenuEl}
            open={Boolean(newMenuEl)}
            onClose={() => setNewMenuEl(null)}
          >
            <MenuItem onClick={openNewNote}>Новая заметка</MenuItem>
            <MenuItem onClick={openNewTask}>Новая задача</MenuItem>
          </Menu>
          <Menu
            anchorEl={moreMenuEl}
            open={Boolean(moreMenuEl)}
            onClose={() => setMoreMenuEl(null)}
          >
            <MenuItem
              onClick={() => {
                setMoreMenuEl(null);
                void load();
              }}
            >
              Обновить
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: `${radii.panel}px` }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          onClick={() => setTab(0)}
          startIcon={<NoteAltOutlined />}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            borderRadius: '999px',
            px: 2,
            py: 1,
            bgcolor: tab === 0 ? '#fff' : 'transparent',
            color: tab === 0 ? colors.primary : '#8B93A7',
            border: tab === 0 ? '1px solid #EEF1F6' : '1px solid transparent',
            boxShadow: tab === 0 ? '0 2px 10px rgba(27,36,56,0.06)' : 'none',
          }}
        >
          Заметки
        </Button>
        <Button
          onClick={() => setTab(1)}
          startIcon={<AssignmentTurnedInOutlined />}
          sx={{
            textTransform: 'none',
            fontWeight: 800,
            borderRadius: '999px',
            px: 2,
            py: 1,
            bgcolor: tab === 1 ? '#fff' : 'transparent',
            color: tab === 1 ? colors.primary : '#8B93A7',
            border: tab === 1 ? '1px solid #EEF1F6' : '1px solid transparent',
            boxShadow: tab === 1 ? '0 2px 10px rgba(27,36,56,0.06)' : 'none',
          }}
        >
          Задачи
        </Button>
      </Stack>

      {tab === 0 && (
        <NotesBoard
          notes={notes}
          currentUserId={user?.id}
          isOwner={isOwner}
          filter={noteFilter}
          onFilter={setNoteFilter}
          onReload={loadNotes}
          onError={setError}
          onCreateTaskFromNote={createTaskFromNote}
          initialSelectedId={focusNoteId}
          onOpenTask={(taskId) => {
            setFocusTaskId(taskId);
            setTab(1);
          }}
        />
      )}

      {tab === 1 && (
        <TasksBoard
          tasks={tasks}
          staffUsers={staffUsers}
          currentUserId={user?.id}
          isOwner={isOwner}
          onReload={loadTasks}
          onError={setError}
          onCreate={openNewTask}
          initialSelectedId={focusTaskId}
        />
      )}

      <CreateNoteDialog
        open={noteDialog}
        onClose={() => setNoteDialog(false)}
        onError={setError}
        onSaved={async (note, opts) => {
          setFocusNoteId(note?.id || null);
          await loadNotes();
          if (opts.createTask && note) {
            setEditingTask(null);
            setTaskDraft({ title: note.title, body: note.body || '' });
            setTab(1);
            setTaskDialog(true);
          }
        }}
      />

      <CreateStaffTaskDialog
        open={taskDialog}
        onClose={() => {
          setTaskDialog(false);
          setEditingTask(null);
          setTaskDraft(null);
        }}
        onSaved={async () => {
          await loadTasks();
        }}
        staffUsers={staffUsers}
        initialTask={
          editingTask?.id
            ? editingTask
            : taskDraft
              ? ({ title: taskDraft.title, body: taskDraft.body } as any)
              : null
        }
      />
    </Box>
  );
};

export default StaffWorkspace;
