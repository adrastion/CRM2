import React, { useCallback, useEffect, useRef, useState } from 'react';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';
import {
  validateClientForm,
  validateField,
  hasFormErrors,
  ClientFormData,
  ValidationErrors,
} from '../../utils/clientValidation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Assignment, Delete, PhotoCamera } from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../../services/api';
import { Client } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isPromoter as roleIsPromoter } from '../../utils/roles';

const EMPTY_CLIENT_FORM: ClientFormData = {
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  birthCertificateNumber: '',
  birthCertificate: '',
  medicalCertificateNumber: '',
  medicalCertificate: '',
  schoolOrKindergarten: '',
  photo: '',
  weight: '',
  athleteStatus: 'active',
  groupIds: [],
  parents: [],
};

type PassportData = {
  passportSeries: string;
  passportNumber: string;
  passportIssueDate: string;
  passportIssuedBy: string;
  passportDivisionCode: string;
  passportBirthPlace: string;
};

const validatePassport = (data: PassportData): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (data.passportSeries && data.passportSeries.trim() !== '') {
    if (!/^\d{4}$/.test(data.passportSeries)) {
      errors.passportSeries = 'Серия паспорта должна содержать 4 цифры';
    }
  }
  if (data.passportNumber && data.passportNumber.trim() !== '') {
    if (!/^\d{6}$/.test(data.passportNumber)) {
      errors.passportNumber = 'Номер паспорта должен содержать 6 цифр';
    }
  }
  if (data.passportDivisionCode && data.passportDivisionCode.trim() !== '') {
    const cleanedCode = data.passportDivisionCode.replace(/-/g, '');
    if (!/^\d{6}$/.test(cleanedCode)) {
      errors.passportDivisionCode = 'Код подразделения должен содержать 6 цифр (формат: 123-456)';
    }
  }
  if (data.passportIssueDate && data.passportIssueDate.trim() !== '') {
    const issueDate = new Date(data.passportIssueDate);
    const today = new Date();
    if (issueDate > today) {
      errors.passportIssueDate = 'Дата выдачи не может быть в будущем';
    }
  }
  if (data.passportIssuedBy && data.passportIssuedBy.trim() !== '') {
    if (data.passportIssuedBy.trim().length < 3) {
      errors.passportIssuedBy = 'Поле должно содержать минимум 3 символа';
    }
  }
  if (data.passportBirthPlace && data.passportBirthPlace.trim() !== '') {
    if (data.passportBirthPlace.trim().length < 3) {
      errors.passportBirthPlace = 'Поле должно содержать минимум 3 символа';
    }
  }
  return errors;
};

const hasPassportErrors = (errors: Record<string, string>): boolean => Object.keys(errors).length > 0;

export type CreateClientDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (client?: Client) => void;
};

const CreateClientDialog: React.FC<CreateClientDialogProps> = ({ open, onClose, onSuccess }) => {
  const { user } = useAuth();
  const isPromoter = roleIsPromoter(user?.role);

  const [formData, setFormData] = useState<ClientFormData>({ ...EMPTY_CLIENT_FORM });
  const [formBaseline, setFormBaseline] = useState<ClientFormData>({ ...EMPTY_CLIENT_FORM });
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [validFields, setValidFields] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [createBillingEffectiveFrom, setCreateBillingEffectiveFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [trialTrainingId, setTrialTrainingId] = useState('');
  const [upcomingTrialTrainings, setUpcomingTrialTrainings] = useState<any[]>([]);
  const [loadingTrialTrainings, setLoadingTrialTrainings] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [birthCertificatePreview, setBirthCertificatePreview] = useState<string | null>(null);
  const birthCertificateInputRef = useRef<HTMLInputElement>(null);
  const [medicalCertificatePreview, setMedicalCertificatePreview] = useState<string | null>(null);
  const medicalCertificateInputRef = useRef<HTMLInputElement>(null);

  const [passportDialog, setPassportDialog] = useState(false);
  const [passportData, setPassportData] = useState<PassportData>({
    passportSeries: '',
    passportNumber: '',
    passportIssueDate: '',
    passportIssuedBy: '',
    passportDivisionCode: '',
    passportBirthPlace: '',
  });
  const [passportErrors, setPassportErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setFormData({ ...EMPTY_CLIENT_FORM });
    setFormBaseline({ ...EMPTY_CLIENT_FORM });
    setFormErrors({});
    setTouchedFields(new Set());
    setValidFields(new Set());
    setError('');
    setTrialEnabled(false);
    setTrialTrainingId('');
    setUpcomingTrialTrainings([]);
    setPhotoPreview(null);
    setBirthCertificatePreview(null);
    setMedicalCertificatePreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (birthCertificateInputRef.current) birthCertificateInputRef.current.value = '';
    if (medicalCertificateInputRef.current) medicalCertificateInputRef.current.value = '';
    const d = new Date();
    setCreateBillingEffectiveFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
    if (isPromoter) return;
    let cancelled = false;
    (async () => {
      try {
        const groupsRes = await apiService.getGroups({ limit: 1000, page: 1 }).catch(() => ({ data: [] }));
        if (!cancelled) setGroups(groupsRes.data || []);
      } catch (err) {
        console.error('Failed to load groups for create client:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isPromoter, resetForm]);

  const loadUpcomingTrialTrainings = async (groupId?: string) => {
    setLoadingTrialTrainings(true);
    try {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      const res = await apiService.getTrainings({
        startDate: now.toISOString(),
        endDate: end.toISOString(),
        limit: 50,
        page: 1,
      });
      let list = (res.data || []).filter((t: any) => t.groupId && !t.isCancelled);
      if (groupId) list = list.filter((t: any) => t.groupId === groupId);
      setUpcomingTrialTrainings(list);
    } catch (err) {
      console.error('Failed to load trainings for trial:', err);
      setUpcomingTrialTrainings([]);
    } finally {
      setLoadingTrialTrainings(false);
    }
  };

  const validateFieldValue = (fieldName: string, value: any, parentIndex?: number) => {
    const fieldError = validateField(fieldName, value, formData, parentIndex);
    setFormErrors((prev) => {
      const newErrors = { ...prev };
      const errorKey =
        parentIndex !== undefined ? `parent_${parentIndex}_${fieldName.replace('parent_', '')}` : fieldName;
      if (fieldError) newErrors[errorKey] = fieldError;
      else delete newErrors[errorKey];
      return newErrors;
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touchedFields.has(field)) validateFieldValue(field, value);
    if (error) setError('');
  };

  const handleParentFieldChange = (index: number, field: string, value: string) => {
    const newParents = [...formData.parents];
    newParents[index] = { ...newParents[index], [field]: value };
    setFormData((prev) => ({ ...prev, parents: newParents }));
    const errorKey = `parent_${index}_${field}`;
    if (touchedFields.has(errorKey)) {
      const fieldName =
        field === 'fullName' ? 'parent_fullName' : field === 'email' ? 'parent_email' : field === 'phone' ? 'parent_phone' : field;
      validateFieldValue(fieldName, value, index);
    }
  };

  const handleParentFieldBlur = (index: number, field: string, value: string) => {
    const errorKey = `parent_${index}_${field}`;
    setTouchedFields((prev) => new Set(prev).add(errorKey));
    const fieldName =
      field === 'fullName' ? 'parent_fullName' : field === 'email' ? 'parent_email' : field === 'phone' ? 'parent_phone' : field;
    validateFieldValue(fieldName, value, index);
  };

  const handleCreateClient = async (): Promise<boolean> => {
    const errors = validateClientForm(formData);
    if (trialEnabled && !trialTrainingId) {
      setError('Выберите занятие для пробной записи');
      setSnackbarMessage('Для пробного занятия нужно выбрать тренировку');
      setSnackbarOpen(true);
      return false;
    }
    if (hasFormErrors(errors)) {
      setError('Пожалуйста, исправьте ошибки в форме');
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      return false;
    }
    try {
      const { groupIds, ...clientData } = formData;
      const dataToSend: any = isPromoter
        ? {
            firstName: clientData.firstName,
            lastName: clientData.lastName,
            gender: clientData.gender || null,
            dateOfBirth: clientData.dateOfBirth || null,
            phone: clientData.phone || null,
          }
        : {
            ...clientData,
            weight: clientData.weight ? parseFloat(clientData.weight) : null,
            passportSeries: clientData.passportSeries?.trim() ? clientData.passportSeries : null,
            passportNumber: clientData.passportNumber?.trim() ? clientData.passportNumber : null,
            passportIssueDate: clientData.passportIssueDate?.trim() ? clientData.passportIssueDate : null,
            passportIssuedBy: clientData.passportIssuedBy?.trim() ? clientData.passportIssuedBy : null,
            passportDivisionCode: clientData.passportDivisionCode?.trim() ? clientData.passportDivisionCode : null,
            passportBirthPlace: clientData.passportBirthPlace?.trim() ? clientData.passportBirthPlace : null,
          };
      if (!isPromoter) {
        if (!dataToSend.birthCertificate) delete dataToSend.birthCertificate;
        if (!dataToSend.medicalCertificate) delete dataToSend.medicalCertificate;
      }
      const createdClient = await apiService.createClient(dataToSend);
      let trialGroupId: string | null = null;
      if (!isPromoter && trialEnabled && trialTrainingId && createdClient?.id) {
        try {
          const membership = await apiService.assignClientTrial(createdClient.id, trialTrainingId);
          trialGroupId = membership?.groupId || membership?.group?.id || null;
        } catch (err: any) {
          console.error('Error assigning trial:', err);
          setSnackbarMessage(err?.response?.data?.error || 'Клиент создан, но не удалось записать на пробное занятие');
          setSnackbarOpen(true);
        }
      }
      if (!isPromoter && groupIds?.length && createdClient?.id) {
        for (const groupId of groupIds) {
          if (trialGroupId && groupId === trialGroupId) continue;
          try {
            const group = groups.find((g) => g.id === groupId);
            const needsBillingDate =
              Boolean(group?.isMonthlyPayment) ||
              Boolean(
                (group as any)?.membershipPlans?.some(
                  (p: any) => p.membership?.category === 'GROUP' && p.membership?.isActive !== false
                )
              );
            await apiService.addClientToGroup(groupId, createdClient.id, needsBillingDate ? createBillingEffectiveFrom : undefined);
          } catch (err: any) {
            console.error(`Error adding client to group ${groupId}:`, err);
          }
        }
      }
      resetForm();
      onClose();
      await onSuccess?.(createdClient);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания клиента');
      console.error('Error creating client:', err);
      return false;
    }
  };

  const discardForm = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const isDirty = open && isDirtyValue(formData, formBaseline);
  const unsaved = useUnsavedClose({
    isDirty: Boolean(isDirty),
    onDiscard: discardForm,
    onSave: () => handleCreateClient(),
  });

  const submitCreate = () => {
    const validationErrors = validateClientForm(formData);
    setFormErrors(validationErrors);
    const newTouchedFields = new Set<string>();
    ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'weight'].forEach((field) => newTouchedFields.add(field));
    formData.parents.forEach((_, index) => {
      ['fullName', 'email', 'phone'].forEach((field) => newTouchedFields.add(`parent_${index}_${field}`));
    });
    setTouchedFields(newTouchedFields);
    if (hasFormErrors(validationErrors)) {
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      setValidFields(new Set());
      return;
    }
    handleCreateClient();
  };

  return (
    <>
<Dialog 
  open={open}
  onClose={(_event, reason) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      unsaved.requestClose(reason);
    }
  }}
  maxWidth="md" 
  fullWidth
  disableEscapeKeyDown={hasFormErrors(formErrors)}
>
  <DialogTitle>Добавить нового клиента</DialogTitle>
  <DialogContent>
    {error && (
      <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
        {error}
      </Alert>
    )}
    {isPromoter ? (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Фамилия"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            required
            error={!!formErrors.lastName}
            helperText={formErrors.lastName}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Имя"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            required
            error={!!formErrors.firstName}
            helperText={formErrors.firstName}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Пол</InputLabel>
            <Select
              value={formData.gender}
              label="Пол"
              onChange={(e) => handleInputChange('gender', e.target.value)}
            >
              <MenuItem value="male">Мужской</MenuItem>
              <MenuItem value="female">Женский</MenuItem>
              <MenuItem value="other">Другой</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Дата рождения"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            InputLabelProps={{ shrink: true }}
            error={!!formErrors.dateOfBirth}
            helperText={
              formErrors.dateOfBirth ||
              (formData.dateOfBirth
                ? (() => {
                    const dob = new Date(formData.dateOfBirth);
                    if (Number.isNaN(dob.getTime())) return undefined;
                    const today = new Date();
                    let age = today.getFullYear() - dob.getFullYear();
                    const m = today.getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
                    return `Возраст: ${age}`;
                  })()
                : 'Укажите дату рождения (возраст)')
            }
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Телефон"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="+1234567890"
            error={!!formErrors.phone}
            helperText={formErrors.phone}
          />
        </Grid>
      </Grid>
    ) : (
    <Grid container spacing={2} sx={{ mt: 1 }}>
      {/* Фото клиента слева от первых строк */}
      <Grid item xs={12} sm={3}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            type="file"
            accept="image/*"
            ref={photoInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                reader.onloadend = () => {
                  setPhotoPreview(reader.result as string);
                  setFormData(prev => ({ ...prev, photo: reader.result as string }));
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <Box
            sx={{
              width: 120,
              height: 120,
              borderRadius: 1,
              border: '2px dashed',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              bgcolor: 'background.default',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
            onClick={() => photoInputRef.current?.click()}
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Фото клиента"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <PhotoCamera sx={{ fontSize: 32, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Загрузить фото
                </Typography>
              </Box>
            )}
          </Box>
          {photoPreview ? (
            <Button
              size="small"
              color="error"
              onClick={() => {
                      setPhotoPreview(null);
                      setFormData(prev => ({ ...prev, photo: '' }));
                if (photoInputRef.current) {
                  photoInputRef.current.value = '';
                }
              }}
              sx={{ mt: 1 }}
            >
              Удалить
            </Button>
          ) : null}
        </Box>
      </Grid>
      <Grid item xs={12} sm={9}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Фамилия"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              required
              error={!!formErrors.lastName}
              helperText={formErrors.lastName}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Имя"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              required
              error={!!formErrors.firstName}
              helperText={formErrors.firstName}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Отчество"
              value={formData.middleName}
              onChange={(e) => handleInputChange('middleName', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={!!formErrors.email}
              helperText={formErrors.email}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Телефон"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1234567890"
              error={!!formErrors.phone}
              helperText={formErrors.phone}
            />
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Дата рождения"
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
          InputLabelProps={{ shrink: true }}
          error={!!formErrors.dateOfBirth}
          helperText={formErrors.dateOfBirth}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Пол</InputLabel>
          <Select
            value={formData.gender}
            onChange={(e) => handleInputChange('gender', e.target.value)}
          >
            <MenuItem value="male">Мужской</MenuItem>
            <MenuItem value="female">Женский</MenuItem>
            <MenuItem value="other">Другой</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Вес (кг)"
          type="number"
          value={formData.weight}
          onChange={(e) => handleInputChange('weight', e.target.value)}
          inputProps={{ min: 0, max: 500, step: 0.1 }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Группы</InputLabel>
          <Select
            multiple
            value={formData.groupIds}
            onChange={(e) => {
              const value = e.target.value;
              setFormData({
                ...formData,
                groupIds: typeof value === 'string' ? value.split(',') : value as string[]
              });
            }}
            label="Группы"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as string[]).map((groupId) => {
                  const group = groups.find(g => g.id === groupId);
                  return group ? (
                    <Chip key={groupId} label={group.name} size="small" />
                  ) : null;
                })}
              </Box>
            )}
          >
            {groups.filter(g => g.isActive).map((group) => (
              <MenuItem key={group.id} value={group.id}>
                {group.name} {group.branch ? `(${group.branch.name})` : ''}
                {group.isMonthlyPayment ||
                (group as any).membershipPlans?.some(
                  (p: any) => p.membership?.category === 'GROUP'
                )
                  ? ' · ежемесячная'
                  : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      {formData.groupIds.some((gid) => {
        const g = groups.find((x) => x.id === gid);
        return (
          Boolean(g?.isMonthlyPayment) ||
          Boolean(
            (g as any)?.membershipPlans?.some(
              (p: any) => p.membership?.category === 'GROUP' && p.membership?.isActive !== false
            )
          )
        );
      }) && (
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="Начало начислений (групповой абонемент)"
            value={createBillingEffectiveFrom}
            onChange={(e) => setCreateBillingEffectiveFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="С какой даты начислять ежемесячную оплату"
          />
        </Grid>
      )}
      {formData.groupIds.some((gid) => {
        const g = groups.find((x) => x.id === gid);
        return (
          Boolean(g?.isMonthlyPayment) ||
          Boolean(
            (g as any)?.membershipPlans?.some(
              (p: any) => p.membership?.category === 'GROUP' && p.membership?.isActive !== false
            )
          )
        );
      }) && (
        <Grid item xs={12}>
          <Alert severity="info">
            Выбрана группа с групповым абонементом — клиентский пакет при создании не выдаётся.
            Оплата идёт по ежемесячному тарифу группы.
          </Alert>
        </Grid>
      )}
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Checkbox
              checked={trialEnabled}
              onChange={(e) => {
                const on = e.target.checked;
                setTrialEnabled(on);
                if (on) {
                  loadUpcomingTrialTrainings();
                } else {
                  setTrialTrainingId('');
                }
              }}
            />
          }
          label="Пробное занятие"
        />
      </Grid>
      {trialEnabled && (
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel>Занятие для пробы</InputLabel>
            <Select
              value={trialTrainingId}
              onChange={(e) => setTrialTrainingId(e.target.value)}
              label="Занятие для пробы"
              disabled={loadingTrialTrainings}
            >
              {loadingTrialTrainings && (
                <MenuItem value="" disabled>
                  Загрузка…
                </MenuItem>
              )}
              {!loadingTrialTrainings && upcomingTrialTrainings.length === 0 && (
                <MenuItem value="" disabled>
                  Нет ближайших занятий с группой
                </MenuItem>
              )}
              {upcomingTrialTrainings.map((t: any) => (
                <MenuItem key={t.id} value={t.id}>
                  {format(new Date(t.startTime), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  {' — '}
                  {t.group?.name || t.title}
                  {t.branch?.name ? ` (${t.branch.name})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      )}
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Адрес проживания"
          value={formData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          multiline
          rows={2}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Номер свидетельства о рождении"
          value={formData.birthCertificateNumber}
          onChange={(e) => handleInputChange('birthCertificateNumber', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Номер справки"
          value={formData.medicalCertificateNumber}
          onChange={(e) => handleInputChange('medicalCertificateNumber', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Место учебы/дет.сада"
          value={formData.schoolOrKindergarten}
          onChange={(e) => handleInputChange('schoolOrKindergarten', e.target.value)}
        />
      </Grid>
      {/* Загрузка свидетельства о рождении */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
            Свидетельство о рождении (фото/документ)
          </Typography>
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            ref={birthCertificateInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                reader.onloadend = () => {
                  setBirthCertificatePreview(reader.result as string);
                  setFormData(prev => ({ ...prev, birthCertificate: reader.result as string }));
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              minHeight: 100,
              bgcolor: 'background.default',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
            onClick={() => birthCertificateInputRef.current?.click()}
          >
            {birthCertificatePreview ? (
              <Box sx={{ textAlign: 'center', width: '100%' }}>
                <img
                  src={birthCertificatePreview}
                  alt="Свидетельство о рождении"
                  style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                />
                <Button
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                          setBirthCertificatePreview(null);
                          setFormData(prev => ({ ...prev, birthCertificate: '' }));
                    if (birthCertificateInputRef.current) {
                      birthCertificateInputRef.current.value = '';
                    }
                  }}
                  sx={{ mt: 1 }}
                >
                  Удалить
                </Button>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <PhotoCamera sx={{ fontSize: 32, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Загрузить файл
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  (изображение или PDF)
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Grid>
      {/* Загрузка справки */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
            Справка (фото/документ)
          </Typography>
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            ref={medicalCertificateInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                reader.onloadend = () => {
                  setMedicalCertificatePreview(reader.result as string);
                  setFormData(prev => ({ ...prev, medicalCertificate: reader.result as string }));
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              minHeight: 100,
              bgcolor: 'background.default',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
            onClick={() => medicalCertificateInputRef.current?.click()}
          >
            {medicalCertificatePreview ? (
              <Box sx={{ textAlign: 'center', width: '100%' }}>
                <img
                  src={medicalCertificatePreview}
                  alt="Справка"
                  style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                />
                <Button
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMedicalCertificatePreview(null);
                    setFormData(prev => ({ ...prev, medicalCertificate: '' }));
                    if (medicalCertificateInputRef.current) {
                      medicalCertificateInputRef.current.value = '';
                    }
                  }}
                  sx={{ mt: 1 }}
                >
                  Удалить
                </Button>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <PhotoCamera sx={{ fontSize: 32, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Загрузить файл
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  (изображение или PDF)
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Grid>
      <Grid item xs={12} sm={6}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<Assignment />}
          onClick={() => {
            setPassportData({
                passportSeries: formData.passportSeries || '',
                passportNumber: formData.passportNumber || '',
                passportIssueDate: formData.passportIssueDate || '',
                passportIssuedBy: formData.passportIssuedBy || '',
                passportDivisionCode: formData.passportDivisionCode || '',
                passportBirthPlace: formData.passportBirthPlace || '',
              }); setPassportErrors({});
            setPassportDialog(true);
          }}
          sx={{ height: '56px' }}
        >
          Паспорт спортсмена
        </Button>
      </Grid>
      
      {/* Родители */}
      <Grid item xs={12}>
        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="medium">
              Родители (необязательно)
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => {
                setFormData({
                  ...formData,
                  parents: [
                    ...formData.parents,
                    {
                      fullName: '',
                      phone: '',
                      email: '',
                      workplace: '',
                      workplaceContact: '',
                      relationType: 'other',
                      isPrimaryContact: false,
                    },
                  ],
                });
              }}
            >
              Добавить родителя
            </Button>
          </Box>

          {formData.parents.map((parent, index) => (
            <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="medium">
                  Родитель {index + 1}
                </Typography>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      parents: formData.parents.filter((_, i) => i !== index),
                    });
                  }}
                >
                  <Delete />
                </IconButton>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Полное ФИО родителя"
                    value={parent.fullName}
                    onChange={(e) => handleParentFieldChange(index, 'fullName', e.target.value)}
                    onBlur={(e) => handleParentFieldBlur(index, 'fullName', e.target.value)}
                    error={!!formErrors[`parent_${index}_fullName`]}
                    helperText={formErrors[`parent_${index}_fullName`]}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&.Mui-focused fieldset': {
                          borderColor: validFields.has(`parent_${index}_fullName`) && !formErrors[`parent_${index}_fullName`] ? 'success.main' : undefined,
                        },
                        '& fieldset': {
                          borderColor: validFields.has(`parent_${index}_fullName`) && !formErrors[`parent_${index}_fullName`] ? 'success.main' : undefined,
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Телефон"
                    value={parent.phone}
                    onChange={(e) => handleParentFieldChange(index, 'phone', e.target.value)}
                    onBlur={(e) => handleParentFieldBlur(index, 'phone', e.target.value)}
                    placeholder="+1234567890"
                    error={!!formErrors[`parent_${index}_phone`]}
                    helperText={formErrors[`parent_${index}_phone`]}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&.Mui-focused fieldset': {
                          borderColor: validFields.has(`parent_${index}_phone`) && !formErrors[`parent_${index}_phone`] ? 'success.main' : undefined,
                        },
                        '& fieldset': {
                          borderColor: validFields.has(`parent_${index}_phone`) && !formErrors[`parent_${index}_phone`] ? 'success.main' : undefined,
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={parent.email}
                    onChange={(e) => handleParentFieldChange(index, 'email', e.target.value)}
                    onBlur={(e) => handleParentFieldBlur(index, 'email', e.target.value)}
                    error={!!formErrors[`parent_${index}_email`]}
                    helperText={formErrors[`parent_${index}_email`]}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '&.Mui-focused fieldset': {
                          borderColor: validFields.has(`parent_${index}_email`) && !formErrors[`parent_${index}_email`] ? 'success.main' : undefined,
                        },
                        '& fieldset': {
                          borderColor: validFields.has(`parent_${index}_email`) && !formErrors[`parent_${index}_email`] ? 'success.main' : undefined,
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Место работы"
                    value={parent.workplace}
                    onChange={(e) => {
                      const newParents = [...formData.parents];
                      newParents[index].workplace = e.target.value;
                      setFormData({ ...formData, parents: newParents });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Способ связи с местом работы"
                    value={parent.workplaceContact}
                    onChange={(e) => {
                      const newParents = [...formData.parents];
                      newParents[index].workplaceContact = e.target.value;
                      setFormData({ ...formData, parents: newParents });
                    }}
                    placeholder="Телефон, email и т.д."
                  />
                </Grid>
              </Grid>
            </Paper>
          ))}

          {formData.parents.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              Родители не добавлены. Нажмите "Добавить родителя" для добавления.
            </Typography>
          )}
        </Box>
      </Grid>
    </Grid>
    )}
  </DialogContent>
  <DialogActions>
    <Button 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        discardForm();
        if (photoInputRef.current) {
          photoInputRef.current.value = '';
        }
      }}
      type="button"
    >
      Отмена
    </Button>
    <Button 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        
        // Выполняем валидацию синхронно
        const validationErrors = validateClientForm(formData);
        setFormErrors(validationErrors);
        
        // Отмечаем все поля как touched для отображения ошибок
        const allFields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'weight'];
        const newTouchedFields = new Set<string>();
        allFields.forEach(field => newTouchedFields.add(field));
        formData.parents.forEach((_, index) => {
          ['fullName', 'email', 'phone'].forEach(field => {
            newTouchedFields.add(`parent_${index}_${field}`);
          });
        });
        setTouchedFields(newTouchedFields);
        
        // Если есть ошибки, показываем их и оставляем диалог открытым
        if (hasFormErrors(validationErrors)) {
          setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
          setSnackbarOpen(true);
          setValidFields(new Set());
          return; // Не создаем клиента, если есть ошибки
        }
        
        // Если нет ошибок, вызываем handleCreateClient для сохранения
        submitCreate();
      }} 
      variant="contained"
      type="button"
    >
      Создать клиента
    </Button>
  </DialogActions>
</Dialog>

{/* Диалог паспорта спортсмена */}
<Dialog
  open={passportDialog}
  onClose={() => setPassportDialog(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>Паспорт спортсмена</DialogTitle>
  <DialogContent>
    {hasPassportErrors(passportErrors) && (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Пожалуйста, исправьте {Object.keys(passportErrors).length} {Object.keys(passportErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
      </Alert>
    )}
    <Grid container spacing={2} sx={{ mt: 1 }}>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Серия паспорта"
          value={passportData.passportSeries}
          onChange={(e) => {
            setPassportData({ ...passportData, passportSeries: e.target.value });
            if (passportErrors.passportSeries) {
              setPassportErrors({ ...passportErrors, passportSeries: '' });
            }
          }}
          inputProps={{ maxLength: 4 }}
          placeholder="1234"
          error={!!passportErrors.passportSeries}
          helperText={passportErrors.passportSeries || '4 цифры'}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Номер паспорта"
          value={passportData.passportNumber}
          onChange={(e) => {
            setPassportData({ ...passportData, passportNumber: e.target.value });
            if (passportErrors.passportNumber) {
              setPassportErrors({ ...passportErrors, passportNumber: '' });
            }
          }}
          inputProps={{ maxLength: 6 }}
          placeholder="123456"
          error={!!passportErrors.passportNumber}
          helperText={passportErrors.passportNumber || '6 цифр'}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Дата выдачи"
          type="date"
          value={passportData.passportIssueDate}
          onChange={(e) => {
            setPassportData({ ...passportData, passportIssueDate: e.target.value });
            if (passportErrors.passportIssueDate) {
              setPassportErrors({ ...passportErrors, passportIssueDate: '' });
            }
          }}
          InputLabelProps={{ shrink: true }}
          error={!!passportErrors.passportIssueDate}
          helperText={passportErrors.passportIssueDate}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Код подразделения"
          value={passportData.passportDivisionCode}
          onChange={(e) => {
            // Удаляем все нецифровые символы
            let value = e.target.value.replace(/\D/g, '');
            
            // Ограничиваем до 6 цифр
            if (value.length > 6) {
              value = value.substring(0, 6);
            }
            
            // Добавляем тире после третьей цифры
            if (value.length > 3) {
              value = value.substring(0, 3) + '-' + value.substring(3);
            }
            
            setPassportData({ ...passportData, passportDivisionCode: value });
            if (passportErrors.passportDivisionCode) {
              setPassportErrors({ ...passportErrors, passportDivisionCode: '' });
            }
          }}
          inputProps={{ maxLength: 7 }}
          placeholder="123-456"
          error={!!passportErrors.passportDivisionCode}
          helperText={passportErrors.passportDivisionCode || '6 цифр (формат: 123-456)'}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Кем выдан"
          value={passportData.passportIssuedBy}
          onChange={(e) => {
            setPassportData({ ...passportData, passportIssuedBy: e.target.value });
            if (passportErrors.passportIssuedBy) {
              setPassportErrors({ ...passportErrors, passportIssuedBy: '' });
            }
          }}
          multiline
          rows={2}
          error={!!passportErrors.passportIssuedBy}
          helperText={passportErrors.passportIssuedBy}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Место рождения"
          value={passportData.passportBirthPlace}
          onChange={(e) => {
            setPassportData({ ...passportData, passportBirthPlace: e.target.value });
            if (passportErrors.passportBirthPlace) {
              setPassportErrors({ ...passportErrors, passportBirthPlace: '' });
            }
          }}
          multiline
          rows={2}
          error={!!passportErrors.passportBirthPlace}
          helperText={passportErrors.passportBirthPlace}
        />
      </Grid>
    </Grid>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => {
      setPassportDialog(false);
      setPassportErrors({});
    }}>Отмена</Button>
    <Button
      variant="contained"
      onClick={async () => {
        // Выполняем валидацию
        const validationErrors = validatePassport(passportData);
        setPassportErrors(validationErrors);

        // Если есть ошибки, не сохраняем
        if (hasPassportErrors(validationErrors)) {
          setSnackbarMessage('Пожалуйста, исправьте ошибки в форме паспорта');
          setSnackbarOpen(true);
          return;
        }

        setFormData((prev) => ({
                  ...prev,
                  passportSeries: passportData.passportSeries || '',
                  passportNumber: passportData.passportNumber || '',
                  passportIssueDate: passportData.passportIssueDate || '',
                  passportIssuedBy: passportData.passportIssuedBy || '',
                  passportDivisionCode: passportData.passportDivisionCode || '',
                  passportBirthPlace: passportData.passportBirthPlace || '',
                }));
                setPassportDialog(false);
                setPassportErrors({});
                setSnackbarMessage('Данные паспорта добавлены в форму');
                setSnackbarOpen(true);
      }}
    >
      Сохранить
    </Button>
  </DialogActions>
</Dialog>

      <UnsavedChangesDialog
        open={unsaved.confirmOpen}
        saving={unsaved.saving}
        onSave={unsaved.save}
        onDiscard={unsaved.discard}
        onStay={unsaved.stay}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default CreateClientDialog;
