import React, { useState, useEffect } from 'react';
import { validateBranchForm } from '../utils/validation';
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
  useMediaQuery,
  useTheme,
  Divider,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add, Edit, Delete, MeetingRoom } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Branch, Hall, Trainer } from '../types';
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog';
import { isDirtyValue, useUnsavedClose } from '../hooks/useUnsavedClose';
import { useAuth } from '../contexts/AuthContext';
import { canAssignSeniorTrainer, canCreateBranches, isSeniorTrainerUser } from '../utils/roles';

const EMPTY_BRANCH_FORM = {
  name: '',
  address: '',
  phone: '',
  email: '',
  description: '',
  seniorTrainerId: '',
};

const EMPTY_HALL_FORM = {
  name: '',
  description: '',
  capacity: '',
};

function seniorTrainerLabel(branch: Branch): string {
  const u = branch.seniorTrainer?.user;
  if (!u) return '—';
  return [u.lastName, u.firstName].filter(Boolean).join(' ') || '—';
}

const Branches: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const canAssignSenior = canAssignSeniorTrainer(user);
  const canCreate = canCreateBranches(user);
  const isSeniorOnly = isSeniorTrainerUser(user);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [hallsDialog, setHallsDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loadingHalls, setLoadingHalls] = useState(false);
  const [hallDialog, setHallDialog] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [hallFormData, setHallFormData] = useState({ ...EMPTY_HALL_FORM });
  const [hallFormErrors, setHallFormErrors] = useState<Record<string, string>>({});
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({ ...EMPTY_BRANCH_FORM });
  const [createFormBaseline, setCreateFormBaseline] = useState({ ...EMPTY_BRANCH_FORM });
  const [editFormBaseline, setEditFormBaseline] = useState({ ...EMPTY_BRANCH_FORM });
  const [hallFormBaseline, setHallFormBaseline] = useState({ ...EMPTY_HALL_FORM });

  const fetchBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getBranches();
      setBranches(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки филиалов');
      console.error('Error fetching branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadBranches = async () => {
      try {
        if (!isMounted || abortController.signal.aborted) return;
        setLoading(true);
        setError(null);
        const response = await apiService.getBranches(undefined, abortController.signal);
        if (!isMounted || abortController.signal.aborted) return;
        setBranches(response.data);
      } catch (err: any) {
        // Ignore cancelled requests
        if (err?.code === 'ERR_CANCELED' || err?.message === 'canceled' || abortController.signal.aborted) {
          return;
        }
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Ошибка загрузки филиалов');
        console.error('Error fetching branches:', err);
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadBranches();
    if (canAssignSenior) {
      apiService.getTrainers({ limit: 1000 }).then((response) => {
        if (isMounted) setTrainers(response.data || []);
      }).catch((err) => console.error('Error fetching trainers:', err));
    }

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [canAssignSenior]);

  const handleCreateBranch = async (): Promise<boolean> => {
    // Validate form
    const errors = validateBranchForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return false;
    }

    try {
      const payload = {
        ...formData,
        seniorTrainerId: formData.seniorTrainerId || null,
      };
      await apiService.createBranch(payload);
      await fetchBranches();
      setOpenDialog(false);
      setFormErrors({});
      setError('');
      setFormData({ ...EMPTY_BRANCH_FORM });
      setCreateFormBaseline({ ...EMPTY_BRANCH_FORM });
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания филиала');
      console.error('Error creating branch:', err);
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

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setFormErrors({});
    setError('');
    const nextForm = {
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      description: branch.description || '',
      seniorTrainerId: branch.seniorTrainerId || '',
    };
    setFormData(nextForm);
    setEditFormBaseline(nextForm);
    setEditDialog(true);
  };

  const handleUpdateBranch = async (): Promise<boolean> => {
    if (!editingBranch) return false;
    
    // Validate form
    const errors = validateBranchForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return false;
    }
    
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        description: formData.description,
      };
      if (canAssignSenior) {
        payload.seniorTrainerId = formData.seniorTrainerId || null;
      }
      await apiService.updateBranch(editingBranch.id, payload);
      await fetchBranches();
      setEditDialog(false);
      setEditingBranch(null);
      setFormErrors({});
      setError('');
      setFormData({ ...EMPTY_BRANCH_FORM });
      setEditFormBaseline({ ...EMPTY_BRANCH_FORM });
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления филиала');
      console.error('Error updating branch:', err);
      return false;
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот филиал?')) {
      try {
        await apiService.deleteBranch(branchId);
        await fetchBranches();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления филиала');
        console.error('Error deleting branch:', err);
      }
    }
  };

  const handleOpenHallsDialog = async (branch: Branch) => {
    setSelectedBranch(branch);
    setHallsDialog(true);
    await fetchHalls(branch.id);
  };

  const fetchHalls = async (branchId: string) => {
    try {
      setLoadingHalls(true);
      const response = await apiService.getHalls({ branchId });
      setHalls(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки залов');
      console.error('Error fetching halls:', err);
    } finally {
      setLoadingHalls(false);
    }
  };

  const discardHallForm = React.useCallback(() => {
    setHallDialog(false);
    setEditingHall(null);
    setHallFormData({ ...EMPTY_HALL_FORM });
    setHallFormBaseline({ ...EMPTY_HALL_FORM });
    setHallFormErrors({});
    setError('');
  }, []);

  const handleCreateHall = async (): Promise<boolean> => {
    if (!selectedBranch) return false;

    const errors: Record<string, string> = {};
    if (!hallFormData.name.trim()) {
      errors.name = 'Название зала обязательно';
    }

    setHallFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return false;
    }

    try {
      await apiService.createHall({
        ...hallFormData,
        branchId: selectedBranch.id,
        capacity: hallFormData.capacity ? parseInt(hallFormData.capacity) : undefined,
      });
      await fetchHalls(selectedBranch.id);
      discardHallForm();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания зала');
      console.error('Error creating hall:', err);
      return false;
    }
  };

  const handleEditHall = (hall: Hall) => {
    setEditingHall(hall);
    const nextForm = {
      name: hall.name || '',
      description: hall.description || '',
      capacity: hall.capacity?.toString() || '',
    };
    setHallFormData(nextForm);
    setHallFormBaseline(nextForm);
    setHallFormErrors({});
    setHallDialog(true);
  };

  const handleUpdateHall = async (): Promise<boolean> => {
    if (!editingHall || !selectedBranch) return false;

    const errors: Record<string, string> = {};
    if (!hallFormData.name.trim()) {
      errors.name = 'Название зала обязательно';
    }

    setHallFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return false;
    }

    try {
      await apiService.updateHall(editingHall.id, {
        ...hallFormData,
        capacity: hallFormData.capacity ? parseInt(hallFormData.capacity) : undefined,
      });
      await fetchHalls(selectedBranch.id);
      discardHallForm();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления зала');
      console.error('Error updating hall:', err);
      return false;
    }
  };

  const handleDeleteHall = async (hallId: string) => {
    if (!selectedBranch) return;
    if (window.confirm('Вы уверены, что хотите удалить этот зал?')) {
      try {
        await apiService.deleteHall(hallId);
        await fetchHalls(selectedBranch.id);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка удаления зала');
        console.error('Error deleting hall:', err);
      }
    }
  };

  const discardCreateForm = React.useCallback(() => {
    setOpenDialog(false);
    setFormErrors({});
    setError('');
    setFormData({ ...EMPTY_BRANCH_FORM });
    setCreateFormBaseline({ ...EMPTY_BRANCH_FORM });
  }, []);

  const discardEditForm = React.useCallback(() => {
    setEditDialog(false);
    setEditingBranch(null);
    setFormErrors({});
    setError('');
    setFormData({ ...EMPTY_BRANCH_FORM });
    setEditFormBaseline({ ...EMPTY_BRANCH_FORM });
  }, []);

  const createDirty = openDialog && isDirtyValue(formData, createFormBaseline);
  const editDirty = editDialog && isDirtyValue(formData, editFormBaseline);
  const hallDirty = hallDialog && isDirtyValue(hallFormData, hallFormBaseline);

  const createUnsaved = useUnsavedClose({
    isDirty: Boolean(createDirty),
    onDiscard: discardCreateForm,
    onSave: async () => handleCreateBranch(),
  });

  const editUnsaved = useUnsavedClose({
    isDirty: Boolean(editDirty),
    onDiscard: discardEditForm,
    onSave: async () => handleUpdateBranch(),
  });

  const hallUnsaved = useUnsavedClose({
    isDirty: Boolean(hallDirty),
    onDiscard: discardHallForm,
    onSave: async () => (editingHall ? handleUpdateHall() : handleCreateHall()),
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box data-onboarding="branches-page">
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
          Филиалы
        </Typography>
        {canCreate && (
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
          onClick={() => {
            const initial = { ...EMPTY_BRANCH_FORM };
            setFormData(initial);
            setCreateFormBaseline(initial);
            setFormErrors({});
            setError('');
            setOpenDialog(true);
          }}
          data-onboarding="add-branch-button"
        >
          Добавить филиал
        </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isMobile ? (
        <Stack spacing={1.5}>
          {branches.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              Филиалы не найдены
            </Typography>
          ) : (
            branches.map((branch) => (
              <Card key={branch.id} variant="outlined">
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {branch.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {branch.address}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Старший тренер: {seniorTrainerLabel(branch)}
                      </Typography>
                    </Box>
                    <Chip
                      label={branch.isActive ? 'Активен' : 'Неактивен'}
                      color={branch.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  {(branch.phone || branch.email) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, wordBreak: 'break-all' }}>
                      {[branch.phone, branch.email].filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                  {branch.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                    >
                      {branch.description}
                    </Typography>
                  )}
                  <Divider sx={{ mb: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      title="Залы"
                      onClick={() => handleOpenHallsDialog(branch)}
                    >
                      <MeetingRoom />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="primary"
                      title="Редактировать"
                      onClick={() => handleEditBranch(branch)}
                    >
                      <Edit />
                    </IconButton>
                    {!isSeniorOnly && (
                    <IconButton
                      size="small"
                      color="error"
                      title="Удалить"
                      onClick={() => handleDeleteBranch(branch.id)}
                    >
                      <Delete />
                    </IconButton>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      ) : (
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Адрес</TableCell>
                  <TableCell>Старший тренер</TableCell>
                  <TableCell>Телефон</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Описание</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        Филиалы не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell>{branch.name}</TableCell>
                      <TableCell>{branch.address}</TableCell>
                      <TableCell>{seniorTrainerLabel(branch)}</TableCell>
                      <TableCell>{branch.phone || '-'}</TableCell>
                      <TableCell>{branch.email || '-'}</TableCell>
                      <TableCell>
                        {branch.description ? (
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {branch.description}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={branch.isActive ? 'Активен' : 'Неактивен'}
                          color={branch.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Залы"
                          onClick={() => handleOpenHallsDialog(branch)}
                        >
                          <MeetingRoom />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Редактировать"
                          onClick={() => handleEditBranch(branch)}
                        >
                          <Edit />
                        </IconButton>
                        {!isSeniorOnly && (
                        <IconButton 
                          size="small" 
                          color="error" 
                          title="Удалить"
                          onClick={() => handleDeleteBranch(branch.id)}
                        >
                          <Delete />
                        </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      )}

      {/* Диалог добавления филиала */}
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
        data-onboarding="branch-form-dialog"
      >
        <DialogTitle>Добавить новый филиал</DialogTitle>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название филиала"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                error={!!formErrors.name}
                helperText={formErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Адрес"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                required
                multiline
                rows={2}
                error={!!formErrors.address}
                helperText={formErrors.address}
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
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="branch@example.com"
                error={!!formErrors.email}
                helperText={formErrors.email}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
            {canAssignSenior && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="create-senior-trainer-label">Старший тренер</InputLabel>
                  <Select
                    labelId="create-senior-trainer-label"
                    label="Старший тренер"
                    value={formData.seniorTrainerId}
                    onChange={(e) => handleInputChange('seniorTrainerId', String(e.target.value))}
                  >
                    <MenuItem value="">
                      <em>Не назначен</em>
                    </MenuItem>
                    {trainers.map((t: Trainer) => (
                      <MenuItem key={t.id} value={t.id}>
                        {[t.user?.lastName, t.user?.firstName].filter(Boolean).join(' ') || t.user?.email || t.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={discardCreateForm}>Отмена</Button>
          <Button 
            onClick={handleCreateBranch} 
            variant="contained"
            disabled={!formData.name || !formData.address}
          >
            Создать филиал
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования филиала */}
      <Dialog 
        open={editDialog} 
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            editUnsaved.requestClose(reason);
          }
        }}
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>Редактировать филиал</DialogTitle>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название филиала"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                error={!!formErrors.name}
                helperText={formErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Адрес"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                required
                multiline
                rows={2}
                error={!!formErrors.address}
                helperText={formErrors.address}
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
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="branch@example.com"
                error={!!formErrors.email}
                helperText={formErrors.email}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
              />
            </Grid>
            {canAssignSenior && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="edit-senior-trainer-label">Старший тренер</InputLabel>
                  <Select
                    labelId="edit-senior-trainer-label"
                    label="Старший тренер"
                    value={formData.seniorTrainerId}
                    onChange={(e) => handleInputChange('seniorTrainerId', String(e.target.value))}
                  >
                    <MenuItem value="">
                      <em>Не назначен</em>
                    </MenuItem>
                    {trainers.map((t: Trainer) => (
                      <MenuItem key={t.id} value={t.id}>
                        {[t.user?.lastName, t.user?.firstName].filter(Boolean).join(' ') || t.user?.email || t.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={discardEditForm}>Отмена</Button>
          <Button 
            onClick={handleUpdateBranch} 
            variant="contained"
            disabled={!formData.name || !formData.address}
          >
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог управления залами */}
      <Dialog 
        open={hallsDialog} 
        onClose={() => {
          setHallsDialog(false);
          setSelectedBranch(null);
          setHalls([]);
          setError('');
        }}
        maxWidth="md" 
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>
          Залы филиала: {selectedBranch?.name}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Список залов</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setEditingHall(null);
                const initial = { ...EMPTY_HALL_FORM };
                setHallFormData(initial);
                setHallFormBaseline(initial);
                setHallFormErrors({});
                setHallDialog(true);
              }}
            >
              Добавить зал
            </Button>
          </Box>
          {loadingHalls ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : halls.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              Залы не найдены. Добавьте первый зал.
            </Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Описание</TableCell>
                    <TableCell>Вместимость</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {halls.map((hall) => (
                    <TableRow key={hall.id}>
                      <TableCell>{hall.name}</TableCell>
                      <TableCell>{hall.description || '-'}</TableCell>
                      <TableCell>{hall.capacity || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={hall.isActive ? 'Активен' : 'Неактивен'}
                          color={hall.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          color="primary" 
                          title="Редактировать"
                          onClick={() => handleEditHall(hall)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          title="Удалить"
                          onClick={() => handleDeleteHall(hall.id)}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setHallsDialog(false);
            setSelectedBranch(null);
            setHalls([]);
            setError('');
          }}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания/редактирования зала */}
      <Dialog 
        open={hallDialog} 
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            hallUnsaved.requestClose(reason);
          }
        }}
        maxWidth="sm" 
        fullWidth
        fullScreen={isNarrow}
      >
        <DialogTitle>
          {editingHall ? 'Редактировать зал' : 'Добавить зал'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {Object.keys(hallFormErrors).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Пожалуйста, исправьте ошибки в форме
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название зала"
                value={hallFormData.name}
                onChange={(e) => {
                  setHallFormData(prev => ({ ...prev, name: e.target.value }));
                  if (hallFormErrors.name) {
                    setHallFormErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.name;
                      return newErrors;
                    });
                  }
                }}
                required
                error={!!hallFormErrors.name}
                helperText={hallFormErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={hallFormData.description}
                onChange={(e) => setHallFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Вместимость (человек)"
                type="number"
                value={hallFormData.capacity}
                onChange={(e) => setHallFormData(prev => ({ ...prev, capacity: e.target.value }))}
                inputProps={{ min: 1 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={discardHallForm}>Отмена</Button>
          <Button 
            onClick={editingHall ? handleUpdateHall : handleCreateHall}
            variant="contained"
            disabled={!hallFormData.name.trim()}
          >
            {editingHall ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      <UnsavedChangesDialog
        open={createUnsaved.confirmOpen}
        saving={createUnsaved.saving}
        onSave={createUnsaved.save}
        onDiscard={createUnsaved.discard}
        onStay={createUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={editUnsaved.confirmOpen}
        saving={editUnsaved.saving}
        onSave={editUnsaved.save}
        onDiscard={editUnsaved.discard}
        onStay={editUnsaved.stay}
      />
      <UnsavedChangesDialog
        open={hallUnsaved.confirmOpen}
        saving={hallUnsaved.saving}
        onSave={hallUnsaved.save}
        onDiscard={hallUnsaved.discard}
        onStay={hallUnsaved.stay}
      />
    </Box>
  );
};

export default Branches;
