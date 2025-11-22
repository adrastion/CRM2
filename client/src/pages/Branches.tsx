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
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { apiService } from '../services/api';
import { Branch } from '../types';

const Branches: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Филиалы
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
          Добавить филиал
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
    </Box>
  );
};

export default Branches;
