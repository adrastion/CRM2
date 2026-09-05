import React, { useState, useEffect } from 'react';
import { validateTrainerForm } from '../utils/validation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  useMediaQuery,
  useTheme,
  Divider,
  Stack,
} from '@mui/material';
import { Add, Edit, Delete, Business, AttachMoney, Person, AdminPanelSettings } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiService } from '../services/api';
import { Trainer, Branch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  SALARY_SCHEME_OPTIONS,
  normalizeSalaryScheme,
  salarySchemeLabel,
  salaryRateFieldLabel,
  salarySchemeHint,
} from '../utils/salarySchemes';

const isEmployeeAdmin = (employee: any): boolean =>
  employee?.employeeType === 'admin' ||
  employee?.user?.role === 'ADMIN' ||
  employee?.role === 'ADMIN';

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
  salaryScheme: 'per_training_person',
  salaryRate: '',
  canViewAllGroups: false,
};

const Trainers: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const isOwner = user?.role === 'OWNER';
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleSelectionDialog, setRoleSelectionDialog] = useState(false); // Диалог выбора роли
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [roleConfirmDialog, setRoleConfirmDialog] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<string | null>(null);
  const [branchesDialog, setBranchesDialog] = useState(false);
  const [earningsDialog, setEarningsDialog] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [earningsStartDate, setEarningsStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [earningsEndDate, setEarningsEndDate] = useState<Date | null>(new Date());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [formData, setFormData] = useState({ ...emptyFormData });

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        setError(null);
        const [trainersRes, branchesRes] = await Promise.all([
          apiService.getTrainers({ includeAdmins: 'true', limit: 1000 }, abortController.signal),
          apiService.getBranches(undefined, abortController.signal),
        ]);
        if (!isMounted || abortController.signal.aborted) return;
        setTrainers(trainersRes.data);
        setBranches(branchesRes.data);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Ошибка загрузки данных');
        console.error('Error fetching data:', err);
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const fetchTrainers = async () => {
    try {
      const response = await apiService.getTrainers({ includeAdmins: 'true', limit: 1000 });
      setTrainers(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки сотрудников');
      console.error('Error fetching employees:', err);
    }
  };

  const handleDeleteTrainer = async (trainerId: string) => {
    console.log('Attempting to delete trainer:', trainerId);
    if (window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
      try {
        console.log('Deleting trainer...');
        await apiService.deleteTrainer(trainerId);
        console.log('Trainer deleted successfully, updating list...');
        setTrainers(trainers.filter(trainer => trainer.id !== trainerId));
        console.log('Trainer list updated');
      } catch (err: any) {
        console.error('Error deleting trainer:', err);
        setError(err.response?.data?.error || 'Ошибка удаления сотрудника');
      }
    } else {
      console.log('Delete cancelled by user');
    }
  };

  const handleDeleteAdmin = async (userId: string) => {
    console.log('Attempting to delete admin:', userId);
    try {
      console.log('Deleting admin...');
      await apiService.deleteUser(userId);
      console.log('Admin deleted successfully, updating list...');
      setTrainers(trainers.filter(trainer => {
        const user = (trainer as any).user || trainer;
        return user.id !== userId;
      }));
      console.log('Admin list updated');
      setSnackbarMessage('Администратор успешно удален');
      setSnackbarOpen(true);
    } catch (err: any) {
      console.error('Error deleting admin:', err);
      setError(err.response?.data?.error || 'Ошибка удаления администратора');
      setSnackbarMessage(err.response?.data?.error || 'Ошибка удаления администратора');
      setSnackbarOpen(true);
    }
  };

  const handleCreateTrainer = async () => {
    // Валидация уже выполнена в onClick кнопки, поэтому здесь просто проверяем еще раз для надежности
    const errors = validateTrainerForm(formData);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      return;
    }

    try {
      // Если создаем администратора, используем API создания пользователя
      if (formData.role === 'ADMIN') {
        const { role, qualification, experience, specialization, salaryScheme, salaryRate, canViewAllGroups, ...userData } = formData;
        await apiService.createUser({
          ...userData,
          role: 'ADMIN'
        });
      } else {
        // Если создаем тренера, используем API создания тренера
        await apiService.createTrainer({
          ...formData,
          salaryScheme: formData.salaryScheme,
          salaryRate: formData.salaryRate ? parseFloat(formData.salaryRate) : 0,
          salaryType: formData.salaryScheme,
          salaryAmount: formData.salaryRate ? parseFloat(formData.salaryRate) : 0,
        });
      }
      // Обновляем список сотрудников, получая свежие данные с сервера
      await fetchTrainers();
      setOpenDialog(false);
      setFormErrors({});
      setError('');
      setFormData({
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
        salaryScheme: 'per_training_person',
        salaryRate: '',
        canViewAllGroups: false,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания сотрудника');
      console.error('Error creating employee:', err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleEditTrainer = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setFormErrors({});
    setError('');
    setFormData({
      email: trainer.user?.email || '',
      password: '',
      firstName: trainer.user?.firstName || '',
      lastName: trainer.user?.lastName || '',
      middleName: trainer.user?.middleName || '',
      phone: trainer.user?.phone || '',
      role: trainer.user?.role || 'TRAINER',
      qualification: trainer.qualification || '',
      experience: trainer.experience?.toString() || '',
      specialization: trainer.specialization || '',
      salaryScheme: normalizeSalaryScheme((trainer as any).salaryScheme || trainer.salaryType),
      salaryRate: String((trainer as any).salaryRate ?? trainer.salaryAmount ?? ''),
      canViewAllGroups: (trainer as any).canViewAllGroups || false,
    });
    setEditDialog(true);
  };

  const handleEditAdmin = (admin: any) => {
    setEditingTrainer(admin);
    setFormErrors({});
    setError('');
    const adminUser = admin.user || admin;
    setFormData({
      ...emptyFormData,
      email: adminUser.email || '',
      firstName: adminUser.firstName || '',
      lastName: adminUser.lastName || '',
      middleName: adminUser.middleName || '',
      phone: adminUser.phone || '',
      role: adminUser.role || 'ADMIN',
    });
    setEditDialog(true);
  };

  const openEmployeeEdit = (employee: any) => {
    if (isEmployeeAdmin(employee)) {
      handleEditAdmin(employee);
    } else {
      handleEditTrainer(employee);
    }
  };

  const getCurrentEmployeeRole = (): string => {
    if (!editingTrainer) return formData.role;
    return (
      (editingTrainer as any).user?.role ||
      (editingTrainer as any).role ||
      ((editingTrainer as any).employeeType === 'admin' ? 'ADMIN' : 'TRAINER')
    );
  };

  const resetEditForm = () => {
    setEditDialog(false);
    setFormErrors({});
    setError('');
    setEditingTrainer(null);
    setFormData({ ...emptyFormData });
    setRoleConfirmDialog(false);
    setPendingRoleChange(null);
  };

  const performSaveEmployee = async () => {
    if (!editingTrainer) return;

    const userId = (editingTrainer as any).user?.id || (editingTrainer as any).id;
    const currentRole = getCurrentEmployeeRole();
    const newRole = formData.role;
    const roleChanged = newRole !== currentRole;

    try {
      if (roleChanged) {
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          phone: formData.phone,
          email: formData.email,
          role: newRole,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await apiService.updateUser(userId, updateData);

        // After ADMIN → TRAINER, update trainer profile fields if provided
        if (newRole === 'TRAINER') {
          await fetchTrainers();
          const refreshed = await apiService.getTrainers({ includeAdmins: 'true', limit: 1000 });
          const created = refreshed.data.find(
            (e: any) => (e.user?.id || e.id) === userId && e.employeeType !== 'admin'
          );
          if (created?.id) {
            await apiService.updateTrainer(created.id, {
              qualification: formData.qualification,
              experience: formData.experience,
              specialization: formData.specialization,
              salaryScheme: formData.salaryScheme,
              salaryRate: formData.salaryRate ? parseFloat(formData.salaryRate) : 0,
              salaryType: formData.salaryScheme,
              salaryAmount: formData.salaryRate ? parseFloat(formData.salaryRate) : 0,
              canViewAllGroups: formData.canViewAllGroups,
              firstName: formData.firstName,
              lastName: formData.lastName,
              middleName: formData.middleName,
              phone: formData.phone,
              email: formData.email,
            });
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
        if (formData.password) {
          updateData.password = formData.password;
        }
        await apiService.updateUser(userId, updateData);
      } else {
        await apiService.updateTrainer(editingTrainer.id, {
          ...formData,
          salaryScheme: formData.salaryScheme,
          salaryRate: formData.salaryRate ? parseFloat(formData.salaryRate) : 0,
          salaryType: formData.salaryScheme,
          salaryAmount: formData.salaryRate ? parseFloat(formData.salaryRate) : 0,
        });
      }

      await fetchTrainers();
      resetEditForm();
      setSnackbarMessage('Изменения сохранены');
      setSnackbarOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления сотрудника');
      console.error('Error updating employee:', err);
    }
  };

  const handleUpdateTrainer = async () => {
    if (!editingTrainer) return;

    const currentRole = getCurrentEmployeeRole();
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
        setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
        setSnackbarOpen(true);
        return;
      }
    } else {
      const errors = validateTrainerForm(formData);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setError('Пожалуйста, исправьте ошибки в форме');
        setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
        setSnackbarOpen(true);
        return;
      }
    }

    if (roleChanged && isOwner) {
      setPendingRoleChange(newRole);
      setRoleConfirmDialog(true);
      return;
    }

    await performSaveEmployee();
  };

  const handleOpenBranchesDialog = async (trainer: Trainer) => {
    setSelectedTrainer(trainer);
    // Refresh trainer data to get latest branches
    try {
      const updatedTrainer = await apiService.getTrainer(trainer.id);
      setSelectedTrainer(updatedTrainer);
    } catch (err: any) {
      console.error('Error fetching trainer:', err);
    }
    setBranchesDialog(true);
  };

  const handleOpenEarningsDialog = async (trainer: Trainer) => {
    setSelectedTrainer(trainer);
    setEarningsDialog(true);
    await fetchEarnings(trainer.id);
  };

  const fetchEarnings = async (trainerId: string) => {
    try {
      setLoadingEarnings(true);
      setError(null);
      
      const params: any = {};
      if (earningsStartDate) {
        params.startDate = earningsStartDate.toISOString();
      }
      if (earningsEndDate) {
        params.endDate = earningsEndDate.toISOString();
      }

      const earningsRes = await apiService.getTrainerEarnings(trainerId, params);
      setEarnings(earningsRes);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки данных о заработке');
      console.error('Error fetching earnings:', err);
    } finally {
      setLoadingEarnings(false);
    }
  };

  const handleAddBranchToTrainer = async () => {
    if (!selectedTrainer || !selectedBranchId) return;

    try {
      await apiService.addBranchToTrainer(selectedTrainer.id, selectedBranchId);
      // Refresh trainer data
      const updatedTrainer = await apiService.getTrainer(selectedTrainer.id);
      setSelectedTrainer(updatedTrainer);
      // Refresh trainers list
      await fetchTrainers();
      setSelectedBranchId('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления филиала к тренеру');
      console.error('Error adding branch to trainer:', err);
    }
  };

  const handleRemoveBranchFromTrainer = async (branchId: string) => {
    if (!selectedTrainer) return;

    if (window.confirm('Вы уверены, что хотите удалить этот филиал у тренера?')) {
      try {
        await apiService.removeBranchFromTrainer(selectedTrainer.id, branchId);
        // Refresh trainer data
        const updatedTrainer = await apiService.getTrainer(selectedTrainer.id);
        setSelectedTrainer(updatedTrainer);
        // Refresh trainers list
        await fetchTrainers();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления филиала у тренера');
        console.error('Error removing branch from trainer:', err);
      }
    }
  };

  // Get available branches (not already assigned to trainer)
  const getAvailableBranches = () => {
    if (!selectedTrainer) return branches;
    const assignedBranchIds = selectedTrainer.branches?.map(tb => tb.branchId) || [];
    return branches.filter(branch => !assignedBranchIds.includes(branch.id) && branch.isActive);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={fetchTrainers} variant="outlined">
          Попробовать снова
        </Button>
      </Box>
    );
  }

  return (
    <Box data-onboarding="trainers-page">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: 20, md: 24 } }}>
          Сотрудники ({trainers.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
          onClick={() => {
            if (isOwner) {
              setRoleSelectionDialog(true);
            } else {
              setOpenDialog(true);
              setFormErrors({});
              setError('');
              setFormData({ ...emptyFormData, role: 'TRAINER' });
            }
          }}
          data-onboarding="add-trainer-button"
        >
          Добавить сотрудника
        </Button>
      </Box>

      {isMobile ? (
        <Stack spacing={1.5}>
          {trainers.filter(Boolean).map((employee: any) => {
            const isAdmin = isEmployeeAdmin(employee);
            const empUser = employee.user || employee;
            const displayName = `${empUser.lastName || ''} ${empUser.firstName || ''} ${empUser.middleName || ''}`.trim();
            return (
              <Card key={employee.id || empUser.id} variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: 'primary.main',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                        onClick={() => openEmployeeEdit(employee)}
                      >
                        {displayName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                        {empUser.email}
                      </Typography>
                    </Box>
                    <Chip
                      label={isAdmin ? 'Администратор' : 'Тренер'}
                      color={isAdmin ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </Box>
                  {!isAdmin && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {employee.qualification || 'Квалификация не указана'}
                      {employee.experience ? ` · ${employee.experience} лет` : ''}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    <Chip
                      label={employee.isActive !== false ? 'Активен' : 'Неактивен'}
                      color={employee.isActive !== false ? 'success' : 'default'}
                      size="small"
                    />
                    {!isAdmin && (employee.salaryType || employee.salaryScheme) && (
                      <Chip
                        label={salarySchemeLabel(employee.salaryScheme || employee.salaryType)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {!isAdmin && employee.balance !== undefined && (
                      <Chip label={`${Number(employee.balance).toFixed(0)} ₽`} size="small" variant="outlined" />
                    )}
                  </Box>
                  <Divider sx={{ mb: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    {!isAdmin && (
                      <>
                        <IconButton size="small" color="primary" title="Филиалы" onClick={() => handleOpenBranchesDialog(employee)}>
                          <Business />
                        </IconButton>
                        <IconButton size="small" color="primary" title="Зарплата" onClick={() => handleOpenEarningsDialog(employee)}>
                          <AttachMoney />
                        </IconButton>
                      </>
                    )}
                    {(isOwner || !isAdmin) && (
                      <IconButton size="small" color="primary" onClick={() => openEmployeeEdit(employee)}>
                        <Edit />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (isAdmin) {
                          if (window.confirm('Вы уверены, что хотите удалить этого администратора?')) {
                            handleDeleteAdmin(empUser.id);
                          }
                        } else {
                          handleDeleteTrainer(employee.id);
                        }
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      ) : (
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Имя</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Роль</TableCell>
                  <TableCell>Квалификация</TableCell>
                  <TableCell>Опыт</TableCell>
                  <TableCell>Тип зарплаты</TableCell>
                  <TableCell>Баланс</TableCell>
                  <TableCell>Филиалы</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trainers.filter(employee => employee).map((employee: any) => {
                  const isAdmin = isEmployeeAdmin(employee);
                  const empUser = employee.user || employee;
                  const displayName = `${empUser.lastName || ''} ${empUser.firstName || ''} ${empUser.middleName || ''}`.trim();
                  
                  return (
                    <TableRow key={employee.id || empUser.id}>
                      <TableCell>
                        <Typography
                          sx={{
                            cursor: 'pointer',
                            color: 'primary.main',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                          onClick={() => openEmployeeEdit(employee)}
                        >
                          {displayName}
                        </Typography>
                      </TableCell>
                      <TableCell>{empUser.email}</TableCell>
                      <TableCell>
                        <Chip 
                          label={isAdmin ? 'Администратор' : 'Тренер'} 
                          color={isAdmin ? 'primary' : 'secondary'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{employee.qualification || '-'}</TableCell>
                      <TableCell>{employee.experience ? `${employee.experience} лет` : '-'}</TableCell>
                      <TableCell>
                        {employee.salaryType || (employee as any).salaryScheme ? (
                          <Chip
                            label={salarySchemeLabel((employee as any).salaryScheme || employee.salaryType)}
                            color="primary"
                            size="small"
                          />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.balance !== undefined ? (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: Number(employee.balance) > 0 
                                ? 'success.main' 
                                : 'text.secondary'
                            }}
                          >
                            {Number(employee.balance).toFixed(2)} ₽
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.branches && employee.branches.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {employee.branches.map((tb: any) => (
                              <Chip
                                key={tb.id}
                                label={tb.branch?.name || 'Неизвестный филиал'}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">Нет филиалов</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={employee.isActive !== false ? 'Активен' : 'Неактивен'} 
                          color={employee.isActive !== false ? 'success' : 'default'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        {!isAdmin && (
                          <>
                            <IconButton 
                              size="small" 
                              color="primary"
                              title="Управление филиалами"
                              onClick={() => handleOpenBranchesDialog(employee)}
                            >
                              <Business />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="primary"
                              title="Просмотр зарплаты"
                              onClick={() => handleOpenEarningsDialog(employee)}
                            >
                              <AttachMoney />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleEditTrainer(employee)}
                            >
                              <Edit />
                            </IconButton>
                          </>
                        )}
                        {isAdmin && isOwner && (
                          <IconButton 
                            size="small" 
                            color="primary"
                            title="Редактировать администратора"
                            onClick={() => handleEditAdmin(employee)}
                          >
                            <Edit />
                          </IconButton>
                        )}
                        <IconButton 
                          size="small" 
                          color="error"
                          title="Удалить"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isAdmin) {
                              if (window.confirm('Вы уверены, что хотите удалить этого администратора?')) {
                                handleDeleteAdmin(empUser.id);
                              }
                            } else {
                              handleDeleteTrainer(employee.id);
                            }
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      )}

      {/* Диалог выбора роли (только для владельца) */}
      {isOwner && (
        <Dialog open={roleSelectionDialog} onClose={() => setRoleSelectionDialog(false)} maxWidth="sm" fullWidth fullScreen={isNarrow}>
          <DialogTitle>
            Кого вы хотите добавить?
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => {
                  setFormData(prev => ({ 
                    ...prev, 
                    role: 'TRAINER',
                    email: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    middleName: '',
                    phone: '',
                    qualification: '',
                    experience: '',
                    specialization: '',
                    salaryScheme: 'per_training_person',
                    salaryRate: '',
                    canViewAllGroups: false,
                  }));
                  setRoleSelectionDialog(false);
                  setOpenDialog(true);
                  setFormErrors({});
                  setError('');
                }}
                sx={{ py: 2 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ fontSize: 40 }} />
                  <Typography variant="h6">Тренер</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Создать аккаунт тренера
                  </Typography>
                </Box>
              </Button>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => {
                  setFormData(prev => ({ 
                    ...prev, 
                    role: 'ADMIN',
                    email: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    middleName: '',
                    phone: '',
                    qualification: '',
                    experience: '',
                    specialization: '',
                    salaryScheme: 'per_training_person',
                    salaryRate: '',
                    canViewAllGroups: false,
                  }));
                  setRoleSelectionDialog(false);
                  setOpenDialog(true);
                  setFormErrors({});
                  setError('');
                }}
                sx={{ py: 2 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <AdminPanelSettings sx={{ fontSize: 40 }} />
                  <Typography variant="h6">Администратор</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Создать аккаунт администратора
                  </Typography>
                </Box>
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRoleSelectionDialog(false)}>Отмена</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Диалог добавления тренера */}
      <Dialog 
        open={openDialog} 
        onClose={(event, reason) => {
          // Всегда проверяем ошибки перед закрытием
          const hasErrors = Object.keys(formErrors).length > 0;
          
          // Если есть ошибки, не закрываем диалог
          if (hasErrors || error) {
            setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
            setSnackbarOpen(true);
            return;
          }
          
          // Разрешаем закрытие только если нет ошибок
          setOpenDialog(false);
          setFormErrors({});
          setError('');
        }}
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
        disableEscapeKeyDown={Object.keys(formErrors).length > 0 || !!error}
      >
        <DialogTitle>Добавить нового сотрудника</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {Object.keys(formErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(formErrors).length} {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Тип сотрудника отображается как информационный блок (уже выбран в предыдущем диалоге) */}
            {isOwner && (
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Тип сотрудника
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {formData.role === 'ADMIN' ? 'Администратор' : 'Тренер'}
                  </Typography>
                </Box>
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
                label="Пароль"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
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
                    helperText="Укажите уровень квалификации тренера (дан, разряд, звание и т.д.)"
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
                    placeholder="например: Карате, Тхэквондо"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Тип зарплаты</InputLabel>
                    <Select
                      value={formData.salaryScheme}
                      label="Тип зарплаты"
                      onChange={(e) => handleInputChange('salaryScheme', e.target.value)}
                    >
                      {SALARY_SCHEME_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={salaryRateFieldLabel(formData.salaryScheme)}
                    type="number"
                    value={formData.salaryRate}
                    onChange={(e) => handleInputChange('salaryRate', e.target.value)}
                    helperText={salarySchemeHint(formData.salaryScheme)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <input
                        type="checkbox"
                        checked={formData.canViewAllGroups}
                        onChange={(e) => handleInputChange('canViewAllGroups', e.target.checked.toString())}
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
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Отмена всегда закрывает форму без применения изменений
              setOpenDialog(false);
              setFormErrors({});
              setError('');
              setFormData({
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
                salaryScheme: 'per_training_person',
                salaryRate: '',
                canViewAllGroups: false,
              });
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
              const validationErrors = validateTrainerForm(formData);
              setFormErrors(validationErrors);
              
              // Если есть ошибки, показываем их и оставляем диалог открытым
              if (Object.keys(validationErrors).length > 0) {
                setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
                setSnackbarOpen(true);
                return; // Не создаем тренера, если есть ошибки
              }
              
              // Если нет ошибок, вызываем handleCreateTrainer для сохранения
              handleCreateTrainer();
            }} 
            variant="contained"
            type="button"
          >
            Создать сотрудника
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования тренера */}
      <Dialog 
        open={editDialog} 
        onClose={(event, reason) => {
          const hasErrors = Object.keys(formErrors).length > 0;
          if (hasErrors || error) {
            setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
            setSnackbarOpen(true);
            return;
          }
          resetEditForm();
        }}
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
        disableEscapeKeyDown={Object.keys(formErrors).length > 0 || !!error}
      >
        <DialogTitle>Редактировать сотрудника</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {Object.keys(formErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте {Object.keys(formErrors).length} {Object.keys(formErrors).length === 1 ? 'ошибку' : 'ошибок'} в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
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
                    helperText={formErrors.qualification || "Укажите уровень квалификации тренера (дан, разряд, звание и т.д.)"}
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
                  <FormControl fullWidth error={!!formErrors.salaryScheme}>
                    <InputLabel>Тип зарплаты</InputLabel>
                    <Select
                      value={formData.salaryScheme}
                      label="Тип зарплаты"
                      onChange={(e) => handleInputChange('salaryScheme', e.target.value)}
                    >
                      {SALARY_SCHEME_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                    {formErrors.salaryScheme && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {formErrors.salaryScheme}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={salaryRateFieldLabel(formData.salaryScheme)}
                    type="number"
                    value={formData.salaryRate}
                    onChange={(e) => handleInputChange('salaryRate', e.target.value)}
                    error={!!formErrors.salaryRate}
                    helperText={formErrors.salaryRate || salarySchemeHint(formData.salaryScheme)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <input
                        type="checkbox"
                        checked={formData.canViewAllGroups}
                        onChange={(e) => handleInputChange('canViewAllGroups', e.target.checked.toString())}
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
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              resetEditForm();
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
              handleUpdateTrainer();
            }} 
            variant="contained"
            type="button"
          >
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={roleConfirmDialog} onClose={() => { setRoleConfirmDialog(false); setPendingRoleChange(null); }} fullScreen={isNarrow}>
        <DialogTitle>Сменить роль сотрудника?</DialogTitle>
        <DialogContent>
          <Typography>
            {pendingRoleChange === 'ADMIN'
              ? 'Тренер станет администратором. Запись тренера и привязки к филиалам будут удалены. Если у сотрудника есть группы — смена роли будет отклонена.'
              : 'Администратор станет тренером. Будет создан профиль тренера — заполните квалификацию и зарплату при необходимости.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRoleConfirmDialog(false); setPendingRoleChange(null); }}>Отмена</Button>
          <Button
            variant="contained"
            onClick={async () => {
              setRoleConfirmDialog(false);
              await performSaveEmployee();
            }}
          >
            Подтвердить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог управления филиалами тренера */}
      <Dialog open={branchesDialog} onClose={() => setBranchesDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Филиалы тренера: {selectedTrainer?.user?.firstName} {selectedTrainer?.user?.lastName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Добавить филиал</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <FormControl fullWidth>
                  <InputLabel>Выберите филиал</InputLabel>
                  <Select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    label="Выберите филиал"
                  >
                    {getAvailableBranches().map((branch) => (
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
                  onClick={handleAddBranchToTrainer}
                  disabled={!selectedBranchId}
                  sx={{ height: '56px' }}
                >
                  Добавить
                </Button>
              </Grid>
            </Grid>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Текущие филиалы ({selectedTrainer?.branches?.length || 0})</Typography>
            {selectedTrainer?.branches?.length === 0 ? (
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
                      <TableCell>Дата привязки</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedTrainer?.branches?.map((trainerBranch) => (
                      <TableRow key={trainerBranch.id}>
                        <TableCell>{trainerBranch.branch?.name}</TableCell>
                        <TableCell>{trainerBranch.branch?.address}</TableCell>
                        <TableCell>{trainerBranch.branch?.phone || '-'}</TableCell>
                        <TableCell>
                          {trainerBranch.createdAt ? new Date(trainerBranch.createdAt).toLocaleDateString('ru-RU') : '-'}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            title="Удалить привязку"
                            onClick={() => handleRemoveBranchFromTrainer(trainerBranch.branchId)}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setBranchesDialog(false);
            setSelectedTrainer(null);
            setSelectedBranchId('');
          }}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог просмотра зарплаты тренера */}
      <Dialog open={earningsDialog} onClose={() => setEarningsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Зарплата тренера: {selectedTrainer?.user?.firstName} {selectedTrainer?.user?.lastName}
        </DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
            <Box sx={{ mt: 2 }}>
              {/* Фильтры по дате */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <DatePicker
                    label="Дата начала"
                    value={earningsStartDate}
                    onChange={(newValue) => {
                      setEarningsStartDate(newValue);
                      if (selectedTrainer && newValue) {
                        fetchEarnings(selectedTrainer.id);
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <DatePicker
                    label="Дата окончания"
                    value={earningsEndDate}
                    onChange={(newValue) => {
                      setEarningsEndDate(newValue);
                      if (selectedTrainer && newValue) {
                        fetchEarnings(selectedTrainer.id);
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => {
                      const now = new Date();
                      setEarningsStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
                      setEarningsEndDate(now);
                      if (selectedTrainer) {
                        fetchEarnings(selectedTrainer.id);
                      }
                    }}
                  >
                    Текущий месяц
                  </Button>
                </Grid>
              </Grid>

              {loadingEarnings ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                  <CircularProgress />
                </Box>
              ) : earnings ? (
                <>
                  {/* Общая статистика */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                      <Card>
                        <CardContent>
                          <Typography color="text.secondary" gutterBottom>
                            Всего тренировок
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                            {earnings.trainingCount || 0}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card>
                        <CardContent>
                          <Typography color="text.secondary" gutterBottom>
                            Общий заработок
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                            {earnings.totalEarnings?.toLocaleString('ru-RU', {
                              style: 'currency',
                              currency: 'RUB',
                            }) || '0 ₽'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card>
                        <CardContent>
                          <Typography color="text.secondary" gutterBottom>
                            Тип зарплаты
                          </Typography>
                          <Chip
                            label={salarySchemeLabel(earnings.trainer?.salaryScheme || earnings.trainer?.salaryType)}
                            color="primary"
                            sx={{ mt: 1 }}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Отчёт по реестру начислений */}
                  {(earnings.ledger || earnings.trainingEarnings)?.length > 0 && (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Название</TableCell>
                            <TableCell align="right">Сумма</TableCell>
                            <TableCell>Дата</TableCell>
                            <TableCell>Комментарий</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(earnings.ledger || earnings.trainingEarnings)
                            .filter((row: any) => row.kind !== 'payout')
                            .map((row: any, index: number) => (
                            <TableRow key={row.id || index}>
                              <TableCell>{row.title || row.trainingTitle || row.groupName}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {Number(row.amount ?? row.earnings)?.toLocaleString('ru-RU', {
                                  style: 'currency',
                                  currency: 'RUB',
                                }) || '-'}
                              </TableCell>
                              <TableCell>
                                {format(new Date(row.occurredAt || row.trainingDate), 'dd.MM.yyyy', { locale: ru })}
                              </TableCell>
                              <TableCell>{row.comment || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  Нет данных за выбранный период
                </Typography>
              )}
            </Box>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEarningsDialog(false);
            setSelectedTrainer(null);
            setEarnings(null);
          }}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar для показа сообщений о валидации */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default Trainers;
