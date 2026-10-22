import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Snackbar,
  Stack,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import TrainerCard, { isEmployeeAdmin, isEmployeePromoter } from '../components/trainers/TrainerCard';
import EmployeesBoard from '../components/trainers/EmployeesBoard';
import CreateSelfTrainerDialog from '../components/trainers/CreateSelfTrainerDialog';
import CreateTrainerDialog from '../components/trainers/CreateTrainerDialog';
import CreateAdminDialog from '../components/trainers/CreateAdminDialog';
import CreatePromoterDialog from '../components/trainers/CreatePromoterDialog';
import AddEmployeeTypeDialog, { AddEmployeeChoice } from '../components/trainers/AddEmployeeTypeDialog';
import { apiService } from '../services/api';
import { Trainer, Branch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  canCreatePromoterUsers,
  isOwner as roleIsOwner,
  isOwnerOrAdmin,
} from '../utils/roles';
import DeletionScopeDialog, { PurgeOption } from '../components/common/DeletionScopeDialog';
import PlanLimitAlert from '../components/common/PlanLimitAlert';
import {
  resolveTrainerCardScheme,
  salarySchemeLabel,
} from '../utils/salarySchemes';
import { colors, radii } from '../theme/tokens';

const TRAINER_DELETE_OPTIONS: PurgeOption[] = [
  { key: 'trainerAssignments', label: 'Назначения тренера (группы)', countKeys: ['trainerAssignments'] },
  { key: 'salaries', label: 'Зарплаты тренера', countKeys: ['salaries'] },
  { key: 'groupComposition', label: 'Занятия тренера', countKeys: ['trainings'] },
  { key: 'chats', label: 'Переписки', countKeys: ['chats'] },
];

const TRAINER_FIXED_MONTHLY = 'fixed_monthly';

const Trainers: React.FC = () => {
  const { user, updateUser } = useAuth();
  const isOwner = roleIsOwner(user?.role);
  const canPickEmployeeRole = isOwnerOrAdmin(user?.role);
  const isSenior = Boolean(user?.isSeniorTrainer || (user?.seniorBranchIds && user.seniorBranchIds.length > 0));
  const [searchParams, setSearchParams] = useSearchParams();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleSelectionDialog, setRoleSelectionDialog] = useState(false);
  const [selfTrainerDialog, setSelfTrainerDialog] = useState(false);
  const [createTrainerDialog, setCreateTrainerDialog] = useState(false);
  const [createAdminDialog, setCreateAdminDialog] = useState(false);
  const [createPromoterDialog, setCreatePromoterDialog] = useState(false);
  const [cardDialog, setCardDialog] = useState(false);
  const [cardFromSection, setCardFromSection] = useState('Сотрудники');
  const [earningsDialog, setEarningsDialog] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [cardEmployee, setCardEmployee] = useState<Trainer | any | null>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [earningsStartDate, setEarningsStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [earningsEndDate, setEarningsEndDate] = useState<Date | null>(new Date());
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [deleteTrainerTarget, setDeleteTrainerTarget] = useState<Trainer | any | null>(null);

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

  const handleDeleteTrainer = (trainerId: string) => {
    const employee =
      trainers.find((t) => t.id === trainerId) ||
      (cardEmployee?.id === trainerId ? cardEmployee : null);
    if (!employee) return;
    setDeleteTrainerTarget(employee);
  };

  const confirmDeleteTrainer = async (purge: Record<string, boolean>) => {
    if (!deleteTrainerTarget) return;
    const trainerId = deleteTrainerTarget.id;
    const deletedOwnerId =
      deleteTrainerTarget.userId ||
      deleteTrainerTarget.user?.id ||
      null;
    await apiService.deleteTrainer(trainerId, purge);
    setTrainers((prev) => prev.filter((trainer) => trainer.id !== trainerId));
    if (cardEmployee?.id === trainerId) {
      setCardDialog(false);
      setCardEmployee(null);
    }
    // Soft-delete оставляет Trainer в БД; сбрасываем session, иначе CTA «Создать себя как тренера» скрыт
    if (user && deletedOwnerId && deletedOwnerId === user.id) {
      updateUser({ ...user, trainerId: null, isTrainer: false });
    }
    setDeleteTrainerTarget(null);
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

  const ownerAlreadyTrainer =
    Boolean(user?.trainerId) ||
    trainers.some((t: any) => t.userId === user?.id || t.user?.id === user?.id);

  const handleSelfTrainerCreated = async () => {
    await fetchTrainers();
    try {
      const profile = await apiService.getProfile();
      if (profile && user) {
        const activeTrainerId =
          profile.trainerId ??
          (profile.trainer?.isActive !== false ? profile.trainer?.id : null) ??
          null;
        updateUser({
          ...user,
          ...profile,
          trainerId: activeTrainerId,
          isTrainer: Boolean(activeTrainerId),
        });
      }
    } catch {
      /* профиль обновится при следующем входе */
    }
    setSnackbarMessage('Профиль тренера создан. Доступны «Мой заработок» и «Мой профиль».');
    setSnackbarOpen(true);
  };

  const openEmployeeCard = (employee: any) => {
    setCardEmployee(employee);
    setCardDialog(true);
    setCardFromSection('Сотрудники');
    const id = employee?.id || employee?.user?.id;
    if (id) {
      const qs = new URLSearchParams({ trainerId: id, from: 'Сотрудники' });
      setSearchParams(qs, { replace: false });
    }
  };

  const closeEmployeeCard = () => {
    setCardDialog(false);
    setCardEmployee(null);
    setCardFromSection('Сотрудники');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('trainerId');
      next.delete('from');
      return next;
    }, { replace: true });
  };

  // Deep-link: ?trainerId=&from= — карточка как подстраница, не модалка
  useEffect(() => {
    const trainerIdFromUrl = searchParams.get('trainerId');
    if (!trainerIdFromUrl) {
      if (cardDialog) {
        setCardDialog(false);
        setCardEmployee(null);
        setCardFromSection('Сотрудники');
      }
      return;
    }
    if (loading) return;
    if (cardDialog && cardEmployee?.id === trainerIdFromUrl) return;
    if (cardDialog && (cardEmployee?.user?.id || cardEmployee?.id) === trainerIdFromUrl) return;

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
        const from = searchParams.get('from');
        setCardFromSection(from && from.trim() ? from.trim() : 'Сотрудники');
        setCardEmployee(employee);
        setCardDialog(true);
      } catch (err) {
        console.error('Failed to open trainer card from URL:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainers, searchParams, cardDialog, cardEmployee?.id, loading, setSearchParams]);

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
        <PlanLimitAlert sx={{ mb: 2 }}>
          {error}
        </PlanLimitAlert>
        <Button onClick={fetchTrainers} variant="outlined">
          Попробовать снова
        </Button>
      </Box>
    );
  }

  const staffList = trainers.filter(Boolean);

  const startAddEmployee = () => {
    if (canPickEmployeeRole) {
              setRoleSelectionDialog(true);
            } else {
      setCreateTrainerDialog(true);
    }
  };

  const handleEmployeeTypeSelect = (choice: AddEmployeeChoice) => {
    setRoleSelectionDialog(false);

    if (choice === 'self-trainer') {
      setSelfTrainerDialog(true);
      return;
    }
    if (choice === 'TRAINER') {
      setCreateTrainerDialog(true);
      return;
    }
    if (choice === 'ADMIN') {
      setCreateAdminDialog(true);
      return;
    }
    if (choice === 'PROMOTER') {
      setCreatePromoterDialog(true);
    }
  };

  // Подстраница карточки сотрудника (не модальное окно)
  if (cardDialog && cardEmployee) {
                  return (
      <Box sx={{ pb: 2 }} data-onboarding="trainers-page">
        <TrainerCard
          employee={cardEmployee}
          branches={branches}
          isOwner={isOwner}
          fromSection={cardFromSection}
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
        {/* Диалог зарплаты остаётся поверх подстраницы */}
        <Dialog open={earningsDialog} onClose={() => setEarningsDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            Зарплата тренера: {selectedTrainer?.user?.firstName} {selectedTrainer?.user?.lastName}
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ color: colors.textHint, fontSize: 13, mb: 1 }}>
              Подробный расчёт — в разделе Финансы → Зарплата тренеров, либо закройте и откройте из списка.
                  </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEarningsDialog(false)}>Закрыть</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box data-onboarding="trainers-page">
      <EmployeesBoard
        employees={staffList}
        canPickRole={canPickEmployeeRole}
        onAdd={startAddEmployee}
        onImport={() => {
          setSnackbarMessage('Импорт сотрудников появится в следующем обновлении');
            setSnackbarOpen(true);
        }}
        onOpen={openEmployeeCard}
        onEdit={openEmployeeCard}
        onOpenCalendar={openEmployeeCard}
        onDelete={(employee) => {
          const isAdmin = isEmployeeAdmin(employee) || isEmployeePromoter(employee);
          const empUser = employee.user || employee;
          if (isAdmin) {
            if (window.confirm('Вы уверены, что хотите удалить этого администратора?')) {
              void handleDeleteAdmin(empUser.id);
            }
          } else {
            void handleDeleteTrainer(employee.id);
          }
        }}
      />

      {canPickEmployeeRole && (
        <AddEmployeeTypeDialog
          open={roleSelectionDialog}
          onClose={() => setRoleSelectionDialog(false)}
          onSelect={handleEmployeeTypeSelect}
          showSelfTrainer={isOwner && !ownerAlreadyTrainer}
          showAdmin={isOwner}
          showPromoter={canCreatePromoterUsers(user?.role) || isOwner}
        />
      )}

      <CreateSelfTrainerDialog
        open={selfTrainerDialog}
        onClose={() => setSelfTrainerDialog(false)}
        onSuccess={handleSelfTrainerCreated}
        user={user}
        branches={branches}
        onError={(msg) => {
          setSnackbarMessage(msg);
          setSnackbarOpen(true);
        }}
      />

      <CreateTrainerDialog
        open={createTrainerDialog}
        onClose={() => setCreateTrainerDialog(false)}
        onSuccess={async () => {
          await fetchTrainers();
          setSnackbarMessage('Тренер успешно создан');
                setSnackbarOpen(true);
        }}
        branches={
          isSenior && user?.seniorBranchIds?.length
            ? branches.filter((b) => user.seniorBranchIds!.includes(b.id))
            : branches
        }
        requireBranch={isSenior}
        defaultBranchId={
          isSenior && user?.seniorBranchIds?.length === 1 ? user.seniorBranchIds[0] : ''
        }
        canViewAllGroups={!isSenior}
        onError={(msg) => {
          setSnackbarMessage(msg);
          setSnackbarOpen(true);
        }}
      />

      <CreateAdminDialog
        open={createAdminDialog}
        onClose={() => setCreateAdminDialog(false)}
        onSuccess={async () => {
          await fetchTrainers();
          setSnackbarMessage('Администратор успешно создан');
            setSnackbarOpen(true);
        }}
        branches={branches}
        onError={(msg) => {
          setSnackbarMessage(msg);
          setSnackbarOpen(true);
        }}
      />

      <CreatePromoterDialog
        open={createPromoterDialog}
        onClose={() => setCreatePromoterDialog(false)}
        onSuccess={async () => {
          await fetchTrainers();
          setSnackbarMessage('Промоутер успешно создан');
          setSnackbarOpen(true);
        }}
        branches={branches}
        onError={(msg) => {
          setSnackbarMessage(msg);
          setSnackbarOpen(true);
        }}
      />

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
                              resolveTrainerCardScheme(
                                earnings.trainer?.salaryScheme,
                                earnings.trainer?.salaryType
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

      <DeletionScopeDialog
        open={Boolean(deleteTrainerTarget)}
        title="Удалить сотрудника?"
        entityLabel={
          deleteTrainerTarget?.user
            ? `${deleteTrainerTarget.user.lastName || ''} ${deleteTrainerTarget.user.firstName || ''}`.trim()
            : deleteTrainerTarget?.id || ''
        }
        options={TRAINER_DELETE_OPTIONS}
        loadImpact={() => apiService.getTrainerDeletionImpact(deleteTrainerTarget!.id)}
        onClose={() => setDeleteTrainerTarget(null)}
        onConfirm={confirmDeleteTrainer}
      />

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
