import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import {
  Close,
  Delete,
  EditOutlined,
  EmailOutlined,
  PhoneOutlined,
  SaveOutlined,
} from '@mui/icons-material';
import { apiService } from '../../services/api';
import { Branch, Trainer } from '../../types';
import { validateTrainerForm } from '../../utils/validation';
import {
  normalizeSalaryScheme,
  salaryRateFieldLabel,
  salarySchemeHint,
  salarySchemeLabel,
} from '../../utils/salarySchemes';
import { colors, radii, typography } from '../../theme/tokens';
import TrainerDocumentsPanel from './TrainerDocumentsPanel';
import AttendanceExcelExport from '../AttendanceExcelExport';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';

const TRAINER_FIXED_MONTHLY = 'fixed_monthly';

const emptyFormData = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  middleName: '',
  phone: '',
  role: 'TRAINER',
  qualification: '',
  experience: '',
  specialization: '',
  coachCategory: '',
  judgeCategory: '',
  achievements: '',
  salaryScheme: '',
  salaryRate: '',
  individualTrainingPrice: '',
  canViewAllGroups: false,
  branchId: '',
};

export const isEmployeeAdmin = (employee: any): boolean =>
  employee?.employeeType === 'admin' ||
  employee?.user?.role === 'ADMIN' ||
  employee?.role === 'ADMIN';

export const isEmployeePromoter = (employee: any): boolean =>
  employee?.employeeType === 'promoter' ||
  employee?.user?.role === 'PROMOTER' ||
  employee?.role === 'PROMOTER';

export const employeeRoleLabel = (employee: any): string => {
  if (isEmployeeAdmin(employee)) return 'Администратор';
  if (isEmployeePromoter(employee)) return 'Промоутер';
  return 'Тренер';
};

function fullName(user: { lastName?: string; firstName?: string; middleName?: string } | null | undefined) {
  if (!user) return 'Сотрудник';
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim() || 'Сотрудник';
}

function buildFormFromEmployee(employee: any) {
  if (isEmployeeAdmin(employee)) {
    const adminUser = employee.user || employee;
    return {
      ...emptyFormData,
      email: adminUser.email || '',
      firstName: adminUser.firstName || '',
      lastName: adminUser.lastName || '',
      middleName: adminUser.middleName || '',
      phone: adminUser.phone || '',
      role: adminUser.role || 'ADMIN',
    };
  }
  return {
    email: employee.user?.email || '',
    password: '',
    firstName: employee.user?.firstName || '',
    lastName: employee.user?.lastName || '',
    middleName: employee.user?.middleName || '',
    phone: employee.user?.phone || '',
    role: employee.user?.role || 'TRAINER',
    qualification: employee.qualification || '',
    experience: employee.experience?.toString() || '',
    specialization: employee.specialization || '',
    coachCategory: employee.coachCategory || '',
    judgeCategory: employee.judgeCategory || '',
    achievements: employee.achievements || '',
    salaryScheme:
      normalizeSalaryScheme(employee.salaryScheme || employee.salaryType) === TRAINER_FIXED_MONTHLY
        ? TRAINER_FIXED_MONTHLY
        : '',
    salaryRate:
      normalizeSalaryScheme(employee.salaryScheme || employee.salaryType) === TRAINER_FIXED_MONTHLY
        ? String(employee.salaryRate ?? employee.salaryAmount ?? '')
        : '',
    individualTrainingPrice:
      employee.individualTrainingPrice != null ? String(employee.individualTrainingPrice) : '',
    canViewAllGroups: Boolean(employee.canViewAllGroups),
    branchId: employee.branches?.[0]?.branchId || '',
  };
}

export interface TrainerCardProps {
  employee: Trainer | any;
  branches: Branch[];
  isOwner: boolean;
  onSaved?: () => void | Promise<void>;
  onClose?: () => void;
  onOpenEarnings?: (trainer: Trainer) => void;
}

const TrainerCard: React.FC<TrainerCardProps> = ({
  employee: initialEmployee,
  branches,
  isOwner,
  onSaved,
  onClose,
  onOpenEarnings,
}) => {
  const [employee, setEmployee] = useState<any>(initialEmployee);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(() => buildFormFromEmployee(initialEmployee));
  const [formBaseline, setFormBaseline] = useState(() => buildFormFromEmployee(initialEmployee));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [roleConfirmDialog, setRoleConfirmDialog] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [branchBusy, setBranchBusy] = useState(false);

  const isAdmin = isEmployeeAdmin(employee);
  const canEdit = isAdmin ? isOwner : true;
  const empUser = employee?.user || employee;
  const displayName = fullName(empUser);

  const refreshEmployee = useCallback(async () => {
    if (isEmployeeAdmin(initialEmployee)) {
      setEmployee(initialEmployee);
      return initialEmployee;
    }
    try {
      setLoading(true);
      const updated = await apiService.getTrainer(initialEmployee.id);
      setEmployee(updated);
      return updated;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось обновить данные сотрудника');
      return initialEmployee;
    } finally {
      setLoading(false);
    }
  }, [initialEmployee]);

  useEffect(() => {
    setEmployee(initialEmployee);
    const next = buildFormFromEmployee(initialEmployee);
    setFormData(next);
    setFormBaseline(next);
    setEditing(false);
    setFormErrors({});
    setError('');
    if (!isEmployeeAdmin(initialEmployee) && initialEmployee?.id) {
      refreshEmployee();
    }
  }, [initialEmployee, refreshEmployee]);

  const getCurrentRole = (): string =>
    employee?.user?.role ||
    employee?.role ||
    (employee?.employeeType === 'admin' ? 'ADMIN' : 'TRAINER');

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const startEdit = () => {
    if (!canEdit) return;
    const next = buildFormFromEmployee(employee);
    setFormData(next);
    setFormBaseline(next);
    setFormErrors({});
    setError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setFormData(formBaseline);
    setFormErrors({});
    setError('');
    setEditing(false);
  };

  const performSave = async (): Promise<boolean> => {
    const userId = employee?.user?.id || employee?.id;
    const currentRole = getCurrentRole();
    const newRole = formData.role;
    const roleChanged = newRole !== currentRole;

    try {
      setSaving(true);
      setError('');

      if (roleChanged) {
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          phone: formData.phone,
          email: formData.email,
          role: newRole,
        };
        if (formData.password) updateData.password = formData.password;
        await apiService.updateUser(userId, updateData);

        if (newRole === 'TRAINER') {
          const refreshed = await apiService.getTrainers({ includeAdmins: 'true', limit: 1000 });
          const created = refreshed.data.find(
            (e: any) => (e.user?.id || e.id) === userId && e.employeeType !== 'admin'
          );
          if (created?.id) {
            await apiService.updateTrainer(created.id, {
              qualification: formData.qualification,
              experience: formData.experience,
              specialization: formData.specialization,
              coachCategory: formData.coachCategory,
              judgeCategory: formData.judgeCategory,
              achievements: formData.achievements,
              salaryScheme:
                formData.salaryScheme === TRAINER_FIXED_MONTHLY
                  ? TRAINER_FIXED_MONTHLY
                  : 'per_training_person',
              salaryRate:
                formData.salaryScheme === TRAINER_FIXED_MONTHLY && formData.salaryRate
                  ? parseFloat(formData.salaryRate)
                  : 0,
              salaryType:
                formData.salaryScheme === TRAINER_FIXED_MONTHLY
                  ? TRAINER_FIXED_MONTHLY
                  : 'per_training_person',
              salaryAmount:
                formData.salaryScheme === TRAINER_FIXED_MONTHLY && formData.salaryRate
                  ? parseFloat(formData.salaryRate)
                  : 0,
              individualTrainingPrice: formData.individualTrainingPrice
                ? parseFloat(formData.individualTrainingPrice)
                : null,
              canViewAllGroups: formData.canViewAllGroups,
              firstName: formData.firstName,
              lastName: formData.lastName,
              middleName: formData.middleName,
              phone: formData.phone,
              email: formData.email,
            });
            setEmployee(created);
          }
        }
      } else if (newRole === 'ADMIN') {
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          phone: formData.phone,
          email: formData.email,
        };
        if (formData.password) updateData.password = formData.password;
        await apiService.updateUser(userId, updateData);
        setEmployee({
          ...employee,
          user: { ...(employee.user || employee), ...updateData },
          ...(employee.user ? {} : updateData),
        });
      } else {
        await apiService.updateTrainer(employee.id, {
          ...formData,
          salaryScheme:
            formData.salaryScheme === TRAINER_FIXED_MONTHLY
              ? TRAINER_FIXED_MONTHLY
              : 'per_training_person',
          salaryRate:
            formData.salaryScheme === TRAINER_FIXED_MONTHLY && formData.salaryRate
              ? parseFloat(formData.salaryRate)
              : 0,
          salaryType:
            formData.salaryScheme === TRAINER_FIXED_MONTHLY
              ? TRAINER_FIXED_MONTHLY
              : 'per_training_person',
          salaryAmount:
            formData.salaryScheme === TRAINER_FIXED_MONTHLY && formData.salaryRate
              ? parseFloat(formData.salaryRate)
              : 0,
          individualTrainingPrice: formData.individualTrainingPrice
            ? parseFloat(formData.individualTrainingPrice)
            : null,
        });
        await refreshEmployee();
      }

      await onSaved?.();

      let latest = employee;
      if (newRole === 'TRAINER' && employee?.id && !isEmployeeAdmin(employee)) {
        try {
          latest = await apiService.getTrainer(employee.id);
          setEmployee(latest);
        } catch {
          /* keep */
        }
      } else if (newRole === 'ADMIN') {
        latest = {
          ...employee,
          user: { ...(employee.user || employee), ...formData, role: 'ADMIN' },
          role: 'ADMIN',
          employeeType: 'admin',
        };
        setEmployee(latest);
      }
      const rebuilt = buildFormFromEmployee(latest);
      setFormData(rebuilt);
      setFormBaseline(rebuilt);

      setEditing(false);
      setSnack('Изменения сохранены');
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка обновления сотрудника');
      return false;
    } finally {
      setSaving(false);
      setRoleConfirmDialog(false);
      setPendingRoleChange(null);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    const currentRole = getCurrentRole();
    const newRole = formData.role;
    const roleChanged = newRole !== currentRole;
    const targetIsAdmin = newRole === 'ADMIN';

    if (targetIsAdmin) {
      const adminErrors: Record<string, string> = {};
      if (!formData.firstName) adminErrors.firstName = 'Имя обязательно';
      if (!formData.lastName) adminErrors.lastName = 'Фамилия обязательна';
      if (!formData.email) adminErrors.email = 'Email обязателен';
      setFormErrors(adminErrors);
      if (Object.keys(adminErrors).length > 0) {
        setError('Пожалуйста, исправьте ошибки в форме');
        setSnack('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
        return false;
      }
    } else {
      const errors = validateTrainerForm(formData);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setError('Пожалуйста, исправьте ошибки в форме');
        setSnack('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
        return false;
      }
    }

    if (roleChanged && isOwner) {
      setPendingRoleChange(newRole);
      setRoleConfirmDialog(true);
      return false;
    }

    return performSave();
  };

  const availableBranches = useMemo(() => {
    const assigned = employee?.branches?.map((tb: any) => tb.branchId) || [];
    return branches.filter((b) => !assigned.includes(b.id) && b.isActive);
  }, [branches, employee]);

  const handleAddBranch = async () => {
    if (!employee?.id || !selectedBranchId || isAdmin) return;
    try {
      setBranchBusy(true);
      await apiService.addBranchToTrainer(employee.id, selectedBranchId);
      setSelectedBranchId('');
      await refreshEmployee();
      await onSaved?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка добавления филиала к тренеру');
    } finally {
      setBranchBusy(false);
    }
  };

  const handleRemoveBranch = async (branchId: string) => {
    if (!employee?.id || isAdmin) return;
    if (!window.confirm('Вы уверены, что хотите удалить этот филиал у тренера?')) return;
    try {
      setBranchBusy(true);
      await apiService.removeBranchFromTrainer(employee.id, branchId);
      await refreshEmployee();
      await onSaved?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка удаления филиала у тренера');
    } finally {
      setBranchBusy(false);
    }
  };

  const dirty = editing && isDirtyValue(formData, formBaseline);

  const discardAndClose = useCallback(() => {
    setEditing(false);
    setFormData(formBaseline);
    setFormErrors({});
    setError('');
    onClose?.();
  }, [formBaseline, onClose]);

  const unsaved = useUnsavedClose({
    isDirty: Boolean(dirty),
    onDiscard: discardAndClose,
    onSave: async () => handleSave(),
  });

  const requestClose = () => {
    if (dirty) {
      unsaved.requestClose('escapeKeyDown');
    } else {
      onClose?.();
    }
  };

  const salaryScheme = normalizeSalaryScheme(employee?.salaryScheme || employee?.salaryType);
  const balance = employee?.balance;

  if (loading && !employee) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ fontSize: typography.panelTitle, fontWeight: 700, color: colors.text }}>
          Карточка сотрудника
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {canEdit && !editing && (
            <Button
              size="small"
              variant="contained"
              startIcon={<EditOutlined />}
              onClick={startEdit}
              sx={{ textTransform: 'none' }}
            >
              Редактировать
            </Button>
          )}
          {canEdit && editing && (
            <>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveOutlined />}
                disabled={saving}
                onClick={() => handleSave()}
                sx={{ textTransform: 'none' }}
              >
                Сохранить
              </Button>
              <Button
                size="small"
                startIcon={<Close />}
                onClick={cancelEdit}
                sx={{ textTransform: 'none' }}
              >
                Отмена
              </Button>
            </>
          )}
          {onClose && (
            <Button size="small" onClick={requestClose} sx={{ textTransform: 'none' }}>
              Закрыть
            </Button>
          )}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {Object.keys(formErrors).length > 0 && (
        <Alert severity="warning">
          Пожалуйста, исправьте {Object.keys(formErrors).length}{' '}
          {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
        </Alert>
      )}

      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: colors.card,
          borderRadius: radii.card,
          border: `1px solid ${colors.divider}`,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
              {editing
                ? [formData.lastName, formData.firstName, formData.middleName].filter(Boolean).join(' ')
                : displayName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap">
              <Chip
                label={isAdmin || formData.role === 'ADMIN' ? 'Администратор' : 'Тренер'}
                color={isAdmin || formData.role === 'ADMIN' ? 'primary' : 'secondary'}
                size="small"
              />
              {employee?.isActive !== false && !isAdmin && (
                <Chip label="Активен" color="success" size="small" variant="outlined" />
              )}
            </Stack>
            <Stack spacing={0.5} sx={{ mt: 1.5 }}>
              {(editing ? formData.phone : empUser?.phone) && (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <PhoneOutlined sx={{ fontSize: 16, color: colors.textMuted }} />
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                    {editing ? formData.phone : empUser.phone}
                  </Typography>
                </Stack>
              )}
              {(editing ? formData.email : empUser?.email) && (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <EmailOutlined sx={{ fontSize: 16, color: colors.textMuted }} />
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                    {editing ? formData.email : empUser.email}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          {!isAdmin && (
            <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
              <Typography sx={{ fontSize: typography.hint, color: colors.textMuted }}>
                Схема зарплаты
              </Typography>
              <Chip
                label={
                  salaryScheme === TRAINER_FIXED_MONTHLY
                    ? salarySchemeLabel(TRAINER_FIXED_MONTHLY)
                    : 'На группах'
                }
                color={salaryScheme === TRAINER_FIXED_MONTHLY ? 'primary' : 'default'}
                size="small"
              />
              {balance !== undefined && (
                <Box>
                  <Typography sx={{ fontSize: typography.hint, color: colors.textMuted, mb: 0.25 }}>
                    Баланс
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      color: Number(balance) > 0 ? 'success.main' : colors.text,
                      cursor: onOpenEarnings ? 'pointer' : 'default',
                      textDecoration: onOpenEarnings ? 'underline' : 'none',
                      '&:hover': onOpenEarnings ? { opacity: 0.85 } : undefined,
                    }}
                    onClick={() => onOpenEarnings?.(employee)}
                    title={onOpenEarnings ? 'Открыть зарплату' : undefined}
                  >
                    {Number(balance).toFixed(2)} ₽
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Edit form / view details */}
      {editing ? (
        <Grid container spacing={2}>
          {isOwner && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Роль</InputLabel>
                <Select
                  value={formData.role}
                  label="Роль"
                  onChange={(e) => handleInputChange('role', e.target.value)}
                >
                  <MenuItem value="TRAINER">Тренер</MenuItem>
                  <MenuItem value="ADMIN">Администратор</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
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
              error={!!formErrors.middleName}
              helperText={formErrors.middleName}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              error={!!formErrors.email}
              helperText={formErrors.email}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Новый пароль (оставьте пустым, чтобы не менять)"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Введите новый пароль или оставьте пустым"
              error={!!formErrors.password}
              helperText={formErrors.password}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Телефон"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              error={!!formErrors.phone}
              helperText={formErrors.phone}
            />
          </Grid>

          {formData.role === 'TRAINER' && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Квалификация"
                  value={formData.qualification}
                  onChange={(e) => handleInputChange('qualification', e.target.value)}
                  placeholder="Например: 3-й дан черный пояс, Мастер спорта, КМС"
                  helperText={
                    formErrors.qualification ||
                    'Укажите уровень квалификации тренера (дан, разряд, звание и т.д.)'
                  }
                  error={!!formErrors.qualification}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Опыт (лет)"
                  type="number"
                  value={formData.experience}
                  onChange={(e) => handleInputChange('experience', e.target.value)}
                  error={!!formErrors.experience}
                  helperText={formErrors.experience}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Специализация"
                  value={formData.specialization}
                  onChange={(e) => handleInputChange('specialization', e.target.value)}
                  placeholder="например: Карате, Тхэквондо"
                  error={!!formErrors.specialization}
                  helperText={formErrors.specialization}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Тренерская категория"
                  value={formData.coachCategory}
                  onChange={(e) => handleInputChange('coachCategory', e.target.value)}
                  placeholder="Например: высшая, первая, вторая"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Судейская категория"
                  value={formData.judgeCategory}
                  onChange={(e) => handleInputChange('judgeCategory', e.target.value)}
                  placeholder="Например: всероссийская, первая"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Достижения"
                  value={formData.achievements}
                  onChange={(e) => handleInputChange('achievements', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.salaryScheme}>
                  <InputLabel>Зарплата сотрудника</InputLabel>
                  <Select
                    value={formData.salaryScheme}
                    label="Зарплата сотрудника"
                    onChange={(e) => handleInputChange('salaryScheme', e.target.value)}
                  >
                    <MenuItem value="">На группах</MenuItem>
                    <MenuItem value={TRAINER_FIXED_MONTHLY}>Фикс плата в месяц</MenuItem>
                  </Select>
                  {formErrors.salaryScheme && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                      {formErrors.salaryScheme}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              {formData.salaryScheme === TRAINER_FIXED_MONTHLY && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={salaryRateFieldLabel(TRAINER_FIXED_MONTHLY)}
                    type="number"
                    value={formData.salaryRate}
                    onChange={(e) => handleInputChange('salaryRate', e.target.value)}
                    error={!!formErrors.salaryRate}
                    helperText={formErrors.salaryRate || salarySchemeHint(TRAINER_FIXED_MONTHLY)}
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Цена индивидуальной тренировки (₽)"
                  type="number"
                  value={formData.individualTrainingPrice || ''}
                  onChange={(e) => handleInputChange('individualTrainingPrice', e.target.value)}
                  helperText="Начисляется ученику при создании индивидуалки"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(formData.canViewAllGroups)}
                      onChange={(e) => handleInputChange('canViewAllGroups', e.target.checked)}
                      style={{ width: 20, height: 20 }}
                    />
                    <Typography variant="body2">
                      Тренер может видеть расписание всех групп (не только своих)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 4 }}>
                    Если отключено, тренер будет видеть только тренировки своих групп
                  </Typography>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
      ) : (
        !isAdmin && (
          <Box
            sx={{
              p: 2,
              borderRadius: radii.card,
              border: `1px solid ${colors.divider}`,
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1, fontSize: typography.label }}>
              Профиль тренера
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Квалификация
                </Typography>
                <Typography variant="body2">{employee.qualification || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Опыт
                </Typography>
                <Typography variant="body2">
                  {employee.experience != null ? `${employee.experience} лет` : '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Специализация
                </Typography>
                <Typography variant="body2">{employee.specialization || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Тренерская категория
                </Typography>
                <Typography variant="body2">{employee.coachCategory || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Судейская категория
                </Typography>
                <Typography variant="body2">{employee.judgeCategory || '—'}</Typography>
              </Grid>
              {employee.achievements && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Достижения
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {employee.achievements}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        )
      )}

      {/* Branches — trainers only */}
      {!isAdmin && formData.role !== 'ADMIN' && employee?.id && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography sx={{ fontWeight: 600, mb: 2, fontSize: typography.label }}>
            Филиалы
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <FormControl fullWidth size="small">
                  <InputLabel>Выберите филиал</InputLabel>
                  <Select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    label="Выберите филиал"
                    disabled={branchBusy}
                  >
                    {availableBranches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name} - {branch.address}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleAddBranch}
                  disabled={!selectedBranchId || branchBusy}
                  sx={{ height: '40px', textTransform: 'none' }}
                >
                  Добавить
                </Button>
              </Grid>
            </Grid>
          </Box>
          {(employee.branches?.length || 0) === 0 ? (
            <Typography variant="body2" color="text.secondary">
              У тренера пока нет привязанных филиалов
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Адрес</TableCell>
                    <TableCell>Телефон</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employee.branches?.map((trainerBranch: any) => (
                    <TableRow key={trainerBranch.id}>
                      <TableCell>{trainerBranch.branch?.name}</TableCell>
                      <TableCell>{trainerBranch.branch?.address}</TableCell>
                      <TableCell>{trainerBranch.branch?.phone || '-'}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          title="Удалить привязку"
                          disabled={branchBusy}
                          onClick={() => handleRemoveBranch(trainerBranch.branchId)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Documents + attendance export — trainers only */}
      {!isAdmin && employee?.id && (
        <>
          <Box sx={{ mt: 1 }}>
            <Divider sx={{ mb: 2 }} />
            <TrainerDocumentsPanel
              trainerId={employee.id}
              initialDocs={employee.documents}
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <AttendanceExcelExport
              scope="trainer"
              entityId={employee.id}
              entityName={displayName}
            />
          </Box>
        </>
      )}

      <Dialog
        open={roleConfirmDialog}
        onClose={() => {
          setRoleConfirmDialog(false);
          setPendingRoleChange(null);
        }}
      >
        <DialogTitle>Сменить роль сотрудника?</DialogTitle>
        <DialogContent>
          <Typography>
            {pendingRoleChange === 'ADMIN'
              ? 'Тренер станет администратором. Запись тренера и привязки к филиалам будут удалены. Если у сотрудника есть группы — смена роли будет отклонена.'
              : 'Администратор станет тренером. Будет создан профиль тренера — заполните квалификацию и зарплату при необходимости.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRoleConfirmDialog(false);
              setPendingRoleChange(null);
            }}
          >
            Отмена
          </Button>
          <Button variant="contained" onClick={() => performSave()}>
            Подтвердить
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack('')}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <UnsavedChangesDialog
        open={unsaved.confirmOpen}
        saving={unsaved.saving}
        onSave={unsaved.save}
        onDiscard={unsaved.discard}
        onStay={unsaved.stay}
      />
    </Box>
  );
};

export default TrainerCard;
