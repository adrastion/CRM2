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
} from '@mui/material';
import { Add, Edit, Delete, Visibility, Business, AttachMoney } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Trainer, Branch, TrainerBranch } from '../types';

const Trainers: React.FC = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
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
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    qualification: '',
    experience: '',
    specialization: '',
    salaryType: 'fixed',
    salaryAmount: '',
    canViewAllGroups: false,
  });

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        setError(null);
        const [trainersRes, branchesRes] = await Promise.all([
          apiService.getTrainers(undefined, abortController.signal),
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
      const response = await apiService.getTrainers();
      setTrainers(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки тренеров');
      console.error('Error fetching trainers:', err);
    }
  };

  const handleDeleteTrainer = async (trainerId: string) => {
    console.log('Attempting to delete trainer:', trainerId);
    if (window.confirm('Вы уверены, что хотите удалить этого тренера?')) {
      try {
        console.log('Deleting trainer...');
        await apiService.deleteTrainer(trainerId);
        console.log('Trainer deleted successfully, updating list...');
        setTrainers(trainers.filter(trainer => trainer.id !== trainerId));
        console.log('Trainer list updated');
      } catch (err: any) {
        console.error('Error deleting trainer:', err);
        setError(err.response?.data?.error || 'Ошибка удаления тренера');
      }
    } else {
      console.log('Delete cancelled by user');
    }
  };

  const handleCreateTrainer = async () => {
    // Validate form
    const errors = validateTrainerForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }

    try {
      await apiService.createTrainer(formData);
      // Обновляем список тренеров, получая свежие данные с сервера
      await fetchTrainers();
      setOpenDialog(false);
      setFormErrors({});
      setError('');
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        qualification: '',
        experience: '',
        specialization: '',
        salaryType: 'fixed',
        salaryAmount: '',
        canViewAllGroups: false,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания тренера');
      console.error('Error creating trainer:', err);
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
      password: '', // Не показываем пароль при редактировании
      firstName: trainer.user?.firstName || '',
      lastName: trainer.user?.lastName || '',
      phone: trainer.user?.phone || '',
      qualification: trainer.qualification || '',
      experience: trainer.experience?.toString() || '',
      specialization: trainer.specialization || '',
      salaryType: trainer.salaryType || 'fixed',
      salaryAmount: trainer.salaryAmount?.toString() || '',
      canViewAllGroups: (trainer as any).canViewAllGroups || false,
    });
    setEditDialog(true);
  };

  const handleUpdateTrainer = async () => {
    if (!editingTrainer) return;
    
    // Validate form
    const errors = validateTrainerForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }
    
    try {
      await apiService.updateTrainer(editingTrainer.id, formData);
      await fetchTrainers();
      setEditDialog(false);
      setFormErrors({});
      setError('');
      setEditingTrainer(null);
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        qualification: '',
        experience: '',
        specialization: '',
        salaryType: 'fixed',
        salaryAmount: '',
        canViewAllGroups: false,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления тренера');
      console.error('Error updating trainer:', err);
    }
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Тренеры ({trainers.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none' }}
          onClick={() => {
            setOpenDialog(true);
            setFormErrors({});
            setError('');
          }}
        >
          Добавить тренера
        </Button>
      </Box>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Имя</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Квалификация</TableCell>
                  <TableCell>Опыт</TableCell>
                  <TableCell>Тип зарплаты</TableCell>
                  <TableCell>Филиалы</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trainers.filter(trainer => trainer).map((trainer) => {
                  return (
                    <TableRow key={trainer.id}>
                      <TableCell>
                        <Typography
                          sx={{
                            cursor: 'pointer',
                            color: 'primary.main',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => {
                            setEditingTrainer(trainer);
                            setFormData({
                              email: trainer.user?.email || '',
                              password: '',
                              firstName: trainer.user?.firstName || '',
                              lastName: trainer.user?.lastName || '',
                              phone: trainer.user?.phone || '',
                              qualification: trainer.qualification || '',
                              experience: trainer.experience?.toString() || '',
                              specialization: trainer.specialization || '',
                              salaryType: trainer.salaryType || 'fixed',
                              salaryAmount: trainer.salaryAmount?.toString() || '',
                              canViewAllGroups: trainer.canViewAllGroups || false,
                            });
                            setEditDialog(true);
                          }}
                        >
                          {trainer.user?.firstName} {trainer.user?.lastName}
                        </Typography>
                      </TableCell>
                      <TableCell>{trainer.user?.email}</TableCell>
                      <TableCell>{trainer.qualification || '-'}</TableCell>
                      <TableCell>{trainer.experience ? `${trainer.experience} лет` : '-'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={trainer.salaryType === 'fixed' ? 'Фиксированная' : 'Процентная'} 
                          color={trainer.salaryType === 'fixed' ? 'primary' : 'secondary'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        {trainer.branches && trainer.branches.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {trainer.branches.map((tb) => (
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
                          label={trainer.isActive ? 'Активен' : 'Неактивен'} 
                          color={trainer.isActive ? 'success' : 'default'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          color="primary"
                          title="Управление филиалами"
                          onClick={() => handleOpenBranchesDialog(trainer)}
                        >
                          <Business />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="primary"
                          title="Просмотр зарплаты"
                          onClick={() => handleOpenEarningsDialog(trainer)}
                        >
                          <AttachMoney />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditTrainer(trainer)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error"
                          title="Удалить"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Delete button clicked for trainer:', trainer.id);
                            handleDeleteTrainer(trainer.id);
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

      {/* Диалог добавления тренера */}
      <Dialog 
        open={openDialog} 
        onClose={(event, reason) => {
          // Предотвращаем закрытие при наличии ошибок
          if (Object.keys(formErrors).length > 0 || error) {
            return;
          }
          setOpenDialog(false);
          setFormErrors({});
          setError('');
        }}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Добавить нового тренера</DialogTitle>
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
                  value={formData.salaryType}
                  onChange={(e) => handleInputChange('salaryType', e.target.value)}
                >
                  <MenuItem value="fixed">Фиксированная</MenuItem>
                  <MenuItem value="percentage">Процентная</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Размер зарплаты"
                type="number"
                value={formData.salaryAmount}
                onChange={(e) => handleInputChange('salaryAmount', e.target.value)}
                placeholder="Введите сумму"
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            // Разрешаем закрытие только если нет ошибок
            if (Object.keys(formErrors).length === 0 && !error) {
              setOpenDialog(false);
              setFormErrors({});
              setError('');
            }
          }}>Отмена</Button>
          <Button onClick={handleCreateTrainer} variant="contained">
            Создать тренера
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования тренера */}
      <Dialog 
        open={editDialog} 
        onClose={(event, reason) => {
          // Предотвращаем закрытие при наличии ошибок
          if (Object.keys(formErrors).length > 0 || error) {
            return;
          }
          setEditDialog(false);
          setFormErrors({});
          setError('');
        }}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Редактировать тренера</DialogTitle>
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
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Имя"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Фамилия"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                required
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
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </Grid>
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
                  value={formData.salaryType}
                  onChange={(e) => handleInputChange('salaryType', e.target.value)}
                >
                  <MenuItem value="fixed">Фиксированная</MenuItem>
                  <MenuItem value="percentage">Процентная</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Размер зарплаты"
                type="number"
                value={formData.salaryAmount}
                onChange={(e) => handleInputChange('salaryAmount', e.target.value)}
                placeholder="Введите сумму"
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            // Разрешаем закрытие только если нет ошибок
            if (Object.keys(formErrors).length === 0 && !error) {
              setEditDialog(false);
              setEditingTrainer(null);
              setFormErrors({});
              setError('');
            }
          }}>Отмена</Button>
          <Button onClick={handleUpdateTrainer} variant="contained">
            Сохранить изменения
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
                            label={earnings.trainer?.salaryType === 'percentage' ? 'Процентная' : 'Фиксированная'}
                            color={earnings.trainer?.salaryType === 'percentage' ? 'secondary' : 'primary'}
                            sx={{ mt: 1 }}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Детализация по тренировкам */}
                  {earnings.trainingEarnings && earnings.trainingEarnings.length > 0 && (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Дата</TableCell>
                            <TableCell>Группа</TableCell>
                            <TableCell>Филиал</TableCell>
                            <TableCell align="center">Присутствовало</TableCell>
                            <TableCell align="right">Заработок</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {earnings.trainingEarnings.map((training: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>
                                {format(new Date(training.trainingDate), 'dd.MM.yyyy HH:mm', { locale: ru })}
                              </TableCell>
                              <TableCell>{training.groupName}</TableCell>
                              <TableCell>{training.branchName || '-'}</TableCell>
                              <TableCell align="center">{training.presentCount}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {training.earnings?.toLocaleString('ru-RU', {
                                  style: 'currency',
                                  currency: 'RUB',
                                }) || '-'}
                              </TableCell>
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
    </Box>
  );
};

export default Trainers;
