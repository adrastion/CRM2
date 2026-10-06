import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Group as GroupIcon, Person } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { Branch, Client, Group, Hall, Trainer } from '../../types';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';

type TrainingType = 'group' | 'individual';

type FormState = {
  title: string;
  description: string;
  date: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  trainingType: TrainingType;
  groupId: string;
  selectedClientIds: string[];
  trainerId: string;
  branchId: string;
  hallId: string;
  price: string;
};

const defaultStartTime = (): Date => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d;
};

const defaultEndTime = (): Date => {
  const d = new Date();
  d.setHours(11, 0, 0, 0);
  return d;
};

const createEmptyForm = (trainingType: TrainingType): FormState => ({
  title: '',
  description: '',
  date: new Date(),
  startTime: defaultStartTime(),
  endTime: defaultEndTime(),
  trainingType,
  groupId: '',
  selectedClientIds: [],
  trainerId: '',
  branchId: '',
  hallId: '',
  price: '',
});

const trainerLabel = (trainer: Trainer) =>
  trainer.user
    ? `${trainer.user.lastName} ${trainer.user.firstName} ${trainer.user.middleName || ''}`.trim()
    : `Тренер #${trainer.id}`;

const clientLabel = (c: Client) => {
  const full = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ').trim();
  return full || `${c.firstName} ${c.lastName}`;
};

export interface CreateTrainingFlowDialogsProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'type' | 'form';

const CreateTrainingFlowDialogs: React.FC<CreateTrainingFlowDialogsProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));

  const [step, setStep] = useState<Step>('type');
  const [formData, setFormData] = useState<FormState>(() => createEmptyForm('group'));
  const [formBaseline, setFormBaseline] = useState<FormState>(() => createEmptyForm('group'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allHalls, setAllHalls] = useState<Hall[]>([]);
  const [branchHalls, setBranchHalls] = useState<Hall[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const hallsForBranch = useMemo(() => {
    if (!formData.branchId) return [];
    const fromBranch = branchHalls.filter((h) => h.branchId === formData.branchId && h.isActive);
    if (fromBranch.length > 0) return fromBranch;
    return allHalls.filter((h) => h.branchId === formData.branchId && h.isActive);
  }, [allHalls, branchHalls, formData.branchId]);

  const resetAll = useCallback(() => {
    setStep('type');
    const empty = createEmptyForm('group');
    setFormData(empty);
    setFormBaseline(empty);
    setIsSubmitting(false);
    setRefsError(null);
    setBranchHalls([]);
  }, []);

  const closeFlow = useCallback(() => {
    resetAll();
    onClose();
  }, [onClose, resetAll]);

  useEffect(() => {
    if (!open) {
      resetAll();
      return;
    }

    resetAll();
    setRefsLoading(true);
    setRefsError(null);

    const abort = new AbortController();
    Promise.all([
      apiService.getGroups({ limit: 1000, page: 1 }, abort.signal),
      apiService.getTrainers({ limit: 1000, page: 1 }, abort.signal),
      apiService.getBranches({ limit: 1000, page: 1 }, abort.signal),
      apiService
        .getHalls({ limit: 1000, page: 1 }, abort.signal)
        .catch(() => ({ data: [] as Hall[] })),
      apiService.getClients({ limit: 1000 }, abort.signal).catch(() => ({ data: [] as Client[] })),
    ])
      .then(([groupsRes, trainersRes, branchesRes, hallsRes, clientsRes]) => {
        if (abort.signal.aborted) return;
        setGroups(groupsRes.data || []);
        setTrainers(trainersRes.data || []);
        setBranches(branchesRes.data || []);
        setAllHalls(hallsRes.data || []);
        setClients(clientsRes?.data || []);
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Не удалось загрузить справочники';
        setRefsError(message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setRefsLoading(false);
      });

    return () => abort.abort();
  }, [open, resetAll]);

  const pickType = (trainingType: TrainingType) => {
    const next = createEmptyForm(trainingType);
    setFormData(next);
    setFormBaseline(next);
    setStep('form');
  };

  const discardForm = useCallback(() => {
    if (step === 'form') {
      setStep('type');
      const empty = createEmptyForm('group');
      setFormData(empty);
      setFormBaseline(empty);
      return;
    }
    closeFlow();
  }, [closeFlow, step]);

  const formDirty = open && step === 'form' && isDirtyValue(formData, formBaseline);

  const submitCreate = useCallback(async (): Promise<boolean> => {
    if (isSubmitting) return false;

    if (!formData.title.trim()) {
      alert('Пожалуйста, укажите название тренировки');
      return false;
    }
    if (formData.trainingType === 'group') {
      if (!formData.groupId) {
        alert('Пожалуйста, выберите группу');
        return false;
      }
    } else if (!formData.selectedClientIds.length) {
      alert('Пожалуйста, выберите хотя бы одного клиента');
      return false;
    }
    if (!formData.trainerId) {
      alert('Пожалуйста, выберите тренера');
      return false;
    }
    if (!formData.branchId) {
      alert('Пожалуйста, выберите филиал');
      return false;
    }
    if (!formData.date || !formData.startTime || !formData.endTime) {
      alert('Пожалуйста, выберите дату, время начала и окончания');
      return false;
    }

    const trainingData: Record<string, unknown> = {
      title: formData.title.trim(),
      description: formData.description,
      trainerId: formData.trainerId,
      branchId: formData.branchId,
      hallId: formData.hallId || undefined,
      isRecurring: false,
      recurrence: 'weekly',
      daysOfWeek: [],
    };

    if (formData.trainingType === 'group') {
      trainingData.groupId = formData.groupId;
    } else {
      trainingData.groupId = null;
      const priceNum = formData.price ? parseFloat(formData.price) : NaN;
      if (Number.isFinite(priceNum) && priceNum >= 0) {
        trainingData.price = priceNum;
      }
    }

    const baseDate = formData.date;
    const startTime = new Date(baseDate);
    startTime.setHours(formData.startTime.getHours(), formData.startTime.getMinutes(), 0, 0);
    const endTime = new Date(baseDate);
    endTime.setHours(formData.endTime.getHours(), formData.endTime.getMinutes(), 0, 0);

    const payload = {
      ...trainingData,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };

    try {
      setIsSubmitting(true);
      const createdTraining = await apiService.createTraining(payload);
      const trainingId = createdTraining?.id || createdTraining?.data?.id;

      if (formData.trainingType === 'individual' && formData.selectedClientIds.length && trainingId) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const attendances = formData.selectedClientIds.map((clientId) => ({
            clientId,
            status: 'PRESENT',
            notes: '',
            shouldCharge: false,
          }));
          await apiService.bulkUpdateAttendance(trainingId, attendances);
        } catch {
          alert('Тренировка создана, но не удалось добавить клиентов в посещаемость');
        }
      }

      onSuccess?.();
      closeFlow();
      return true;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; data?: Array<{ field: string; message: string }> } }; message?: string };
      const details = err.response?.data?.data;
      if (details && Array.isArray(details)) {
        alert(
          `Ошибка создания тренировки:\n${details.map((e) => `${e.field}: ${e.message}`).join('\n')}`
        );
      } else {
        alert(err.response?.data?.error || err.message || 'Не удалось создать тренировку');
      }
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [closeFlow, formData, isSubmitting, onSuccess]);

  const unsaved = useUnsavedClose({
    isDirty: Boolean(formDirty),
    onDiscard: closeFlow,
    onSave: submitCreate,
  });

  const handleTypeDialogClose = () => {
    closeFlow();
  };

  const handleFormDialogClose = (_event: object, reason?: string) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      unsaved.requestClose(reason);
    }
  };

  const loadHallsForBranch = async (branchId: string) => {
    if (!branchId) {
      setBranchHalls([]);
      return;
    }
    try {
      const hallsRes = await apiService.getHalls({ branchId });
      setBranchHalls(hallsRes.data || []);
    } catch {
      setBranchHalls([]);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
      <Dialog
        open={open && step === 'type'}
        onClose={handleTypeDialogClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>Какое занятие вы хотите добавить?</DialogTitle>
        <DialogContent>
          {refsLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          )}
          {refsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {refsError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: refsLoading ? 0 : 2 }}>
            <Button
              variant="outlined"
              fullWidth
              size="large"
              disabled={refsLoading}
              onClick={() => pickType('group')}
              sx={{ py: 2 }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <GroupIcon sx={{ fontSize: 40 }} />
                <Typography variant="h6">Тренировка группы</Typography>
                <Typography variant="body2" color="text.secondary">
                  Создать тренировку для группы
                </Typography>
              </Box>
            </Button>
            <Button
              variant="outlined"
              fullWidth
              size="large"
              disabled={refsLoading}
              onClick={() => pickType('individual')}
              sx={{ py: 2 }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Person sx={{ fontSize: 40 }} />
                <Typography variant="h6">Индивидуальная тренировка</Typography>
                <Typography variant="body2" color="text.secondary">
                  Создать разовую тренировку для выбранных клиентов
                </Typography>
              </Box>
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTypeDialogClose}>Отмена</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={open && step === 'form'}
        onClose={handleFormDialogClose}
        maxWidth="md"
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>Создать новую тренировку</DialogTitle>
        <DialogContent>
          {refsError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {refsError}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Тип тренировки
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formData.trainingType === 'group'
                    ? 'Тренировка для группы'
                    : 'Индивидуальная тренировка (разовая)'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Название тренировки"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <DatePicker
                label="Дата тренировки"
                value={formData.date}
                onChange={(newValue) => setFormData({ ...formData, date: newValue })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TimePicker
                label="Время начала"
                value={formData.startTime}
                onChange={(newValue) => setFormData({ ...formData, startTime: newValue })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TimePicker
                label="Время окончания"
                value={formData.endTime}
                onChange={(newValue) => setFormData({ ...formData, endTime: newValue })}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>

            {formData.trainingType === 'group' && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Группа</InputLabel>
                  <Select
                    value={formData.groupId}
                    label="Группа"
                    onChange={(e) => {
                      const groupId = e.target.value;
                      const group = groups.find((g) => g.id === groupId);
                      setFormData({
                        ...formData,
                        groupId,
                        trainerId: group?.trainerId || formData.trainerId,
                      });
                    }}
                  >
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {formData.trainingType === 'individual' && (
              <>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    disableCloseOnSelect
                    options={clients.filter((c) => c.isActive)}
                    getOptionLabel={clientLabel}
                    value={clients.filter((c) => formData.selectedClientIds.includes(c.id))}
                    onChange={(_event, newValue) => {
                      setFormData({
                        ...formData,
                        selectedClientIds: newValue.map((c) => c.id),
                      });
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Клиенты" required placeholder="ФИО, телефон или email" />
                    )}
                    renderOption={(props, option) => {
                      const selected = formData.selectedClientIds.includes(option.id);
                      return (
                        <li {...props} key={option.id}>
                          <Checkbox checked={selected} sx={{ mr: 1 }} />
                          <Box>
                            <Typography variant="body1">{clientLabel(option)}</Typography>
                            {(option.phone || option.email) && (
                              <Typography variant="body2" color="text.secondary">
                                {option.phone || option.email}
                              </Typography>
                            )}
                          </Box>
                        </li>
                      );
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip {...getTagProps({ index })} key={option.id} label={clientLabel(option)} />
                      ))
                    }
                    filterOptions={(options, { inputValue }) => {
                      const q = inputValue.toLowerCase();
                      return options.filter((option) => {
                        const fullName = [option.lastName, option.firstName, option.middleName]
                          .filter(Boolean)
                          .join(' ')
                          .toLowerCase();
                        return (
                          fullName.includes(q) ||
                          (option.phone || '').toLowerCase().includes(q) ||
                          (option.email || '').toLowerCase().includes(q)
                        );
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Цена тренировки (руб.)"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Тренер</InputLabel>
                <Select
                  value={formData.trainerId}
                  label="Тренер"
                  onChange={(e) => {
                    const trainerId = e.target.value;
                    const trainer = trainers.find((t) => t.id === trainerId) as Trainer & {
                      individualTrainingPrice?: number;
                    };
                    setFormData({
                      ...formData,
                      trainerId,
                      price:
                        formData.trainingType === 'individual'
                          ? String(trainer?.individualTrainingPrice ?? formData.price ?? '')
                          : formData.price,
                    });
                  }}
                >
                  {trainers.map((trainer) => (
                    <MenuItem key={trainer.id} value={trainer.id}>
                      {trainerLabel(trainer)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Филиал</InputLabel>
                <Select
                  value={formData.branchId}
                  label="Филиал"
                  onChange={(e) => {
                    const branchId = e.target.value;
                    setFormData({ ...formData, branchId, hallId: '' });
                    void loadHallsForBranch(branchId);
                  }}
                >
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Зал (необязательно)</InputLabel>
                <Select
                  value={formData.hallId}
                  label="Зал (необязательно)"
                  disabled={!formData.branchId}
                  onChange={(e) => setFormData({ ...formData, hallId: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Не выбран</em>
                  </MenuItem>
                  {hallsForBranch.map((hall) => (
                    <MenuItem key={hall.id} value={hall.id}>
                      {hall.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={discardForm} disabled={isSubmitting}>
            Назад
          </Button>
          <Button onClick={() => void submitCreate()} variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Создание…' : 'Создать тренировку'}
          </Button>
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        open={unsaved.confirmOpen}
        saving={unsaved.saving || isSubmitting}
        onSave={() => void unsaved.save()}
        onDiscard={unsaved.discard}
        onStay={unsaved.stay}
      />
    </LocalizationProvider>
  );
};

export default CreateTrainingFlowDialogs;
