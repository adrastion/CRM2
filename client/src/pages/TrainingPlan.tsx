import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, DescriptionOutlined, Edit, ExpandMore } from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { colors, radii } from '../theme/tokens';
import CyclesBoard from '../components/trainingPlan/CyclesBoard';
import CreateCycleWizardDialog from '../components/trainingPlan/CreateCycleWizardDialog';
import CreateExerciseDialog from '../components/trainingPlan/CreateExerciseDialog';
import ExerciseCatalog from '../components/trainingPlan/ExerciseCatalog';

const PASTEL_CARD = ['#EEF4FF', '#F3EEFF', '#EEF9F6', '#FFF4F0', '#F5F6FA'] as const;

const btnPrimary = {
  textTransform: 'none' as const,
  borderRadius: `${radii.button}px`,
  bgcolor: colors.primary,
  fontWeight: 600,
  boxShadow: 'none',
  '&:hover': { bgcolor: colors.primaryDark, boxShadow: 'none' },
};

const btnGhost = {
  textTransform: 'none' as const,
  borderRadius: `${radii.button}px`,
  fontWeight: 600,
  color: colors.textMuted,
};

const dialogPaper = {
  borderRadius: { xs: 0, sm: `${radii.panel}px` },
  bgcolor: colors.surface,
};

type Media = {
  id: string;
  kind: string;
  mimeType: string;
  originalName: string;
  sortOrder: number;
};

type Exercise = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  exerciseType?: string | null;
  sets?: number | null;
  reps?: number | null;
  restSec?: number | null;
  difficulty?: string | null;
  inventory?: string | null;
  tempo?: string | null;
  videoUrl?: string | null;
  tags?: string | null;
  media: Media[];
};

type TemplateItem = {
  exerciseId: string;
  sortOrder?: number;
  durationSec?: number | null;
  sets?: number | null;
  reps?: number | null;
  notes?: string | null;
  exercise?: { id: string; title: string };
};

type Template = {
  id: string;
  title: string;
  kind: 'WARMUP' | 'WORKOUT';
  items: TemplateItem[];
};

type GroupOpt = {
  id: string;
  name: string;
  branchId?: string;
  trainerId?: string;
  ageMin?: number | null;
  ageMax?: number | null;
  branch?: { id?: string; name: string } | null;
  trainer?: { id: string; user?: { firstName?: string; lastName?: string } | null } | null;
  color?: string | null;
};

type Cycle = {
  id: string;
  title: string | null;
  description?: string | null;
  frequency?: string | null;
  quantity?: number | null;
  dateFrom: string;
  dateTo: string;
  updatedAt?: string;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  groups: Array<{ groupId: string; group: { id: string; name: string; color?: string | null } }>;
  _count?: { sessionPlans: number };
};

type PreviewTraining = {
  id: string;
  title: string;
  startTime: string;
  group: { id: string; name: string; color?: string | null } | null;
  hasPlan: boolean;
};

type Preview = {
  total: number;
  byMonth: Record<string, number>;
  byWeek: Record<string, number>;
  trainings: PreviewTraining[];
};

type PlanItemDraft = {
  key: string;
  section: 'WARMUP' | 'MAIN';
  exerciseId: string;
  durationSec: string;
  sets: string;
  reps: string;
  notes: string;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MediaThumb: React.FC<{ mediaId: string; kind: string; mimeType: string }> = ({
  mediaId,
  kind,
  mimeType,
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await apiService.getExerciseMediaBlob(mediaId);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        revoked = objectUrl;
        setUrl(objectUrl);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [mediaId]);

  if (!url) {
    return (
      <Box
        sx={{
          width: 160,
          height: 100,
          bgcolor: colors.surface,
          borderRadius: radii.panel,
          border: `1px solid ${colors.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Загрузка…
        </Typography>
      </Box>
    );
  }

  if (kind === 'video' || mimeType.startsWith('video/')) {
    return (
      <video
        src={url}
        controls
        style={{ maxWidth: 280, maxHeight: 180, borderRadius: 16, display: 'block', border: `1px solid ${colors.divider}` }}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      style={{ maxWidth: 280, maxHeight: 180, objectFit: 'contain', borderRadius: 16, display: 'block', border: `1px solid ${colors.divider}` }}
    />
  );
};

const TrainingPlan: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseQ, setExerciseQ] = useState('');
  const [exerciseDialog, setExerciseDialog] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [expandedEx, setExpandedEx] = useState<string | false>(false);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplDialog, setTplDialog] = useState(false);
  const [editingTpl, setEditingTpl] = useState<Template | null>(null);
  const [tplTitle, setTplTitle] = useState('');
  const [tplKind, setTplKind] = useState<'WARMUP' | 'WORKOUT'>('WARMUP');
  const [tplItems, setTplItems] = useState<
    Array<{
      key: string;
      exerciseId: string;
      durationSec: string;
      sets: string;
      reps: string;
      notes: string;
    }>
  >([]);

  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [cycleDetail, setCycleDetail] = useState<(Cycle & { preview: Preview }) | null>(null);

  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionTraining, setSessionTraining] = useState<PreviewTraining | null>(null);
  const [planItems, setPlanItems] = useState<PlanItemDraft[]>([]);
  const [applyTplId, setApplyTplId] = useState('');
  const [applySection, setApplySection] = useState<'WARMUP' | 'MAIN'>('WARMUP');

  const loadExercises = useCallback(async (q?: string) => {
    const rows = await apiService.listExercises(q);
    setExercises(rows);
  }, []);

  const loadTemplates = useCallback(async () => {
    const rows = await apiService.listWorkoutTemplates();
    setTemplates(rows);
  }, []);

  const loadCycles = useCallback(async () => {
    const [g, c] = await Promise.all([
      apiService.listTrainingPlanGroups(),
      apiService.listTrainingCycles(),
    ]);
    setGroups(g);
    setCycles(c);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadExercises(), loadTemplates(), loadCycles()]);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [loadCycles, loadExercises, loadTemplates]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (tab !== 1 || activeCycleId || cycles.length === 0) return;
    void openCycle(cycles[0].id);
  }, [tab, cycles, activeCycleId]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadExercises(exerciseQ.trim() || undefined).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [exerciseQ, loadExercises]);

  const openNewExercise = () => {
    setEditingExercise(null);
    setExerciseDialog(true);
  };

  const openEditExercise = (ex: Exercise) => {
    setEditingExercise(ex);
    setExerciseDialog(true);
  };

  const removeExercise = async (id: string) => {
    if (!window.confirm('Удалить упражнение?')) return;
    try {
      await apiService.deleteExercise(id);
      await loadExercises(exerciseQ.trim() || undefined);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить');
    }
  };

  const onUploadMedia = async (exerciseId: string, file: File | null) => {
    if (!file) return;
    try {
      await apiService.uploadExerciseMedia(exerciseId, file);
      await loadExercises(exerciseQ.trim() || undefined);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка загрузки файла');
    }
  };

  const duplicateExercise = async (ex: Exercise) => {
    try {
      await apiService.createExercise({
        title: `${ex.title} (копия)`,
        description: ex.description,
        category: ex.category || 'Другое',
        exerciseType: ex.exerciseType || null,
        sets: ex.sets ?? null,
        reps: ex.reps ?? null,
        restSec: ex.restSec ?? null,
        difficulty: ex.difficulty || '',
        inventory: ex.inventory || '',
        tempo: ex.tempo || null,
        videoUrl: ex.videoUrl || null,
        tags: ex.tags || null,
      });
      await loadExercises(exerciseQ.trim() || undefined);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось дублировать упражнение');
    }
  };

  const addExerciseToTemplate = (ex: Exercise) => {
    setEditingTpl(null);
    setTplTitle(ex.title);
    setTplKind('WORKOUT');
    setTplItems([
      {
        key: newKey(),
        exerciseId: ex.id,
        durationSec: '',
        sets: ex.sets != null ? String(ex.sets) : '',
        reps: ex.reps != null ? String(ex.reps) : '',
        notes: '',
      },
    ]);
    setTplDialog(true);
  };

  const removeMedia = async (exerciseId: string, mediaId: string) => {
    try {
      await apiService.deleteExerciseMedia(exerciseId, mediaId);
      await loadExercises(exerciseQ.trim() || undefined);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить медиа');
    }
  };

  const openNewTemplate = () => {
    setEditingTpl(null);
    setTplTitle('');
    setTplKind('WARMUP');
    setTplItems([]);
    setTplDialog(true);
  };

  const openEditTemplate = (tpl: Template) => {
    setEditingTpl(tpl);
    setTplTitle(tpl.title);
    setTplKind(tpl.kind);
    setTplItems(
      (tpl.items || []).map((it) => ({
        key: newKey(),
        exerciseId: it.exerciseId,
        durationSec: it.durationSec != null ? String(it.durationSec) : '',
        sets: it.sets != null ? String(it.sets) : '',
        reps: it.reps != null ? String(it.reps) : '',
        notes: it.notes || '',
      }))
    );
    setTplDialog(true);
  };

  const saveTemplate = async () => {
    try {
      const payload = {
        title: tplTitle.trim(),
        kind: tplKind,
        items: tplItems
          .filter((it) => it.exerciseId)
          .map((it, idx) => ({
            exerciseId: it.exerciseId,
            sortOrder: idx,
            durationSec: it.durationSec ? Number(it.durationSec) : null,
            sets: it.sets ? Number(it.sets) : null,
            reps: it.reps ? Number(it.reps) : null,
            notes: it.notes || null,
          })),
      };
      if (!payload.title) return;
      if (editingTpl) {
        await apiService.updateWorkoutTemplate(editingTpl.id, payload);
      } else {
        await apiService.createWorkoutTemplate(payload);
      }
      setTplDialog(false);
      await loadTemplates();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить шаблон');
    }
  };

  const removeTemplate = async (id: string) => {
    if (!window.confirm('Удалить шаблон?')) return;
    try {
      await apiService.deleteWorkoutTemplate(id);
      await loadTemplates();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить шаблон');
    }
  };

  const openWizard = () => setWizardOpen(true);

  const openCycle = async (id: string) => {
    try {
      const data = await apiService.getTrainingCycle(id);
      setActiveCycleId(id);
      setCycleDetail(data);
      setTab(1);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось открыть цикл');
    }
  };

  const removeCycle = async (id: string) => {
    if (!window.confirm('Удалить цикл?')) return;
    try {
      await apiService.deleteTrainingCycle(id);
      if (activeCycleId === id) {
        setActiveCycleId(null);
        setCycleDetail(null);
      }
      await loadCycles();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось удалить цикл');
    }
  };

  const openSessionEditor = async (training: PreviewTraining) => {
    setSessionTraining(training);
    setApplyTplId('');
    setApplySection('WARMUP');
    try {
      const plan = await apiService.getSessionPlanByTraining(training.id);
      const items: PlanItemDraft[] = (plan?.items || []).map((it: any) => ({
        key: newKey(),
        section: it.section as 'WARMUP' | 'MAIN',
        exerciseId: it.exerciseId,
        durationSec: it.durationSec != null ? String(it.durationSec) : '',
        sets: it.sets != null ? String(it.sets) : '',
        reps: it.reps != null ? String(it.reps) : '',
        notes: it.notes || '',
      }));
      setPlanItems(items);
      setSessionOpen(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось загрузить план');
    }
  };

  const saveSessionPlan = async () => {
    if (!sessionTraining) return;
    try {
      await apiService.upsertSessionPlan(sessionTraining.id, {
        cycleId: activeCycleId,
        items: planItems
          .filter((it) => it.exerciseId)
          .map((it, idx) => ({
            section: it.section,
            exerciseId: it.exerciseId,
            sortOrder: idx,
            durationSec: it.durationSec ? Number(it.durationSec) : null,
            sets: it.sets ? Number(it.sets) : null,
            reps: it.reps ? Number(it.reps) : null,
            notes: it.notes || null,
          })),
      });
      setSessionOpen(false);
      if (activeCycleId) await openCycle(activeCycleId);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить план');
    }
  };

  const applyTemplate = async () => {
    if (!sessionTraining || !applyTplId) return;
    try {
      const plan = await apiService.applyTemplateToSession(sessionTraining.id, {
        templateId: applyTplId,
        section: applySection,
        cycleId: activeCycleId || undefined,
        replace: true,
      });
      setPlanItems(
        (plan?.items || []).map((it: any) => ({
          key: newKey(),
          section: it.section,
          exerciseId: it.exerciseId,
          durationSec: it.durationSec != null ? String(it.durationSec) : '',
          sets: it.sets != null ? String(it.sets) : '',
          reps: it.reps != null ? String(it.reps) : '',
          notes: it.notes || '',
        }))
      );
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось применить шаблон');
    }
  };

  const exerciseOptions = useMemo(
    () => exercises.map((e) => ({ id: e.id, label: e.title })),
    [exercises]
  );

  const templatesForSection = useMemo(() => {
    const kind = applySection === 'WARMUP' ? 'WARMUP' : 'WORKOUT';
    return templates.filter((t) => t.kind === kind);
  }, [applySection, templates]);

  const renderPlanSectionEditor = (section: 'WARMUP' | 'MAIN', label: string) => {
    const rows = planItems.filter((p) => p.section === section);
    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {label}
          </Typography>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() =>
              setPlanItems((prev) => [
                ...prev,
                {
                  key: newKey(),
                  section,
                  exerciseId: '',
                  durationSec: '',
                  sets: '',
                  reps: '',
                  notes: '',
                },
              ])
            }
          >
            Упражнение
          </Button>
        </Stack>
        <Stack spacing={1}>
          {rows.map((row) => (
            <Stack key={row.key} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
              <Autocomplete
                sx={{ flex: 2, minWidth: 180 }}
                size="small"
                options={exerciseOptions}
                getOptionLabel={(o) => o.label}
                value={exerciseOptions.find((o) => o.id === row.exerciseId) || null}
                onChange={(_, v) =>
                  setPlanItems((prev) =>
                    prev.map((p) => (p.key === row.key ? { ...p, exerciseId: v?.id || '' } : p))
                  )
                }
                renderInput={(params) => <TextField {...params} label="Упражнение" />}
              />
              <TextField
                size="small"
                label="Сек"
                sx={{ width: 90 }}
                value={row.durationSec}
                onChange={(e) =>
                  setPlanItems((prev) =>
                    prev.map((p) => (p.key === row.key ? { ...p, durationSec: e.target.value } : p))
                  )
                }
              />
              <TextField
                size="small"
                label="Подх."
                sx={{ width: 80 }}
                value={row.sets}
                onChange={(e) =>
                  setPlanItems((prev) =>
                    prev.map((p) => (p.key === row.key ? { ...p, sets: e.target.value } : p))
                  )
                }
              />
              <TextField
                size="small"
                label="Повт."
                sx={{ width: 80 }}
                value={row.reps}
                onChange={(e) =>
                  setPlanItems((prev) =>
                    prev.map((p) => (p.key === row.key ? { ...p, reps: e.target.value } : p))
                  )
                }
              />
              <IconButton
                size="small"
                color="error"
                onClick={() => setPlanItems((prev) => prev.filter((p) => p.key !== row.key))}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          {rows.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Пусто
            </Typography>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 800, color: '#1B2438', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Тренировочный план
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: '#6B7280', mt: 0.6, maxWidth: 640 }}>
            {tab === 0
              ? 'Каталог упражнений, шаблонов разминки/тренировки и циклы по существующим занятиям.'
              : 'Собирайте циклы тренировок для конкретных групп из готовых упражнений и шаблонов.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
          <Button
            variant="outlined"
            startIcon={<DescriptionOutlined />}
            onClick={() => setTemplatesOpen(true)}
            sx={{
              textTransform: 'none',
              borderRadius: '12px',
              borderColor: '#C9D7FF',
              color: colors.primary,
              fontWeight: 700,
              bgcolor: '#fff',
              px: 1.75,
              height: 40,
            }}
          >
            Шаблоны
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={tab === 0 ? openNewExercise : openWizard}
            sx={{ ...btnPrimary, borderRadius: '12px', px: 2, height: 40 }}
          >
            {tab === 0 ? 'Упражнение' : 'Цикл'}
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {tab === 0 && (
        <ExerciseCatalog
          exercises={exercises}
          templates={templates}
          loading={loading}
          query={exerciseQ}
          onQuery={setExerciseQ}
          onCreate={openNewExercise}
          onEdit={(ex) => {
            const full = exercises.find((e) => e.id === ex.id) || ({ ...ex, media: ex.media || [] } as Exercise);
            openEditExercise(full);
          }}
          onDuplicate={(ex) => {
            const full = exercises.find((e) => e.id === ex.id) || ({ ...ex, media: ex.media || [] } as Exercise);
            void duplicateExercise(full);
          }}
          onAddToTemplate={(ex) => {
            const full = exercises.find((e) => e.id === ex.id) || ({ ...ex, media: ex.media || [] } as Exercise);
            addExerciseToTemplate(full);
          }}
          onUpload={(id, file) => void onUploadMedia(id, file)}
          onSwitchCycles={() => setTab(1)}
        />
      )}

      {tab === 1 && (
        <CyclesBoard
          cycles={cycles}
          groups={groups}
          exercises={exercises}
          templatesCount={templates.length}
          recentTemplates={templates.filter((t) => {
            const updated = (t as { updatedAt?: string }).updatedAt;
            return updated ? Date.now() - new Date(updated).getTime() < 7 * 24 * 3600 * 1000 : false;
          }).length}
          selectedId={activeCycleId}
          detail={cycleDetail}
          onSelect={(id) => void openCycle(id)}
          onCreate={openWizard}
          onDelete={(id) => void removeCycle(id)}
          onOpenExercise={openNewExercise}
          onSwitchExercises={() => setTab(0)}
          onChanged={() => {
            if (activeCycleId) void openCycle(activeCycleId);
            void loadCycles();
          }}
        />
      )}

      <CreateExerciseDialog
        open={exerciseDialog}
        editing={editingExercise}
        onClose={() => {
          setExerciseDialog(false);
          setEditingExercise(null);
        }}
        onError={(msg) => setError(msg)}
        onSaved={async () => {
          await loadExercises(exerciseQ.trim() || undefined);
          await loadTemplates();
        }}
      />

      {/* Templates list */}
      <Dialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <span>Шаблоны разминки и тренировки</span>
            <Button size="small" startIcon={<Add />} onClick={openNewTemplate}>
              Шаблон
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {templates.length === 0 ? (
            <Typography color="text.secondary">Шаблонов пока нет</Typography>
          ) : (
            <Stack spacing={1}>
              {templates.map((tpl) => (
                <Paper key={tpl.id} sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600}>{tpl.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tpl.kind === 'WARMUP' ? 'Разминка' : 'Тренировка'} ·{' '}
                        {(tpl.items || []).length} упр.
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {(tpl.items || [])
                          .map((it) => it.exercise?.title || '—')
                          .join(', ')}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => openEditTemplate(tpl)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => removeTemplate(tpl.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplatesOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Template editor */}
      <Dialog open={tplDialog} onClose={() => setTplDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingTpl ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Название"
              fullWidth
              value={tplTitle}
              onChange={(e) => setTplTitle(e.target.value)}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Тип</InputLabel>
              <Select
                label="Тип"
                value={tplKind}
                onChange={(e) => setTplKind(e.target.value as 'WARMUP' | 'WORKOUT')}
              >
                <MenuItem value="WARMUP">Разминка</MenuItem>
                <MenuItem value="WORKOUT">Тренировка</MenuItem>
              </Select>
            </FormControl>
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography fontWeight={600}>Упражнения</Typography>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={() =>
                  setTplItems((prev) => [
                    ...prev,
                    {
                      key: newKey(),
                      exerciseId: '',
                      durationSec: '',
                      sets: '',
                      reps: '',
                      notes: '',
                    },
                  ])
                }
              >
                Добавить
              </Button>
            </Stack>
            {tplItems.map((row) => (
              <Stack key={row.key} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Autocomplete
                  sx={{ flex: 2 }}
                  size="small"
                  options={exerciseOptions}
                  getOptionLabel={(o) => o.label}
                  value={exerciseOptions.find((o) => o.id === row.exerciseId) || null}
                  onChange={(_, v) =>
                    setTplItems((prev) =>
                      prev.map((p) => (p.key === row.key ? { ...p, exerciseId: v?.id || '' } : p))
                    )
                  }
                  renderInput={(params) => <TextField {...params} label="Упражнение" />}
                />
                <TextField
                  size="small"
                  label="Сек"
                  sx={{ width: 90 }}
                  value={row.durationSec}
                  onChange={(e) =>
                    setTplItems((prev) =>
                      prev.map((p) =>
                        p.key === row.key ? { ...p, durationSec: e.target.value } : p
                      )
                    )
                  }
                />
                <TextField
                  size="small"
                  label="Подх."
                  sx={{ width: 80 }}
                  value={row.sets}
                  onChange={(e) =>
                    setTplItems((prev) =>
                      prev.map((p) => (p.key === row.key ? { ...p, sets: e.target.value } : p))
                    )
                  }
                />
                <TextField
                  size="small"
                  label="Повт."
                  sx={{ width: 80 }}
                  value={row.reps}
                  onChange={(e) =>
                    setTplItems((prev) =>
                      prev.map((p) => (p.key === row.key ? { ...p, reps: e.target.value } : p))
                    )
                  }
                />
                <IconButton
                  color="error"
                  onClick={() => setTplItems((prev) => prev.filter((p) => p.key !== row.key))}
                >
                  <Delete />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTplDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveTemplate} disabled={!tplTitle.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <CreateCycleWizardDialog
        open={wizardOpen}
        groups={groups}
        onClose={() => setWizardOpen(false)}
        onError={(msg) => setError(msg)}
        onCreated={async (cycleId) => {
          setWizardOpen(false);
          await loadCycles();
          await openCycle(cycleId);
        }}
      />

      {/* Session plan editor */}
      <Dialog open={sessionOpen} onClose={() => setSessionOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          План сессии
          {sessionTraining && (
            <Typography variant="body2" color="text.secondary">
              {sessionTraining.title} ·{' '}
              {format(new Date(sessionTraining.startTime), 'd MMM yyyy HH:mm', { locale: ru })}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Секция</InputLabel>
              <Select
                label="Секция"
                value={applySection}
                onChange={(e) => setApplySection(e.target.value as 'WARMUP' | 'MAIN')}
              >
                <MenuItem value="WARMUP">Разминка</MenuItem>
                <MenuItem value="MAIN">Основная</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
              <InputLabel>Шаблон</InputLabel>
              <Select
                label="Шаблон"
                value={applyTplId}
                onChange={(e) => setApplyTplId(e.target.value)}
              >
                {templatesForSection.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" disabled={!applyTplId} onClick={applyTemplate}>
              Применить шаблон
            </Button>
          </Stack>
          {renderPlanSectionEditor('WARMUP', 'Разминка')}
          <Divider sx={{ my: 2 }} />
          {renderPlanSectionEditor('MAIN', 'Основная часть')}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveSessionPlan}>
            Сохранить план
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrainingPlan;
