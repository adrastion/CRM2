import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Stack,
} from '@mui/material';
import { Add, Delete, Person, AdminPanelSettings } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import TrainerCard, { employeeRoleLabel, isEmployeeAdmin, isEmployeePromoter } from '../components/trainers/TrainerCard';
import { apiService } from '../services/api';
import { Trainer, Branch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { canCreateAdminUsers, canCreatePromoterUsers, isOwner as roleIsOwner, isOwnerOrAdmin } from '../utils/roles';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import {
  normalizeSalaryScheme,
  salarySchemeLabel,
  salaryRateFieldLabel,
  salarySchemeHint,
} from '../utils/salarySchemes';

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
  /** fixed_monthly или '' (= зарплата на группах) */
  salaryScheme: '',
  salaryRate: '',
  individualTrainingPrice: '',
  canViewAllGroups: false,
  branchId: '',
};

const Trainers: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const isOwner = roleIsOwner(user?.role);
  const canPickEmployeeRole = isOwnerOrAdmin(user?.role);
  const isSenior = Boolean(user?.isSeniorTrainer || (user?.seniorBranchIds && user.seniorBranchIds.length > 0));
  const [searchParams, setSearchParams] = useSearchParams();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleSelectionDialog, setRoleSelectionDialog] = useState(false); // Диалог выбора роли
  const [openDialog, setOpenDialog] = useState(false);
  const [cardDialog, setCardDialog] = useState(false);
  const [earningsDialog, setEarningsDialog] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [cardEmployee, setCardEmployee] = useState<Trainer | any | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [earningsStartDate, setEarningsStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [earningsEndDate, setEarningsEndDate] = useState<Date | null>(new Date());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [formData, setFormData] = useState({ ...emptyFormData });
  const [createFormBaseline, setCreateFormBaseline] = useState({ ...emptyFormData });

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

  const handleCreateTrainer = async (): Promise<boolean> => {
    // Валидация уже выполнена в onClick кнопки, поэтому здесь просто проверяем еще раз для надежности
    const errors = validateTrainerForm(formData);
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setError('Пожалуйста, исправьте ошибки в форме');
      setSnackbarMessage('Обнаружены ошибки в форме. Пожалуйста, исправьте их.');
      setSnackbarOpen(true);
      return false;
    }

    try {
      // Если создаем администратора или промоутера, используем API создания пользователя
      if (formData.role === 'ADMIN' || formData.role === 'PROMOTER') {
        if (formData.role === 'ADMIN' && !canCreateAdminUsers(user?.role)) {
          setError('Только владелец может создавать администраторов');
          setSnackbarMessage('Только владелец может создавать администраторов');
          setSnackbarOpen(true);
          return false;
        }
        if (formData.role === 'PROMOTER' && !canCreatePromoterUsers(user?.role)) {
          setError('Недостаточно прав для создания промоутера');
          setSnackbarMessage('Недостаточно прав для создания промоутера');
          setSnackbarOpen(true);
          return false;
        }
        const { role, qualification, experience, specialization, salaryScheme, salaryRate, canViewAllGroups, ...userData } = formData;
        await apiService.createUser({
          ...userData,
          role: formData.role,
        });
      } else {
        if (isSenior && !formData.branchId) {
          setError('Укажите филиал для нового тренера');
          setSnackbarMessage('Укажите филиал для нового тренера');
          setSnackbarOpen(true);
          return false;
        }
        // Если создаем тренера, используем API создания тренера
        await apiService.createTrainer({
          ...formData,
          branchId: formData.branchId || undefined,
          canViewAllGroups: isSenior ? false : formData.canViewAllGroups,
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
      }
      // Обновляем список сотрудников, получая свежие данные с сервера
      await fetchTrainers();
      setOpenDialog(false);
      setFormErrors({});
      setError('');
      setFormData({ ...emptyFormData });
      setCreateFormBaseline({ ...emptyFormData });
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания сотрудника');
      console.error('Error creating employee:', err);
      return false;
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

  const openEmployeeCard = (employee: any) => {
    setCardEmployee(employee);
    setCardDialog(true);
  };

  const closeEmployeeCard = () => {
    setCardDialog(false);
    setCardEmployee(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('trainerId');
      return next;
    }, { replace: true });
  };

  // Deep-link: ?trainerId= opens employee card
  useEffect(() => {
    const trainerIdFromUrl = searchParams.get('trainerId');
    if (!trainerIdFromUrl || cardDialog || loading) return;

    let cancelled = false;

    (async () => {
      try {
        let employee: any = trainers.find((t: any) => t.id === trainerIdFromUrl);
        if (!employee) {
          employee = trainers.find(
            (t: any) => (t.user?.id || t.id) === trainerIdFromUrl
          );
        }
        if (!employee) {
          try {
            employee = await apiService.getTrainer(trainerIdFromUrl);
          } catch {
            employee = null;
          }
        }
        if (cancelled || !employee) return;
        openEmployeeCard(employee);
        const next = new URLSearchParams(searchParams);
        next.delete('trainerId');
        setSearchParams(next, { replace: true });
      } catch (err) {
        console.error('Failed to open trainer card from URL:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainers, searchParams, cardDialog, loading, setSearchParams]);

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

  const discardCreateForm = React.useCallback(() => {
    setOpenDialog(false);
    setFormErrors({});
    setError('');
    setFormData({ ...emptyFormData });
    setCreateFormBaseline({ ...emptyFormData });
  }, []);

  const createDirty = openDialog && isDirtyValue(formData, createFormBaseline);

  const createUnsaved = useUnsavedClose({
    isDirty: Boolean(createDirty),
    onDiscard: discardCreateForm,
    onSave: async () => handleCreateTrainer(),
  });

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
            if (canPickEmployeeRole) {
              setRoleSelectionDialog(true);
            } else {
              const defaultBranch =
                isSenior && user?.seniorBranchIds?.length === 1
                  ? user.seniorBranchIds[0]
                  : '';
              const initial = { ...emptyFormData, role: 'TRAINER', branchId: defaultBranch };
              setFormData(initial);
              setCreateFormBaseline(initial);
              setFormErrors({});
              setError('');
              setOpenDialog(true);
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
            const isPromoter = isEmployeePromoter(employee);
            const empUser = employee.user || employee;
            const displayName = `${empUser.lastName || ''} ${empUser.firstName || ''} ${empUser.middleName || ''}`.trim();
            return (
              <Card
                key={employee.id || empUser.id}
                variant="outlined"
                sx={{ cursor: 'pointer' }}
                onClick={() => openEmployeeCard(employee)}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          color: 'primary.main',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {displayName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                        {empUser.email}
                      </Typography>
                    </Box>
                    <Chip
                      label={employeeRoleLabel(employee)}
                      color={isAdmin ? 'primary' : isPromoter ? 'default' : 'secondary'}
                      size="small"
                    />
                  </Box>
                  {!isAdmin && !isPromoter && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {employee.qualification || 'Квалификация не указана'}
                      {employee.experience ? ` · ${employee.experience} лет` : ''}
                      {employee.coachCategory ? ` · Трен. кат.: ${employee.coachCategory}` : ''}
                      {employee.judgeCategory ? ` · Суд. кат.: ${employee.judgeCategory}` : ''}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    <Chip
                      label={employee.isActive !== false ? 'Активен' : 'Неактивен'}
                      color={employee.isActive !== false ? 'success' : 'default'}
                      size="small"
                    />
                    {!isAdmin &&
                      normalizeSalaryScheme(employee.salaryScheme || employee.salaryType) ===
                        TRAINER_FIXED_MONTHLY && (
                      <Chip
                        label={salarySchemeLabel(TRAINER_FIXED_MONTHLY)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {!isAdmin && employee.balance !== undefined && (
                      <Chip
                        label={`${Number(employee.balance).toFixed(0)} ₽`}
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEarningsDialog(employee);
                        }}
                        sx={{ cursor: 'pointer' }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
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
                  const isPromoter = isEmployeePromoter(employee);
                  const empUser = employee.user || employee;
                  const displayName = `${empUser.lastName || ''} ${empUser.firstName || ''} ${empUser.middleName || ''}`.trim();
                  
                  return (
                    <TableRow
                      key={employee.id || empUser.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => openEmployeeCard(employee)}
                    >
                      <TableCell>
                        <Typography
                          sx={{
                            color: 'primary.main',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {displayName}
                        </Typography>
                      </TableCell>
                      <TableCell>{empUser.email}</TableCell>
                      <TableCell>
                        <Chip 
                          label={employeeRoleLabel(employee)} 
                          color={isAdmin ? 'primary' : isPromoter ? 'default' : 'secondary'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{isAdmin || isPromoter ? '-' : (employee.qualification || '-')}</TableCell>
                      <TableCell>{isAdmin || isPromoter ? '-' : (employee.experience ? `${employee.experience} лет` : '-')}</TableCell>
                      <TableCell>
                        {normalizeSalaryScheme(
                          (employee as any).salaryScheme || employee.salaryType
                        ) === TRAINER_FIXED_MONTHLY ? (
                          <Chip
                            label={salarySchemeLabel(TRAINER_FIXED_MONTHLY)}
                            color="primary"
                            size="small"
                          />
                        ) : !isAdmin ? (
                          <Typography variant="body2" color="text.secondary">
                            На группах
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell
                        onClick={(e) => {
                          if (!isAdmin && employee.balance !== undefined) {
                            e.stopPropagation();
                            handleOpenEarningsDialog(employee);
                          }
                        }}
                      >
                        {employee.balance !== undefined ? (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: Number(employee.balance) > 0 
                                ? 'success.main' 
                                : 'text.secondary',
                              cursor: !isAdmin ? 'pointer' : 'default',
                              textDecoration: !isAdmin ? 'underline' : 'none',
                            }}
                            title={!isAdmin ? 'Просмотр зарплаты' : undefined}
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
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

      {/* Диалог выбора роли (OWNER / ADMIN) */}
      {canPickEmployeeRole && (
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
                  const initial = {
                    ...emptyFormData,
                    role: 'TRAINER',
                  };
                  setFormData(initial);
                  setCreateFormBaseline(initial);
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
              {isOwner && (
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  onClick={() => {
                    const initial = {
                      ...emptyFormData,
                      role: 'ADMIN',
                    };
                    setFormData(initial);
                    setCreateFormBaseline(initial);
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
              )}
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => {
                  const initial = {
                    ...emptyFormData,
                    role: 'PROMOTER',
                  };
                  setFormData(initial);
                  setCreateFormBaseline(initial);
                  setRoleSelectionDialog(false);
                  setOpenDialog(true);
                  setFormErrors({});
                  setError('');
                }}
                sx={{ py: 2 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ fontSize: 40 }} />
                  <Typography variant="h6">Промоутер</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Создать аккаунт промоутера (только свои клиенты)
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
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            createUnsaved.requestClose(reason);
          }
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
            {canPickEmployeeRole && (
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, backgroundColor: 'background.default' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Тип сотрудника
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {formData.role === 'ADMIN'
                      ? 'Администратор'
                      : formData.role === 'PROMOTER'
                        ? 'Промоутер'
                        : 'Тренер'}
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
                  <FormControl fullWidth>
                    <InputLabel>Зарплата сотрудника</InputLabel>
                    <Select
                      value={formData.salaryScheme}
                      label="Зарплата сотрудника"
                      onChange={(e) => handleInputChange('salaryScheme', e.target.value)}
                    >
                      <MenuItem value="">На группах</MenuItem>
                      <MenuItem value={TRAINER_FIXED_MONTHLY}>Фикс плата в месяц</MenuItem>
                    </Select>
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
                      helperText={salarySchemeHint(TRAINER_FIXED_MONTHLY)}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Цена индивидуальной тренировки (₽)"
                    type="number"
                    value={formData.individualTrainingPrice}
                    onChange={(e) => handleInputChange('individualTrainingPrice', e.target.value)}
                    helperText="Начисляется ученику при создании индивидуалки в календаре"
                  />
                </Grid>
                {isSenior && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Филиал</InputLabel>
                      <Select
                        value={formData.branchId}
                        label="Филиал"
                        onChange={(e) => handleInputChange('branchId', e.target.value)}
                      >
                        {branches.map((b) => (
                          <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {!isSenior && (
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
                )}
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              discardCreateForm();
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
              handleCreateTrainer();
            }} 
            variant="contained"
            type="button"
          >
            Создать сотрудника
          </Button>
        </DialogActions>
      </Dialog>

      {/* Карточка сотрудника */}
      <Dialog
        open={cardDialog}
        onClose={() => closeEmployeeCard()}
        maxWidth="md"
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogContent>
          {cardEmployee && (
            <TrainerCard
              employee={cardEmployee}
              branches={branches}
              isOwner={isOwner}
              onSaved={async () => {
                await fetchTrainers();
                const id = cardEmployee?.id || cardEmployee?.user?.id;
                if (!id) return;
                try {
                  if (!isEmployeeAdmin(cardEmployee)) {
                    const refreshed = await apiService.getTrainer(cardEmployee.id);
                    setCardEmployee(refreshed);
                  } else {
                    const list = await apiService.getTrainers({ includeAdmins: 'true', limit: 1000 });
                    const refreshed = list.data.find(
                      (e: any) => (e.user?.id || e.id) === (cardEmployee.user?.id || cardEmployee.id)
                    );
                    if (refreshed) setCardEmployee(refreshed);
                  }
                } catch (_) {
                  /* keep current card */
                }
              }}
              onClose={closeEmployeeCard}
              onOpenEarnings={(trainer) => {
                handleOpenEarningsDialog(trainer);
              }}
            />
          )}
        </DialogContent>
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
                            label={
                              normalizeSalaryScheme(
                                earnings.trainer?.salaryScheme || earnings.trainer?.salaryType
                              ) === TRAINER_FIXED_MONTHLY
                                ? salarySchemeLabel(TRAINER_FIXED_MONTHLY)
                                : 'На группах'
                            }
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

      <UnsavedChangesDialog
        open={createUnsaved.confirmOpen}
        saving={createUnsaved.saving}
        onSave={createUnsaved.save}
        onDiscard={createUnsaved.discard}
        onStay={createUnsaved.stay}
      />
    </Box>
  );
};

export default Trainers;
