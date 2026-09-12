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
import { Add, Delete, Edit, ExpandMore, FitnessCenter } from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';

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
  branch?: { name: string } | null;
  color?: string | null;
};

type Cycle = {
  id: string;
  title: string | null;
  dateFrom: string;
  dateTo: string;
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
          bgcolor: 'action.hover',
          borderRadius: 1,
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
        style={{ maxWidth: 280, maxHeight: 180, borderRadius: 8, display: 'block' }}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      style={{ maxWidth: 280, maxHeight: 180, objectFit: 'contain', borderRadius: 8, display: 'block' }}
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
  const [exTitle, setExTitle] = useState('');
  const [exDesc, setExDesc] = useState('');
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
  const [wizardStep, setWizardStep] = useState(0);
  const [cycleTitle, setCycleTitle] = useState('');
  const [cycleGroups, setCycleGroups] = useState<GroupOpt[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
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
    const t = setTimeout(() => {
      loadExercises(exerciseQ.trim() || undefined).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [exerciseQ, loadExercises]);

  const openNewExercise = () => {
    setEditingExercise(null);
    setExTitle('');
    setExDesc('');
    setExerciseDialog(true);
  };

  const openEditExercise = (ex: Exercise) => {
    setEditingExercise(ex);
    setExTitle(ex.title);
    setExDesc(ex.description || '');
    setExerciseDialog(true);
  };

  const saveExercise = async () => {
    try {
      if (!exTitle.trim()) return;
      if (editingExercise) {
        await apiService.updateExercise(editingExercise.id, {
          title: exTitle.trim(),
          description: exDesc,
        });
      } else {
        await apiService.createExercise({ title: exTitle.trim(), description: exDesc });
      }
      setExerciseDialog(false);
      await loadExercises(exerciseQ.trim() || undefined);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось сохранить упражнение');
    }
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

  const openWizard = () => {
    setWizardStep(0);
    setCycleTitle('');
    setCycleGroups([]);
    setDateFrom('');
    setDateTo('');
    setPreview(null);
    setWizardOpen(true);
  };

  const runPreview = async () => {
    try {
      const data = await apiService.previewTrainingCycleDraft({
        dateFrom,
        dateTo,
        groupIds: cycleGroups.map((g) => g.id),
      });
      setPreview(data);
      setWizardStep(2);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось посчитать статистику');
    }
  };

  const createCycle = async () => {
    try {
      const created = await apiService.createTrainingCycle({
        title: cycleTitle.trim() || null,
        dateFrom,
        dateTo,
        groupIds: cycleGroups.map((g) => g.id),
      });
      setWizardOpen(false);
      await loadCycles();
      await openCycle(created.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось создать цикл');
    }
  };

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
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FitnessCenter /> Тренировочный план
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Каталог упражнений, шаблоны разминки/тренировки и циклы по существующим занятиям
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => setTemplatesOpen(true)}>
          Шаблоны
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Упражнения" />
        <Tab label="Циклы" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Поиск упражнений…"
              value={exerciseQ}
              onChange={(e) => setExerciseQ(e.target.value)}
            />
            <Button variant="contained" startIcon={<Add />} onClick={openNewExercise} sx={{ whiteSpace: 'nowrap' }}>
              Упражнение
            </Button>
          </Stack>

          {loading && exercises.length === 0 ? (
            <Typography color="text.secondary">Загрузка…</Typography>
          ) : exercises.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Каталог пуст — добавьте первое упражнение</Typography>
            </Paper>
          ) : (
            exercises.map((ex) => (
              <Accordion
                key={ex.id}
                expanded={expandedEx === ex.id}
                onChange={(_, exp) => setExpandedEx(exp ? ex.id : false)}
                disableGutters
                sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
              >
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', pr: 1 }}>
                    <Typography fontWeight={600} sx={{ flex: 1 }}>
                      {ex.title}
                    </Typography>
                    {ex.media?.length > 0 && (
                      <Chip size="small" label={`${ex.media.length} медиа`} />
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditExercise(ex);
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExercise(ex.id);
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {ex.description && (
                    <Typography variant="body2" sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>
                      {ex.description}
                    </Typography>
                  )}
                  <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    {(ex.media || []).map((m) => (
                      <Box key={m.id} sx={{ position: 'relative' }}>
                        <MediaThumb mediaId={m.id} kind={m.kind} mimeType={m.mimeType} />
                        <IconButton
                          size="small"
                          color="error"
                          sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper' }}
                          onClick={() => removeMedia(ex.id, m.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                  <Button component="label" size="small" variant="outlined">
                    Загрузить фото/видео
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                      onChange={(e) => onUploadMedia(ex.id, e.target.files?.[0] || null)}
                    />
                  </Button>
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          {!cycleDetail ? (
            <>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Циклы
                </Typography>
                <Button variant="contained" startIcon={<Add />} onClick={openWizard}>
                  Новый цикл
                </Button>
              </Stack>
              {cycles.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    Нет циклов. Создайте цикл по группам и диапазону дат — план привяжется к уже
                    существующим тренировкам.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={1}>
                  {cycles.map((c) => (
                    <Paper
                      key={c.id}
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => openCycle(c.id)}
                    >
                      <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Typography fontWeight={600}>
                          {c.title || 'Цикл без названия'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(c.dateFrom), 'd MMM yyyy', { locale: ru })} —{' '}
                          {format(new Date(c.dateTo), 'd MMM yyyy', { locale: ru })}
                        </Typography>
                      </Box>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {c.groups?.map((g) => (
                          <Chip key={g.groupId} size="small" label={g.group.name} />
                        ))}
                      </Stack>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Планов: ${c._count?.sessionPlans ?? 0}`}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCycle(c.id);
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Paper>
                  ))}
                </Stack>
              )}
            </>
          ) : (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <Button size="small" onClick={() => setCycleDetail(null)}>
                  ← К списку
                </Button>
                <Typography variant="h6" sx={{ flex: 1 }}>
                  {cycleDetail.title || 'Цикл'}
                </Typography>
              </Stack>
              <Alert severity="info" sx={{ mb: 2 }}>
                Тренировок в периоде: <strong>{cycleDetail.preview?.total ?? 0}</strong>
                {cycleDetail.preview?.byMonth &&
                  Object.keys(cycleDetail.preview.byMonth).length > 0 && (
                    <>
                      {' '}
                      · по месяцам:{' '}
                      {Object.entries(cycleDetail.preview.byMonth)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')}
                    </>
                  )}
              </Alert>
              <Stack spacing={1}>
                {(cycleDetail.preview?.trainings || []).map((t) => (
                  <Paper
                    key={t.id}
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                      alignItems: 'center',
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography fontWeight={600}>{t.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(t.startTime), 'EEEE, d MMMM yyyy, HH:mm', { locale: ru })}
                        {t.group ? ` · ${t.group.name}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={t.hasPlan ? 'success' : 'default'}
                      label={t.hasPlan ? 'План есть' : 'План не задан'}
                    />
                    <Button size="small" variant="outlined" onClick={() => openSessionEditor(t)}>
                      Редактировать план
                    </Button>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}

      {/* Exercise dialog */}
      <Dialog open={exerciseDialog} onClose={() => setExerciseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingExercise ? 'Редактировать упражнение' : 'Новое упражнение'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Название"
              fullWidth
              required
              value={exTitle}
              onChange={(e) => setExTitle(e.target.value)}
            />
            <TextField
              label="Описание"
              fullWidth
              multiline
              minRows={3}
              value={exDesc}
              onChange={(e) => setExDesc(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExerciseDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={saveExercise} disabled={!exTitle.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Cycle wizard */}
      <Dialog open={wizardOpen} onClose={() => setWizardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Новый цикл · шаг {wizardStep + 1} из 3</DialogTitle>
        <DialogContent>
          {wizardStep === 0 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Название (необязательно)"
                fullWidth
                value={cycleTitle}
                onChange={(e) => setCycleTitle(e.target.value)}
              />
              <Autocomplete
                multiple
                options={groups}
                getOptionLabel={(g) =>
                  g.branch?.name ? `${g.name} (${g.branch.name})` : g.name
                }
                value={cycleGroups}
                onChange={(_, v) => setCycleGroups(v)}
                renderInput={(params) => <TextField {...params} label="Группы" />}
              />
            </Stack>
          )}
          {wizardStep === 1 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="С даты"
                type="date"
                InputLabelProps={{ shrink: true }}
                fullWidth
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <TextField
                label="По дату"
                type="date"
                InputLabelProps={{ shrink: true }}
                fullWidth
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </Stack>
          )}
          {wizardStep === 2 && preview && (
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ mb: 1 }}>
                Найдено тренировок: <strong>{preview.total}</strong>
              </Typography>
              {Object.keys(preview.byWeek || {}).length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  По неделям:{' '}
                  {Object.entries(preview.byWeek)
                    .slice(0, 8)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('; ')}
                  {Object.keys(preview.byWeek).length > 8 ? '…' : ''}
                </Typography>
              )}
              {Object.keys(preview.byMonth || {}).length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  По месяцам:{' '}
                  {Object.entries(preview.byMonth)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ')}
                </Typography>
              )}
              {preview.total === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  В выбранном диапазоне нет тренировок выбранных групп. Цикл всё равно можно создать.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWizardOpen(false)}>Отмена</Button>
          {wizardStep > 0 && (
            <Button onClick={() => setWizardStep((s) => s - 1)}>Назад</Button>
          )}
          {wizardStep === 0 && (
            <Button
              variant="contained"
              disabled={cycleGroups.length === 0}
              onClick={() => setWizardStep(1)}
            >
              Далее
            </Button>
          )}
          {wizardStep === 1 && (
            <Button
              variant="contained"
              disabled={!dateFrom || !dateTo}
              onClick={runPreview}
            >
              Статистика
            </Button>
          )}
          {wizardStep === 2 && (
            <Button variant="contained" onClick={createCycle}>
              Создать цикл
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
