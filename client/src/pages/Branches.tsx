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
} from '@mui/material';
import { Add, Edit, Delete, MeetingRoom } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Branch, Hall } from '../types';

const Branches: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const [branches, setBranches] = useState<Branch[]>([]);
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
  const [hallFormData, setHallFormData] = useState({
    name: '',
    description: '',
    capacity: '',
  });
  const [hallFormErrors, setHallFormErrors] = useState<Record<string, string>>({});
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
  });

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

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const handleCreateBranch = async () => {
    // Validate form
    const errors = validateBranchForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }

    try {
      await apiService.createBranch(formData);
      await fetchBranches();
      setOpenDialog(false);
      setFormErrors({});
      setError('');
      setFormData({
        name: '',
        address: '',
        phone: '',
        email: '',
        description: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания филиала');
      console.error('Error creating branch:', err);
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
    setFormData({
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      description: branch.description || '',
    });
    setEditDialog(true);
  };

  const handleUpdateBranch = async () => {
    if (!editingBranch) return;
    
    // Validate form
    const errors = validateBranchForm(formData);
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }
    
    try {
      await apiService.updateBranch(editingBranch.id, formData);
      await fetchBranches();
      setEditDialog(false);
      setEditingBranch(null);
      setFormErrors({});
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления филиала');
      console.error('Error updating branch:', err);
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

  const handleCreateHall = async () => {
    if (!selectedBranch) return;

    const errors: Record<string, string> = {};
    if (!hallFormData.name.trim()) {
      errors.name = 'Название зала обязательно';
    }

    setHallFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }

    try {
      await apiService.createHall({
        ...hallFormData,
        branchId: selectedBranch.id,
        capacity: hallFormData.capacity ? parseInt(hallFormData.capacity) : undefined,
      });
      await fetchHalls(selectedBranch.id);
      setHallDialog(false);
      setHallFormData({ name: '', description: '', capacity: '' });
      setHallFormErrors({});
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания зала');
      console.error('Error creating hall:', err);
    }
  };

  const handleEditHall = (hall: Hall) => {
    setEditingHall(hall);
    setHallFormData({
      name: hall.name || '',
      description: hall.description || '',
      capacity: hall.capacity?.toString() || '',
    });
    setHallFormErrors({});
    setHallDialog(true);
  };

  const handleUpdateHall = async () => {
    if (!editingHall || !selectedBranch) return;

    const errors: Record<string, string> = {};
    if (!hallFormData.name.trim()) {
      errors.name = 'Название зала обязательно';
    }

    setHallFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }

    try {
      await apiService.updateHall(editingHall.id, {
        ...hallFormData,
        capacity: hallFormData.capacity ? parseInt(hallFormData.capacity) : undefined,
      });
      await fetchHalls(selectedBranch.id);
      setHallDialog(false);
      setEditingHall(null);
      setHallFormData({ name: '', description: '', capacity: '' });
      setHallFormErrors({});
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка обновления зала');
      console.error('Error updating hall:', err);
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
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
          onClick={() => {
            setOpenDialog(true);
            setFormErrors({});
            setError('');
          }}
          data-onboarding="add-branch-button"
        >
          Добавить филиал
        </Button>
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
                    <IconButton
                      size="small"
                      color="error"
                      title="Удалить"
                      onClick={() => handleDeleteBranch(branch.id)}
                    >
                      <Delete />
                    </IconButton>
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
                    <TableCell colSpan={7} align="center">
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
                        <IconButton 
                          size="small" 
                          color="error" 
                          title="Удалить"
                          onClick={() => handleDeleteBranch(branch.id)}
                        >
                          <Delete />
                        </IconButton>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            // Разрешаем закрытие только если нет ошибок
            if (Object.keys(formErrors).length === 0 && !error) {
              setEditDialog(false);
              setEditingBranch(null);
              setFormErrors({});
              setError('');
            }
          }}>Отмена</Button>
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
                setHallFormData({ name: '', description: '', capacity: '' });
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
        onClose={() => {
          setHallDialog(false);
          setEditingHall(null);
          setHallFormData({ name: '', description: '', capacity: '' });
          setHallFormErrors({});
          setError('');
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
          <Button onClick={() => {
            setHallDialog(false);
            setEditingHall(null);
            setHallFormData({ name: '', description: '', capacity: '' });
            setHallFormErrors({});
            setError('');
          }}>Отмена</Button>
          <Button 
            onClick={editingHall ? handleUpdateHall : handleCreateHall}
            variant="contained"
            disabled={!hallFormData.name.trim()}
          >
            {editingHall ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Branches;
