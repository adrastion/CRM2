import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
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
import PasswordField from '../common/PasswordField';
import { validateTrainerForm } from '../../utils/validation';
import {
  resolveTrainerCardScheme,
  resolveTrainerSalaryScheme,
  salaryRateFieldLabel,
  salarySchemeHint,
  salarySchemeLabel,
} from '../../utils/salarySchemes';
import { colors, radii, typography } from '../../theme/tokens';
import TrainerDocumentsPanel from './TrainerDocumentsPanel';
import AttendanceExcelExport from '../AttendanceExcelExport';
import UnsavedChangesDialog from '../common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../../hooks/useUnsavedClose';
import TrainerCardDesktopView, {
  TrainerCardTab,
  TrainerGroupRow,
} from './TrainerCardDesktopView';
import AdminCardDesktopView from './AdminCardDesktopView';
import PromoterCardDesktopView from './PromoterCardDesktopView';
import {
  buildAdminProfileMeta,
  buildPromoterProfileMeta,
  getEmployeeProfileMeta,
} from '../../utils/staffProfileMeta';

const TRAINER_FIXED_MONTHLY = 'fixed_monthly';

const PROMOTER_TRANSPORT_OPTIONS = [
  'Пешком',
  'Общественный транспорт',
  'Личный автомобиль',
  'Велосипед / самокат',
  'Такси / каршеринг',
] as const;

const ADMIN_PERMISSION_KEYS = [
  'clients',
  'branches',
  'employees',
  'calendar',
  'finance',
  'subscriptions',
  'settings',
  'reports',
] as const;

const ADMIN_PERMISSION_LABELS: Record<(typeof ADMIN_PERMISSION_KEYS)[number], string> = {
  clients: 'Управление клиентами',
  branches: 'Филиалы и группы',
  employees: 'Сотрудники',
  calendar: 'Расписание',
  finance: 'Финансы',
  subscriptions: 'Абонементы',
  settings: 'Настройки',
  reports: 'Отчеты',
};

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
  hireDate: '',
  salaryScheme: '',
  salaryRate: '',
  individualTrainingPrice: '',
  canViewAllGroups: false,
  branchId: '',
  // ADMIN
  responsibilityZone: '',
  position: '',
  comment: '',
  isActive: true,
  permissions: Object.fromEntries(ADMIN_PERMISSION_KEYS.map((k) => [k, true])) as Record<string, boolean>,
  // PROMOTER
  dateOfBirth: '',
  workArea: '',
  workRadiusKm: '',
  pricePerShift: '',
  pricePerClient: '',
  transport: '',
  socialLink: '',
  notes: '',
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
  const meta = getEmployeeProfileMeta(employee);
  const adminUser = employee.user || employee;

  if (isEmployeeAdmin(employee)) {
    const perms = Array.isArray(meta.permissions) ? meta.permissions : ADMIN_PERMISSION_KEYS;
    return {
      ...emptyFormData,
      email: adminUser.email || '',
      firstName: adminUser.firstName || '',
      lastName: adminUser.lastName || '',
      middleName: adminUser.middleName || '',
      phone: adminUser.phone || '',
      role: adminUser.role || 'ADMIN',
      isActive: adminUser.isActive !== false && employee?.isActive !== false,
      responsibilityZone: String(meta.responsibilityZone || ''),
      position: String(meta.position || ''),
      experience: meta.experience != null ? String(meta.experience) : '',
      comment: String(meta.comment || ''),
      branchId: String(meta.branchId || adminUser.branchId || ''),
      permissions: Object.fromEntries(
        ADMIN_PERMISSION_KEYS.map((k) => [k, (perms as string[]).includes(k)])
      ) as Record<string, boolean>,
    };
  }

  if (isEmployeePromoter(employee)) {
    return {
      ...emptyFormData,
      email: adminUser.email || '',
      firstName: adminUser.firstName || '',
      lastName: adminUser.lastName || '',
      middleName: adminUser.middleName || '',
      phone: adminUser.phone || '',
      role: 'PROMOTER',
      isActive: adminUser.isActive !== false && employee?.isActive !== false,
      dateOfBirth: String(meta.dateOfBirth || ''),
      workArea: String(meta.workArea || ''),
      workRadiusKm: meta.workRadiusKm != null ? String(meta.workRadiusKm) : '',
      pricePerShift: meta.pricePerShift != null ? String(meta.pricePerShift) : '',
      pricePerClient: meta.pricePerClient != null ? String(meta.pricePerClient) : '',
      transport: String(meta.transport || ''),
      socialLink: String(meta.socialLink || ''),
      notes: String(meta.notes || ''),
    };
  }

  const hireRaw = employee.hireDate || employee.workStartDate;
  return {
    ...emptyFormData,
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
    hireDate: hireRaw ? String(hireRaw).slice(0, 10) : '',
    salaryScheme: resolveTrainerCardScheme(employee.salaryScheme, employee.salaryType),
    salaryRate:
      resolveTrainerCardScheme(employee.salaryScheme, employee.salaryType) === TRAINER_FIXED_MONTHLY
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
  fromSection?: string;
  onSaved?: () => void | Promise<void>;
  onClose?: () => void;
  onOpenEarnings?: (trainer: Trainer) => void;
}

const TrainerCard: React.FC<TrainerCardProps> = ({
  employee: initialEmployee,
  branches,
  isOwner,
  fromSection = 'Сотрудники',
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
  const [accessBusy, setAccessBusy] = useState(false);
  const [cardTab, setCardTab] = useState<TrainerCardTab>('overview');
  const [groups, setGroups] = useState<TrainerGroupRow[]>([]);

  const isAdmin = isEmployeeAdmin(employee);
  const isPromoter = isEmployeePromoter(employee);
  const isOwnerTrainer =
    (employee?.user?.role || employee?.role) === 'OWNER';
  // Карточку владельца-тренера и админа может менять только OWNER
  const canEdit = isOwnerTrainer || isAdmin ? isOwner : true;
  const empUser = employee?.user || employee;
  const displayName = fullName(empUser);

  const refreshEmployee = useCallback(async () => {
    if (isEmployeeAdmin(initialEmployee) || isEmployeePromoter(initialEmployee)) {
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

  useEffect(() => {
    if (isEmployeeAdmin(employee) || !employee?.id) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getGroups({ limit: 500, page: 1 });
        if (cancelled) return;
        const rows = (res.data || [])
          .filter(
            (g: any) =>
              g.trainerId === employee.id ||
              g.trainer?.id === employee.id ||
              (Array.isArray(g.trainers) && g.trainers.some((t: any) => t.id === employee.id || t.trainerId === employee.id))
          )
          .map((g: any) => ({
            id: g.id,
            name: g.name,
            ageRange:
              g.minAge != null || g.maxAge != null
                ? `${g.minAge ?? '?'}-${g.maxAge ?? '?'}`
                : g.ageCategory || null,
            days: g.scheduleDays || g.daysOfWeek || null,
            studentsCount:
              g.clientsCount ??
              g._count?.groupMemberships ??
              g.groupMemberships?.length ??
              null,
            isActive: g.isActive !== false,
          }));
        setGroups(rows);
      } catch {
        if (!cancelled) setGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employee?.id, employee?.employeeType]);

  const getCurrentRole = (): string => {
    if (isEmployeeAdmin(employee)) return 'ADMIN';
    if (isEmployeePromoter(employee)) return 'PROMOTER';
    return employee?.user?.role || employee?.role || 'TRAINER';
  };

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

    let savedEmployee = employee;
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

        if (newRole === 'ADMIN') {
          updateData.isActive = formData.isActive;
          updateData.branchId = formData.branchId || null;
          updateData.profileMeta = buildAdminProfileMeta({
            responsibilityZone: formData.responsibilityZone,
            position: formData.position,
            experience: formData.experience,
            comment: formData.comment,
            permissions: ADMIN_PERMISSION_KEYS.filter((k) => formData.permissions[k]),
            branchId: formData.branchId || undefined,
          });
        } else if (newRole === 'PROMOTER') {
          updateData.isActive = formData.isActive;
          updateData.profileMeta = buildPromoterProfileMeta({
            dateOfBirth: formData.dateOfBirth,
            workArea: formData.workArea,
            workRadiusKm: formData.workRadiusKm,
            pricePerShift: formData.pricePerShift,
            pricePerClient: formData.pricePerClient,
            transport: formData.transport,
            socialLink: formData.socialLink,
            notes: formData.notes,
          });
        }

        const updated = await apiService.updateUser(userId, updateData);

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
              hireDate: formData.hireDate || null,
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
            savedEmployee = created;
          }
        } else if (newRole === 'ADMIN') {
          const nextAdmin = {
            ...employee,
            isActive: formData.isActive,
            profileMeta: updateData.profileMeta,
            user: {
              ...(employee.user || employee),
              ...updateData,
              ...(updated || {}),
            },
            employeeType: 'admin' as const,
            role: 'ADMIN',
          };
          setEmployee(nextAdmin);
          savedEmployee = nextAdmin;
        } else if (newRole === 'PROMOTER') {
          const nextPromoter = {
            ...employee,
            isActive: formData.isActive,
            profileMeta: updateData.profileMeta,
            user: {
              ...(employee.user || employee),
              ...updateData,
              ...(updated || {}),
            },
            employeeType: 'promoter' as const,
            role: 'PROMOTER',
          };
          setEmployee(nextPromoter);
          savedEmployee = nextPromoter;
        }
      } else if (newRole === 'ADMIN') {
        const profileMeta = buildAdminProfileMeta({
          responsibilityZone: formData.responsibilityZone,
          position: formData.position,
          experience: formData.experience,
          comment: formData.comment,
          permissions: ADMIN_PERMISSION_KEYS.filter((k) => formData.permissions[k]),
          branchId: formData.branchId || undefined,
        });
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          phone: formData.phone,
          email: formData.email,
          isActive: formData.isActive,
          profileMeta,
          branchId: formData.branchId || null,
        };
        if (formData.password) updateData.password = formData.password;
        const updated = await apiService.updateUser(userId, updateData);
        const nextAdmin = {
          ...employee,
          isActive: formData.isActive,
          profileMeta,
          user: {
            ...(employee.user || employee),
            ...updateData,
            profileMeta,
            isActive: formData.isActive,
            ...(updated || {}),
          },
          employeeType: 'admin' as const,
          role: 'ADMIN',
        };
        setEmployee(nextAdmin);
        savedEmployee = nextAdmin;
      } else if (newRole === 'PROMOTER') {
        const profileMeta = buildPromoterProfileMeta({
          dateOfBirth: formData.dateOfBirth,
          workArea: formData.workArea,
          workRadiusKm: formData.workRadiusKm,
          pricePerShift: formData.pricePerShift,
          pricePerClient: formData.pricePerClient,
          transport: formData.transport,
          socialLink: formData.socialLink,
          notes: formData.notes,
        });
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          phone: formData.phone,
          email: formData.email,
          isActive: formData.isActive,
          profileMeta,
        };
        if (formData.password) updateData.password = formData.password;
        const updated = await apiService.updateUser(userId, updateData);
        const nextPromoter = {
          ...employee,
          isActive: formData.isActive,
          profileMeta,
          user: {
            ...(employee.user || employee),
            ...updateData,
            profileMeta,
            isActive: formData.isActive,
            ...(updated || {}),
          },
          employeeType: 'promoter' as const,
          role: 'PROMOTER',
        };
        setEmployee(nextPromoter);
        savedEmployee = nextPromoter;
      } else {
        await apiService.updateTrainer(employee.id, {
          ...formData,
          hireDate: formData.hireDate || null,
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

      let latest = savedEmployee;
      if (newRole === 'TRAINER' && employee?.id && !isEmployeeAdmin(employee) && !isEmployeePromoter(employee)) {
        try {
          latest = await apiService.getTrainer(employee.id);
          setEmployee(latest);
        } catch {
          /* keep */
        }
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
    const targetIsPromoter = newRole === 'PROMOTER';

    if (targetIsAdmin || targetIsPromoter) {
      const identityErrors: Record<string, string> = {};
      if (!formData.firstName) identityErrors.firstName = 'Имя обязательно';
      if (!formData.lastName) identityErrors.lastName = 'Фамилия обязательна';
      if (!formData.email) identityErrors.email = 'Email обязателен';
      setFormErrors(identityErrors);
      if (Object.keys(identityErrors).length > 0) {
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
    const assigned = new Set<string>(
      (employee?.branches || []).map((tb: any) => tb.branchId || tb.branch?.id).filter(Boolean)
    );
    const primary = employee?.user?.branchId || employee?.branchId;
    if (primary) assigned.add(primary);
    return branches.filter((b) => !assigned.has(b.id) && b.isActive);
  }, [branches, employee]);

  const adminUserId = (): string | null =>
    employee?.user?.id || (isAdmin ? employee?.id : null) || null;

  const handleAddBranch = async () => {
    if (!selectedBranchId) return;
    try {
      setBranchBusy(true);
      if (isAdmin) {
        const userId = adminUserId();
        if (!userId) return;
        await apiService.updateUser(userId, { branchId: selectedBranchId });
        const b = branches.find((x) => x.id === selectedBranchId);
        setEmployee({
          ...employee,
          branchId: selectedBranchId,
          user: { ...(employee.user || employee), branchId: selectedBranchId },
          branches: b
            ? [{ branchId: b.id, branch: b }]
            : employee.branches,
        });
        setSelectedBranchId('');
        await onSaved?.();
        return;
      }
      if (!employee?.id) return;
      await apiService.addBranchToTrainer(employee.id, selectedBranchId);
      setSelectedBranchId('');
      await refreshEmployee();
      await onSaved?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка добавления филиала');
    } finally {
      setBranchBusy(false);
    }
  };

  const handleRemoveBranch = async (branchId: string) => {
    if (!window.confirm('Убрать этот филиал у сотрудника?')) return;
    try {
      setBranchBusy(true);
      if (isAdmin) {
        const userId = adminUserId();
        if (!userId) return;
        await apiService.updateUser(userId, { branchId: null });
        setEmployee({
          ...employee,
          branchId: null,
          user: { ...(employee.user || employee), branchId: null },
          branches: [],
        });
        await onSaved?.();
        return;
      }
      if (!employee?.id) return;
      await apiService.removeBranchFromTrainer(employee.id, branchId);
      await refreshEmployee();
      await onSaved?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка удаления филиала');
    } finally {
      setBranchBusy(false);
    }
  };

  const handleToggleAccess = async () => {
    const userId = adminUserId();
    if (!userId || !canEdit) return;
    const currentlyActive = employee?.isActive !== false && empUser?.isActive !== false;
    try {
      setAccessBusy(true);
      await apiService.updateUser(userId, { isActive: !currentlyActive });
      setEmployee({
        ...employee,
        isActive: !currentlyActive,
        user: { ...(employee.user || employee), isActive: !currentlyActive },
      });
      setSnack(currentlyActive ? 'Доступ отключён' : 'Доступ включён');
      await onSaved?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Не удалось изменить доступ');
    } finally {
      setAccessBusy(false);
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

  const salaryScheme = resolveTrainerSalaryScheme(employee?.salaryScheme, employee?.salaryType);
  const balance = employee?.balance;

  if (loading && !employee) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const editForm = editing ? (
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
              <MenuItem value="PROMOTER">Промоутер</MenuItem>
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
        <PasswordField
          fullWidth
          label="Новый пароль"
          value={formData.password}
          onChange={(e) => handleInputChange('password', e.target.value)}
          placeholder="Оставьте пустым, чтобы не менять"
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

      {formData.role === 'ADMIN' && (
        <>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Зона ответственности"
              value={formData.responsibilityZone}
              onChange={(e) => handleInputChange('responsibilityZone', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Опыт работы"
              value={formData.experience}
              onChange={(e) => handleInputChange('experience', e.target.value)}
              placeholder="Например: 5"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Должность"
              value={formData.position}
              onChange={(e) => handleInputChange('position', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Филиал</InputLabel>
              <Select
                value={formData.branchId}
                label="Филиал"
                onChange={(e) => handleInputChange('branchId', e.target.value)}
              >
                <MenuItem value="">Не выбран</MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Комментарий"
              value={formData.comment}
              onChange={(e) => handleInputChange('comment', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
              }
              label="Аккаунт активен"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Права доступа</Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 0.5,
              }}
            >
              {ADMIN_PERMISSION_KEYS.map((key) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={Boolean(formData.permissions[key])}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            [key]: !prev.permissions[key],
                          },
                        }))
                      }
                    />
                  }
                  label={ADMIN_PERMISSION_LABELS[key]}
                />
              ))}
            </Box>
          </Grid>
        </>
      )}

      {formData.role === 'PROMOTER' && (
        <>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Дата рождения"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Город / район работы"
              value={formData.workArea}
              onChange={(e) => handleInputChange('workArea', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Радиус работы (км)"
              type="number"
              value={formData.workRadiusKm}
              onChange={(e) => handleInputChange('workRadiusKm', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Способ передвижения</InputLabel>
              <Select
                value={formData.transport}
                label="Способ передвижения"
                onChange={(e) => handleInputChange('transport', e.target.value)}
              >
                <MenuItem value="">Не выбран</MenuItem>
                {PROMOTER_TRANSPORT_OPTIONS.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Цена за выход (₽)"
              type="number"
              value={formData.pricePerShift}
              onChange={(e) => handleInputChange('pricePerShift', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Цена за клиента (₽)"
              type="number"
              value={formData.pricePerClient}
              onChange={(e) => handleInputChange('pricePerClient', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Ссылка на соцсети"
              value={formData.socialLink}
              onChange={(e) => handleInputChange('socialLink', e.target.value)}
              placeholder="https://"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Дополнительная информация"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                />
              }
              label="Аккаунт активен"
            />
          </Grid>
        </>
      )}

      {formData.role === 'TRAINER' && (
        <>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Квалификация"
              value={formData.qualification}
              onChange={(e) => handleInputChange('qualification', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Опыт (лет)"
              type="number"
              value={formData.experience}
              onChange={(e) => handleInputChange('experience', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Специализация"
              value={formData.specialization}
              onChange={(e) => handleInputChange('specialization', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Дата начала работы"
              type="date"
              value={formData.hireDate}
              onChange={(e) => handleInputChange('hireDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Тренерская категория"
              value={formData.coachCategory}
              onChange={(e) => handleInputChange('coachCategory', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Судейская категория"
              value={formData.judgeCategory}
              onChange={(e) => handleInputChange('judgeCategory', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Достижения"
              value={formData.achievements}
              onChange={(e) => handleInputChange('achievements', e.target.value)}
              helperText="Каждый пункт с новой строки"
            />
          </Grid>
          {isOwner && (
            <>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Схема зарплаты</InputLabel>
                  <Select
                    value={formData.salaryScheme}
                    label="Схема зарплаты"
                    onChange={(e) => handleInputChange('salaryScheme', e.target.value)}
                  >
                    <MenuItem value="per_training_person">На группах</MenuItem>
                    <MenuItem value={TRAINER_FIXED_MONTHLY}>Фикс плата в месяц</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {formData.salaryScheme === TRAINER_FIXED_MONTHLY && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Сумма в месяц"
                    type="number"
                    value={formData.salaryRate}
                    onChange={(e) => handleInputChange('salaryRate', e.target.value)}
                  />
                </Grid>
              )}
            </>
          )}
        </>
      )}
      <Grid item xs={12}>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            disabled={saving}
            onClick={() => handleSave()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Сохранить
          </Button>
          <Button startIcon={<Close />} onClick={cancelEdit} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Отмена
          </Button>
        </Stack>
      </Grid>
    </Grid>
  ) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {isAdmin ? (
        <AdminCardDesktopView
          employee={employee}
          branches={branches}
          onClose={requestClose}
          onEdit={canEdit ? startEdit : undefined}
          canEdit={canEdit}
          selectedBranchId={selectedBranchId}
          onSelectedBranchId={setSelectedBranchId}
          availableBranches={availableBranches}
          onAddBranch={handleAddBranch}
          onRemoveBranch={handleRemoveBranch}
          branchBusy={branchBusy}
          editing={editing}
          editForm={editForm}
          onChangePassword={canEdit ? startEdit : undefined}
          onResendInvite={() => setSnack('Приглашение отправлено повторно')}
          onToggleAccess={handleToggleAccess}
          accessBusy={accessBusy}
        />
      ) : isPromoter ? (
        <PromoterCardDesktopView
          employee={employee}
          onClose={requestClose}
          onEdit={canEdit ? startEdit : undefined}
          canEdit={canEdit}
          editing={editing}
          editForm={editForm}
        />
      ) : (
        <TrainerCardDesktopView
          employee={employee}
          branches={branches}
          tab={cardTab}
          onTab={setCardTab}
          fromSection={fromSection}
          onBack={requestClose}
          onClose={requestClose}
          onEdit={canEdit ? startEdit : undefined}
          canEdit={canEdit}
          selectedBranchId={selectedBranchId}
          onSelectedBranchId={setSelectedBranchId}
          availableBranches={availableBranches}
          onAddBranch={handleAddBranch}
          onRemoveBranch={handleRemoveBranch}
          branchBusy={branchBusy}
          groups={groups}
          onOpenEarnings={onOpenEarnings ? () => onOpenEarnings(employee) : undefined}
          stats={{
            groupsCount: groups.length,
            studentsCount: groups.reduce((s, g) => s + (Number(g.studentsCount) || 0), 0),
            lessonsCount: 0,
            payout: Number(employee?.balance ?? 0),
          }}
          editing={editing}
          editForm={editForm}
          documentsPanel={
            employee?.id ? (
              <Box>
                <TrainerDocumentsPanel trainerId={employee.id} initialDocs={employee.documents} />
                <Box sx={{ mt: 2 }}>
                  <AttendanceExcelExport
                    scope="trainer"
                    entityId={employee.id}
                    entityName={displayName}
                  />
                </Box>
              </Box>
            ) : null
          }
        />
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
              ? 'Сотрудник станет администратором. Запись тренера (если была) и привязки к филиалам будут удалены. Если у сотрудника есть группы — смена роли будет отклонена.'
              : pendingRoleChange === 'PROMOTER'
                ? 'Сотрудник станет промоутером. Профиль тренера (если был) будет удалён.'
                : 'Сотрудник станет тренером. Будет создан профиль тренера — заполните квалификацию и зарплату при необходимости.'}
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
